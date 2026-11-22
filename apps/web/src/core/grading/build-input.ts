/**
 * 适配器：把「学生做过的事」拼成 `GradingInput`
 *
 * 唯一的入口。选证据的五条规则照抄 local/AI-GRADING-SPEC.md §2.3：
 *
 *   1. 只取 captures 里 `experiment.source.openedChallenge === challenge.id` 的那些
 *   2. 按 at 升序，最多 8 条
 *   3. captures 为空时退回 learner.runs 过滤 challengeId，按 lockedAt 升序，最多 8 条
 *   4. 两边都有时以 captures 为准
 *   5. 一条都没有 → NO_EVIDENCE（由 grade() 判）
 *
 * 为什么以 captures 为准：`LockedRun.params` 来自网页层的 `params`，而学生在 iframe
 * 里拖的滑块根本不回传，所以 runs 里的参数大概率是开局 preset（§2.3 的坑）。
 * 评分**一律先看 freeRuns**。
 */

import type { CaptureSnapshot } from '../../components/free-build/ImmersiveLab';
import type { Challenge, LearnerState, LensMetrics, Stage } from '../contracts';
import { factFromCapture, factFromLocked, snapshotChallengeId, suffixOf } from './comparison';
import { buildChanges, buildChecks, scoreVariables } from './rules';
import { computeAssembly, computeObservation } from './compute';
import { describeWin, checkWin } from './win';
import type { GradingInput, Rubric, RunFact } from './types';

/** 评分只需要挑战的这几项，不需要完整的 Challenge */
export type ChallengeRef = Pick<Challenge, 'id' | 'title' | 'brief' | 'labId' | 'knowledgeIds'> & {
  winCondition?: Challenge['winCondition'];
};

export interface BuildInputArgs {
  learner: LearnerState;
  challenge: ChallengeRef;
  rubric: Rubric | null;
  /** freeRuns（App.tsx 的 freeRuns，持久化在 physquest.freebuild.v1） */
  captures: CaptureSnapshot[];
  /** 学生自报看过的通道后缀（缺口 3 方案 B）；也可以是工作台 focus 采集的后缀 */
  seenObservations: string[];
  stage: Stage;
  /** 最多几条证据，默认 8，和 buildReport 的 slice(-8) 对齐 */
  maxFacts?: number;
}

export interface BuildInputResult {
  input: GradingInput;
  /** 有没有拿到任何证据 */
  hasEvidence: boolean;
  /** 记录里有几条是「空实验台」（用来判 NO_RUN） */
  emptyFacts: number;
}

/* ============================================================
 * 证据选择
 * ========================================================== */

export function selectCaptures(captures: CaptureSnapshot[], challengeId: string): CaptureSnapshot[] {
  return captures
    .filter((c) => snapshotChallengeId(c) === challengeId)
    .slice()
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

export function factsFromCaptures(
  captures: CaptureSnapshot[],
  maxFacts = 8,
): RunFact[] {
  return captures.slice(-maxFacts).map((c, i) => factFromCapture(c, i));
}

export function factsFromRuns(
  learner: LearnerState,
  challengeId: string,
  maxFacts = 8,
): RunFact[] {
  return learner.runs
    .filter((r) => r.challengeId === challengeId)
    .slice()
    .sort((a, b) => a.lockedAt - b.lockedAt)
    .slice(-maxFacts)
    .map((r, i) => factFromLocked(r, i));
}

/**
 * 学生自报的通道后缀，再合并工作台 focus 采集到的通道键。
 * focus 里的键是 `<id>:m` 这种，要削成后缀。
 */
export function normalizeSeen(seen: string[] | undefined, facts: RunFact[]): string[] {
  const out = new Set<string>();
  for (const s of seen ?? []) {
    if (typeof s === 'string' && s.trim()) out.add(suffixOf(s.trim()));
  }
  return [...out].filter((s) => facts.length === 0 || facts.some((f) => hasChannel(f, s)));
}

function hasChannel(f: RunFact, suffix: string): boolean {
  return Object.keys(f.channels).some((k) => suffixOf(k) === suffix);
}

/* ============================================================
 * 主入口
 * ========================================================== */

export function buildGradingInput(args: BuildInputArgs): BuildInputResult {
  const { learner, challenge, rubric, captures, stage } = args;
  const maxFacts = args.maxFacts ?? 8;

  /* —— 1/2/3/4：先 captures，空了再退回 runs —— */
  const picked = selectCaptures(captures, challenge.id);
  const facts: RunFact[] =
    picked.length > 0 ? factsFromCaptures(picked, maxFacts) : factsFromRuns(learner, challenge.id, maxFacts);

  /* —— 学生自报 —— */
  const seen = normalizeSeen(args.seenObservations, facts);

  /* —— 三张分数 + 两张表（纯本地） —— */
  const changes = buildChanges(facts, challenge.labId);
  const checks = buildChecks(facts);
  const assembly = computeAssembly(facts, rubric?.requiredKinds ?? []);
  const observation = computeObservation(rubric, seen);
  const variables = scoreVariables(changes);

  /* —— 目标判定：拿最后一条记录的读数去判 —— */
  const last = facts[facts.length - 1] ?? null;
  const goalMet = challenge.winCondition
    ? checkWin(challenge.winCondition, metricsForWin(last))
    : 'unknown';

  const reflection = learner.reflections[challenge.id];
  const text = reflection?.text ?? '';

  const input: GradingInput = {
    version: 1,
    stage,
    challenge: {
      id: challenge.id,
      title: challenge.title,
      brief: challenge.brief,
      labId: challenge.labId,
      knowledgeIds: [...challenge.knowledgeIds],
      requiredKinds: [...(rubric?.requiredKinds ?? [])],
      requiredObservations: [...(rubric?.requiredObservations ?? [])],
      optionalObservations: [...(rubric?.optionalObservations ?? [])],
      unmappableObservations: [...(rubric?.unmappableObservations ?? [])],
      winText: challenge.winCondition ? describeWin(challenge.winCondition) : '没有可判定的目标',
      goalMet,
    },
    facts,
    checks,
    changes,
    scores: { assembly, observation, variables },
    reflection: {
      text,
      chars: text.trim().length,
      updatedAt: reflection?.updatedAt,
    },
    seenObservations: seen,
  };

  const emptyFacts = facts.filter((f) => isRunEmpty(f)).length;

  return { input, hasEvidence: facts.length > 0, emptyFacts };
}

function metricsForWin(f: RunFact | null): Partial<LensMetrics> {
  if (!f) return {};
  const m = f.metrics;
  const out: Partial<LensMetrics> = {};
  if (m.v !== undefined) out.v = m.v;
  if (m.m !== undefined) out.m = m.m ?? Number.POSITIVE_INFINITY;
  if (m.real !== undefined) out.real = m.real;
  if (m.imageHeight !== undefined) out.imageHeight = m.imageHeight ?? Number.POSITIVE_INFINITY;
  if (m.blurDiameter !== undefined) out.blurDiameter = m.blurDiameter;
  if (m.screenHasImage !== undefined) out.screenHasImage = m.screenHasImage;
  if (m.relativeIlluminance !== undefined) out.relativeIlluminance = m.relativeIlluminance;
  if (m.description !== undefined) out.description = m.description;
  return out;
}

/** 文档 §4 的 NO_RUN 判据：器具为 0，或所有通道全空 */
export function isRunEmpty(f: RunFact): boolean {
  if (f.componentCount === 0) return true;
  return Object.keys(f.channels).length === 0;
}
