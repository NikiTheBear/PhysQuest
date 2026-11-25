#!/usr/bin/env node
/**
 * 全平台内容校验脚本
 *
 * 用法：  node shared/knowledge-data/schema/validate.mjs
 *
 * 检查范围：
 *   1. 全平台 176 张知识卡（knowledge-cards.json）：必填字段、id 唯一、前置依赖存在且不跨级
 *   2. 全平台 46 条误区（optics-lens/misconceptions.json + misconceptions.json）：必填字段、id 唯一、关联挑战与知识点有效
 *   3. 全平台挑战（optics-lens/challenges.json + labs/*-challenges.json）：必填字段、id 唯一、知识点引用与预测选项合法
 *   4. 公式实验室（formula-lab.json）：全部 97 条条目在默认值及滑杆边界处不产生语法错误或 NaN
 *   5. 实验索引（experiment-index.json）与 platform/experiments/*.pqexp.json 一致性
 *   6. 光学旧版题库（optics-lens/quiz.json）兼容性校验
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..', '..');
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

function loadJson(absPath, label) {
  if (!existsSync(absPath)) {
    errors.push(`${label}：文件不存在`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (e) {
    errors.push(`${label}：JSON 格式错误 —— ${e.message}`);
    return null;
  }
}

/* ---------- 1. 读取全部核心数据 ---------- */
const knowledge = loadJson(join(ROOT, LAB, 'knowledge.json'), 'optics-lens/knowledge.json');
const optMisconceptions = loadJson(join(ROOT, LAB, 'misconceptions.json'), 'optics-lens/misconceptions.json');
const optChallenges = loadJson(join(ROOT, LAB, 'challenges.json'), 'optics-lens/challenges.json');
const quiz = loadJson(join(ROOT, LAB, 'quiz.json'), 'optics-lens/quiz.json');
const globalCardsData = loadJson(join(ROOT, 'knowledge-cards.json'), 'knowledge-cards.json');
const crossMiscData = loadJson(join(ROOT, 'misconceptions.json'), 'misconceptions.json');
const formulaLabData = loadJson(join(ROOT, 'formula-lab.json'), 'formula-lab.json');
const expIndexData = loadJson(join(ROOT, 'experiment-index.json'), 'experiment-index.json');

if (errors.length) {
  console.log(C.red('\n✗ 读取失败：\n'));
  errors.forEach((e) => console.log('  ' + e));
  process.exit(1);
}

const STAGE_ORDER = { primary: 1, junior: 2, senior: 3, university: 4 };

/* ---------- 2. 校验全平台 176 张知识卡 ---------- */
const globalCards = globalCardsData.cards ?? [];
const globalCardMap = new Map();
globalCards.forEach((card, i) => {
  const at = `knowledge-cards.json 第 ${i + 1} 张卡（${card.id ?? '无 id'}）`;
  ['id', 'stage', 'domain', 'title', 'oneLine', 'why'].forEach((f) => {
    const v = card[f];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      errors.push(`${at}：缺必填字段 ${f}`);
    }
  });
  if (card.id) {
    if (globalCardMap.has(card.id)) errors.push(`${at}：id 重复`);
    globalCardMap.set(card.id, card);
  }
  if (card.stage && !(card.stage in STAGE_ORDER)) {
    errors.push(`${at}：非法学段 ${card.stage}`);
  }
});

globalCards.forEach((card) => {
  const at = `knowledge-cards.json（${card.id}）`;
  (card.prerequisites ?? []).forEach((p) => {
    const pre = globalCardMap.get(p);
    if (!pre) {
      errors.push(`${at}：前置知识 ${p} 不存在`);
      return;
    }
    if (STAGE_ORDER[pre.stage] > STAGE_ORDER[card.stage]) {
      errors.push(`${at}：前置 ${p} 的学段（${pre.stage}）高于自己（${card.stage}）`);
    }
  });
});

/* ---------- 3. 校验全部 5 个模块的挑战（共 133 个） ---------- */
const allChallenges = [];
const allChallengeIds = new Set();

