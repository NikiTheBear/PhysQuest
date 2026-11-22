import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HANDWRITTEN, BANK } from './question-bank';

const root = fileURLToPath(new URL('../../../../shared/knowledge-data/', import.meta.url));
const readJSON = (p: string) => JSON.parse(readFileSync(root + p, 'utf8'));

const cards = readJSON('knowledge-cards.json').cards as Array<{ id: string; domain: string }>;
const cardIds = new Set(cards.map((c) => c.id));
const misIds = new Set(
  [
    ...readJSON('optics-lens/misconceptions.json').misconceptions,
    ...readJSON('misconceptions.json').misconceptions,
  ].map((m: { id: string }) => m.id),
);

const domainOf = (knowledgeId: string) => knowledgeId.split('-')[1][0];

describe('手写题', () => {
  it('选项和逐项解析一一对应', () => {
    for (const q of HANDWRITTEN) {
      expect(q.options.length, `${q.id} 选项数`).toBeGreaterThanOrEqual(2);
      expect(q.optionNotes?.length, `${q.id} 的 optionNotes 长度必须等于 options`).toBe(q.options.length);
      for (const note of q.optionNotes ?? []) expect(note.trim().length, `${q.id} 有空的 optionNotes`).toBeGreaterThan(4);
    }
  });

  it('答案下标合法、选项不重复', () => {
    for (const q of HANDWRITTEN) {
      expect(q.answerIndex, `${q.id} 的 answerIndex 越界`).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex, `${q.id} 的 answerIndex 越界`).toBeLessThan(q.options.length);
      expect(new Set(q.options).size, `${q.id} 有重复选项`).toBe(q.options.length);
      // 不允许凑数选项
      for (const opt of q.options) expect(opt).not.toMatch(/以上都|都不对|无法判断/);
    }
  });

  it('id 唯一，且 knowledgeId / misconceptionId 都真实存在', () => {
    const ids = new Set<string>();
    for (const q of HANDWRITTEN) {
      expect(ids.has(q.id), `重复 id ${q.id}`).toBe(false);
      ids.add(q.id);
      expect(cardIds.has(q.knowledgeId), `${q.id} 的知识点 ${q.knowledgeId} 不存在`).toBe(true);
      if (q.misconceptionId) expect(misIds.has(q.misconceptionId), `${q.id} 的误区不存在`).toBe(true);
      expect(['easy', 'medium', 'hard']).toContain(q.level);
    }
  });

  it('每个领域至少 30 道手写题', () => {
    const count: Record<string, number> = {};
    for (const q of HANDWRITTEN) count[domainOf(q.knowledgeId)] = (count[domainOf(q.knowledgeId)] ?? 0) + 1;
    for (const d of ['M', 'E', 'T', 'N']) {
      expect(count[d] ?? 0, `${d} 领域手写题不足 30 道`).toBeGreaterThanOrEqual(30);
    }
  });

  it('题干不重复，且每题都有解释', () => {
    const seen = new Set<string>();
    for (const q of HANDWRITTEN) {
      expect(seen.has(q.question), `重复题干：${q.question.slice(0, 24)}`).toBe(false);
      seen.add(q.question);
      expect(q.explanation.trim().length, `${q.id} 的 explanation 太短`).toBeGreaterThan(10);
    }
  });

  it('合并后题库包含全部手写题，且没有重复 id', () => {
    const ids = BANK.map((q) => q.id);
    expect(new Set(ids).size, '合并后出现重复 id').toBe(ids.length);
    for (const q of HANDWRITTEN) expect(ids).toContain(q.id);
  });
});
