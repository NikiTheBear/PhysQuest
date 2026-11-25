/**
 * AI 适配层：调一次模型，然后把返回体洗成白名单结构
 *
 * 铁律 1 的最后一道闸在这里：
 *   - `sanitize` 只认 6 个顶层字段，多余的（rewrite / suggested / example …）直接丢掉；
 *   - **输出里没有 score**，AI 想给分也没有位置放；
 *   - `guardNumbers` 把评语里的数字逐个对回输入，出现外来数字的整句退回本地模板。
 *
 * 文档出处：§3.5 返回体清洗、§3.6 数字守卫、§4 拒绝评分、§4.1 模板评语。
 */

import { chat as defaultChat, type AIConfig, type ChatMessage } from '../../ai/client';
import { fallbackRefs, assemblyComment, observationComment, variablesComment } from './compute';
import { buildPrompt } from './prompt';
import type {
  AiDimension,
  AiGrade,
  Claim,
  ConclusionBand,
  DimensionKey,
  GradingInput,
  RefuseCode,
} from './types';
import { DIMENSION_KEYS } from './types';

/* ============================================================
 * 依赖注入（测试里换成 fake）
 * ========================================================== */

export type ChatResult = { ok: true; text: string } | { ok: false; error: unknown };

export type ChatFn = (
  config: AIConfig,
  messages: ChatMessage[],
  opts?: { maxTokens?: number; timeoutMs?: number },
) => Promise<ChatResult>;

export interface AiGradeDeps {
  chat?: ChatFn;
  /** JSON 解析失败时最多试几次，默认 2（§3.1：只在 AI_INVALID 时重试 1 次） */
  attempts?: number;
}

/* ============================================================
 * 1. 解析 + 白名单清洗（§3.5）
 * ========================================================== */

const ALLOWED_TOP = new Set([
  'version',
  'challengeId',
  'dimensions',
  'claims',
  'conclusionBand',
  'summary',
]);

const BAND_SET = new Set<ConclusionBand>(['excellent', 'solid', 'shaky', 'wrong']);
const VERDICT_SET = new Set(['agree', 'contradict', 'unrelated']);

