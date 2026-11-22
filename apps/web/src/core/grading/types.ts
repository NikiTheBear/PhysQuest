/**
 * AI 实验评分 · 类型与常量
 *
 * 和 core/contracts.ts 一个规矩：**只有类型和常量，没有逻辑**。
 * 设计说明见 local/AI-GRADING-SPEC.md §2.2 / §1.6。
 *
 * 三条铁律在类型上的体现：
 *  1. GradeInput 里没有任何写存储的句柄（没有 setState / saveLearner）；
 *  2. 四个维度的 score 全部来自本地计算，AI 只能给结论维度一个档位；
 *  3. AI 的输出白名单里没有 rewrite / suggested / example。
 */

import type { LensParams, Stage } from '../contracts';

/* ============================================================
 * 1. 维度与档位
 * ========================================================== */

export type DimensionKey = 'assembly' | 'observation' | 'variables' | 'conclusion';

export const DIMENSION_KEYS: DimensionKey[] = [
  'assembly',
  'observation',
  'variables',
  'conclusion',
];

/** 权重。改权重不改结构 —— 改结构要重新讨论（§1.1） */
export const W: Record<DimensionKey, number> = {
  assembly: 0.3,
  observation: 0.3,
  variables: 0.25,
  conclusion: 0.15,
};

export const DIM_LABEL: Record<DimensionKey, string> = {
  assembly: '实验搭得对不对',
  observation: '观测项选得对不对',
  variables: '变量控制',
  conclusion: '结论站不站得住',
};

/** 单维度显示的档位 */
export type Band = 'top' | 'ok' | 'weak' | 'zero' | 'insufficient' | 'engine_error';

export const BAND_LABEL: Record<Band, string> = {
  top: '满档',
  ok: '合格',
  weak: '勉强',
  zero: '零',
  insufficient: '无法判断',
  engine_error: '引擎报错',
};

/** 结论维度的四档（只由 AI 判，本地做硬校验） */
export type ConclusionBand = 'excellent' | 'solid' | 'shaky' | 'wrong';

export const CONCLUSION_SCORE: Record<ConclusionBand, number> = {
  excellent: 100,
  solid: 80,
  shaky: 55,
  wrong: 0,
};

export const CONCLUSION_BAND_LABEL: Record<ConclusionBand, string> = {
  excellent: '优秀',
  solid: '扎实',
  shaky: '含糊',
  wrong: '站不住',
};

/** 总分档 */
export type Level = 'excellent' | 'good' | 'pass' | 'improve' | 'not_graded';

export const LEVEL_LABEL: Record<Level, string> = {
  excellent: '优秀',
  good: '良好',
  pass: '合格',
  improve: '待改进',
  not_graded: '未评分',
};

/** 通过线：总分 ≥60 **并且** D1 ≥50（§1.6） */
export const PASS_LINE = 60;
export const ASSEMBLY_FLOOR = 50;

export function PASS(total: number | null, d1: number | null): boolean {
  if (total === null) return false;
  return total >= PASS_LINE && (d1 === null || d1 >= ASSEMBLY_FLOOR);
}

/* ============================================================
 * 2. 证据
 * ========================================================== */

/** 一次「学生做过的事」的最小快照。来源只有两个：freeRuns 或 LockedRun。 */
export interface RunFact {
  /** R1 / R2 … 提示词里用的编号 */
  id: string;
  /** 证据出处，渲染时用来「点一下跳回那次记录」 */
  source: 'capture' | 'locked';
  /** 快照的 time（capture，仿真秒）或 lockedAt（locked，时间戳） */
  at: number;
  /** 器具种类（D1 用） */
  kinds: string[];
  componentCount: number;
  /** 参数快照，D3 逐对比对用。键是组件 id */
  params: Record<string, Record<string, number | boolean | string>>;
  /** 环境参数（重力等），有就带上 */
  env?: Record<string, number>;
  /** 引擎读数，键是 channels 的原键（含 `<id>:` 前缀） */
  channels: Record<string, ChannelReading>;
  /** 电路等求解器报错 */
  engineError: string | null;
  /** 本次焦距（光具座专有，方便评语直接引用）。拿不全就只填拿到的字段 */
  lens?: Partial<Pick<LensParams, 'u' | 'f' | 'h' | 'screenX' | 'maskTop' | 'lensDiameter'>>;
  /** 从 channels 里抽出来的扁平指标，已按后缀归一 */
  metrics: {
    v?: number;
    /** 可能是 Infinity → null（缺口 5） */
    m?: number | null;
    real?: boolean;
    imageHeight?: number | null;
    blurDiameter?: number;
    screenHasImage?: boolean;
    relativeIlluminance?: number;
    description?: string;
  };
}

export interface ChannelReading {
  label: string;
  value: number;
  unit: string;
  valid?: boolean;
}

/** 对照表 T 的一行。verdict 由本地算，AI 不许改 */
export interface CheckRow {
  /** T1 / T2 … */
  id: string;
  claim: string;
  verdict: 'yes' | 'no' | 'unknown';
}

