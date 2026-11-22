import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const dir = new URL('../../shared/knowledge-data/', import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, dir), 'utf8'));

const opticsMis = (await read('optics-lens/misconceptions.json')).misconceptions;
const crossMis = (await read('misconceptions.json')).misconceptions;
const all = [...opticsMis, ...crossMis];
const cards = (await read('knowledge-cards.json')).cards;
const cardIds = new Set(cards.map((c) => c.id));

const challengeIds = new Set();
for (const name of await readdir(new URL('labs/', dir))) {
  if (!name.endsWith('.json')) continue;
  for (const c of (await read(new URL('labs/' + name, dir))).challenges ?? []) challengeIds.add(c.id);
}
for (const c of (await read('optics-lens/challenges.json')).challenges) challengeIds.add(c.id);
const opticsHandChallenges = (await read('optics-lens/challenges.json')).challenges;
const labChallengeFiles = await Promise.all(
  ['mechanics', 'circuits', 'optics-lens', 'acoustics'].map((n) => read(new URL(`labs/${n}-challenges.json`, dir))),
);

test('误区库规模与分布达到任务要求（每领域 ≥ 8 条，总数 40–50）', () => {
  assert.ok(all.length >= 40 && all.length <= 50, `总数 ${all.length} 应在 40–50`);
  const byArea = {};
  for (const m of all) {
    const area = m.id.slice(4, 5); // M / E / A / O
    byArea[area] = (byArea[area] ?? 0) + 1;
  }
  for (const [area, n] of Object.entries(byArea)) assert.ok(n >= 8, `${area} 只有 ${n} 条，少于 8`);
});

test(' misconception id 唯一，必填字段齐全', () => {
  const ids = new Set();
  for (const m of all) {
    assert.ok(!ids.has(m.id), `重复 id ${m.id}`);
    ids.add(m.id);
    for (const f of ['belief', 'truth', 'challengedBy']) assert.ok(m[f]?.trim(), `${m.id} 缺 ${f}`);
    // belief 必须是学生口气的一句话，不能写成「对XX概念理解有误」
    assert.doesNotMatch(m.belief, /理解有误|概念不清|掌握不牢/, `${m.id} 的 belief 写成了评语`);
  }
});

test(' misconception 引用的挑战和知识点都真实存在', () => {
  for (const m of all) {
    assert.ok(challengeIds.has(m.challengedBy), `${m.id} 的 challengedBy ${m.challengedBy} 不存在`);
    for (const k of m.knowledgeIds ?? []) assert.ok(cardIds.has(k), `${m.id} 的 knowledgeIds ${k} 不存在`);
  }
});

test('误区已经挂到挑战和知识卡上（不是躺在库里没人用）', () => {
  const usedByChallenge = new Set();
  for (const file of labChallengeFiles) {
    for (const c of file.challenges) for (const id of c.misconceptionIds ?? []) usedByChallenge.add(id);
  }
  for (const c of opticsHandChallenges) {
    for (const id of c.misconceptionIds ?? []) usedByChallenge.add(id);
  }
  for (const m of all) assert.ok(usedByChallenge.has(m.id), `${m.id} 没挂到任何挑战上`);

  const onCards = new Set(cards.flatMap((c) => c.misconceptions ?? []));
  for (const m of all) assert.ok(onCards.has(m.id), `${m.id} 没挂到任何知识卡上`);
});
