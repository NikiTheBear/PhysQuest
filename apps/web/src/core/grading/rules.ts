/**
 * 评分规则 —— 全部是纯函数
 *
 * 对应 local/AI-GRADING-SPEC.md §1.2（D1）、§1.3（D2）、§1.4（D3）、§1.5（对照表 T）、§1.6（总分）。
 *
 * 硬要求（照抄文档）：
 *  - 输入输出都能 JSON.stringify；不碰 Date.now（时间由调用方给）；
 *  - 不调 AI、不读存储、不 import persistence；
 *  - 分数是**连续值**，档位只在显示时用（§1.2 的注）。
 */

import type {
  Band,
  ChangeRow,
  CheckRow,
  DimensionKey,
  Level,
  RunFact,
} from './types';
import {
  ASSEMBLY_FLOOR,
  PASS_LINE,
  W,
} from './types';
import { isCounted, isExempt, ENV_COUNTED, ENV_EXEMPT } from './params';

/* ============================================================
 * 小工具
 * ========================================================== */

const fin = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? n : null;

/** 数字格式化：4 位小数；null / Infinity 写成人话（§5.2 的显示规则） */
export function fmt(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined) return '无定义';
  if (!Number.isFinite(n)) return '无穷远';
  if (Math.abs(n) >= 1e6) return '无穷远';
  return n.toFixed(digits);
}

/** 比大小的三态：>0 表示 b 更大 */
function cmp(a: number | null, b: number | null): -1 | 0 | 1 | null {
  if (a === null || b === null) return null;
  if (Math.abs(a - b) < 1e-9) return 0;
  return b > a ? 1 : -1;
}

/* ============================================================
 * D1 · 组装合法（§1.2）
 * ========================================================== */

export interface AssemblyArgs {
  componentCount: number;
  kinds: string[];
  requiredKinds: string[];
  engineError: string | null;
  invalidChannels: number;
}

export function scoreAssembly(a: AssemblyArgs): { score: number; facts: string[] } {
  const facts: string[] = [];
  if (a.componentCount === 0) {
    return { score: 0, facts: ['实验台上没有任何器具'] };
  }
  if (a.engineError) {
    return { score: 20, facts: [`引擎报错：${a.engineError}`] };
  }
  const missing = a.requiredKinds.filter((k) => !a.kinds.includes(k));
  if (missing.length > 0) {
    const have = a.requiredKinds.length - missing.length;
    // requiredKinds 为空时不可能走到这里（missing 也会空），除零已被上面兜住
    const score = 20 + Math.round((60 * have) / a.requiredKinds.length);
    return { score, facts: [`缺少器具：${missing.join('、')}`] };
  }
  if (a.invalidChannels > 0) {
    return {
      score: 80,
      facts: [
        `器具齐全，但有 ${a.invalidChannels} 个读数没有有限值（例如物距正好等于焦距时放大率无定义）`,
      ],
    };
  }
  return { score: 100, facts: [`器具齐全（${a.kinds.join('、')}），引擎无报错`] };
}

/* ============================================================
 * D2 · 观测项（§1.3）
 * ========================================================== */

export function scoreObservation(req: string[], optional: string[], seen: string[]): {
  score: number | null;
  hits: string[];
  bonus: string[];
  reason?: 'insufficient';
} {
  if (req.length === 0) return { score: null, hits: [], bonus: [], reason: 'insufficient' };
  const hits = req.filter((k) => seen.includes(k));
  const bonus = optional.filter((k) => seen.includes(k));
  // 主项满分 100；可选量**不加分**，只写进评语（§1.3）
  return { score: Math.round((100 * hits.length) / req.length), hits, bonus };
}

/* ============================================================
 * D3 · 变化表 V 与变量控制（§1.4）
 * ========================================================== */

/** 一个快照里所有参数摊平：`组件id.参数名 → 值` */
function flatParams(f: RunFact): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  for (const [id, params] of Object.entries(f.params ?? {})) {
    for (const [k, v] of Object.entries(params ?? {})) out[`${id}.${k}`] = v;
  }
  for (const [k, v] of Object.entries(f.env ?? {})) out[`env.${k}`] = v;
  return out;
}

/** 「u 30→25」这种给人看的短写 */
function describeChange(key: string, from: unknown, to: unknown): string {
  const short = key.split('.').slice(-1)[0] ?? key;
  const a = typeof from === 'number' ? trimNum(from) : String(from);
  const b = typeof to === 'number' ? trimNum(to) : String(to);
  return `${short} ${a}→${b}`;
}

