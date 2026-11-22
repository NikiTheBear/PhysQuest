import {
  STAGE_LABEL,
  type LearnerState,
  type LockedRun,
  type PredictionRecord,
  type Reflection,
  type Stage,
} from './contracts';

const KEY = 'physquest.learner.v1';

const empty = (): LearnerState => ({
  stage: 'junior',
  completed: {},
  runs: [],
  predictions: {},
  reflections: {},
  misconceptions: {},
});

export function loadLearner(): LearnerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<LearnerState>;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

export function saveLearner(s: LearnerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 隐私模式下写不进去，静默忽略 */
  }
}

export function pushRun(s: LearnerState, run: LockedRun): LearnerState {
  const next: LearnerState = {
    ...s,
    runs: [...s.runs, run].slice(-200),
    completed: { ...s.completed, [run.challengeId]: true },
  };
  saveLearner(next);
  return next;
}

export function setPrediction(
  s: LearnerState,
  challengeId: string,
  chosenIndex: number,
): LearnerState {
  const next: LearnerState = {
    ...s,
    predictions: {
      ...s.predictions,
      [challengeId]: { challengeId, chosenIndex, lockedAt: Date.now() },
    },
  };
  saveLearner(next);
  return next;
}

export function setReflection(s: LearnerState, challengeId: string, text: string): LearnerState {
  const next: LearnerState = {
    ...s,
    reflections: {
      ...s.reflections,
      [challengeId]: { text, updatedAt: Date.now() },
    },
  };
  saveLearner(next);
  return next;
}

export function hitMisconception(s: LearnerState, id: string): LearnerState {
  const next: LearnerState = {
    ...s,
    misconceptions: { ...s.misconceptions, [id]: (s.misconceptions[id] ?? 0) + 1 },
  };
  saveLearner(next);
  return next;
}

export function setStage(s: LearnerState, stage: Stage): LearnerState {
  const next = { ...s, stage };
  saveLearner(next);
  return next;
}

export function weakMisconceptions(s: LearnerState, minHits = 1): string[] {
  return Object.entries(s.misconceptions)
    .filter(([, n]) => n >= minHits)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}


/* ============================================================
 * 导出 / 导入
 * ========================================================== */

/** 导出文件的格式标记。导入时按这个字段认人 */
export const LEARNER_FORMAT = 'physquest.learner';

/** 当前的导出格式版本。改格式就 +1，并在 parseLearnerExport 里加迁移 */
export const LEARNER_VERSION = 1;

/** 和 pushRun 保持一致：本地最多留 200 条参数记录 */
const MAX_RUNS = 200;

/** 导出/导入时的一句话小结，直接拿去显示 toast */
export interface LearnerImportSummary {
  /** 真的有新增的参数记录条数 */
  addedRuns: number;
  /** 和本地重复（challengeId + lockedAt 一样）而被跳过的条数 */
  duplicateRuns: number;
  addedPredictions: number;
  addedCompleted: number;
  addedReflections: number;
  /** 本地已有、但内容不同、被导入版本覆盖的反思条数 */
  overwrittenReflections: number;
  /** 上面那些被覆盖的反思分别是哪个挑战的（界面用来说清「具体哪几条」） */
  overwrittenReflectionIds: string[];
  addedMisconceptions: number;
}

/** 预演结果：合并后的记录 + 小结。不写 localStorage */
export interface LearnerImportPreview {
  learner: LearnerState;
  summary: LearnerImportSummary;
}

/**
 * 把学习记录打包成可下载的 JSON（含版本号和时间戳）
 *
 * 刻意不在里面放任何和学习记录无关的东西（AI Key、主题、侧栏宽度都在别的 key 里），
 * 这样导出文件可以放心发给老师看。
 */
export function exportLearner(learner: LearnerState): string {
  return JSON.stringify(
    {
      format: LEARNER_FORMAT,
      version: LEARNER_VERSION,
      exportedAt: new Date().toISOString(),
      learner,
    },
    null,
    2,
  );
}

/* ---------- 下面这一小段只服务于校验 ---------- */

