/**
 * 评分主入口
 *
 * 流程（文档 §6 第 3 步）：
 *   本地算分 →（有需要才）调 AI → 合并 → GradeResult
 *
 * 三条降级路径都必须优雅：
 *   1. 没配 Key / 连不上 → D1–D3 照常，D4 用模板 + 保守档位，`refused: NO_AI`
 *   2. AI 格式不对 → 同上，`refused: AI_INVALID`
 *   3. 反思太短 → D4 不评（不是 0 分），其余三维照常
 *
 * 永远不做的事：不写回 LearnerState、不锁任何东西、不给 0 分当「不知道」。
 */

import { isConfigured, type AIConfig } from '../../ai/client';
import type { CaptureSnapshot } from '../../components/free-build/ImmersiveLab';
import type { LearnerState, Stage } from '../contracts';
import { gradeWithAI, templateComments, type AiGradeDeps, type AiGradeOutcome } from './ai-grade';
import { buildGradingInput, type ChallengeRef } from './build-input';
import {
  assemblyBand,
  fallbackRefs,
  observationBand,
  observationComment,
  variablesBand,
  variablesComment,
} from './compute';
import { loadRubric } from './rubric';
import { levelOf, passedOf, total as totalOf } from './rules';
import {
  CONCLUSION_SCORE,
  DIMENSION_KEYS,
  REFUSE_MESSAGE,
  type Band,
  type ConclusionBand,
  type DimensionKey,
  type GradeDimension,
  type GradeResult,
  type GradingInput,
  type RefuseCode,
  type Rubric,
} from './types';

/** 反思门槛，和 ReportView.tsx 的 ≥10 字保持同一个数 */
export const REFLECTION_MIN_CHARS = 10;

/* ============================================================
 * 1. 纯合并：GradingInput +（可选）AI 结果 → GradeResult
 * ========================================================== */

export interface MergeArgs {
  input: GradingInput;
  rubric: Rubric | null;
  /** AI 结果；null 表示没跑 / 跑失败 */
  ai: AiGradeOutcome | null;
  /** AI 没跑成功的原因 */
  aiRefused: RefuseCode | null;
  /** 整体拒绝（NO_EVIDENCE / NO_RUN / ENGINE_ERROR）时用 */
  hardRefuse?: RefuseCode | null;
  /** AI 到底配了没有。区分「没配」和「配了但连不上」，D4 的文案不一样 */
  aiConfigured?: boolean;
  now?: number;
}

/** 哪一维的评语来自 AI，哪一维退回模板 */
type Source = Record<DimensionKey, 'ai' | 'template'>;

