/**
 * 从知识点的搭建提示词，批量生成「挑战 + 实验文件」
 *
 * 思路：
 *   队友的 140 条提示词里，每条都写清了 models（要用哪些器具）、variables（能调什么）、
 *   observations（看什么）、objective（目标是什么）。
 *   这些字段足够自动生成一个「有目标、有挑战、能搭出来」的关卡。
 *
 * 产出：
 *   shared/knowledge-data/labs/<domain>-challenges.json   挑战定义
 *   platform/experiments/<id>.pqexp.json                  实验文件（工作台能导入）
 *
 * 用法：node scripts/gen-challenges.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const PROMPTS = JSON.parse(
  await readFile(new URL('../shared/knowledge-data/knowledge-prompts.json', import.meta.url), 'utf8'),
);

const DOMAIN_TO_LAB = {
  力学: 'mechanics',
  电磁: 'circuits',
  光学: 'optics-lens',
  // 声学并入力学：平台只有 2 种声学器具，撑不起独立模块
  声学: 'mechanics',
};

/** 每个知识点生成 1 个挑战；能真算的才生成 */
const challenges = [];
const experiments = [];

/* 一个知识点一个挑战。
   不硬凑「4 个不相关的知识点合成一关」——那样做出来的挑战没有意义。 */

const groups = new Map(); // key -> prompts[]

