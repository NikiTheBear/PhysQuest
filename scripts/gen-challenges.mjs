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
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { CATALOG, RIGID_KINDS, LINK_KINDS } from '../platform/shared/catalog.js';
import { HANDWRITTEN_LABS } from './handwritten-labs.mjs';

/* 误区库：按 challengedBy 反查，给挑战挂上 misconceptionIds。
   两张来源都读（光学在 optics-lens/ 下，其余在 misconceptions.json）。 */
const MISCONCEPTION_BY_CHALLENGE = new Map();
for (const path of ['optics-lens/misconceptions.json', 'misconceptions.json']) {
  let list = [];
  try {
    list = JSON.parse(
      await readFile(new URL(`../shared/knowledge-data/${path}`, import.meta.url), 'utf8'),
    ).misconceptions ?? [];
  } catch {
    continue;
  }
  for (const m of list) {
    if (!m.challengedBy) continue;
    if (!MISCONCEPTION_BY_CHALLENGE.has(m.challengedBy)) MISCONCEPTION_BY_CHALLENGE.set(m.challengedBy, []);
    MISCONCEPTION_BY_CHALLENGE.get(m.challengedBy).push(m.id);
  }
}
const misconceptionsFor = (id) => MISCONCEPTION_BY_CHALLENGE.get(id) ?? [];

const PROMPTS = JSON.parse(
  await readFile(new URL('../shared/knowledge-data/knowledge-prompts.json', import.meta.url), 'utf8'),
);

const DOMAIN_TO_LAB = {
  力学: 'mechanics',
  电磁: 'circuits',
  光学: 'optics-lens',
  // 声学已独立成模块（2026-11 起），不再并进力学
  声学: 'acoustics',
};

/**
 * 已经被「手写关」覆盖的知识点 —— 不再生成自动挑战，避免同一件事出两关。
 *
 * 光学 5 关在 shared/knowledge-data/optics-lens/challenges.json；
 * 声学 5 关在本文件下面的 WAVE 数组里。
 */
const COVERED_BY_HANDWRITTEN = {
  'optics-lens': [
    'K-O2-04', 'K-O2-06', 'K-O2-07', 'K-O2-08',
    'K-O2-09', 'K-O2-10', 'K-O2-11', 'K-O2-13', 'K-O2-15',
  ],
  // 声学：WAVE 手写 5 关覆盖了这两条，不再派生自动关
  acoustics: ['K-M3-14', 'K-M3-15', 'K-M3-16', 'K-M4-05', 'K-M4-06'],
};

/* 手写实验（scripts/handwritten-labs.mjs）也要占位：
   同一个知识点不能再被自动生成一遍，否则会出现两关同一件事。 */
for (const lab of HANDWRITTEN_LABS) {
  (COVERED_BY_HANDWRITTEN[lab.labId] ||= []).push(lab.knowledgeId);
}

/** 每个知识点生成 1 个挑战；能真算的才生成 */
const challenges = [];
const experiments = [];

/* 一个知识点一个挑战。
   不硬凑「4 个不相关的知识点合成一关」——那样做出来的挑战没有意义。 */

const groups = new Map(); // key -> prompts[]