function bad(msg: string): never {
  throw new Error(msg);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 说人话地把「读到的是什么」写出来，方便报错时告诉学生 */
function describe(v: unknown): string {
  if (v === undefined) return '（缺失）';
  if (v === null) return 'null';
  if (Array.isArray(v)) return '一个数组';
  if (typeof v === 'string') return `字符串「${v.length > 24 ? `${v.slice(0, 24)}…` : v}」`;
  if (typeof v === 'number') return `数字 ${v}`;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return '一个对象';
  return typeof v;
}

/** 导入是外部数据，__proto__ 之类的键一律丢掉，别让它污染对象原型 */
const UNSAFE_KEY = new Set(['__proto__', 'constructor', 'prototype']);

function readString(o: Record<string, unknown>, key: string, at: string): string {
  const v = o[key];
  if (typeof v !== 'string') bad(`${at}的「${key}」应该是字符串，实际是${describe(v)}。`);
  return v as string;
}

function readNum(o: Record<string, unknown>, key: string, at: string): number {
  const v = o[key];
  if (!isNum(v)) bad(`${at}的「${key}」应该是数字，实际是${describe(v)}。`);
  return v as number;
}

function readBool(o: Record<string, unknown>, key: string, at: string): boolean {
  const v = o[key];
  if (typeof v !== 'boolean') bad(`${at}的「${key}」应该是 true 或 false，实际是${describe(v)}。`);
  return v as boolean;
}

const SHAPES = ['arrow', 'F', 'candle'] as const;

function readRun(raw: unknown, index: number): LockedRun {
  const at = `第 ${index + 1} 条参数记录`;
  if (!isPlainObject(raw)) bad(`${at}应该是一个对象，实际是${describe(raw)}。`);
  const r = raw as Record<string, unknown>;

  const params = r.params;
  if (!isPlainObject(params)) bad(`${at}缺 params（那次的实验参数），实际是${describe(params)}。`);
  const p = params as Record<string, unknown>;
  const shape = p.objectShape;
  if (!SHAPES.includes(shape as (typeof SHAPES)[number])) {
    bad(`${at}的参数 objectShape 只能是 arrow / F / candle，实际是${describe(shape)}。`);
  }

  const metrics = r.metrics;
  if (!isPlainObject(metrics)) bad(`${at}缺 metrics（那次的实验结果），实际是${describe(metrics)}。`);
  const m = metrics as Record<string, unknown>;

  const prediction = r.prediction;
  if (prediction !== null && !isPlainObject(prediction)) {
    bad(`${at}的 prediction 要么是 null，要么是一个对象，实际是${describe(prediction)}。`);
  }
  const pred = prediction ? (prediction as Record<string, unknown>) : null;

  return {
    challengeId: readString(r, 'challengeId', at),
    params: {
      u: readNum(p, 'u', `${at}的 params`),
      f: readNum(p, 'f', `${at}的 params`),
      h: readNum(p, 'h', `${at}的 params`),
      screenX: readNum(p, 'screenX', `${at}的 params`),
      maskTop: readBool(p, 'maskTop', `${at}的 params`),
      lensDiameter: readNum(p, 'lensDiameter', `${at}的 params`),
      objectShape: shape as (typeof SHAPES)[number],
    },
    metrics: {
      v: readNum(m, 'v', `${at}的 metrics`),
      m: readNum(m, 'm', `${at}的 metrics`),
      real: readBool(m, 'real', `${at}的 metrics`),
      imageHeight: readNum(m, 'imageHeight', `${at}的 metrics`),
      screenHasImage: readBool(m, 'screenHasImage', `${at}的 metrics`),
      blurDiameter: readNum(m, 'blurDiameter', `${at}的 metrics`),
      description: readString(m, 'description', `${at}的 metrics`),
    },
    prediction: pred
      ? {
          challengeId: readString(pred, 'challengeId', `${at}的 prediction`),
          chosenIndex: readNum(pred, 'chosenIndex', `${at}的 prediction`),
          lockedAt: readNum(pred, 'lockedAt', `${at}的 prediction`),
        }
      : null,
    lockedAt: readNum(r, 'lockedAt', at),
  };
}

function readPrediction(raw: unknown, key: string): PredictionRecord {
  const at = `predictions 里的「${key}」`;
  if (!isPlainObject(raw)) bad(`${at}应该是一个对象，实际是${describe(raw)}。`);
  const r = raw as Record<string, unknown>;
  const chosenIndex = readNum(r, 'chosenIndex', at);
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0) {
    bad(`${at}的 chosenIndex 应该是 0 或更大的整数，实际是 ${chosenIndex}。`);
  }
  return {
    // 键就是挑战 id；文件里的 challengeId 写歪了也以键为准，合并时才不会串
    challengeId: key,
    chosenIndex,
    lockedAt: readNum(r, 'lockedAt', at),
  };
}