export function mergeGrade(args: MergeArgs): GradeResult {
  const { input, rubric, ai, aiRefused } = args;
  const now = args.now ?? Date.now();
  const template = templateComments(input);

  /* —— 整体拒绝：这一关什么都评不了，total 必须是 null（不给 0 分） —— */
  if (args.hardRefuse) {
    return {
      version: 1,
      challengeId: input.challenge.id,
      total: null,
      level: 'not_graded',
      passed: false,
      dimensions: [],
      claims: [],
      summary: REFUSE_MESSAGE[args.hardRefuse],
      by: 'template',
      refused: { code: args.hardRefuse, message: REFUSE_MESSAGE[args.hardRefuse] },
      evidence: { facts: input.facts, changes: input.changes, checks: input.checks },
      at: now,
    };
  }

  const source: Source = {
    assembly: 'template',
    observation: 'template',
    variables: 'template',
    conclusion: 'template',
  };

  const dims: GradeDimension[] = [];
  const refusedCodes: RefuseCode[] = [];
  // 这一关没有评分标准：D2 已经是 insufficient，这里补一条码说清为什么
  if (!rubric) refusedCodes.push('NO_RUBRIC');
  if (aiRefused) refusedCodes.push(aiRefused);

  /* ---------- D1 组装 ---------- */
  {
    const score = input.scores.assembly.score;
    const aiText = ai?.ai?.dimensions.assembly;
    const useAi = Boolean(aiText);
    if (useAi) source.assembly = 'ai';
    dims.push({
      key: 'assembly',
      score,
      band: assemblyBand(score),
      comment: useAi ? aiText!.text : template.assembly,
      refs: pickRefs(useAi ? aiText!.refs : [], input, fallbackRefs('assembly', input, input.scores)),
      by: useAi ? 'ai' : 'template',
    });
  }

  /* ---------- D2 观测 ---------- */
  {
    const score = input.scores.observation.score;
    const aiText = ai?.ai?.dimensions.observation;
    // 数据不足时**不采用** AI 写的观测评语：它没有数据，只能编
    const useAi = Boolean(aiText) && score !== null;
    if (useAi) source.observation = 'ai';
    dims.push({
      key: 'observation',
      score,
      band: observationBand(score),
      comment: useAi ? aiText!.text : observationComment(input, input.scores),
      refs: pickRefs(
        useAi ? aiText!.refs : [],
        input,
        fallbackRefs('observation', input, input.scores),
      ),
      by: useAi ? 'ai' : 'template',
    });
  }

  /* ---------- D3 变量 ---------- */
  {
    const score = input.scores.variables.score;
    const aiText = ai?.ai?.dimensions.variables;
    const useAi = Boolean(aiText) && score !== null;
    if (useAi) source.variables = 'ai';
    dims.push({
      key: 'variables',
      score,
      band: variablesBand(score),
      comment: useAi ? aiText!.text : variablesComment(input, input.scores),
      refs: pickRefs(useAi ? aiText!.refs : [], input, fallbackRefs('variables', input, input.scores)),
      by: useAi ? 'ai' : 'template',
    });
  }

  /* ---------- D4 结论 ---------- */
  {
    const hasReflection = input.reflection.chars >= REFLECTION_MIN_CHARS;
    if (!hasReflection) {
      // 没写 ≠ 写错。不显示 0 分，显示「无法判断」。
      refusedCodes.push('NO_REFLECTION');
      dims.push({
        key: 'conclusion',
        score: null,
        band: 'insufficient',
        comment: `反思还没写够（现在 ${input.reflection.chars} 字，至少要 ${REFLECTION_MIN_CHARS} 字）。写完可以再评一次结论。`,
        refs: [],
        by: 'template',
      });
    } else {
      const band: ConclusionBand = ai?.band ?? 'shaky';
      const aiText = ai?.ai?.dimensions.conclusion;
      const useAi = Boolean(aiText);
      if (useAi) source.conclusion = 'ai';
      dims.push({
        key: 'conclusion',
        score: CONCLUSION_SCORE[band],
        band: conclusionDisplayBand(band),
        comment: useAi
          ? aiText!.text
          : ai
            ? template.conclusion
            : noAiComment(aiRefused, args.aiConfigured),
        refs: pickRefs(useAi ? aiText!.refs : [], input, fallbackRefs('conclusion', input, input.scores)),
        by: useAi ? 'ai' : 'template',
      });
    }
  }

  /* ---------- 总分 ---------- */
  const t = totalOf(dims.map((d) => ({ key: d.key, score: d.score })));
  const d1 = dims.find((d) => d.key === 'assembly')?.score ?? null;
  const level = levelOf(t);
  const passed = passedOf(t, d1);

  /* ---------- 拒绝码：只保留最该说的一条 ---------- */
  const refused = pickRefuse(refusedCodes);

  // by 的意思是「这份结果的评语有没有 AI 参与」。有一条退回模板，
  // 那一行就会带 by:'template'，UI 在旁边写小字（§3.6）。
  const anyAi = DIMENSION_KEYS.some((k) => source[k] === 'ai');
  const by: 'ai' | 'template' = anyAi ? 'ai' : 'template';

  return {
    version: 1,
    challengeId: input.challenge.id,
    total: t,
    level,
    passed,
    dimensions: dims,
    claims: ai?.ai?.claims ?? [],
    summary: buildSummary({ input, t, passed, ai, rubric }),
    by,
    refused: refused ? { code: refused, message: REFUSE_MESSAGE[refused] } : null,
    evidence: { facts: input.facts, changes: input.changes, checks: input.checks },
    at: now,
  };
}

