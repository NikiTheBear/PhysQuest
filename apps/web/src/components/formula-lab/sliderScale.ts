import type { LabInputSpec } from './labData';

/**
 * 公式实验室的滑杆刻度 & 数字格式
 *
 * 从 FormulaLab.tsx 里抽出来的原因：这些是纯函数，也最容易出错（对数刻度、端点、
 * 单调性、默认值落点），埋在组件里只能靠肉眼看。抽出来之后 sliderScale.test.ts
 * 可以拿 formula-lab.json 里真实的 193 个 input 逐格扫一遍。
 *
 * 三种刻度（193 个 input 的实际分布：91 线性 / 99 对数 / 3 对称对数）：
 *
 *   linear —— 普通等距滑杆。步长 = (max - min) / 1000。
 *
 *   log    —— 滑杆位置按 ln(v / min) 均匀分布，「翻倍」永远是同一段距离。
 *             两组输入走这条：① max / min ≥ 1000 的 98 个（1e20~2e30 的星体质量、
 *             1e-30~1e-10 的粒子质量、10~1e5 的时间常数……）；
 *             ② 还有 1 个额外命中 K-M3-09 的 r [6.4e6, 1e9]（轨道半径）：
 *             它的区间只跨 156 倍，但线性每格 993 km、默认值 6600 km 会被吸到
 *             6400 km（差 3%，肉眼就是「默认值不在默认值上」）。对数下误差 0.6%。
 *
 *   symlog —— 区间大到线性刻度不能用、又没法取对数的补丁。判据是「线性每格
 *             比典型值（默认值）粗 10 倍以上」。只剩 3 个：
 *               K-T2-08 qc [0, 1e6]        默认 600 J   （min = 0，不能取 log）
 *               K-T3-05 q  [-1e6, 1e6]     默认 500 J   （跨零，不能取 log）
 *               K-T3-05 w  [-1e6, 1e6]     默认 200 J   （同上）
 *             0 附近按线性、两头按对数（经典 symlog），保证 0 可表示、默认值
 *             附近有足够刻度格、两端又能拖到极限。
 *
 * 两条硬约束（test 里对全量数据逐格断言）：
 *   ① min ≤ 0 的输入**绝不**走 log —— log(0) = -∞、log(负数) = NaN，
 *      端点会直接崩成 NaN 并污染整条滑杆。数据里有 13 个 input 的 min 恰好是 0、
 *      10 个跨零，全靠在 scaleKind 里先短路掉。
 *   ② 对任意 p ∈ [0, 1000]，fromPos(p) 必须是有限数、落在 [min, max] 内、
 *      且随 p 单调不减（滑杆不能「拖过头倒回去」）。
 */

/** 滑杆内部用 0 ~ POS_MAX 的整数位置 */
export const POS_MAX = 1000;

/** 跨多少个数量级才值得换对数刻度 */
const LOG_RATIO = 1000;

/**
 * 「线性刻度太粗」的判据：一格（span / POS_MAX）比典型值（默认值）的 1/DIV 还大，
 * 就说明这条滑杆调不到典型值附近（默认值会被吸到最近的一格上，甚至吸到 0）。
 */
const COARSE_STEP_DIV = 10;

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

export function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

/** 1.000e+5 → 1e5，1.0000e-4 → 1e-4（JS 的指数写法带 `+` 和多余零，放界面里难看） */
function expText(v: number, digits: number): string {
  const [mant, exp] = v.toExponential(digits).split('e');
  return `${trimZeros(mant)}e${exp.replace('+', '')}`;
}

/**
 * 界面上给人看的数字：4~6 位有效数字，非常大 / 非常小的时候用科学计数法
 *（1e-34 那类必须这样，否则一串 0 数不过来）。
 *
 * 这里原来有个坑（已修，见 test）：`toPrecision(5)` 在整数位数 ≥ 精度时会
 * 自己切到指数写法，也就是 1e5 ≤ |v| < 1e6 这一段会输出 "1.0000e+5" ——
 * 但这一段按阈值本该走定点写法（阈值是 1e6）。K-M2-07 的滑杆右端就显示成
 * 了「2.0000e+5」而不是「200000」。修法：`String(Number(...))` 收回来再转字符串，
 * 100000 → "100000"，101300 → "101300"，-998000 → "-998000"。
 */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e6 || a < 1e-3) return expText(v, 3);
  return trimZeros(String(Number(v.toPrecision(5))));
}

/**
 * 输入框里的原文。
 * 极大 / 极小的值写成 1e12 这种，一来输入框放得下（1e20 那类整串数字有 21 位），
 * 二来这些量本来就是「量级」在起作用的，写全反而看不出数量级。
 */
export function numText(v: number): string {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e9 || a < 1e-4)) return expText(v, 3);
  return String(Number(v.toPrecision(8)));
}

export type ScaleKind = 'linear' | 'log' | 'symlog';

/** 默认值收口到 [min, max]（数据里偶尔会有默认值越界/缺失） */
function safeDefault(inp: LabInputSpec): number {
  const d = Number.isFinite(inp.default) ? inp.default : inp.min;
  return clamp(d, inp.min, inp.max);
}

