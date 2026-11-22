/**
 * 目标判定（winCondition）
 *
 * 文档 §2.4 缺口 4：全仓库只有 `WinCondition` 的类型声明（contracts.ts:158），
 * **没有任何判定函数**。评分要用 `goalMet`，所以在这里补一个。
 *
 * 注意三点：
 *  1. `m` 在 u ≈ f 时是 `Infinity` / `null`（缺口 5），必须能返回 `'unknown'`；
 *  2. 判定在本地做，AI 只看到 `达成了 / 还没达到`，看不到原始数字的容差计算；
 *  3. 自动挑战的 `winCondition` 是假的 `{metric:'m', op:'<', value:0}`（§7.3 第 3 条），
 *     判出来多半是 `yes`，别当回事 —— 它只是给评语提供一个锚点。
 */

import type { LensMetrics, WinCondition } from '../contracts';

export type GoalMet = 'yes' | 'no' | 'unknown';

export function checkWin(c: WinCondition, m: Partial<LensMetrics>): GoalMet {
  const v = m[c.metric] as number | boolean | undefined | null;
  if (v === undefined || v === null) return 'unknown';

  switch (c.op) {
    case 'true':
      return v === true ? 'yes' : 'no';
    case 'false':
      return v === false ? 'yes' : 'no';
    case '≈': {
      if (typeof v !== 'number' || typeof c.value !== 'number') return 'unknown';
      if (!Number.isFinite(v)) return 'unknown';
      // 加 1e-9：容差本身是十进制小数，浮点误差会让 |Δ| = 0.06000000000000005 掉出去
      return Math.abs(v - c.value) <= (c.tolerance ?? 0.05) + 1e-9 ? 'yes' : 'no';
    }
    case '<':
      if (typeof v !== 'number' || typeof c.value !== 'number') return 'unknown';
      if (!Number.isFinite(v)) return 'unknown';
      return v < c.value ? 'yes' : 'no';
    case '>':
      if (typeof v !== 'number' || typeof c.value !== 'number') return 'unknown';
      if (!Number.isFinite(v)) return 'unknown';
      return v > c.value ? 'yes' : 'no';
    default:
      return 'unknown';
  }
}

/** 把 winCondition 写成中文原话，塞进提示词的「本关目标」一行 */
export function describeWin(c: WinCondition): string {
  const metric = METRIC_LABEL[c.metric] ?? c.metric;
  switch (c.op) {
    case 'true':
      return `${metric}为真`;
    case 'false':
      return `${metric}为假`;
    case '≈':
      return `${metric} ≈ ${c.value}${c.tolerance ? `（容差 ±${c.tolerance}）` : ''}`;
    case '<':
      return `${metric} < ${c.value}`;
    case '>':
      return `${metric} > ${c.value}`;
    default:
      return `${metric}`;
  }
}

const METRIC_LABEL: Partial<Record<keyof LensMetrics, string>> = {
  v: '像距 v',
  m: '放大率 m',
  real: '实像',
  isParallel: '出射光平行',
  imageHeight: '像高',
  imageX: '像的位置',
  imageY: '像的顶端高度',
  screenHasImage: '光屏上有清晰像',
  blurDiameter: '弥散圆',
  relativeIlluminance: '相对照度',
  description: '成像描述',
};