function readReflection(raw: unknown, key: string): Reflection {
  const at = `reflections 里的「${key}」`;
  if (!isPlainObject(raw)) bad(`${at}应该是一个对象（{ text, updatedAt }），实际是${describe(raw)}。`);
  const r = raw as Record<string, unknown>;
  const text = readString(r, 'text', at);
  return { text, updatedAt: readNum(r, 'updatedAt', at) };
}

/**
 * 校验一份导出文件，通过就返回里面干净的 LearnerState。任何不对都抛 Error，消息是给学生看的。
 *
 * 顺手做的事：只挑认识的字段重建对象（丢未知字段、丢 __proto__ 这类危险键），
 * 所以后面合并时拿到的数据形状一定是可信的。
 */
function parseLearnerExport(fileText: string): LearnerState {
  if (typeof fileText !== 'string' || fileText.trim() === '') {
    bad('文件是空的，什么都没读到。是不是选错文件了？');
  }

  let root: unknown;
  try {
    root = JSON.parse(fileText);
  } catch (e) {
    const why = e instanceof Error ? e.message : '解析失败';
    bad(`这个文件不是合法的 JSON（${why}）。多半不是 PhysQuest 导出的记录。`);
  }

  if (!isPlainObject(root)) bad(`文件最外层应该是一个对象，实际是${describe(root)}。`);
  const doc = root as Record<string, unknown>;

  if (doc.format !== LEARNER_FORMAT) {
    bad(
      `这不是 PhysQuest 的学习记录文件：format 应该是「${LEARNER_FORMAT}」，实际是${describe(doc.format)}。`,
    );
  }
  if (!isNum(doc.version) || !Number.isInteger(doc.version)) {
    bad(`文件里的 version 应该是一个整数，实际是${describe(doc.version)}。`);
  }
  if (doc.version !== LEARNER_VERSION) {
    bad(
      `文件版本是 ${doc.version}，这个版本的 PhysQuest 只认得 ${LEARNER_VERSION}。如果是新版导出的，先把 PhysQuest 升级到同一版再来。`,
    );
  }

  const learner = doc.learner;
  if (!isPlainObject(learner)) {
    bad(`文件里没有 learner 这一段（学习记录本体），实际是${describe(learner)}。`);
  }
  const raw = learner as Record<string, unknown>;

  const required = ['stage', 'completed', 'runs', 'predictions', 'reflections', 'misconceptions'];
  const missing = required.filter((k) => !(k in raw));
  if (missing.length > 0) {
    bad(`学习记录里缺字段：${missing.map((k) => `「${k}」`).join('、')}，文件可能被改过或者没导全。`);
  }

  const stage = raw.stage;
  if (typeof stage !== 'string' || !Object.prototype.hasOwnProperty.call(STAGE_LABEL, stage)) {
    bad(
      `stage 只能是 ${Object.keys(STAGE_LABEL).join(' / ')} 之一，实际是${describe(stage)}。`,
    );
  }

  if (!Array.isArray(raw.runs)) bad(`runs 应该是一个数组，实际是${describe(raw.runs)}。`);
  const runs = (raw.runs as unknown[]).map((r, i) => readRun(r, i));

  if (!isPlainObject(raw.completed)) {
    bad(`completed 应该是一个对象（挑战 id → true/false），实际是${describe(raw.completed)}。`);
  }
  const completed: Record<string, boolean> = {};
  Object.entries(raw.completed as Record<string, unknown>).forEach(([k, v]) => {
    if (UNSAFE_KEY.has(k)) return;
    if (typeof v !== 'boolean') {
      bad(`completed 里的「${k}」应该是 true 或 false，实际是${describe(v)}。`);
    }
    completed[k] = v;
  });

  if (!isPlainObject(raw.predictions)) {
    bad(`predictions 应该是一个对象，实际是${describe(raw.predictions)}。`);
  }
  const predictions: Record<string, PredictionRecord> = {};
  Object.entries(raw.predictions as Record<string, unknown>).forEach(([k, v]) => {
    if (UNSAFE_KEY.has(k)) return;
    predictions[k] = readPrediction(v, k);
  });

  if (!isPlainObject(raw.reflections)) {
    bad(`reflections 应该是一个对象，实际是${describe(raw.reflections)}。`);
  }
  const reflections: Record<string, Reflection> = {};
  Object.entries(raw.reflections as Record<string, unknown>).forEach(([k, v]) => {
    if (UNSAFE_KEY.has(k)) return;
    reflections[k] = readReflection(v, k);
  });

  if (!isPlainObject(raw.misconceptions)) {
    bad(`misconceptions 应该是一个对象（误区 id → 命中次数），实际是${describe(raw.misconceptions)}。`);
  }
  const misconceptions: Record<string, number> = {};
  Object.entries(raw.misconceptions as Record<string, unknown>).forEach(([k, v]) => {
    if (UNSAFE_KEY.has(k)) return;
    if (!isNum(v) || v < 0) {
      bad(`misconceptions 里的「${k}」应该是 0 或更大的数字（命中次数），实际是${describe(v)}。`);
    }
    misconceptions[k] = v;
  });

  return { stage: stage as Stage, completed, runs, predictions, reflections, misconceptions };
}

