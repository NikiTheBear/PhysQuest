import knowledge from '@knowledge/optics-lens/knowledge.json';
import misconceptions from '@knowledge/optics-lens/misconceptions.json';
import challenges from '@knowledge/optics-lens/challenges.json';
import quiz from '@knowledge/optics-lens/quiz.json';
import demos from '@knowledge/optics-lens/demo-scripts.json';
import allCards from '@knowledge/knowledge-cards.json';
import allPrompts from '@knowledge/knowledge-prompts.json';

import type {
  Challenge,
  KnowledgeCard,
  Misconception,
  QuizItem,
} from '../core/contracts';

export const KNOWLEDGE: KnowledgeCard[] = knowledge.cards as unknown as KnowledgeCard[];
export const MISCONCEPTIONS: Misconception[] =
  misconceptions.misconceptions as unknown as Misconception[];
export const CHALLENGES: Challenge[] = challenges.challenges as unknown as Challenge[];
export const QUIZ: QuizItem[] = quiz.items as unknown as QuizItem[];
export const DEMOS = demos.scripts;

/** 全平台 166 张知识卡（26 手写 + 140 生成） */
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
}>;

/** 全平台 140 条 AI 搭建提示词（知识卡的背面） */
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
export const allCardById = (id: string) => ALL_CARDS.find((c) => c.id === id);

export const knowledgeById = (id: string) => KNOWLEDGE.find((k) => k.id === id);
export const misconceptionById = (id: string) => MISCONCEPTIONS.find((m) => m.id === id);
export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);
export const quizForChallenge = (challenge: Challenge): QuizItem[] => {
  // 优先取这个挑战考的知识点对应的题
  const hit = QUIZ.filter((q) => challenge.knowledgeIds.includes(q.knowledgeId));
  const rest = QUIZ.filter((q) => !challenge.knowledgeIds.includes(q.knowledgeId));
  const picked = [...hit];
  for (const r of rest) {
    if (picked.length >= 4) break;
    if (!picked.some((p) => p.misconceptionId === r.misconceptionId)) picked.push(r);
  }
  return picked.slice(0, 4);
};
