import type { LensParams } from '../../core/contracts';

/**
 * 剧本参数 → 光具座参数
 *
 * 剧本里的 `targetParams` 是「只给参数，不给画面操作」的最小集合：
 *   { u, f, screenX }                —— 大多数步骤
 *   { u, f, screenX, maskTop }       —— 「遮住一半」那一段（maskTop 是布尔）
 *
 * 类型上 DemoPlayer 收的是 `Record<string, number>`（按接口约定），
 * 但数据里确实混了布尔值，所以这里做一次「只认已知字段 + 只认对类型」的过滤：
 * 剧本新增了实验台还不认识的字段时，安静忽略，而不是把 NaN 写进状态。
 */
const NUMERIC_KEYS = ['u', 'f', 'h', 'screenX', 'lensDiameter'] as const;

export function toLensPatch(raw: Record<string, number> | Partial<LensParams> | unknown): Partial<LensParams> {
  const out: Partial<LensParams> = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;

  for (const key of NUMERIC_KEYS) {
    const value = src[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }

  if (typeof src.maskTop === 'boolean') out.maskTop = src.maskTop;

  return out;
}
