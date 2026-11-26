#!/usr/bin/env node
/**
 * 将 DeepSeek 流水线跑出的 scripts/.tmp/generated-*.json 质检并一键合入正式知识库：
 *   - scripts/.tmp/generated-questions.json -> shared/knowledge-data/ai-questions.json
 *   - scripts/.tmp/generated-rubrics.json   -> shared/knowledge-data/grading/rubrics-all.json
 *
 * 用法：node scripts/merge-deepseek-outputs.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const TMP = join(HERE, '.tmp');
const KD = join(REPO, 'shared', 'knowledge-data');

const cards = JSON.parse(readFileSync(join(KD, 'knowledge-cards.json'), 'utf8')).cards;
const cardIds = new Set(cards.map((c) => c.id));
const misIds = new Set([
  ...JSON.parse(readFileSync(join(KD, 'optics-lens', 'misconceptions.json'), 'utf8')).misconceptions.map((m) => m.id),
  ...JSON.parse(readFileSync(join(KD, 'misconceptions.json'), 'utf8')).misconceptions.map((m) => m.id),
]);

/* ---------- 1. 合入原创题库 ---------- */
const qSrc = join(TMP, 'generated-questions.json');
if (existsSync(qSrc)) {
  const raw = JSON.parse(readFileSync(qSrc, 'utf8'));
  const merged = [];
  const seenIds = new Set();
  const seenPrompts = new Set();
  let skipped = 0;

  for (const [kid, list] of Object.entries(raw)) {
    if (!cardIds.has(kid) || !Array.isArray(list)) {
      skipped++;
      continue;
    }
    for (const q of list) {
      if (
        !q?.id ||
        seenIds.has(q.id) ||
        !['easy', 'medium', 'hard'].includes(q.level) ||
        !Array.isArray(q.options) ||
        q.options.length < 2 ||
        new Set(q.options).size !== q.options.length ||
        !Array.isArray(q.optionNotes) ||
        q.optionNotes.length !== q.options.length ||
        typeof q.answerIndex !== 'number' ||
        q.answerIndex < 0 ||
        q.answerIndex >= q.options.length ||
        typeof q.question !== 'string' ||
        seenPrompts.has(q.question.trim())
      ) {
        skipped++;
        continue;
      }
      const clean = {
        id: q.id,
        knowledgeId: kid,
        level: q.level,
        type: 'single',
        question: q.question.trim(),
        options: q.options.map((s) => String(s).trim()),
        answerIndex: q.answerIndex,
        explanation: String(q.explanation || '').trim(),
        optionNotes: q.optionNotes.map((s) => String(s).trim()),
        ...(q.misconceptionId && misIds.has(q.misconceptionId) ? { misconceptionId: q.misconceptionId } : {}),
      };
      seenIds.add(clean.id);
      seenPrompts.add(clean.question);
      merged.push(clean);
    }
  }

  writeFileSync(
    join(KD, 'ai-questions.json'),
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), count: merged.length, questions: merged }, null, 2),
    'utf8',
  );
  console.log(`✓ 已合入原创题库：${merged.length} 道（跳过不合格/重复 ${skipped} 条）→ shared/knowledge-data/ai-questions.json`);
} else {
  console.log('· 未找到 scripts/.tmp/generated-questions.json，跳过题库合入');
}

/* ---------- 2. 合入全模块评分标准 ---------- */
const rSrc = join(TMP, 'generated-rubrics.json');
if (existsSync(rSrc)) {
  const raw = JSON.parse(readFileSync(rSrc, 'utf8'));
  const clean = {};
  let skipped = 0;
  for (const [cid, r] of Object.entries(raw)) {
    if (!r || !Array.isArray(r.requiredKinds) || !Array.isArray(r.requiredObservations)) {
      skipped++;
      continue;
    }
    clean[cid] = {
      requiredKinds: r.requiredKinds,
      requiredObservations: r.requiredObservations,
      optionalObservations: Array.isArray(r.optionalObservations) ? r.optionalObservations : [],
      unmappableObservations: Array.isArray(r.unmappableObservations) ? r.unmappableObservations : [],
    };
  }
  mkdirSync(join(KD, 'grading'), { recursive: true });
  writeFileSync(
    join(KD, 'grading', 'rubrics-all.json'),
    JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), count: Object.keys(clean).length, challenges: clean }, null, 2),
    'utf8',
  );
  console.log(`✓ 已合入评分标准：${Object.keys(clean).length} 关（跳过 ${skipped} 条）→ shared/knowledge-data/grading/rubrics-all.json`);
} else {
  console.log('· 未找到 scripts/.tmp/generated-rubrics.json，跳过评分标准合入');
}