/** 变化表 V 的一行 */
export interface ChangeRow {
  /** V1 / V2 … */
  id: string;
  /** R1 */
  from: string;
  /** R2 */
  to: string;
  /** 真正改了自变量 */
  changed: string[];
  /** 改了但豁免（光屏、内阻……），已换成中文短名 */
  exempt: string[];
  /** changed.length > 1 */
  dirty: boolean;
  /**
   * 给人看的一句话，例如「u 30→25，screenX 15→16.6（光屏，豁免）」。
   * 只用于渲染（提示词的变化表、UI 证据表），不参与任何判定。
   */
  summary?: string;
}

/* ============================================================
 * 3. rubric 与输入
 * ========================================================== */

export interface Rubric {
  challengeId: string;
  requiredKinds: string[];
  /** 通道后缀（m / v / imageHeight …） */
  requiredObservations: string[];
  optionalObservations: string[];
  /** 无法映射到通道的原话，只进评语不进分母 */
  unmappableObservations: string[];
}

export interface GradingInput {
  version: 1;
  stage: Stage;
  challenge: {
    id: string;
    title: string;
    brief: string;
    labId: string;
    knowledgeIds: string[];
    requiredKinds: string[];
    requiredObservations: string[];
    optionalObservations: string[];
    unmappableObservations: string[];
    /** winCondition 的原文，用于让评语引用目标 */
    winText: string;
    goalMet: 'yes' | 'no' | 'unknown';
  };
  /** 最多 8 条，和 buildReport 的 slice(-8) 对齐 */
  facts: RunFact[];
  checks: CheckRow[];
  changes: ChangeRow[];
  scores: {
    assembly: { score: number; facts: string[]; fromFactId: string | null };
    observation: { score: number | null; hits: string[]; bonus: string[]; reason?: 'insufficient' };
    variables: {
      score: number | null;
      clean: number;
      dirty: number;
      reason?: 'insufficient';
    };
  };
  reflection: { text: string; chars: number; updatedAt?: number };
  /** 学生自报（或工作台 focus 自动采集）看过的通道后缀 */
  seenObservations: string[];
}

/** 文档 §2.3 里叫 GradingInput，这里给一个同义别名，UI 层读着更顺 */
export type GradeInput = GradingInput;

/* ============================================================
 * 4. AI 输出（白名单）
 * ========================================================== */

export type ClaimVerdict = 'agree' | 'contradict' | 'unrelated';

export interface Claim {
  /** 反思原句（AI 必须逐字引用） */
  quote: string;
  /** T1 / T2 … */
  checkId: string;
  verdict: ClaimVerdict;
  note: string;
}

export interface AiDimension {
  text: string;
  refs: string[];
}

export interface AiGrade {
  version: 1;
  challengeId: string;
  dimensions: Record<DimensionKey, AiDimension>;
  claims: Claim[];
  conclusionBand: ConclusionBand;
  summary: string;
}

/* ============================================================
 * 5. 结果
 * ========================================================== */

export interface GradeDimension {
  key: DimensionKey;
  score: number | null;
  band: Band;
  comment: string;
  /** ['R1','T2'] */
  refs: string[];
  /** 这一句评语是谁写的。'template' 时 UI 上显示小字「本段由规则生成」（§3.6） */
  by: 'ai' | 'template';
}

export type RefuseCode =
  | 'NO_EVIDENCE'
  | 'NO_RUN'
  | 'NO_REFLECTION'
  | 'ENGINE_ERROR'
  | 'NO_AI'
  | 'AI_INVALID'
  | 'NO_RUBRIC';

export const REFUSE_MESSAGE: Record<RefuseCode, string> = {
  NO_EVIDENCE: '还没有任何记录',
  NO_RUN: '记录里实验台是空的，引擎没有算出任何读数',
  NO_REFLECTION: '反思还没写到 10 个字',
  ENGINE_ERROR: '引擎拒绝计算，本次不评分',
  NO_AI: 'AI 评语不可用，以下是规则判定',
  AI_INVALID: 'AI 这次没按格式返回，已换成规则判定',
  NO_RUBRIC: '这一关还没有评分标准，只评器具和变量控制',
};

/** 证据表：给 UI 的 <details> 用，也让 refs 可以点 */
export interface GradeEvidence {
  facts: RunFact[];
  changes: ChangeRow[];
  checks: CheckRow[];
}

export interface GradeResult {
  version: 1;
  challengeId: string;
  total: number | null;
  level: Level;
  passed: boolean;
  dimensions: GradeDimension[];
  claims: Claim[];
  summary: string;
  /** 谁写的评语。template = 至少一条评语来自本地模板 */
  by: 'ai' | 'template';
  /** 拒绝 / 降级时非空，见 §4 */
  refused: { code: RefuseCode; message: string } | null;
  /** 本地算出来的证据表（AI 从不参与） */
  evidence: GradeEvidence;
  at: number;
}

/* ============================================================
 * 6. 存储
 * ========================================================== */

/** 评分结果单独一个 key，**不**写回 LearnerState.runs / reflections */
export const GRADE_KEY = 'physquest.grade.v1';

/** 最多缓存多少个挑战的评分 */
export const GRADE_CACHE_MAX = 20;
