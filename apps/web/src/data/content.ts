import knowledge from '@knowledge/optics-lens/knowledge.json';
import opticsMisconceptions from '@knowledge/optics-lens/misconceptions.json';
import allMisconceptions from '@knowledge/misconceptions.json';
import challenges from '@knowledge/optics-lens/challenges.json';
import quiz from '@knowledge/optics-lens/quiz.json';
import allCards from '@knowledge/knowledge-cards.json';
import allPrompts from '@knowledge/knowledge-prompts.json';
import expIndex from '@knowledge/experiment-index.json';

import type {
  Challenge,
  KnowledgeCard,
  Misconception,
  QuizItem,
} from '../core/contracts';

export const KNOWLEDGE: KnowledgeCard[] = knowledge.cards as unknown as KnowledgeCard[];
/** 误区库 = 光学 10 条（光具座关卡引用）+ 全平台 32 条（力学 / 电磁 / 声学） */
export const MISCONCEPTIONS: Misconception[] = [
  ...(opticsMisconceptions.misconceptions as unknown as Misconception[]),
  ...(allMisconceptions.misconceptions as unknown as Misconception[]),
];
export const CHALLENGES: Challenge[] = challenges.challenges as unknown as Challenge[];
export const QUIZ: QuizItem[] = quiz.items as unknown as QuizItem[];

/** 全平台 176 张知识卡（光学 32 手写 + 其余生成，全部带加厚内容） */
export const ALL_CARDS = (allCards as { cards: unknown[] }).cards as Array<{
  id: string;
  title: string;
  stage: string;
  domain: string;
  domainLabel: string;
  oneLine: string;
  analogy: string;
  formula: string;
  why: string;
  variables: string[];
  observations: string[];
  support: 'direct' | 'approximation' | 'conceptual';
  misconceptions: string[];
  prerequisites: string[];
  difficulty: string;
  /** 加厚内容：深入讲解 */
  detail?: string[];
  /** 加厚内容：易混对比 */
  compare?: Array<{ with: string; diff: string }>;
  /** 加厚内容：生活里在哪见 */
  everyday?: string[];
  /** 加厚内容：自检三问 */
  selfCheck?: Array<{ q: string; a: string }>;
}>;

/** 全平台 150 条 AI 搭建提示词（知识卡的背面） */
export const ALL_PROMPTS = allPrompts as Array<{
  id: string;
  title: string;
  domainLabel: string;
  stageLabel: string;
  support: 'direct' | 'approximation' | 'conceptual';
  supportLabel: string;
  objective: string;
  construction: string;
  variables: string[];
  observations: string[];
  limitations: string;
  models: string[];
  formula?: string;
  prompt: string;
}>;

export const promptById = (id: string) => ALL_PROMPTS.find((p) => p.id === id);

/**
 * 这一关有没有实验文件。
 *
 * 热学那 17 条「做不出来」的挑战（相变 / 气体 / 统计 / 辐射）故意没有 .pqexp.json。
 * 网页层读不到文件系统，所以用 scripts/gen-experiment-index.mjs 生成一份清单。
 */
export const HAS_EXPERIMENT: Record<string, boolean> = (
  expIndex as { has: Record<string, boolean> }
).has;
export const hasExperiment = (challengeId: string) => HAS_EXPERIMENT[challengeId] === true;
export const allCardById = (id: string) => ALL_CARDS.find((c) => c.id === id);

export const knowledgeById = (id: string) => KNOWLEDGE.find((k) => k.id === id);
export const misconceptionById = (id: string) => MISCONCEPTIONS.find((m) => m.id === id);
export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);

/* ============================================================
 * 自动生成的挑战（力学 / 电路 / 光学额外）
 *
 * 这些是从 knowledge-prompts.json 派生的：
 *   一个「可计算」的知识点 → 一个挑战 + 一个 .pqexp 实验文件
 * 所以「有搭建方案的知识点」全都能真的动手。
 * ========================================================== */

import mechAuto from '@knowledge/labs/mechanics-challenges.json';
import circAuto from '@knowledge/labs/circuits-challenges.json';
import opticsAuto from '@knowledge/labs/optics-lens-challenges.json';
import acousticsAuto from '@knowledge/labs/acoustics-challenges.json';
import thermalAuto from '@knowledge/labs/thermal-challenges.json';

export interface AutoChallenge {
  id: string;
  labId: string;
  title: string;
  brief: string;
  hint: string;
  auto: true;
  multiAnswer: boolean;
  knowledgeIds: string[];
  misconceptionIds: string[];
  difficulty: string;
  prediction: { prompt: string; options: string[]; answerIndex: number };
  build: {
    models: string[];
    variables: string[];
    observations: string[];
    construction: string;
    prompt: string;
    stage: string;
    domain: string;
  };
}

export const AUTO_CHALLENGES: AutoChallenge[] = [
  ...((mechAuto as unknown as { challenges: AutoChallenge[] }).challenges ?? []),
  ...((circAuto as unknown as { challenges: AutoChallenge[] }).challenges ?? []),
  ...((opticsAuto as unknown as { challenges: AutoChallenge[] }).challenges ?? []),
  ...((acousticsAuto as unknown as { challenges: AutoChallenge[] }).challenges ?? []),
  ...((thermalAuto as unknown as { challenges: AutoChallenge[] }).challenges ?? []),
];

/** 某个模块下自动生成的挑战 */
export const autoChallengesFor = (labId: string) =>
  AUTO_CHALLENGES.filter((c) => c.labId === labId);

/** 某个知识点有没有对应的自动挑战 */
export const autoChallengeForKnowledge = (knowledgeId: string) =>
  AUTO_CHALLENGES.find((c) => c.knowledgeIds.includes(knowledgeId));
