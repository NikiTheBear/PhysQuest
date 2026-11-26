#!/usr/bin/env node
/**
 * PhysQuest · DeepSeek / 中转站批量内容生产与质检流水线
 *
 * 零外部依赖（Node 22+ 原生 fetch）。专为兼容 OpenAI 协议的中转站 / 官方 API 设计：
 *   - 低并发队列（默认 2），遇到 429 / 5xx / 超时自动指数退避重试
 *   - 每条结果立刻落盘到 scripts/.tmp/，支持 Ctrl+C 后断点续跑
 *   - 不强依赖 response_format: json_object，内置 <think> 剥离 + 容错 JSON 提取
 *   - 严格本地 Schema 校验 + 真实物理引擎通道白名单校验，不合法自动打回重写
 *
 * 用法示例：
 *   # 1. 先干跑测试（不花任何 token，查看待处理队列与提示词）
 *   node scripts/deepseek-content-pipeline.mjs questions --dry-run --limit 2
 *   node scripts/deepseek-content-pipeline.mjs rubrics --dry-run --limit 2
 *
 *   # 2. 配好中转站环境变量，小批量试跑 3 条看质量
 *   LLM_BASE_URL="https://你的中转站/v1" \
 *   LLM_API_KEY="sk-你的key" \
 *   LLM_MODEL="deepseek-chat" \
 *   node scripts/deepseek-content-pipeline.mjs questions --limit 3
 *
 *   # 3. 批量起草其余 120 关的实验评分标准（自动用本地物理引擎提取真实通道做白名单）
 *   LLM_BASE_URL="https://你的中转站/v1" \
 *   LLM_API_KEY="sk-你的key" \
 *   node scripts/deepseek-content-pipeline.mjs rubrics --limit 5
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Simulation } from '../platform/shared/physics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const KD = join(REPO, 'shared', 'knowledge-data');
const OUT_DIR = join(HERE, '.tmp');
mkdirSync(OUT_DIR, { recursive: true });

/* ============================================================
 * 1. 配置读取（环境变量优先，其次 apps/launcher/config.local.json）
 * ========================================================== */