/** 从模型回复里抠出 JSON 对象。允许被 ``` 包着，也允许前后有闲话 */
export function extractJson(text: string): unknown | null {
  if (typeof text !== 'string') return null;
  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeQuote(s: string): string {
  return s
    .replace(/[\s,，。.;；:：!！?？「」『』“”"'()（）]+/g, '')
    .toLowerCase();
}

function validClaim(raw: unknown, input: GradingInput): Claim | null {
  if (!isPlainObject(raw)) return null;
  const quote = raw.quote;
  const checkId = raw.checkId;
  const verdict = raw.verdict;
  if (typeof quote !== 'string' || !quote.trim()) return null;
  if (typeof checkId !== 'string') return null;
  if (!input.checks.some((c) => c.id === checkId)) return null;
  if (typeof verdict !== 'string' || !VERDICT_SET.has(verdict)) return null;
  const trimmed = quote.trim();
  const exact = input.reflection.text.includes(trimmed);
  const normQuote = normalizeQuote(trimmed);
  const fuzzy =
    !exact && normQuote.length >= 4 && normalizeQuote(input.reflection.text).includes(normQuote);
  return {
    // quote 必须能在反思原文中找到（允许标点与空白差异，但不允许 AI 凭空捏造）
    quote: exact || fuzzy ? trimmed.replace(/\s*\n+\s*/g, ' ').slice(0, 120) : '',
    checkId,
    verdict: verdict as Claim['verdict'],
    note: typeof raw.note === 'string' ? raw.note.trim().replace(/\s*\n+\s*/g, ' ').slice(0, 120) : '',
  };
}

export interface Sanitized {
  dimensions: Partial<Record<DimensionKey, AiDimension>>;
  claims: Claim[];
  conclusionBand: ConclusionBand;
  summary: string;
}

/**
 * 白名单过滤。返回 null 表示「这份返回完全不可用」（串台 / 缺字段 / 档位不认识）。
 *
 * 注意 `rewrite` / `suggestedText` / `example` 这类字段：这里逐个字段挑，
 * 所以它们**自然丢失**，不报错也不记录 —— 铁律 3 就是这么守住的。
 */
export function sanitize(raw: unknown, input: GradingInput): Sanitized | null {
  if (!isPlainObject(raw)) return null;

  // 只要认识的顶层键（多余键在这里就被抛掉）
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) if (ALLOWED_TOP.has(k)) o[k] = raw[k];

  if (o.challengeId !== input.challenge.id) return null; // 串台
  if (typeof o.conclusionBand !== 'string' || !BAND_SET.has(o.conclusionBand as ConclusionBand)) {
    return null;
  }
  if (!isPlainObject(o.dimensions)) return null;

  const dims: Partial<Record<DimensionKey, AiDimension>> = {};
  for (const k of DIMENSION_KEYS) {
    const d = (o.dimensions as Record<string, unknown>)[k];
    if (!isPlainObject(d)) return null;
    if (typeof d.text !== 'string' || !d.text.trim()) return null;
    dims[k] = {
      // 评语会进 Markdown 表格，换行会把表撕成两半，这里先拍平
      text: d.text.trim().replace(/\s*\n+\s*/g, ' ').slice(0, 200),
      refs: Array.isArray(d.refs)
        ? d.refs.filter((r): r is string => typeof r === 'string').slice(0, 4)
        : [],
    };
  }

  const claims: Claim[] = Array.isArray(o.claims)
    ? o.claims
        .map((c) => validClaim(c, input))
        .filter((c): c is Claim => Boolean(c && c.quote))
        .slice(0, 8)
    : [];

  return {
    dimensions: dims,
    claims,
    conclusionBand: o.conclusionBand as ConclusionBand,
    summary:
      typeof o.summary === 'string' ? o.summary.trim().replace(/\s*\n+\s*/g, ' ').slice(0, 300) : '',
  };
}

/* ============================================================
 * 2. 数字守卫（§3.6）
 * ========================================================== */

/**
 * 输入里出现过的所有数字。
 *
 * 每个数只收**恰好等于它自己**的几种写法：`15` / `15.0` / `15.0000` 都收，
 * 但 `1.6667` 不会收 `1.67` —— 文档 §3.2 明写「-2.8571 不能写成 -2.86」，
 * 四舍五入过的数字是编的，不是引的。
 */
export function allowedNumbers(input: GradingInput): Set<string> {
  const s = new Set<string>();
  const add = (n: number) => {
    if (!Number.isFinite(n)) return;
    s.add(String(n));
    for (let d = 0; d <= 4; d++) {
      const t = n.toFixed(d);
      if (Number(t) === n) s.add(t); // 只有「不多不少正好是它」才收
    }
    s.add(n.toFixed(4));
  };

  // 负数同时放行绝对值写法：读数是 -0.6667，学生和 AI 说「|m| 是 0.6667」也是对的
  const addBoth = (n: number) => {
    add(n);
    if (n < 0) add(-n);
  };

  for (const f of input.facts) {
    for (const v of Object.values(f.metrics)) if (typeof v === 'number') addBoth(v);
    for (const p of Object.values(f.params)) {
      for (const v of Object.values(p)) if (typeof v === 'number') addBoth(v);
    }
    if (f.lens) for (const v of Object.values(f.lens)) if (typeof v === 'number') addBoth(v);
  }
  for (const sc of Object.values(input.scores)) if (typeof sc.score === 'number') add(sc.score);
  // 编号数量和字数也允许出现（「三条记录」「12 个字」）
  add(input.facts.length);
  add(input.changes.length);
  add(input.checks.length);
  add(input.reflection.chars);
  return s;
}

/**
 * 这一句里有没有输入之外的数字。
 *
 * 先把 `R1` / `T12` / `V3` / `D1` 这类编号从文本里摘掉 —— 编号里的数字不是物理量，
 * 不摘会把每条正常评语都判成「编造」。
 */
export function foreignNumbers(text: string, allowed: Set<string>): string[] {
  const stripped = text
    .replace(/\b[RVTD]\d+\b/g, ' ')
    .replace(/[RVT]\d+/g, ' ')
    .replace(/D\d/g, ' ')
    // 放行序数词（如「第 1 组」「第2次」）和常见物理公式结构里的常数（如 1/f、2f）
    .replace(/第\s*\d+\s*[组次条步个项]/g, ' ')
    .replace(/\b1\/[fuv]\b/gi, ' ')
    .replace(/\b2f\b/gi, ' ');
  const matches = stripped.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return matches.filter((m) => {
    if (allowed.has(m)) return false;
    // 去掉多余的后导零再试一次（12.50 和 12.5 是同一个数）
    const trimmed = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
    if (allowed.has(trimmed)) return false;
    // 「15.0」和允许集合里的「15」是同一个数
    const asNum = Number(m);
    if (Number.isFinite(asNum) && allowed.has(String(asNum))) return false;
    return true;
  });
}

/* ============================================================
 * 3. 结论档位的硬校验（§1.5「代码侧硬校验」）
 * ========================================================== */

export interface BandDecision {
  band: ConclusionBand;
  /** 触发了哪条硬校验，UI/调试能用 */
  note: string | null;
}

export function enforceBand(sanitized: Sanitized): BandDecision {
  let band = sanitized.conclusionBand;
  let note: string | null = null;

  const contradicted = sanitized.claims.filter((c) => c.verdict === 'contradict');
  if (band === 'excellent' && contradicted.length > 0) {
    band = 'wrong';
    note = 'AI 判了 excellent，但 claims 里有与读数矛盾的陈述，按规则降到 wrong';
  } else if (band !== 'wrong' && contradicted.length > 0) {
    // 文档只写了 excellent 那一条；这里按其判据补齐：有矛盾就是 wrong
    band = 'wrong';
    note = 'claims 里有与读数矛盾的陈述，按判据降到 wrong';
  } else if (band === 'excellent' && sanitized.claims.length === 0) {
    band = 'shaky';
    note = 'AI 判了 excellent，但一条可核对陈述都没对上，按规则降到 shaky';
  }
  return { band, note };
}

/* ============================================================
 * 4. 主调用
 * ========================================================== */

export interface AiGradeOutcome {
  /** 清洗通过的 AI 结果；null 表示这次没拿到可用的 */
  ai: AiGrade | null;
  /** null / 'NO_AI' / 'AI_INVALID' */
  refused: RefuseCode | null;
  /** 每维是否因为外来数字被退回模板 */
  dropped: DimensionKey[];
  band: ConclusionBand | null;
  bandNote: string | null;
  attempts: number;
}

/**
 * 调一次模型（JSON 不合法时重试 1 次）。
 *
 * 注意 `by` 的判定不在这一层：这一层只回答「AI 给的哪些东西能用」，
 * 具体怎么和本地模板拼是 grade.ts 的事。
 */
export async function gradeWithAI(
  input: GradingInput,
  config: AIConfig,
  deps: AiGradeDeps = {},
): Promise<AiGradeOutcome> {
  const chat = deps.chat ?? (defaultChat as unknown as ChatFn);
  const maxAttempts = deps.attempts ?? 2;
  const { system, user } = buildPrompt(input);
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  let lastRefused: RefuseCode | null = 'NO_AI';
  let attempts = 0;

  for (let i = 0; i < maxAttempts; i++) {
    attempts++;
    let res: ChatResult;
    try {
      res = await chat(config, messages, { maxTokens: 1200, timeoutMs: 30000 });
    } catch {
      return {
        ai: null,
        refused: 'NO_AI',
        dropped: [],
        band: null,
        bandNote: null,
        attempts,
      };
    }
    if (!res.ok) {
      lastRefused = 'NO_AI';
      // 连不上就别重试了 —— 第二次也一样
      break;
    }

    const parsed = extractJson(res.text);
    const cleaned = parsed ? sanitize(parsed, input) : null;
    if (!cleaned) {
      lastRefused = 'AI_INVALID';
      continue; // 只在「格式不对」时重试
    }

    /* —— 数字守卫：哪一维的评语里出现了外来数字，就把那一维丢掉 —— */
    const allowed = allowedNumbers(input);
    const dropped: DimensionKey[] = [];
    const dims = { ...cleaned.dimensions };
    for (const key of DIMENSION_KEYS) {
      const d = dims[key];
      if (!d) continue;
      if (foreignNumbers(d.text, allowed).length > 0) {
        delete dims[key];
        dropped.push(key);
        continue;
      }
      dims[key] = { text: d.text, refs: d.refs };
    }
    // summary 也过一遍守卫；编了就清空（它不影响分数）
    const summaryBad = foreignNumbers(cleaned.summary, allowed).length > 0;

    const decision = enforceBand(cleaned);

    return {
      ai: {
        version: 1,
        challengeId: input.challenge.id,
        dimensions: dims as AiGrade['dimensions'],
        claims: cleaned.claims,
        conclusionBand: decision.band,
        summary: summaryBad ? '' : cleaned.summary,
      },
      refused: null,
      dropped,
      band: decision.band,
      bandNote: decision.note,
      attempts,
    };
  }

  return {
    ai: null,
    refused: lastRefused ?? 'AI_INVALID',
    dropped: [],
    band: null,
    bandNote: null,
    attempts,
  };
}

/* ============================================================
 * 5. AI 不可用时的本地兜底（§4.1）
 * ========================================================== */

export interface FallbackComments {
  assembly: string;
  observation: string;
  variables: string;
  conclusion: string;
}

/** 模板评语。**不许**出现「建议你这样写」这类句子（§4.1 末句） */
export function templateComments(input: GradingInput): FallbackComments {
  return {
    assembly: assemblyComment(input, input.scores, []),
    observation: observationComment(input, input.scores),
    variables: variablesComment(input, input.scores),
    // 照抄文档 §4.1 的结论模板：不猜学生写对没写对，只说「需要人再读一遍」
    conclusion: 'AI 评语不可用。规则只看出一件事：你写的句子和读数是否一致，需要人再读一遍。',
  };
}

export { fallbackRefs };
