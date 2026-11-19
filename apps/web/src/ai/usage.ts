/**
 * 用量统计（本机）
 *
 * 目的：为将来的「按 token 计费」打好基础。
 * 现在只做本地统计，不上报任何地方。
 *
 * 计费口径（团队定的）：
 *   1,000,000 token = $0.15 或 ¥1
 * 所以：
 *   每 token ≈ $0.00000015 ≈ ¥0.000001
 *
 * 注意：这只是**我们这边的定价预估**，实际上游费用由用户的厂商账户扣。
 */

const KEY = 'physquest.usage.v1';

export const PRICE_PER_MILLION_USD = 0.15;
export const PRICE_PER_MILLION_CNY = 1;
export const USD_TO_CNY = 1 / PRICE_PER_MILLION_USD * PRICE_PER_MILLION_CNY; // ≈ 6.67

export interface UsageRecord {
  tokens: number;
  at: number;
  model: string;
}

export interface UsageSummary {
  totalTokens: number;
  calls: number;
  costUsd: number;
  costCny: number;
  byModel: Record<string, number>;
}

interface Store {
  records: UsageRecord[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (Array.isArray(parsed.records)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { records: [] };
}

function save(s: Store) {
  try {
    // 只留最近 500 条，别把 localStorage 撑爆
    const trimmed = { records: s.records.slice(-500) };
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* 存不下就算了 */
  }
}

/** 记一次调用。tokens 拿不到就按估算传（1 token ≈ 2 个中文字符） */
export function recordUsage(tokens: number, model: string) {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const s = load();
  s.records.push({ tokens: Math.round(tokens), at: Date.now(), model });
  save(s);
}

/** 粗略估算：中英混排按 2 字符 ≈ 1 token */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 2);
}

export function getUsage(): UsageSummary {
  const s = load();
  const byModel: Record<string, number> = {};
  let totalTokens = 0;
  for (const r of s.records) {
    totalTokens += r.tokens;
    byModel[r.model] = (byModel[r.model] ?? 0) + r.tokens;
  }
  const million = totalTokens / 1_000_000;
  return {
    totalTokens,
    calls: s.records.length,
    costUsd: million * PRICE_PER_MILLION_USD,
    costCny: million * PRICE_PER_MILLION_CNY,
    byModel,
  };
}

export function resetUsage() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