function trimNum(n: number): string {
  if (!Number.isFinite(n)) return '无定义';
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * 逐对比较，生成变化表 V。
 *
 * 口径（§1.4）：只看**真正变了**的参数；`counted` 计入「改了几个自变量」，
 * `exempt` 记一笔但不计数，两边都没有的参数直接忽略。
 */
export function buildChanges(facts: RunFact[], labId = 'optics-lens'): ChangeRow[] {
  const rows: ChangeRow[] = [];
  for (let i = 1; i < facts.length; i++) {
    const a = flatParams(facts[i - 1]);
    const b = flatParams(facts[i]);
    const changed: string[] = [];
    const exempt: string[] = [];
    const detail: string[] = [];

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const before = a[key];
      const after = b[key];
      if (before === after) continue;
      // 数字零容差：引擎内部有 round，浮点噪声不该算「改了」
      if (typeof before === 'number' && typeof after === 'number') {
        if (Math.abs(before - after) < 1e-9) continue;
      }
      if (before === undefined || after === undefined) continue; // 器具增删不算变量控制

      const isEnv = key.startsWith('env.');
      const name = isEnv ? key.slice(4) : (key.split('.').slice(-1)[0] ?? key);
      const counted = isEnv ? ENV_COUNTED.includes(name) : isCounted(labId, name);
      const exempted = isEnv ? ENV_EXEMPT.includes(name) : isExempt(labId, name);

      if (counted) {
        changed.push(name);
        detail.push(describeChange(key, before, after));
      } else if (exempted) {
        exempt.push(name);
        detail.push(`${describeChange(key, before, after)}（${EXEMPT_LABEL[name] ?? name}，豁免）`);
      }
      // 两边都没命中 → 忽略（例如 objectShape / 器具自带的外观参数）
    }

    rows.push({
      id: `V${i}`,
      from: facts[i - 1].id,
      to: facts[i].id,
      changed,
      exempt,
      dirty: changed.length > 1,
      summary: detail.join('，'),
    });
  }
  return rows;
}

const EXEMPT_LABEL: Record<string, string> = {
  screenX: '光屏',
  position: '位置',
  fixed: '固定',
  internal: '内阻',
  initialVoltage: '初值',
  initialCurrent: '初值',
  speed: '播放速度',
  time: '通电时间',
  mode: '电路接法',
};

export function scoreVariables(pairs: ChangeRow[]): {
  score: number | null;
  clean: number;
  dirty: number;
  reason?: 'insufficient';
} {
  if (pairs.length === 0) {
    // 只有一次记录 → 无法判断（§1.4 的注：判零等于惩罚「调到目标就锁定」）
    return { score: null, clean: 0, dirty: 0, reason: 'insufficient' };
  }
  const clean = pairs.filter((p) => !p.dirty).length;
  return { score: Math.round((100 * clean) / pairs.length), clean, dirty: pairs.length - clean };
}

/* ============================================================
 * 对照表 T（§1.5）
 * ========================================================== */

/**
 * 生成对照表。
 *
 * 编号分配写死：**先相邻对（按时间顺序），再首末对，最后单点** ——
 * 同样的输入永远得到同一套编号，可以写进测试断言。
 *
 * 每一对固定生成 6 条（a–f），每条记录固定生成 4 条（g–j）。
 * `m === null` 时 a 和 f 给 `'unknown'`，**不跳过这一行**。
 */
