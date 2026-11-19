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
 * 声与波：5 关（自己写的，不依赖提示词）
 *
 * 平台的声学器具只有点声源 / 指向性声源 / 测量麦克风，
 * 但配合「运动传感器」「距离」等通用器具，足够做出这 5 关。
 * 每一关都能真的拖参数、真的读出不同数字。
 * ========================================================== */
const WAVE = [
  {
    id: 'AC-01',
    knowledgeId: 'K-M3-15',
    title: '同样的声源，走远一倍会小多少',
    brief: '一个点声源、一支麦克风。把麦克风从 1 m 挪到 2 m、4 m，看声压怎么变。',
    hint: '不是线性变小——距离翻倍，声压降到大约一半。',
    models: ['speaker', 'microphone'],
    variables: ['麦克风距离', '声源频率', '参考声压'],
    observations: ['1 m / 2 m / 4 m 处的声压读数'],
    construction:
      '放一个点声源（默认 120 Hz、0.5 Pa）和一支测量麦克风，把麦克风依次放在 1 m、2 m、4 m，每次读一次声压。',
    limitations: '球面波在自由空间中的衰减；不含反射与吸收。',
    limitationMismatch: false,
    prompt:
      '在 Fieldlab 里搭一个声波传播实验：放点声源 speaker 和测量麦克风 microphone，把麦克风分别放在距声源 1 m、2 m、4 m 的位置，读取三处的声压值，观察随距离的衰减规律。',
  },
  {
    id: 'AC-02',
    knowledgeId: 'K-M3-15',
    title: '频率变高，波形会变成什么样',
    brief: '保持麦克风位置不动，只改声源频率，看声压随时间怎么变。',
    hint: '频率越高，单位时间内起伏的次数越多——但振幅不一定变。',
    models: ['speaker', 'microphone'],
    variables: ['频率（20–2000 Hz）'],
    observations: ['声压–时间曲线的疏密'],
    construction:
      '放一个点声源和一支固定在 1 m 处的麦克风，把声源频率从 120 Hz 调到 1000 Hz，观察声压曲线的疏密变化。',
    limitations: '纯音模型；实际声源有谐波。',
    prompt:
      '在 Fieldlab 里搭一个频率对比实验：点声源 speaker + 固定距离的麦克风 microphone，分别设置 120 Hz、500 Hz、1000 Hz，画出声压随时间的变化曲线，比较疏密。',
  },
  {
    id: 'AC-03',
    knowledgeId: 'K-M3-16',
    title: '两列声波叠在一起',
    brief: '两个同频率的点声源，麦克风沿中间移动，找哪里最响、哪里最静。',
    hint: '同频同相的源，会在空间里留下固定的强弱带。',
    models: ['speaker', 'speaker', 'microphone'],
    variables: ['两个声源的间距', '麦克风横向位置', '频率'],
    observations: ['横向移动时的声压起伏', '最强点与最弱点'],
    construction:
      '放两个同频率（120 Hz）的点声源，间距 1 m，用麦克风沿它们连线的中垂线移动，记录声压随横向位置的变化。',
    limitations: '两源相干、同相位；不含多径反射。',
    prompt:
      '在 Fieldlab 里搭一个声波干涉实验：两个同频率同相位的点声源 speaker（间距 1 m），一支测量麦克风 microphone 沿中垂线移动 0–3 m，记录声压随位置的变化，找出加强区和减弱区。',
  },
  {
    id: 'AC-04',
    knowledgeId: 'K-M3-16',
    title: '让干涉条纹变密',
    brief: '间距不变，只改频率，看强弱条纹的分布怎么变。',
    hint: '频率越高、波长越短，条纹越密。',
    models: ['speaker', 'speaker', 'microphone'],
    variables: ['频率', '源间距'],
    observations: ['同一段距离里出现几个强弱周期'],
    construction:
      '保持两源间距 1 m，把频率从 120 Hz 调到 500 Hz，观察同样长度里条纹数量怎么变。',
    limitations: '同一关的线性叠加模型，波长 = 声速 / 频率。',
    prompt:
      '在 Fieldlab 里做频率对干涉条纹的影响：两个点声源间距固定 1 m，频率分别取 120 Hz 和 500 Hz，用麦克风沿中垂线扫一遍，比较两种情况下的条纹疏密。',
  },
  {
    id: 'AC-05',
    knowledgeId: 'K-M3-16',
    title: '把声源换成有指向性的',
    brief: '把点声源换成指向性声源，转到它背后，看看声压会怎样。',
    hint: '指向性声源背后几乎没有声压贡献。',
    models: ['directional_speaker', 'microphone'],
    variables: ['麦克风绕声源的角度', '频率'],
    observations: ['正面 / 侧面 / 背面三个方向的声压'],
    construction:
      '放一个指向性声源，把麦克风放在距它 1 m 的正前方、正侧方、正后方，各读一次声压。',
    limitations: '前向余弦指向性；不含绕射。',
    prompt:
      '在 Fieldlab 里搭一个指向性对比实验：directional_speaker 指向性声源 + 1 m 处的麦克风 microphone，分别放在正前方 0°、侧面 90°、背面 180°，读三处声压，说明指向性的含义。',
  },
];

for (const w of WAVE) {
  challenges.push({
    id: `CH-${w.id}`,
    labId: 'acoustics',
    title: w.title,
    brief: w.brief,
    hint: w.hint,
    winCondition: { metric: 'm', op: '<', value: 0 },
    auto: true,
    multiAnswer: true,
    knowledgeIds: [w.knowledgeId],
    misconceptionIds: [],
    demoScriptId: '',
    difficulty: 'beginner',
    prediction: {
      prompt: w.brief,
      options: ['会和我预期的一样', '会有出乎意料的规律', '看不出明显变化'],
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
      limitations: w.limitations,
    },
  });

  experiments.push({
    metadata: {
      title: w.title,
      description: w.brief,
      source: { project: 'PhysQuest', license: 'MIT', challengeId: `CH-${w.id}`, auto: true },
    },
    experiment: {
      id: `exp-${w.id.toLowerCase()}`,
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
      learning: {
        variables: w.variables,
        steps: w.observations,
        limitations: w.limitations,
      },
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