function checkChallengeList(list, sourceLabel) {
  list.forEach((c, i) => {
    const at = `${sourceLabel} 第 ${i + 1} 个（${c.id ?? '无 id'}）`;
    ['id', 'title', 'brief'].forEach((f) => {
      if (!c[f] || String(c[f]).trim() === '') errors.push(`${at}：缺字段 ${f}`);
    });
    if (c.id) {
      if (allChallengeIds.has(c.id)) errors.push(`${at}：挑战 id 重复`);
      allChallengeIds.add(c.id);
    }
    (c.knowledgeIds ?? []).forEach((k) => {
      if (!globalCardMap.has(k)) errors.push(`${at}：引用不存在的知识点 ${k}`);
    });
    if (c.knowledgeId && !globalCardMap.has(c.knowledgeId)) {
      errors.push(`${at}：引用不存在的知识点 ${c.knowledgeId}`);
    }
    if (c.prediction) {
      const p = c.prediction;
      if (!Array.isArray(p.options) || p.options.length < 2) {
        errors.push(`${at}：prediction.options 至少要有 2 个`);
      }
      if (typeof p.answerIndex !== 'number' || p.answerIndex < 0 || p.answerIndex >= (p.options?.length ?? 0)) {
        errors.push(`${at}：prediction.answerIndex 越界或非数字`);
      }
    }
    allChallenges.push(c);
  });
}

checkChallengeList(optChallenges.challenges ?? [], 'optics-lens/challenges.json');

const labsDir = join(ROOT, 'labs');
if (existsSync(labsDir)) {
  for (const file of readdirSync(labsDir).filter((f) => f.endsWith('-challenges.json')).sort()) {
    const data = loadJson(join(labsDir, file), `labs/${file}`);
    if (data) checkChallengeList(data.challenges ?? [], `labs/${file}`);
  }
}

/* ---------- 4. 校验全部 46 条误区 ---------- */
const allMisconceptions = [
  ...(optMisconceptions.misconceptions ?? []).map((m) => ({ ...m, _src: 'optics-lens/misconceptions.json' })),
  ...(crossMiscData.misconceptions ?? []).map((m) => ({ ...m, _src: 'misconceptions.json' })),
];
const allMiscIds = new Set();

allMisconceptions.forEach((m, i) => {
  const at = `${m._src} 第 ${i + 1} 条（${m.id ?? '无 id'}）`;
  ['id', 'belief', 'truth'].forEach((f) => {
    if (!m[f] || String(m[f]).trim() === '') errors.push(`${at}：缺字段 ${f}`);
  });
  if (m.id) {
    if (allMiscIds.has(m.id)) errors.push(`${at}：误区 id 重复`);
    allMiscIds.add(m.id);
  }
  if (m.challengedBy && !allChallengeIds.has(m.challengedBy)) {
    errors.push(`${at}：challengedBy 指向不存在的挑战 ${m.challengedBy}`);
  }
  (m.knowledgeIds ?? []).forEach((k) => {
    if (!globalCardMap.has(k)) errors.push(`${at}：knowledgeIds 引用不存在的知识点 ${k}`);
  });
});

/* ---------- 5. 校验全部 97 条公式实验室（含默认值与滑杆边界求值） ---------- */
const formulaLabs = formulaLabData.labs ?? {};
const formulaEntries = Object.entries(formulaLabs);
let formulaWithExpr = 0;