export function buildChecks(facts: RunFact[]): CheckRow[] {
  const rows: CheckRow[] = [];
  let n = 0;
  const push = (claim: string, verdict: CheckRow['verdict']) => {
    rows.push({ id: `T${++n}`, claim, verdict });
  };

  const pair = (a: RunFact, b: RunFact, tag = '') => {
    const suffix = tag ? `（${tag}）` : '';
    // a · |m|
    const ma = fin(a.metrics.m);
    const mb = fin(b.metrics.m);
    if (ma === null || mb === null) {
      const which = ma === null ? a.id : b.id;
      push(`${which} 的放大率无定义${suffix}`, 'unknown');
    } else {
      const c = cmp(Math.abs(ma), Math.abs(mb));
      push(
        c === 0
          ? `${b.id} 的 |m| 与 ${a.id} 相等${suffix}`
          : `${b.id} 的 |m| 比 ${a.id} ${c === 1 ? '大' : '小'}${suffix}`,
        c === null ? 'unknown' : 'yes',
      );
    }
    // b · |v|
    const va = fin(a.metrics.v);
    const vb = fin(b.metrics.v);
    const cv = cmp(va === null ? null : Math.abs(va), vb === null ? null : Math.abs(vb));
    push(
      cv === null
        ? `${b.id} 的 |v| 和 ${a.id} 无法比较${suffix}`
        : cv === 0
          ? `${b.id} 的 |v| 与 ${a.id} 相等${suffix}`
          : `${b.id} 的 |v| 比 ${a.id} ${cv === 1 ? '大' : '小'}${suffix}`,
      cv === null ? 'unknown' : 'yes',
    );
    // c · 光屏上有没有像
    if (typeof b.metrics.screenHasImage === 'boolean') {
      push(`${b.id} 的光屏上${b.metrics.screenHasImage ? '有' : '没有'}清晰像${suffix}`, 'yes');
    } else {
      push(`${b.id} 的光屏读数缺失${suffix}`, 'unknown');
    }
    // d · 弥散圆
    const ba = fin(a.metrics.blurDiameter);
    const bb = fin(b.metrics.blurDiameter);
    const cb = cmp(ba, bb);
    push(
      cb === null
        ? `${b.id} 的弥散圆和 ${a.id} 无法比较${suffix}`
        : cb === 0
          ? `${b.id} 的弥散圆与 ${a.id} 相等${suffix}`
          : `${b.id} 的弥散圆比 ${a.id} ${cb === 1 ? '大' : '小'}${suffix}`,
      cb === null ? 'unknown' : 'yes',
    );
    // e · 相对照度
    const ia = fin(a.metrics.relativeIlluminance);
    const ib = fin(b.metrics.relativeIlluminance);
    const ci = cmp(ia, ib);
    push(
      ci === null
        ? `${b.id} 的相对照度和 ${a.id} 无法比较${suffix}`
        : ci === 0
          ? `${b.id} 的相对照度与 ${a.id} 相等${suffix}`
          : `${b.id} 的相对照度比 ${a.id} ${ci === 1 ? '大' : '小'}${suffix}`,
      ci === null ? 'unknown' : 'yes',
    );
    // f · 正倒（m 的符号）
    if (mb === null) {
      push(`${b.id} 的像是正立还是倒立：放大率无定义${suffix}`, 'unknown');
    } else if (mb === 0) {
      push(`${b.id} 的像不成像（m = 0）${suffix}`, 'unknown');
    } else {
      push(`${b.id} 的像是${mb < 0 ? '倒立' : '正立'}的${suffix}`, 'yes');
    }
  };

  for (let i = 1; i < facts.length; i++) {
    pair(facts[i - 1], facts[i], `相邻 ${i}`);
  }
  if (facts.length >= 3) {
    // 首末对：学生写总结时说的总是「我一开始怎样、最后怎样」，
    // 没有这一对，这类句子一行都对不上（§1.5 的关键设计）
    pair(facts[0], facts[facts.length - 1], '首末两条');
  }

  for (const f of facts) {
    // g · 像高
    const ih = fin(f.metrics.imageHeight);
    push(
      ih === null ? `${f.id} 的像高无定义` : `${f.id} 的像高是 ${fmt(ih)} cm`,
      ih === null ? 'unknown' : 'yes',
    );
    // h · 实像 / 虚像
    if (typeof f.metrics.real === 'boolean') {
      push(`${f.id} 成的是${f.metrics.real ? '实' : '虚'}像`, 'yes');
    } else {
      push(`${f.id} 的实虚像读数缺失`, 'unknown');
    }
    // i · 像距
    const v = fin(f.metrics.v);
    push(
      v === null
        ? `${f.id} 的像距 v 无定义`
        : `${f.id} 的像距 v 是 ${fmt(v)} cm${v < 0 ? '（虚像，负数）' : ''}`,
      v === null ? 'unknown' : 'yes',
    );
    // j · 光屏上有没有像
    if (typeof f.metrics.screenHasImage === 'boolean') {
      push(`${f.id} 的光屏上${f.metrics.screenHasImage ? '有' : '没有'}清晰像`, 'yes');
    } else {
      push(`${f.id} 的光屏读数缺失`, 'unknown');
    }
  }

  return rows;
}

/* ============================================================
 * 总分（§1.6）
 * ========================================================== */

export function total(graded: Array<{ key: DimensionKey; score: number | null }>): number | null {
  const usable = graded.filter((g) => g.score !== null) as Array<{ key: DimensionKey; score: number }>;
  if (usable.length === 0) return null;
  const sumW = usable.reduce((n, g) => n + W[g.key], 0);
  if (sumW <= 0) return null;
  const sumS = usable.reduce((n, g) => n + W[g.key] * g.score, 0);
  return Math.round(sumS / sumW);
}

export function levelOf(t: number | null): Level {
  if (t === null) return 'not_graded';
  if (t >= 85) return 'excellent';
  if (t >= 70) return 'good';
  if (t >= PASS_LINE) return 'pass';
  return 'improve';
}

export function passedOf(t: number | null, d1: number | null): boolean {
  if (t === null) return false;
  return t >= PASS_LINE && (d1 === null || d1 >= ASSEMBLY_FLOOR);
}

/** 分数 → 单维度显示档位（档位只在显示时用） */
export function bandOf(score: number | null): Band {
  if (score === null) return 'insufficient';
  if (score >= 100) return 'top';
  if (score >= 80) return 'ok';
  if (score > 0) return 'weak';
  return 'zero';
}

/** 结论维度专用：分数由四档档位换算，不走 bandOf */
export function conclusionBandOf(band: 'excellent' | 'solid' | 'shaky' | 'wrong'): Band {
  if (band === 'excellent' || band === 'solid') return 'top';
  if (band === 'shaky') return 'weak';
  return 'zero';
}