/* ---------- 合并策略 ---------- */

/**
 * 合并策略：取并集 + 时间去重，而不是整份覆盖。
 *
 * 理由：学习记录是「学生做过的事」，两台电脑各做过一截是常态。
 * 整份覆盖等于把本地那半年的努力删了，学生一定骂人。
 *
 * 逐项的规矩：
 *   runs          按「challengeId + lockedAt」认同一次锁定。重复的留本地那条（本地那条带着当时的
 *                 prediction，信息更全），新增的追加进去，最后按 lockedAt 升序，仍然只留 200 条。
 *   predictions   按 challengeId 合并。本地已有就保留本地的 —— 预测是先猜后做，本地的才是这台电脑上
 *                 真按过的选择，跑完再被覆盖会让「预测 vs 实际」对不上。
 *   completed     取并集，任一为 true 就是 true（做过就是做过）。
 *   reflections   两边都有且正文不同 → 用导入的。学生专门把文件导过来，说明想用这一份；
 *                 这条也正好是最该提醒用户「会被覆盖」的，所以单独计数。
 *   misconceptions 按 id 取两者的最大值，不求和 —— 同一份文件导两次不该把命中次数翻倍。
 *   stage         保留本地的（学段是这台电脑上的临时偏好，不是学习记录）；
 *                 但本地一条记录都没有时（新电脑第一次导入）用导入的，不然会把学生学段弄回默认值。
 */
export function mergeLearner(current: LearnerState, incoming: LearnerState): LearnerImportPreview {
  const summary: LearnerImportSummary = {
    addedRuns: 0,
    duplicateRuns: 0,
    addedPredictions: 0,
    addedCompleted: 0,
    addedReflections: 0,
    overwrittenReflections: 0,
    overwrittenReflectionIds: [],
    addedMisconceptions: 0,
  };

  // runs：同一次锁定 = 同一个挑战 + 同一个时间戳
  const seen = new Set(current.runs.map((r) => `${r.challengeId}@${r.lockedAt}`));
  const runs = [...current.runs];
  incoming.runs.forEach((r) => {
    const key = `${r.challengeId}@${r.lockedAt}`;
    if (seen.has(key)) {
      summary.duplicateRuns += 1;
      return;
    }
    seen.add(key);
    runs.push(r);
    summary.addedRuns += 1;
  });
  runs.sort((a, b) => a.lockedAt - b.lockedAt);

  const predictions = { ...current.predictions };
  Object.entries(incoming.predictions).forEach(([k, v]) => {
    if (predictions[k]) return; // 重复：保留本地的
    predictions[k] = v;
    summary.addedPredictions += 1;
  });

  const completed = { ...current.completed };
  Object.entries(incoming.completed).forEach(([k, v]) => {
    if (v && !completed[k]) summary.addedCompleted += 1;
    completed[k] = completed[k] || v;
  });

  const reflections = { ...current.reflections };
  Object.entries(incoming.reflections).forEach(([k, v]) => {
    const mine = reflections[k];
    if (!mine) {
      reflections[k] = v;
      summary.addedReflections += 1;
      return;
    }
    if (mine.text !== v.text) {
      // 内容不同：学生主动导入说明想用那份
      reflections[k] = v;
      summary.overwrittenReflections += 1;
      summary.overwrittenReflectionIds.push(k);
    }
  });

  const misconceptions = { ...current.misconceptions };
  Object.entries(incoming.misconceptions).forEach(([k, v]) => {
    const mine = misconceptions[k];
    if (mine === undefined) {
      misconceptions[k] = v;
      summary.addedMisconceptions += 1;
    } else {
      misconceptions[k] = Math.max(mine, v);
    }
  });

  return {
    learner: {
      // 本地完全空白时（新电脑首次导入）没有「本地偏好」可言，用文件里的学段
      stage: isEmptyLearner(current) ? incoming.stage : current.stage,
      completed,
      runs: runs.slice(-MAX_RUNS),
      predictions,
      reflections,
      misconceptions,
    },
    summary,
  };
}