for (const [kid, lab] of formulaEntries) {
  const at = `formula-lab.json（${kid}）`;
  if (!globalCardMap.has(kid)) errors.push(`${at}：知识点 ${kid} 不存在`);
  const inputs = lab.inputs ?? [];
  const outputs = lab.outputs ?? [];
  if (outputs.length === 0) continue;
  formulaWithExpr++;

  const defaults = {};
  for (const inp of inputs) {
    if (!inp.key) {
      errors.push(`${at}：存在缺少 key 的输入参数`);
      continue;
    }
    if (typeof inp.min === 'number' && typeof inp.max === 'number' && inp.min >= inp.max) {
      errors.push(`${at}：参数 ${inp.key} 的 min(${inp.min}) >= max(${inp.max})`);
    }
    defaults[inp.key] = inp.default;
  }

  for (const out of outputs) {
    if (!out.expr) {
      errors.push(`${at}：输出 ${out.key ?? out.label} 缺少 expr`);
      continue;
    }
    let fn;
    try {
      fn = new Function(...Object.keys(defaults), `return (${out.expr});`);
    } catch (e) {
      errors.push(`${at}：公式「${out.expr}」语法错误 —— ${e.message}`);
      continue;
    }
    try {
      const defVal = fn(...Object.values(defaults));
      if (!Number.isFinite(defVal)) {
        errors.push(`${at}：公式「${out.expr}」在默认值处结果非法（${defVal}）`);
      }
    } catch (e) {
      errors.push(`${at}：公式「${out.expr}」在默认值处求值异常 —— ${e.message}`);
    }
    for (const inp of inputs) {
      for (const edge of [inp.min, inp.max]) {
        const testVars = { ...defaults, [inp.key]: edge };
        try {
          const val = fn(...Object.values(testVars));
          if (Number.isNaN(val)) {
            errors.push(`${at}：公式「${out.expr}」在边界 ${inp.key}=${edge} 处产生 NaN`);
          } else if (!Number.isFinite(val)) {
            warns.push(`${at}：公式「${out.expr}」在边界 ${inp.key}=${edge} 处趋于无穷（${val}）`);
          }
        } catch (e) {
          errors.push(`${at}：公式「${out.expr}」在边界 ${inp.key}=${edge} 处异常 —— ${e.message}`);
        }
      }
    }
  }
}

/* ---------- 6. 校验 experiment-index.json 与实际实验文件 ---------- */
const expDir = join(REPO, 'platform', 'experiments');
const expHas = expIndexData.has ?? {};
const indexedExpIds = Object.keys(expHas).filter((k) => expHas[k]);
if (existsSync(expDir)) {
  const actualFiles = new Set(
    readdirSync(expDir)
      .filter((f) => f.endsWith('.pqexp.json'))
      .map((f) => f.replace(/\.pqexp\.json$/, '')),
  );
  for (const id of indexedExpIds) {
    if (!actualFiles.has(id)) {
      errors.push(`experiment-index.json：索引了 ${id}，但 platform/experiments/${id}.pqexp.json 不存在`);
    }
  }
}

/* ---------- 7. 光学旧版题库（optics-lens/quiz.json） ---------- */
const optKIds = new Set((knowledge.cards ?? []).map((c) => c.id));
(quiz.items ?? []).forEach((q, i) => {
  const at = `optics-lens/quiz.json 第 ${i + 1} 题（${q.id ?? '无 id'}）`;
  ['id', 'type', 'question', 'knowledgeId', 'explanation'].forEach((f) => {
    if (!q[f]) errors.push(`${at}：缺字段 ${f}`);
  });
  if (!optKIds.has(q.knowledgeId) && !globalCardMap.has(q.knowledgeId)) {
    errors.push(`${at}：knowledgeId ${q.knowledgeId} 不存在`);
  }
  if (q.misconceptionId && !allMiscIds.has(q.misconceptionId)) {
    errors.push(`${at}：misconceptionId ${q.misconceptionId} 不存在`);
  }
});

/* ---------- 8. 输出汇总 ---------- */
console.log('');
console.log(C.bold('═══ 全平台内容校验 ═══'));
console.log(
  C.dim(
    `知识点 ${globalCards.length} · 挑战 ${allChallenges.length} · 误区 ${allMisconceptions.length} · 公式实验室 ${formulaEntries.length}（含算式 ${formulaWithExpr}） · 实验索引 ${indexedExpIds.length}`,
  ),
);
console.log('');

if (warns.length) {
  console.log(C.yellow(`⚠ ${warns.length} 条提醒`));
  warns.forEach((w) => console.log('  ' + C.dim('·') + ' ' + w));
  console.log('');
}

if (errors.length) {
  console.log(C.red(`✗ ${errors.length} 个错误，必须修：`));
  errors.forEach((e) => console.log('  ' + C.red('✗') + ' ' + e));
  console.log('');
  process.exit(1);
}

console.log(C.green('✓ 全平台校验通过'));
console.log('');
