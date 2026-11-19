import knowledge from '@knowledge/optics-lens/knowledge.json';
import misconceptions from '@knowledge/optics-lens/misconceptions.json';
import challenges from '@knowledge/optics-lens/challenges.json';
import quiz from '@knowledge/optics-lens/quiz.json';
import demos from '@knowledge/optics-lens/demo-scripts.json';

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