/** 一条学习记录都没有？用来判断「这是不是一台新电脑」 */
function isEmptyLearner(s: LearnerState): boolean {
  return (
    s.runs.length === 0 &&
    Object.keys(s.completed).length === 0 &&
    Object.keys(s.predictions).length === 0 &&
    Object.keys(s.reflections).length === 0 &&
    Object.keys(s.misconceptions).length === 0
  );
}

/**
 * 先算一遍「导进来会变成什么样」，不写 localStorage，也不改当前记录。
 * 界面用它在真正导入前问一句「有 M 条会被覆盖，确定吗？」
 */
export function previewImport(fileText: string, current: LearnerState): LearnerImportPreview {
  return mergeLearner(current, parseLearnerExport(fileText));
}

/**
 * 校验并读入一个导出文件。返回合并后的记录，或抛错说清哪里不对。
 * 与 pushRun / setReflection 一致：返回新记录的同时已经写进 localStorage。
 *
 * 合并规则见 mergeLearner 上面的注释。
 */
export function importLearner(fileText: string, current: LearnerState): LearnerState {
  const { learner } = previewImport(fileText, current);
  saveLearner(learner);
  return learner;
}

/** 把小结拼成一句人话，给 toast 用 */
export function describeImport(s: LearnerImportSummary): string {
  const added: string[] = [];
  if (s.addedRuns) added.push(`${s.addedRuns} 条参数记录`);
  if (s.addedPredictions) added.push(`${s.addedPredictions} 个预测`);
  if (s.addedCompleted) added.push(`${s.addedCompleted} 个已完成挑战`);
  if (s.addedReflections) added.push(`${s.addedReflections} 条反思`);
  if (s.addedMisconceptions) added.push(`${s.addedMisconceptions} 个误区`);

  // 「覆盖了几条反思」是学生最在意的，放前面说
  const overwritten = s.overwrittenReflections
    ? `覆盖了 ${s.overwrittenReflections} 条反思`
    : '';
  const duplicates = s.duplicateRuns ? `跳过 ${s.duplicateRuns} 条重复记录` : '';
  const tail = [overwritten, duplicates].filter(Boolean).join('，');

  if (added.length === 0) {
    const head =
      s.overwrittenReflections > 0
        ? '导入完成：没有新记录'
        : '导入完成：没有新内容（这些记录本地都已经有了）';
    return tail ? `${head}，${tail}。` : `${head}。`;
  }

  return `导入完成：新增 ${added.join('、')}${tail ? `，${tail}` : ''}。`;
}


/* ============================================================
 * 重置
 * ========================================================== */


/** 所有本项目的 localStorage key 前缀 */
const PREFIX = 'physquest.';

/** 清掉所有 physquest.* 开头的 key，除了 keep 名单里的 */
function clearAll(keep: string[] = []) {
  try {
    const victims: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && !keep.includes(k)) victims.push(k);
    }
    victims.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * 只清学习进度
 *
 * 清掉：参数记录 / 预测 / 已完成 / 错题 / 自由搭建记录 / 引导标记 / 提示词草稿
 * 保留：主题、AI 设置（端点、模型、Key）、侧栏宽度、用量统计
 */
export function resetProgress(): LearnerState {
  clearAll([
    'physquest.ai.v1',
    'physquest.ai.width.v1',
    'physquest.theme.v1',
    'physquest.usage.v1',
  ]);
  const fresh = empty();
  saveLearner(fresh);
  return fresh;
}

/** 清掉所有本地数据（包括 AI Key），回到第一次打开的状态 */
export function resetEverything(): LearnerState {
  clearAll();
  return empty();
}
