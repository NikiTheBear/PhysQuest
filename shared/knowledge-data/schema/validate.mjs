#!/usr/bin/env node
/**
 * 内容校验脚本
 *
 * 用法：  node shared/knowledge-data/schema/validate.mjs
 *
 * 它检查四件事：
 *   1. JSON 能不能解析（写错一个逗号就报出来）
 *   2. 必填字段有没有空（C 最常犯的错）
 *   3. 引用的 id 存不存在（防止把 MIS-O2-04 写成 MIS-O2-4）
 *   4. 前置依赖有没有指向比自己学段更高的知识点
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB = 'optics-lens';

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const errors = [];
const warns = [];

function load(name) {
  const p = join(ROOT, LAB, name);
  if (!existsSync(p)) {
    errors.push(`${name}：文件不存在`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push(`${name}：JSON 格式错误 —— ${e.message}`);
    return null;
  }
}

/* ---------- 1. 读文件 ---------- */
const knowledge = load('knowledge.json');
const misconceptions = load('misconceptions.json');
const challenges = load('challenges.json');
const quiz = load('quiz.json');

if (errors.length) {
  console.log(C.red('\n✗ 读取失败：\n'));
  errors.forEach((e) => console.log('  ' + e));
  process.exit(1);
}

/* ---------- 2. 建索引 ---------- */
const kIds = new Set(knowledge.cards.map((c) => c.id));
/* 全平台 176 条知识点在 knowledge-cards.json 里（kIds 只有光学的 26 张） */
const globalCardIds = (() => {
  try {
    const p = join(ROOT, 'knowledge-cards.json');
    return new Set(JSON.parse(readFileSync(p, 'utf8')).cards.map((c) => c.id));
  } catch {
    return new Set();
  }
})();
const mIds = new Set(misconceptions.misconceptions.map((m) => m.id));
const cIds = new Set(challenges.challenges.map((c) => c.id));
const qIds = new Set(quiz.items.map((q) => q.id));

const STAGE_ORDER = { primary: 1, junior: 2, senior: 3, university: 4 };

/* ---------- 3. 检查知识卡 ---------- */
const REQUIRED_CARD = ['id', 'stage', 'title', 'oneLine', 'analogy', 'why', 'prerequisites', 'labPreset'];
knowledge.cards.forEach((card, i) => {
  const at = `knowledge.json 第 ${i + 1} 张卡（${card.id ?? '无 id'}）`;
  REQUIRED_CARD.forEach((f) => {
    const v = card[f];
    if (v === undefined || v === null) errors.push(`${at}：缺字段 ${f}`);
    else if (typeof v === 'string' && v.trim() === '') errors.push(`${at}：字段 ${f} 是空的`);
  });
  (card.misconceptions ?? []).forEach((m) => {
    if (!mIds.has(m)) errors.push(`${at}：引用了不存在的误区 ${m}`);
  });
  (card.prerequisites ?? []).forEach((p) => {
    if (!kIds.has(p)) {
      errors.push(`${at}：前置知识 ${p} 不存在`);
      return;
    }
    const pre = knowledge.cards.find((c) => c.id === p);
    if (STAGE_ORDER[pre.stage] > STAGE_ORDER[card.stage]) {
      errors.push(`${at}：前置 ${p} 的学段（${pre.stage}）高于自己（${card.stage}）`);
    }
  });
  if (!card.why || card.why.trim().length < 12) {
    warns.push(`${at}：why 字段太短（少于 12 字），可能解释不清楚`);
  }
  if (!card.analogy || card.analogy.trim().length < 8) {
    warns.push(`${at}：analogy 字段太短，生活类比可能不够具体`);
  }
});

/* ---------- 4. 检查误区 ---------- */
misconceptions.misconceptions.forEach((m, i) => {
  const at = `misconceptions.json 第 ${i + 1} 条（${m.id ?? '无 id'}）`;
  ['id', 'belief', 'truth'].forEach((f) => {
    if (!m[f] || String(m[f]).trim() === '') errors.push(`${at}：缺字段 ${f}`);
  });
  if (m.challengedBy && !cIds.has(m.challengedBy)) {
    errors.push(`${at}：challengedBy 指向不存在的挑战 ${m.challengedBy}`);
  }
});

/* ---------- 4b. 检查跨领域误区库（力学 / 电磁 / 声学） ---------- */
let crossMisconceptions = [];
try {
  const p = join(ROOT, 'misconceptions.json');
  if (existsSync(p)) crossMisconceptions = JSON.parse(readFileSync(p, 'utf8')).misconceptions ?? [];
} catch (e) {
  errors.push(`misconceptions.json：JSON 格式错误 —— ${e.message}`);
}
{
  // 挑战可能来自任何一个 lab 文件
  const allChallengeIds = new Set(challenges.challenges.map((c) => c.id));
  for (const lab of ['mechanics', 'circuits', 'acoustics']) {
    const p = join(ROOT, 'labs', `${lab}-challenges.json`);
    if (!existsSync(p)) continue;
    for (const c of JSON.parse(readFileSync(p, 'utf8')).challenges ?? []) allChallengeIds.add(c.id);
  }
  const seen = new Set(misconceptions.misconceptions.map((m) => m.id));
  crossMisconceptions.forEach((m, i) => {
    const at = `misconceptions.json 第 ${i + 1} 条（${m.id ?? '无 id'}）`;
    ['id', 'belief', 'truth', 'challengedBy'].forEach((f) => {
      if (!m[f] || String(m[f]).trim() === '') errors.push(`${at}：缺字段 ${f}`);
    });
    if (seen.has(m.id)) errors.push(`${at}：id 与其他误区重复`);
    seen.add(m.id);
    if (m.challengedBy && !allChallengeIds.has(m.challengedBy)) {
      errors.push(`${at}：challengedBy 指向不存在的挑战 ${m.challengedBy}`);
    }
    (m.knowledgeIds ?? []).forEach((k) => {
      if (!kIds.has(k) && !/* 全平台知识点在 knowledge-cards.json 里 */ globalCardIds.has(k)) {
        errors.push(`${at}：knowledgeIds 引用不存在的知识点 ${k}`);
      }
    });
    if (!m.knowledgeIds?.length) warns.push(`${at}：没有 knowledgeIds，挂不到知识卡上`);
  });
}