for (const p of PROMPTS) {
  // 声学虽标 approximation，但平台真有扬声器和麦克风，能做
  const allowed = p.support === 'direct' || p.domainLabel === '声学';
  if (!allowed) continue;
  const domain = p.domainLabel;
  // 只做有对应实验台的领域
  if (!DOMAIN_TO_LAB[domain]) continue;

  const key = `${domain}|${p.stage}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(p);
}

/** 每个挑战的 id 由知识点 id 派生：CH-K-M2-05 ↔ 知识点 K-M2-05。
 *  这样加删知识点时挑战编号不会漂移，外部链接永远有效。 */
const idOf = (knowledgeId) => `CH-${knowledgeId}`;

/** 按器具的实际尺寸摆位，避免透镜重叠、地面套住别的器具。 */
function placeAt(kind, idx, total) {
  if (kind === 'floor_slab') return [0, -0.08, 0]; // 地面永远在原点下方
  if (kind === 'lens_bench') return [0, 1, 0]; // 光具座永远居中
  const spacing = kind === 'lens' || kind === 'diverging_lens' ? 4 : 2.2;
  return [(idx - (total - 1) / 2) * spacing, 1, 0];
}

/** 生成一个部件的完整定义：中文名 + 默认参数填满 + 合理位置。
 *  refs 与 challengeScene 的自动补全保持一致，文件离开工作台也能单独载入。 */
function buildComponent(kind, idx, total) {
  const def = CATALOG[kind];
  const refs = {};
  if (def?.refs) {
    const targets = ['a', 'b', 'target'];
    for (const key of targets) if (def.refs.includes(key)) refs[key] = '';
  }
  return {
    id: `${kind}-${idx + 1}`,
    kind,
    name: def?.name ?? kind,
    position: placeAt(kind, idx, total),
    params: Object.fromEntries(
      Object.entries(def?.params ?? {}).map(([k, v]) => [k, v.value]),
    ),
    refs,
    fixed: kind === 'floor_slab' || kind === 'lens_bench',
  };
}

/** 按领域设定环境：力学有重力有碰撞，其余关闭。 */
const ENV = {
  力学: { gravity: 9.8, damping: 0, speed: 1, collisions: true },
  电磁: { gravity: 0, damping: 0, speed: 1, collisions: false },
  光学: { gravity: 0, damping: 0, speed: 1, collisions: false },
  声学: { gravity: 0, damping: 0, speed: 1, collisions: false },
};

/** 填好 refs：弹簧/绳/杆连到支点与刚体，传感器/力源指向刚体。
 *  与 challengeScene 的自动补全一致，但写进文件，保证单独导入也能用。 */
function wireRefs(comps) {
  const rigid = comps.find((c) => RIGID_KINDS.includes(c.kind));
  if (!rigid) return;
  const anchor = comps.find((c) => c.kind === 'anchor');
  const rigids = comps.filter((c) => RIGID_KINDS.includes(c.kind));
  for (const c of comps) {
    const def = CATALOG[c.kind];
    if (def?.refs?.includes('target')) c.refs.target = rigid.id;
    if (anchor && LINK_KINDS.includes(c.kind)) {
      c.refs.a = anchor.id;
      c.refs.b = rigid.id;
    }
    if (c.kind === 'distance_sensor' && rigids.length >= 2) {
      c.refs.a = rigids[0].id;
      c.refs.b = rigids[1].id;
    }
  }
}

for (const [key, list] of groups) {
  const [domain, stage] = key.split('|');
  const labId = DOMAIN_TO_LAB[domain];

  // 一个知识点一个挑战
  for (const first of list) {
    if ((COVERED_BY_HANDWRITTEN[labId] ?? []).includes(first.id)) continue;
    const chunk = [first];
    const id = idOf(first.id);
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
      misconceptionIds: misconceptionsFor(id),
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

    const comps = models.slice(0, 6).map((kind, idx, all) => buildComponent(kind, idx, all.length));
    wireRefs(comps);

    experiments.push({
      format: 'physquest.experiment',
      version: 1,
      metadata: {
        title,
        description: brief,
        source: { project: 'PhysQuest', license: 'MIT', challengeId: id, auto: true },
      },
      experiment: {
        id: `exp-${id.toLowerCase()}`,
        title,
        goal: brief,
        observation:
          `先按搭建方案把器具摆好，然后只改「${vars[0] ?? '一个变量'}」，观察：` +
          `${first.observations.join('；')}。`,
        mode: '2d',
        environment: ENV[domain] ?? { gravity: 0, damping: 0, speed: 1, collisions: false },
        components: comps,
        connections: [],
        control: { running: false, reset: 0 },
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
    misconceptionIds: misconceptionsFor(`CH-${w.id}`),
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

  const comps = w.models.map((kind, idx) => buildComponent(kind, idx, w.models.length));
  wireRefs(comps);

  experiments.push({
    format: 'physquest.experiment',
    version: 1,
    metadata: {
      title: w.title,
      description: w.brief,
      source: { project: 'PhysQuest', license: 'MIT', challengeId: `CH-${w.id}`, auto: true },
    },
    experiment: {
      id: `exp-${w.id.toLowerCase()}`,
      title: w.title,
      goal: w.brief,
      observation:
        `先按搭建方案把器具摆好，然后只改「${w.variables[0] ?? '一个变量'}」，观察：` +
        `${w.observations.join('；')}。`,
      mode: '2d',
      environment: { gravity: 0, damping: 0, speed: 1, collisions: false },
      components: comps,
      connections: [],
      control: { running: false, reset: 0 },
      learning: {
        variables: w.variables,
        steps: w.observations,
        limitations: w.limitations,
      },
    },
  });
}

/* ============================================================
 * 手写实验（第 2 件任务的 b 小步）
 *
 * 数据在 scripts/handwritten-labs.mjs：每条都有完整器具、连线、观察指引。
 * tier='real' 是真读数，tier='concept' 是概念示意（只做标注布局）。
 * 这个区分既要跟进卡片，也要跟学生交代。
 * ========================================================== */
function handComponent(spec) {
  const def = CATALOG[spec.kind];
  const params = Object.fromEntries(
    Object.entries(def?.params ?? {}).map(([k, v]) => [k, v.value]),
  );
  Object.assign(params, spec.params ?? {});
  return {
    id: spec.id,
    kind: spec.kind,
    name: spec.name ?? def.name,
    position: spec.pos ?? [0, 1, 0],
    params,
    refs: spec.refs ?? {},
    fixed: spec.fixed ?? false,
  };
}

for (const lab of HANDWRITTEN_LABS) {
  const src = PROMPTS.find((p) => p.id === lab.knowledgeId);
  const components = lab.components.map(handComponent);
  const concept = lab.tier === 'concept';

  challenges.push({
    id: lab.id,
    labId: lab.labId,
    title: lab.title,
    brief: lab.brief,
    hint: lab.hint,
    // 两类都用「观察式」判定：自动生成的关卡一律不限具体数值
    winCondition: { metric: 'm', op: '<', value: 0 },
    auto: true,
    multiAnswer: true,
    knowledgeIds: [lab.knowledgeId],
    misconceptionIds: misconceptionsFor(lab.id),
    demoScriptId: '',
    difficulty: lab.difficulty,
    prediction: lab.prediction,
    build: {
      models: [...new Set(components.map((c) => c.kind))],
      variables: lab.learning.variables,
      observations: lab.learning.steps,
      construction: lab.observation,
      prompt: src?.prompt ?? '',
      stage: src?.stage ?? 'senior',
      domain: src?.domainLabel ?? '',
    },
  });

  experiments.push({
    format: 'physquest.experiment',
    version: 1,
    metadata: {
      title: lab.title,
      description: lab.brief,
      source: {
        project: 'PhysQuest',
        license: 'MIT',
        challengeId: lab.id,
        auto: true,
        handwritten: true,
        tier: lab.tier,
      },
    },
    experiment: {
      id: `exp-${lab.id.toLowerCase()}`,
      title: lab.title,
      goal: `${lab.brief}${concept ? '（概念示意：器具只做标注，读数不参与结论）' : ''}`,
      observation: lab.observation,
      mode: '2d',
      environment: lab.env,
      components,
      connections: lab.connections.map((l) => ({ gain: 1, ...l })),
      control: { running: false, reset: 0 },
      learning: lab.learning,
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

const experimentsDir = new URL('../platform/experiments/', import.meta.url);
for (const exp of experiments) {
  const cid = exp.metadata.source.challengeId;
  await writeFile(new URL(`${cid}.pqexp.json`, experimentsDir), JSON.stringify(exp, null, 2) + '\n');
}

// 清理旧的自动生成文件（旧编号 CH-AUTO-xxx 已废弃，避免孤儿文件留在实验目录）
const stale = (await readdir(experimentsDir)).filter(
  (name) => name.endsWith('.pqexp.json') && /^CH-AUTO-\d/.test(name),
);
for (const name of stale) await rm(new URL(name, experimentsDir), { force: true });
if (stale.length) console.log(`清理 ${stale.length} 个旧编号实验文件`);

console.log(`共生成 ${challenges.length} 个挑战、${experiments.length} 个实验文件`);