function loadLauncherConfig() {
  const p = join(REPO, 'apps', 'launcher', 'config.local.json');
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

const localCfg = loadLauncherConfig();
const BASE_URL = (process.env.LLM_BASE_URL || localCfg.endpoint || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const API_KEY = process.env.LLM_API_KEY || localCfg.apiKey || '';
const MODEL = process.env.LLM_MODEL || localCfg.model || 'deepseek-chat';
const CONCURRENCY = Math.max(1, Number(process.env.LLM_CONCURRENCY || 2));
const TIMEOUT_MS = Math.max(10000, Number(process.env.LLM_TIMEOUT_MS || 60000));

function resolveChatUrl(base) {
  if (/\/chat\/completions$/i.test(base)) return base;
  if (/\/v\d+$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/* ============================================================
 * 2. 容错 JSON 提取 + 退避重试请求层（中转站防坑核心）
 * ========================================================== */

export function extractJson(raw) {
  if (typeof raw !== 'string') return null;
  // 兼容 DeepSeek-R1 等带思维链标签的输出，先剥离 <think>...</think>
  const cleaned = raw
    .replace(/^\uFEFF/, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  const objStart = cleaned.indexOf('{');
  const arrStart = cleaned.indexOf('[');
  const useArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  const start = useArray ? arrStart : objStart;
  const end = cleaned.lastIndexOf(useArray ? ']' : '}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callLLM(messages, { maxRetries = 4, temperature = 0.4, maxTokens = 2000 } = {}) {
  if (!API_KEY) {
    throw new Error('缺少 API Key：请通过环境变量 LLM_API_KEY 或 apps/launcher/config.local.json 配置');
  }
  const url = resolveChatUrl(BASE_URL);
  let lastErr = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(20000, 1500 * 2 ** (attempt - 1) + Math.random() * 500);
        console.warn(`  [重试 ${attempt}/${maxRetries}] HTTP ${res.status}，${Math.round(wait)}ms 后重试…`);
        await sleep(wait);
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('接口返回了空内容');
      }
      return text;
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) {
        const wait = Math.min(15000, 1500 * 2 ** (attempt - 1));
        console.warn(`  [重试 ${attempt}/${maxRetries}] ${e.message}，${wait}ms 后重试…`);
        await sleep(wait);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/** 带校验反馈的自修复生成：校验不通过时把具体错因回传模型再修一次 */
async function generateValidated(systemPrompt, userPrompt, validateFn, maxFixes = 2) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  for (let round = 1; round <= maxFixes + 1; round++) {
    const raw = await callLLM(messages);
    const parsed = extractJson(raw);
    if (!parsed) {
      messages.push({ role: 'assistant', content: raw });
      messages.push({ role: 'user', content: '你的回复无法解析为合法 JSON。请只输出纯 JSON，不要加多余解释。' });
      continue;
    }
    const err = validateFn(parsed);
    if (!err) return parsed;
    messages.push({ role: 'assistant', content: raw });
    messages.push({ role: 'user', content: `JSON 校验未通过：${err}。请修正后重新输出完整 JSON。` });
  }
  throw new Error('多次生成仍未通过本地 Schema 校验');
}

/* ============================================================
 * 3. 简易并发池 + 断点续跑读写
 * ========================================================== */

function readCheckpoint(file) {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function saveCheckpoint(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

async function runPool(items, concurrency, worker) {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current, idx, items.length);
    }
  });
  await Promise.all(runners);
}

/* ============================================================
 * 4. 子命令 A：批量生成高质量原创物理题（对标哈里代 Checkpoint 风格）
 * ========================================================== */

function validateQuestionBatch(parsed, knowledgeId, validMiscIds) {
  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length !== 3) {
    return '必须返回 { "questions": [ ...3道题... ] }，分别对应 easy / medium / hard';
  }
  const levels = new Set();
  for (const [i, q] of parsed.questions.entries()) {
    if (!['easy', 'medium', 'hard'].includes(q.level)) return `第 ${i + 1} 题 level 非法`;
    levels.add(q.level);
    if (typeof q.question !== 'string' || q.question.trim().length < 10) return `第 ${i + 1} 题题干过短`;
    if (!Array.isArray(q.options) || q.options.length !== 3) return `第 ${i + 1} 题必须有 3 个选项`;
    if (new Set(q.options).size !== 3) return `第 ${i + 1} 题存在重复选项`;
    for (const opt of q.options) {
      if (/以上都|都不对|无法判断|随便怎么用/.test(String(opt))) {
        return `第 ${i + 1} 题包含凑数选项「${opt}」`;
      }
    }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= 3) {
      return `第 ${i + 1} 题 answerIndex 必须在 0..2`;
    }
    if (!Array.isArray(q.optionNotes) || q.optionNotes.length !== 3) {
      return `第 ${i + 1} 题 optionNotes 长度必须为 3`;
    }
    for (const n of q.optionNotes) {
      if (typeof n !== 'string' || n.trim().length < 6) return `第 ${i + 1} 题 optionNotes 过短`;
    }
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 15) {
      return `第 ${i + 1} 题 explanation 过短`;
    }
    if (q.misconceptionId && !validMiscIds.has(q.misconceptionId)) {
      return `第 ${i + 1} 题引用了不存在的 misconceptionId: ${q.misconceptionId}`;
    }
  }
  if (levels.size !== 3) return '3 道题必须分别覆盖 easy / medium / hard 各 1 道';
  return null;
}