for (const p of PROMPTS) {
  // 声学的两条虽标 approximation，但平台真有扬声器和麦克风，能做
  const allowed = p.support === 'direct' || p.domainLabel === '声学';
  if (!allowed) continue;
  const domain = p.domainLabel;
  // 只做有对应实验台的领域
  if (!DOMAIN_TO_LAB[domain]) continue;

  const key = `${domain}|${p.stage}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(p);
}

let seq = 0;
for (const [key, list] of groups) {
  const [domain, stage] = key.split('|');
  const labId = DOMAIN_TO_LAB[domain];

  // 一个知识点一个挑战
  for (const first of list) {
    const chunk = [first];
    seq += 1;
    const id = `CH-AUTO-${String(seq).padStart(3, '0')}`;
    const title = first.title;
    const brief = first.objective;
    const models = [...new Set(first.models)];
    const vars = first.variables.slice(0, 6);

    challenges.push({
      id,
      labId,
      title,
      brief,
      hint: first.construction,
      // 自动生成的关卡用「观察式」判定：不限具体数值，交给工作台读数
      winCondition: { metric: 'm', op: '<', value: 0 },
      auto: true,
      multiAnswer: true,
      knowledgeIds: chunk.map((c) => c.id),
      misconceptionIds: [],
      demoScriptId: '',
      difficulty: 'beginner',
      prediction: {
        prompt: brief,
        options: ['做出来会和我预期的一样', '不完全一样，需要调整', '完全不一样'],
        answerIndex: 1,
      },
      /** 给工作台用的搭建方案 */
      build: {
        models,
        variables: vars,
        observations: first.observations,
        construction: first.construction,
        prompt: first.prompt,
        stage,
        domain,
      },
    });

    experiments.push({
      metadata: {
        title,
        description: brief,
        source: { project: 'PhysQuest', license: 'MIT', challengeId: id, auto: true },
      },
      experiment: {
        id: `exp-${id.toLowerCase()}`,
        title,
        goal: brief,
        mode: '2d',
        environment: { gravity: 9.8, damping: 0, speed: 1, collisions: true },
        components: models.slice(0, 6).map((kind, idx) => ({
          id: `${kind}-${idx + 1}`,
          kind,
          name: kind,
          position: [idx * 2 - 2, 1, 0],
          params: {},
          refs: {},
          fixed: false,
        })),
        connections: [],
        control: { running: false },
        learning: {
          variables: vars,
          steps: first.observations,
          limitations: first.limitations,
        },
      },
    });
  }
}

/* ============================================================
 * 声波专项：平台有 speaker / microphone / directional_speaker，
 * 虽然提示词把 K-M3-15/16 标成 approximation，但这两条真的能搭、能听、能测。
 * 所以单独补两个挑战，挂到力学模块下。
 * ========================================================== */
const WAVE = [
  {
    knowledgeId: 'K-M3-15',
    title: '看见声波的传播',
    brief: '一个点声源、一个麦克风。改变频率和距离，看声压怎么变。',
    hint: '把麦克风移到不同距离，观察声压随距离怎么衰减。',
    models: ['speaker', 'microphone'],
    variables: ['频率', '声压幅值', '麦克风距离'],
    observations: ['声压随时间的变化', '不同距离下的幅值'],
    construction: '放一个点声源和一支测量麦克风，把麦克风沿轴向移动，记录声压。',
    prompt:
      '用 Fieldlab 搭一个声波传播实验：放一个点声源（speaker）和一支测量麦克风（microphone），把麦克风放在离声源 1 m、2 m、4 m 三个位置，分别读取声压，观察随距离的衰减。',
  },
  {
    knowledgeId: 'K-M3-16',
    title: '两列声波叠在一起会怎样',
    brief: '两个点声源对着放，改变它们的频率差和位置，看麦克风读到的声压怎么变。',
    hint: '两个同频率的源在空间里会形成固定的强弱分布——这就是干涉。',
    models: ['speaker', 'speaker', 'microphone'],
    variables: ['两个声源的频率', '源间距', '麦克风位置'],
    observations: ['不同位置的声压强弱', '移动麦克风时的起伏'],
    construction:
      '放两个同频率的点声源，间隔一定距离，用麦克风沿着它们连线的垂线移动，记录声压的强弱起伏。',
    prompt:
      '用 Fieldlab 搭一个声波干涉实验：放两个同频率的点声源（间距 1 m），用测量麦克风沿垂直于连线方向移动，记录声压随位置的变化，找出加强区和减弱区。',
  },
];

for (const w of WAVE) {
  seq += 1;
  const id = `CH-AUTO-${String(seq).padStart(3, '0')}`;
  challenges.push({
    id,
    labId: 'mechanics',
    title: w.title,
    brief: w.brief,
    hint: w.hint,
    winCondition: { metric: 'm', op: '<', value: 0 },
    auto: true,
    multiAnswer: true,
    knowledgeIds: [w.knowledgeId],
    misconceptionIds: [],
    demoScriptId: '',
    difficulty: 'advanced',
    prediction: {
      prompt: w.brief,
      options: ['会和我预期的一样', '会有出乎意料的分布', '完全看不出来'],
      answerIndex: 1,
    },
    build: {
      models: w.models,
      variables: w.variables,
      observations: w.observations,
      construction: w.construction,
      prompt: w.prompt,
      stage: 'senior',
      domain: 'acoustics',
    },
  });

  experiments.push({
    metadata: {
      title: w.title,
      description: w.brief,
      source: { project: 'PhysQuest', license: 'MIT', challengeId: id, auto: true },
    },
    experiment: {
      id: `exp-${id.toLowerCase()}`,
      title: w.title,
      goal: w.brief,
      mode: '2d',
      environment: { gravity: 0, damping: 0, speed: 1, collisions: false },
      components: w.models.map((kind, idx) => ({
        id: `${kind}-${idx + 1}`,
        kind,
        name: kind,
        position: [idx * 2 - 1, 1, 0],
        params: {},
        refs: {},
        fixed: false,
      })),
      connections: [],
      control: { running: false },
      learning: { variables: w.variables, steps: w.observations, limitations: '声波用线性声场叠加，不含反射与吸收。' },
    },
  });
}

await mkdir(new URL('../shared/knowledge-data/labs', import.meta.url), { recursive: true });
await mkdir(new URL('../platform/experiments', import.meta.url), { recursive: true });

const byLab = {};
for (const c of challenges) {
  (byLab[c.labId] ||= []).push(c);
}

for (const [labId, list] of Object.entries(byLab)) {
  await writeFile(
    new URL(`../shared/knowledge-data/labs/${labId}-challenges.json`, import.meta.url),
    JSON.stringify({ labId, auto: true, challenges: list }, null, 2) + '\n',
  );
  console.log(`${labId}: ${list.length} 个挑战`);
}

for (const exp of experiments) {
  const cid = exp.metadata.source.challengeId;
  await writeFile(
    new URL(`../platform/experiments/${cid}.pqexp.json`, import.meta.url),
    JSON.stringify(exp, null, 2) + '\n',
  );
}

console.log(`共生成 ${challenges.length} 个挑战、${experiments.length} 个实验文件`);