/* ---------- 5. 检查挑战 ---------- */
challenges.challenges.forEach((c, i) => {
  const at = `challenges.json 第 ${i + 1} 个（${c.id ?? '无 id'}）`;
  ['id', 'title', 'brief', 'hint', 'prediction'].forEach((f) => {
    if (!c[f]) errors.push(`${at}：缺字段 ${f}`);
  });
  // guided 挑战用 winCondition（本地引擎判定），free 挑战用 goal（工作台读数判定）
  if (c.kind === 'free') {
    if (!c.goal) errors.push(`${at}：自由搭建的挑战必须有 goal 字段`);
  } else if (!c.winCondition) {
    errors.push(`${at}：缺字段 winCondition`);
  }
  (c.knowledgeIds ?? []).forEach((k) => {
    if (!kIds.has(k)) errors.push(`${at}：引用不存在的知识点 ${k}`);
  });
  (c.misconceptionIds ?? []).forEach((m) => {
    if (!mIds.has(m)) errors.push(`${at}：引用不存在的误区 ${m}`);
  });
  if (false) {
    errors.push(`${at}：demoScriptId 指向不存在的剧本 ${c.demoScriptId}`);
  }
  const p = c.prediction;
  if (p) {
    if (!Array.isArray(p.options) || p.options.length < 2) errors.push(`${at}：prediction.options 至少要有 2 个`);
    if (typeof p.answerIndex !== 'number') errors.push(`${at}：prediction.answerIndex 必须是数字`);
    else if (p.answerIndex < 0 || p.answerIndex >= p.options.length)
      errors.push(`${at}：prediction.answerIndex 越界`);
  }
  if (!c.multiAnswer && c.multiAnswer !== false) warns.push(`${at}：multiAnswer 没写，默认为否`);
});

/* ---------- 6. 检查题库 ---------- */
quiz.items.forEach((q, i) => {
  const at = `quiz.json 第 ${i + 1} 题（${q.id ?? '无 id'}）`;
  ['id', 'type', 'question', 'knowledgeId', 'explanation'].forEach((f) => {
    if (!q[f]) errors.push(`${at}：缺字段 ${f}`);
  });
  if (!kIds.has(q.knowledgeId)) errors.push(`${at}：knowledgeId ${q.knowledgeId} 不存在`);
  if (q.misconceptionId && !mIds.has(q.misconceptionId))
    errors.push(`${at}：misconceptionId ${q.misconceptionId} 不存在`);
  if (q.type === 'single_choice') {
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${at}：选择题至少 2 个选项`);
    if (typeof q.answerIndex !== 'number') errors.push(`${at}：选择题必须有 answerIndex`);
    else if (q.answerIndex < 0 || q.answerIndex >= (q.options?.length ?? 0))
      errors.push(`${at}：answerIndex 越界`);
  }
  if (q.type === 'short_answer' && !q.answerKey) errors.push(`${at}：简答题必须有 answerKey`);
});

/* ---------- 8. 覆盖率报告 ---------- */
const usedByChallenges = new Set(challenges.challenges.flatMap((c) => c.knowledgeIds ?? []));
const usedByQuiz = new Set(quiz.items.map((q) => q.knowledgeId));
const uncovered = knowledge.cards.filter(
  (c) => !usedByChallenges.has(c.id) && !usedByQuiz.has(c.id),
);
const misUsedByQuiz = new Set(quiz.items.map((q) => q.misconceptionId).filter(Boolean));
const misUsedByChallenge = new Set(challenges.challenges.flatMap((c) => c.misconceptionIds ?? []));
const misUnused = misconceptions.misconceptions.filter(
  (m) => !misUsedByQuiz.has(m.id) && !misUsedByChallenge.has(m.id),
);

/* ---------- 9. 输出 ---------- */
console.log('');
console.log(C.bold('═══ 内容校验 ═══'));
console.log(C.dim(`知识点 ${knowledge.cards.length} · 误区 ${misconceptions.misconceptions.length} · 挑战 ${challenges.challenges.length} · 题目 ${quiz.items.length}`));
console.log('');

if (warns.length) {
  console.log(C.yellow(`⚠ ${warns.length} 条提醒`));
  warns.forEach((w) => console.log('  ' + C.dim('·') + ' ' + w));
  console.log('');
}

if (uncovered.length) {
  console.log(C.yellow(`⚠ ${uncovered.length} 个知识点没有被任何挑战或题目用到：`));
  uncovered.forEach((c) => console.log('  ' + C.dim('·') + ` ${c.id} ${c.title}`));
  console.log('');
}

if (misUnused.length) {
  console.log(C.yellow(`⚠ ${misUnused.length} 条误区既没有被题目考察、也没有对应挑战：`));
  misUnused.forEach((m) => console.log('  ' + C.dim('·') + ` ${m.id} ${m.belief}`));
  console.log('');
}

if (errors.length) {
  console.log(C.red(`✗ ${errors.length} 个错误，必须修：`));
  errors.forEach((e) => console.log('  ' + C.red('✗') + ' ' + e));
  console.log('');
  process.exit(1);
}

console.log(C.green('✓ 全部通过'));
console.log('');