async function runQuestions({ dryRun, limit, domain }) {
  const cards = JSON.parse(readFileSync(join(KD, 'knowledge-cards.json'), 'utf8')).cards;
  const optMisc = JSON.parse(readFileSync(join(KD, 'optics-lens', 'misconceptions.json'), 'utf8')).misconceptions;
  const crossMisc = JSON.parse(readFileSync(join(KD, 'misconceptions.json'), 'utf8')).misconceptions;
  const allMisc = [...optMisc, ...crossMisc];
  const validMiscIds = new Set(allMisc.map((m) => m.id));

  const outFile = join(OUT_DIR, 'generated-questions.json');
  const saved = readCheckpoint(outFile);

  let todo = cards.filter((c) => !saved[c.id]);
  if (domain) todo = todo.filter((c) => c.domain === domain);
  if (limit > 0) todo = todo.slice(0, limit);

  console.log(`\n[题库生成] 共 ${cards.length} 个知识点，已完成 ${Object.keys(saved).length}，本次待跑 ${todo.length} 个`);
  if (todo.length === 0) return;

  const systemPrompt = [
    '你是资深物理教研员，擅长编写类似 Halliday《Fundamentals of Physics》Checkpoint 风格的反直觉概念与情境题。',
    '所有题目必须为原创中文物理题，禁止照抄任何教材原题，禁止编造「搭建方案主要说什么」或「控制变量法套话」这类元问题。',
    '每题必须考真实物理规律、方向/大小变化、边界条件或典型生活直觉误区。',
    '只输出严格合法 JSON，不要输出任何额外文字。',
  ].join('\n');

  const buildUserPrompt = (card) => {
    const relatedMisc = allMisc
      .filter((m) => (m.knowledgeIds ?? []).includes(card.id))
      .map((m) => `${m.id}（误区：${m.belief} → 真相：${m.truth}）`);
    return JSON.stringify(
      {
        task: '为下面这条物理知识点编写 3 道原创单选题（easy / medium / hard 各 1 道）',
        knowledge: {
          id: card.id,
          stage: card.stage,
          domain: card.domainLabel,
          title: card.title,
          oneLine: card.oneLine,
          formula: card.formula || '',
          why: card.why,
        },
        availableMisconceptions: relatedMisc,
        outputSchema: {
          questions: [
            {
              level: 'easy | medium | hard',
              question: '具体物理情境题干',
              options: ['选项A', '选项B', '选项C'],
              answerIndex: 0,
              explanation: '总解析（20-80字）',
              optionNotes: ['解释选项A为何对/错', '解释选项B为何对/错', '解释选项C为何对/错'],
              misconceptionId: '可选：仅从 availableMisconceptions 中选用，没有则省略该字段',
            },
          ],
        },
      },
      null,
      2,
    );
  };

  if (dryRun) {
    console.log('\n[DRY-RUN] 样例提示词（第 1 条）：\n');
    console.log(buildUserPrompt(todo[0]));
    return;
  }

  await runPool(todo, CONCURRENCY, async (card, i, total) => {
    process.stdout.write(`  (${i}/${total}) 生成 ${card.id} ${card.title} … `);
    try {
      const res = await generateValidated(
        systemPrompt,
        buildUserPrompt(card),
        (parsed) => validateQuestionBatch(parsed, card.id, validMiscIds),
      );
      saved[card.id] = res.questions.map((q) => ({
        id: `BQ-${card.id}-ai-${q.level}`,
        knowledgeId: card.id,
        level: q.level,
        type: 'single',
        question: q.question.trim(),
        options: q.options.map((s) => String(s).trim()),
        answerIndex: q.answerIndex,
        explanation: q.explanation.trim(),
        optionNotes: q.optionNotes.map((s) => String(s).trim()),
        ...(q.misconceptionId ? { misconceptionId: q.misconceptionId } : {}),
      }));
      saveCheckpoint(outFile, saved);
      console.log('✓');
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  });
  console.log(`\n[完成] 已保存至 ${outFile}`);
}

/* ============================================================
 * 5. 子命令 B：基于真实物理引擎通道，批量起草其余挑战的评分标准（Rubric）
 * ========================================================== */

function inspectExperimentRealChannels(expPath) {
  const file = JSON.parse(readFileSync(expPath, 'utf8'));
  const doc = file.experiment ?? file;
  const kinds = [...new Set((doc.components ?? []).map((c) => c.kind))];
  let channelSuffixes = [];
  let channelSample = [];
  try {
    const sim = new Simulation(doc);
    sim.advance(0.1);
    const channels = sim.measure().channels ?? {};
    const suffixes = new Set();
    for (const [k, v] of Object.entries(channels)) {
      const suffix = k.includes(':') ? k.split(':').slice(1).join(':') : k;
      suffixes.add(suffix);
      channelSample.push({ key: suffix, label: v.label, unit: v.unit });
    }
    channelSuffixes = [...suffixes];
  } catch {
    /* 某些空实验台或特殊文件兜底 */
  }
  return {
    title: doc.title || '',
    goal: doc.goal || '',
    observation: doc.observation || '',
    kinds,
    channelSuffixes,
    channelSample: channelSample.slice(0, 12),
  };
}

async function runRubrics({ dryRun, limit }) {
  const existingRubric = JSON.parse(
    readFileSync(join(REPO, 'apps', 'web', 'src', 'core', 'grading', 'rubric-optics-lens.json'), 'utf8'),
  );
  const covered = new Set(Object.keys(existingRubric.challenges ?? {}));

  const expDir = join(REPO, 'platform', 'experiments');
  const files = readdirSync(expDir)
    .filter((f) => f.endsWith('.pqexp.json'))
    .sort();

  const outFile = join(OUT_DIR, 'generated-rubrics.json');
  const saved = readCheckpoint(outFile);

  let todo = files
    .map((f) => ({ id: f.replace(/\.pqexp\.json$/, ''), path: join(expDir, f) }))
    .filter((item) => !covered.has(item.id) && !saved[item.id]);

  if (limit > 0) todo = todo.slice(0, limit);
  console.log(`\n[Rubric 起草] 实验文件 ${files.length} 个，已有标准 ${covered.size} 个，已缓存 ${Object.keys(saved).length} 个，本次待跑 ${todo.length} 个`);
  if (todo.length === 0) return;

  const systemPrompt = [
    '你是物理实验评分规则工程师。根据实验文件的真实器具列表与真实引擎测量通道，为该关生成客观可判定的评分 rubric。',
    '硬约束：requiredKinds 只能从 actualKinds 里选；requiredObservations 和 optionalObservations 只能从 realChannels 的 key 里选，严禁编造不存在的字段。',
    '只输出严格合法 JSON。',
  ].join('\n');

  if (dryRun) {
    const info = inspectExperimentRealChannels(todo[0].path);
    console.log('\n[DRY-RUN] 样例实验提取结果（第 1 条）：\n');
    console.log(JSON.stringify({ challengeId: todo[0].id, ...info }, null, 2));
    return;
  }

  await runPool(todo, CONCURRENCY, async (item, i, total) => {
    const info = inspectExperimentRealChannels(item.path);
    if (info.kinds.length === 0) {
      console.log(`  (${i}/${total}) 跳过空实验台 ${item.id}`);
      return;
    }
    const kindSet = new Set(info.kinds);
    const chanSet = new Set(info.channelSuffixes);

    const userPrompt = JSON.stringify(
      {
        challengeId: item.id,
        title: info.title,
        goal: info.goal,
        observationHint: info.observation,
        actualKinds: info.kinds,
        realChannels: info.channelSample,
        outputSchema: {
          requiredKinds: ['必须出现的器具 kind（只能来自 actualKinds）'],
          requiredObservations: ['必看通道 key（只能来自 realChannels，1-3个）'],
          optionalObservations: ['可选通道 key（只能来自 realChannels）'],
          unmappableObservations: ['无法直接对应通道、需观察画面的定性现象'],
        },
      },
      null,
      2,
    );

    process.stdout.write(`  (${i}/${total}) 起草 ${item.id} ${info.title} … `);
    try {
      const res = await generateValidated(systemPrompt, userPrompt, (p) => {
        if (!Array.isArray(p.requiredKinds) || !Array.isArray(p.requiredObservations)) {
          return '缺少 requiredKinds 或 requiredObservations 数组';
        }
        for (const k of p.requiredKinds) if (!kindSet.has(k)) return `非法器具 kind: ${k}`;
        for (const c of [...p.requiredObservations, ...(p.optionalObservations ?? [])]) {
          if (!chanSet.has(c)) return `非法通道 key: ${c}`;
        }
        return null;
      });
      saved[item.id] = {
        requiredKinds: res.requiredKinds,
        requiredObservations: res.requiredObservations,
        optionalObservations: res.optionalObservations ?? [],
        unmappableObservations: res.unmappableObservations ?? [],
      };
      saveCheckpoint(outFile, saved);
      console.log('✓');
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  });
  console.log(`\n[完成] 已保存至 ${outFile}`);
}

/* ============================================================
 * 6. CLI 入口
 * ========================================================== */

const args = process.argv.slice(2);
const cmd = args[0];
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 0 : 0;
const domainIdx = args.indexOf('--domain');
const domain = domainIdx >= 0 ? args[domainIdx + 1] : '';

if (cmd === 'questions') {
  await runQuestions({ dryRun, limit, domain });
} else if (cmd === 'rubrics') {
  await runRubrics({ dryRun, limit });
} else {
  console.log(`用法：
  node scripts/deepseek-content-pipeline.mjs questions [--dry-run] [--limit N] [--domain mechanics]
  node scripts/deepseek-content-pipeline.mjs rubrics   [--dry-run] [--limit N]

环境变量：
  LLM_BASE_URL     中转站或官方接口地址（默认 https://api.deepseek.com/v1）
  LLM_API_KEY      API Key（未设时自动回退读取 apps/launcher/config.local.json）
  LLM_MODEL        模型名（默认 deepseek-chat）
  LLM_CONCURRENCY  并发数（默认 2）`);
}