/**
 * 选刻度。三条规则，按顺序短路：
 *   ① `min > 0` 且 `max / min ≥ 1000` → log
 *   ② 线性每格比典型值的 1/10 还粗 → 全正区间用 log，否则（从 0 起 / 跨零）用 symlog
 *   ③ 其余 linear
 *
 * 规则 ② 是给数据兜底的：默认值代表「出题人认为的典型值」，如果一格就跨过它，
 * 那条滑杆的默认位置等于没意义。193 个 input 里规则 ② 只命中 4 个
 *（K-M3-09/r、K-T2-08/qc、K-T3-05/q、K-T3-05/w），另外 189 个行为完全不变。
 *
 * 为什么阈值是 1/10 而不是 1/2：1/2 只能抓到最极端的 3 个（qc/q/w），
 * 像 K-M3-09/r（默认 6600 km 会被吸到 6400 km，差 3%）这种「差得不多但看得见」
 * 的就漏了；1/10 只多命中它 1 个，再收紧（1/20）就会把 K-N4-01/n（能级编号 1~100）
 * 这种完全正常的整数参数也拉进来，得不偿失。
 */
export function scaleKind(inp: LabInputSpec): ScaleKind {
  const span = inp.max - inp.min;
  if (!Number.isFinite(span) || !(span > 0)) return 'linear';
  const positive = Number.isFinite(inp.min) && inp.min > 0;

  // ① min > 0 是硬前提（见文件头约束 ①）
  if (positive && inp.max / inp.min >= LOG_RATIO) return 'log';

  // ② 线性刻度粗到调不到典型值
  const dv = safeDefault(inp);
  if (dv !== 0 && span / POS_MAX > Math.abs(dv) / COARSE_STEP_DIV) {
    return positive ? 'log' : 'symlog';
  }
  return 'linear';
}

/** 滑杆的 title 提示（鼠标悬停时告诉用户这条为什么不是均匀的） */
export const SCALE_TITLE: Record<ScaleKind, string> = {
  linear: '线性刻度',
  log: '对数刻度：范围跨了多个数量级，按倍数走',
  symlog: '对称对数刻度：0 附近细、两头粗',
};

/**
 * symlog 的「线性区宽度」c：0 附近 |v| ≲ c 时接近线性，再往外按对数走。
 * 取默认值的绝对值，这样「典型值」周围一定分到足够刻度格；
 * 默认值为 0 时退化成 span / POS_MAX（保证 c > 0，不会除零）。
 */
function symlogCenter(inp: LabInputSpec): number {
  const a = Math.abs(safeDefault(inp));
  if (a > 0 && Number.isFinite(a)) return a;
  const span = Math.abs(inp.max - inp.min);
  return span > 0 ? span / POS_MAX : 1;
}

/** 值 → symlog 坐标（保号的对数，0 → 0） */
function symlog(v: number, c: number): number {
  return Math.sign(v) * Math.log1p(Math.abs(v) / c);
}

/** symlog 坐标 → 值 */
function symlogInv(s: number, c: number): number {
  return Math.sign(s) * c * Math.expm1(Math.abs(s));
}

/** 值 → 滑杆位置（0 ~ POS_MAX，可能是小数） */
export function toPos(v: number, inp: LabInputSpec): number {
  const span = inp.max - inp.min;
  if (!Number.isFinite(span) || !(span > 0)) return 0;
  const x = clamp(v, inp.min, inp.max);
  const kind = scaleKind(inp);
  if (kind === 'log') {
    const t = Math.log(x / inp.min) / Math.log(inp.max / inp.min);
    return clamp(t, 0, 1) * POS_MAX;
  }
  if (kind === 'symlog') {
    const c = symlogCenter(inp);
    const lo = symlog(inp.min, c);
    const hi = symlog(inp.max, c);
    if (!(hi > lo)) return 0;
    return clamp((symlog(x, c) - lo) / (hi - lo), 0, 1) * POS_MAX;
  }
  return clamp((x - inp.min) / span, 0, 1) * POS_MAX;
}

/** 滑杆位置 → 值（结果收 6 位有效数字，避免 0.30000000000000004 这类尾巴） */
export function fromPos(p: number, inp: LabInputSpec): number {
  const span = inp.max - inp.min;
  const t = !Number.isFinite(span) || !(span > 0) ? 0 : clamp(p, 0, POS_MAX) / POS_MAX;
  const kind = scaleKind(inp);
  let raw: number;
  if (kind === 'log') {
    raw = inp.min * Math.pow(inp.max / inp.min, t);
  } else if (kind === 'symlog') {
    const c = symlogCenter(inp);
    const lo = symlog(inp.min, c);
    const hi = symlog(inp.max, c);
    raw = symlogInv(lo + t * (hi - lo), c);
  } else {
    raw = inp.min + t * span;
  }
  // 兜底：任何非有限结果都退回最近的端点，绝不让 NaN 流进输入框
  if (!Number.isFinite(raw)) raw = t <= 0 ? inp.min : inp.max;
  return clamp(Number(raw.toPrecision(6)), inp.min, inp.max);
}