/**
 * AI 不可用时的结论评语。
 *
 * 分两种说清楚 —— 学生要知道「这是我的问题还是系统的问题」（§4 NO_AI 的界面文案）：
 * 没配 Key / 连不上 → 让他去配；配了但格式不对 → 说明不是他的问题。
 */
function noAiComment(code: RefuseCode | null, configured: boolean | undefined): string {
  if (code === 'AI_INVALID') {
    return 'AI 这次没按格式返回，已换成规则判定。这一项先按保守档位「含糊」计，稍后可以再评一次。';
  }
  if (configured) {
    return '这次连不上 AI（本地启动器没在跑或网络不通），这一项先按保守档位「含糊」计。';
  }
  // 文档要求逐字出现这句：没配 Key 时 D4 只说明「需要配置 AI」
  return '需要配置 AI 才能评价你的反思。没配置时这一项先按保守档位「含糊」计，配置后重评就能看到针对你写的那句话的核对。';
}

function conclusionDisplayBand(band: ConclusionBand): Band {
  if (band === 'excellent' || band === 'solid') return 'top';
  if (band === 'shaky') return 'weak';
  return 'zero';
}

function pickRefs(aiRefs: string[], input: GradingInput, fallback: string[]): string[] {
  const allowed = new Set<string>([
    ...input.facts.map((f) => f.id),
    ...input.changes.map((c) => c.id),
    ...input.checks.map((c) => c.id),
  ]);
  const good = (Array.isArray(aiRefs) ? aiRefs : []).filter((r) => allowed.has(r)).slice(0, 4);
  const fb = fallback.filter((r) => allowed.has(r));
  return good.length > 0 ? good : fb;
}

const REFUSE_PRIORITY: RefuseCode[] = [
  'ENGINE_ERROR',
  'NO_EVIDENCE',
  'NO_RUN',
  'NO_REFLECTION',
  'NO_RUBRIC',
  'AI_INVALID',
  'NO_AI',
];

function pickRefuse(codes: RefuseCode[]): RefuseCode | null {
  for (const c of REFUSE_PRIORITY) if (codes.includes(c)) return c;
  return null;
}

function buildSummary(a: {
  input: GradingInput;
  t: number | null;
  passed: boolean;
  ai: AiGradeOutcome | null;
  rubric: Rubric | null;
}): string {
  const aiSummary = a.ai?.ai?.summary?.trim();
  if (aiSummary) return aiSummary;

  const bits: string[] = [];
  if (a.t === null) bits.push('本次没有可评的维度');
  else bits.push(`总分 ${a.t} 分，${a.passed ? '通过' : '还没到通过线'}`);
  if (!a.rubric) bits.push('这一关还没有评分标准，只评了器具和变量控制');
  if (a.input.scores.assembly.score < 50) bits.push('实验台上还缺东西，其余三项的分数只能参考');
  const dirty = a.input.changes.find((c) => c.dirty);
  if (dirty) bits.push(`下一次试着在一次记录里只改一个量（${dirty.id} 改了不止一个）`);
  return `${bits.join('；')}。`;
}

/* ============================================================
 * 2. 整体拒绝的判据（§4）
 * ========================================================== */

export function hardRefusal(args: {
  hasEvidence: boolean;
  emptyFacts: number;
  factCount: number;
  allEngineError: boolean;
  /** 有没有任何一条记录带引擎报错 */
  anyEngineError: boolean;
  /** D1 分数 */
  assemblyScore: number | null;
}): RefuseCode | null {
  if (!args.hasEvidence) return 'NO_EVIDENCE';
  if (args.factCount > 0 && args.emptyFacts === args.factCount) return 'NO_RUN';
  if (args.allEngineError) return 'ENGINE_ERROR';
  // 文档 §4 的判据是「D1 ≤ 20 也算引擎报错」。但 D1 = 20 还有另一种来源：
  // 器具都在、只是该有的那个一件没放（requiredKinds 全缺，20 + 0）。那不是引擎报错，
  // 是「搭错了」，应该照常给 20 分并让学生看到缺什么。所以这里多要一个「确实有报错」。
  if (args.assemblyScore !== null && args.assemblyScore <= 20 && args.anyEngineError) {
    return 'ENGINE_ERROR';
  }
  return null;
}

/* ============================================================
 * 3. grade(input, config)：文档 §6 第 3 步的那个入口
 * ========================================================== */

export async function grade(
  input: GradingInput,
  config: AIConfig | null,
  deps: AiGradeDeps & { hardRefuse?: RefuseCode | null; rubric?: Rubric | null; now?: number } = {},
): Promise<GradeResult> {
  const rubric = deps.rubric ?? loadRubric(input.challenge.id);
  const hard = deps.hardRefuse ?? null;

  // 整体拒绝 / 反思太短 / 没配 AI → 一次 API 都不发
  // （省 token，也避免 AI 拿空数据编评语）
  const configured = Boolean(config && isConfigured(config));
  const needAi =
    !hard && input.reflection.chars >= REFLECTION_MIN_CHARS && input.facts.length > 0 && configured;

  if (!needAi) {
    const aiRefused: RefuseCode | null =
      hard || input.reflection.chars < REFLECTION_MIN_CHARS || configured ? null : 'NO_AI';
    return mergeGrade({
      input,
      rubric,
      ai: null,
      aiRefused,
      hardRefuse: hard,
      aiConfigured: configured,
      now: deps.now,
    });
  }

  const outcome = await gradeWithAI(input, config as AIConfig, deps);
  const aiRefused: RefuseCode | null = outcome.ai ? null : (outcome.refused ?? 'AI_INVALID');
  return mergeGrade({
    input,
    rubric,
    ai: outcome,
    aiRefused,
    hardRefuse: hard,
    aiConfigured: true,
    now: deps.now,
  });
}

/* ============================================================
 * 4. gradeExperiment：UI 直接用这个
 * ========================================================== */

export interface GradeExperimentArgs {
  learner: LearnerState;
  challenge: ChallengeRef;
  /** freeRuns（physquest.freebuild.v1） */
  captures: CaptureSnapshot[];
  /** 学生自报看过的通道后缀 */
  seenObservations?: string[];
  stage: Stage;
  config: AIConfig | null;
  /** 测试注入 */
  deps?: AiGradeDeps;
  /** 测试注入 */
  now?: number;
  maxFacts?: number;
}

export async function gradeExperiment(args: GradeExperimentArgs): Promise<GradeResult> {
  const rubric = loadRubric(args.challenge.id);
  const { input, hasEvidence, emptyFacts } = buildGradingInput({
    learner: args.learner,
    challenge: args.challenge,
    rubric,
    captures: args.captures,
    seenObservations: args.seenObservations ?? [],
    stage: args.stage,
    maxFacts: args.maxFacts,
  });

  const allEngineError = input.facts.length > 0 && input.facts.every((f) => Boolean(f.engineError));
  const anyEngineError = input.facts.some((f) => Boolean(f.engineError));
  const hard = hardRefusal({
    hasEvidence,
    emptyFacts,
    factCount: input.facts.length,
    allEngineError,
    anyEngineError,
    assemblyScore: input.scores.assembly.score,
  });

  return grade(input, args.config, {
    ...args.deps,
    rubric,
    hardRefuse: hard,
    now: args.now,
  });
}
