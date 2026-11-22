import { describe, expect, it } from 'vitest';
import { LABS } from './labData';
import type { LabInputSpec } from './labData';
import {
  POS_MAX,
  SCALE_TITLE,
  clamp,
  formatNumber,
  fromPos,
  numText,
  scaleKind,
  toPos,
  trimZeros,
} from './sliderScale';

/**
 * 滑杆刻度的测试。
 *
 * 这里最值钱的不是「手写几个例子」，而是最后那组**全量数据**断言：
 * formula-lab.json 里 193 个 input 每一个都逐格（0~1000）扫一遍。
 * 对数刻度的坑（min = 0 → log(0) = -∞、跨零 → log(负数) = NaN）原来只在
 * 「碰巧没触发」的状态下存在，靠人眼看代码是发现不了的。
 */

const inp = (o: Partial<LabInputSpec>): LabInputSpec => ({
  key: 'x',
  label: 'x',
  unit: '',
  min: 0,
  max: 1,
  default: 0.5,
  ...o,
});

const allInputs = (): Array<{ labId: string; title: string; inp: LabInputSpec }> => {
  const out: Array<{ labId: string; title: string; inp: LabInputSpec }> = [];
  for (const [labId, lab] of Object.entries(LABS)) {
    if (lab.kind !== 'formula') continue;
    for (const i of lab.inputs) out.push({ labId, title: lab.title, inp: i });
  }
  return out;
};

/* ============================================================
   数字格式
   ============================================================ */

describe('格式：formatNumber / numText', () => {
  it('普通数 4~6 位有效数字，去掉尾巴上的零', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(0.25)).toBe('0.25');
    expect(formatNumber(343)).toBe('343');
    expect(formatNumber(2.0008)).toBe('2.0008');
    expect(formatNumber(-3.5)).toBe('-3.5');
  });

  it('极大 / 极小走科学计数法，不带 `+`、不带多余零', () => {
    expect(formatNumber(6.674e-11)).toBe('6.674e-11');
    expect(formatNumber(5.97e24)).toBe('5.97e24');
    expect(formatNumber(1e-34)).toBe('1e-34');
    expect(formatNumber(-1.5e8)).toBe('-1.5e8');
  });

  it('1e5 ~ 1e6 之间不许漏成指数写法（这里是原来的 bug）', () => {
    // (100000).toPrecision(5) === "1.0000e+5"，直接塞界面会显示成「1.0000e+5」
    expect(formatNumber(100000)).toBe('100000');
    expect(formatNumber(101300)).toBe('101300');
    expect(formatNumber(200000)).toBe('200000');
    expect(formatNumber(998000)).toBe('998000');
    expect(formatNumber(-998000)).toBe('-998000');
    // 到 1e6 才切科学计数法
    expect(formatNumber(1e6)).toBe('1e6');
  });

  it('坏了的值显示破折号，不显示 NaN / Infinity', () => {
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
    expect(formatNumber(-Infinity)).toBe('—');
    expect(numText(NaN)).toBe('');
    expect(numText(Infinity)).toBe('');
  });

  it('numText：输入框里放得下，而且能被 Number() 原样读回来', () => {
    expect(numText(0)).toBe('0');
    expect(numText(6600000)).toBe('6600000');
    expect(numText(5.97e24)).toBe('5.97e24');
    expect(numText(1.66e-27)).toBe('1.66e-27');
    for (const v of [0, 1, 0.5, 343, 6600000, 5.97e24, 1.66e-27, 1e-30]) {
      expect(Number(numText(v))).toBe(v);
    }
  });

  it('trimZeros 只动小数尾部', () => {
    expect(trimZeros('1.5000')).toBe('1.5');
    expect(trimZeros('2.000')).toBe('2');
    expect(trimZeros('1000')).toBe('1000');
    expect(trimZeros('0.0001')).toBe('0.0001');
  });

  it('clamp 把 NaN / Infinity 收成下界', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(NaN, 2, 10)).toBe(2);
    expect(clamp(Infinity, 2, 10)).toBe(2);
  });
});

/* ============================================================
   刻度选择
   ============================================================ */

describe('刻度选择 scaleKind', () => {
  it('普通区间走线性', () => {
    expect(scaleKind(inp({ min: 0, max: 5, default: 1 }))).toBe('linear');
    expect(scaleKind(inp({ min: 0.01, max: 2, default: 0.5 }))).toBe('linear');
    expect(scaleKind(inp({ min: -2, max: 2, default: 0.3 }))).toBe('linear');
  });

  it('跨 ≥1000 倍且 min > 0 走对数', () => {
    expect(scaleKind(inp({ min: 1, max: 1000, default: 100 }))).toBe('log');
    expect(scaleKind(inp({ min: 1e-30, max: 1e-10, default: 1.66e-27 }))).toBe('log');
    expect(scaleKind(inp({ min: 1e20, max: 2e30, default: 5.97e24 }))).toBe('log');
    // 差一点点不到 1000 倍就还是线性
    expect(scaleKind(inp({ min: 1, max: 999, default: 100 }))).toBe('linear');
  });

  it('min = 0 的区间绝不走对数（log(0) 是 -∞）', () => {
    // 即便跨度是 Infinity 倍
    expect(scaleKind(inp({ min: 0, max: 1e6, default: 600 }))).not.toBe('log');
    expect(scaleKind(inp({ min: 0, max: 5, default: 1 }))).toBe('linear');
    expect(scaleKind(inp({ min: 0, max: 1 }))).toBe('linear');
  });

  it('跨零的区间绝不走对数（log(负数) 是 NaN）', () => {
    expect(scaleKind(inp({ min: -50, max: 50, default: 0 }))).not.toBe('log');
    expect(scaleKind(inp({ min: -1e6, max: 1e6, default: 500 }))).not.toBe('log');
    expect(scaleKind(inp({ min: -273, max: 1000, default: 20 }))).not.toBe('log');
  });

  it('每种刻度都有对应的滑杆提示文案', () => {
    const cases: LabInputSpec[] = [
      inp({ min: 1, max: 1e5, default: 100 }), // log
      inp({ min: 0, max: 1e6, default: 600 }), // symlog
      inp({ min: 0, max: 5, default: 1 }), // linear
    ];
    for (const c of cases) {
      const title = SCALE_TITLE[scaleKind(c)];
      expect(title, `${scaleKind(c)} 没有提示文案`).toBeTruthy();
      expect(title).toContain('刻度');
    }
    expect(SCALE_TITLE.linear).toBe('线性刻度');
    expect(SCALE_TITLE.log).toContain('对数');
    expect(SCALE_TITLE.symlog).toContain('对称');
  });

  it('全 0 区间 / 反向区间这种脏数据退回线性，不抛', () => {
    expect(scaleKind(inp({ min: 5, max: 5, default: 5 }))).toBe('linear');
    expect(scaleKind(inp({ min: 10, max: 5, default: 7 }))).toBe('linear');
    expect(scaleKind(inp({ min: NaN, max: 5, default: 1 }))).toBe('linear');
  });

  it('线性刻度粗到调不动默认值的，改用对数 / 对称对数', () => {
    // K-T3-05 的 q：[-1e6, 1e6]、一格 2000 J、默认 500 J —— 线性下会被吸到 0
    expect(scaleKind(inp({ min: -1e6, max: 1e6, default: 500 }))).toBe('symlog');
    // K-T2-08 的 qc：[0, 1e6]、默认 600 J
    expect(scaleKind(inp({ min: 0, max: 1e6, default: 600 }))).toBe('symlog');
    // 全正的那种可以走对数（K-M3-09 的 r）
    expect(scaleKind(inp({ min: 6.4e6, max: 1e9, default: 6.6e6 }))).toBe('log');
  });
});

/* ============================================================
   线性刻度
   ============================================================ */

describe('线性刻度', () => {
  const i = inp({ min: 0, max: 5, default: 1 });

  it('端点和中间', () => {
    expect(toPos(0, i)).toBe(0);
    expect(toPos(5, i)).toBe(POS_MAX);
    expect(toPos(2.5, i)).toBe(POS_MAX / 2);
    expect(fromPos(0, i)).toBe(0);
    expect(fromPos(POS_MAX, i)).toBe(5);
    expect(fromPos(POS_MAX / 2, i)).toBe(2.5);
  });

  it('越界的值被夹回两端', () => {
    expect(toPos(-100, i)).toBe(0);
    expect(toPos(100, i)).toBe(POS_MAX);
    expect(fromPos(-10, i)).toBe(0);
    expect(fromPos(9999, i)).toBe(5);
  });

  it('默认值一定落在滑杆上（往返无损）', () => {
    expect(fromPos(Math.round(toPos(1, i)), i)).toBe(1);
  });

  it('负区间也正常', () => {
    const n = inp({ min: -2, max: 2, default: 0.3 });
    expect(toPos(-2, n)).toBe(0);
    expect(toPos(2, n)).toBe(POS_MAX);
    expect(fromPos(Math.round(toPos(0.3, n)), n)).toBeCloseTo(0.3, 2);
  });
});

/* ============================================================
   对数刻度
   ============================================================ */

describe('对数刻度', () => {
  const i = inp({ min: 1, max: 1000, default: 10 });

  it('端点精确', () => {
    expect(toPos(1, i)).toBe(0);
    expect(fromPos(0, i)).toBe(1);
    expect(toPos(1000, i)).toBeCloseTo(POS_MAX, 6);
    expect(fromPos(POS_MAX, i)).toBeCloseTo(1000, 3);
  });

  it('每个数量的位置等距（10 / 100 / 1000 各差 1/3）', () => {
    expect(toPos(10, i)).toBeCloseTo(POS_MAX / 3, 6);
    expect(toPos(100, i)).toBeCloseTo((POS_MAX * 2) / 3, 6);
  });

  it('翻倍永远是同一段距离（这就是换对数的理由）', () => {
    const a = toPos(2, i) - toPos(1, i);
    const b = toPos(200, i) - toPos(100, i);
    expect(b).toBeCloseTo(a, 6);
  });

  it('min = 0 时不崩：fromPos 全程有限、落在 [0, max]', () => {
    // 这条本来就会走线性，但就算有人把 scaleKind 改坏，fromPos 也不许吐 NaN
    const z = inp({ min: 0, max: 100, default: 5 });
    for (let p = 0; p <= POS_MAX; p += 1) {
      const v = fromPos(p, z);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('跨零区间同理', () => {
    const c = inp({ min: -50, max: 50, default: 0 });
    for (let p = 0; p <= POS_MAX; p += 1) {
      expect(Number.isFinite(fromPos(p, c))).toBe(true);
    }
  });
});

/* ============================================================
   对称对数（symlog）
   ============================================================ */

describe('对称对数刻度（跨零 / 从 0 起、且线性太粗）', () => {
  const q = inp({ min: -1e6, max: 1e6, default: 500 });

  it('被判定为 symlog', () => {
    expect(scaleKind(q)).toBe('symlog');
  });

  it('0 能精确表示，且落在滑杆中间', () => {
    const p = toPos(0, q);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeCloseTo(POS_MAX / 2, 6);
    expect(fromPos(POS_MAX / 2, q)).toBeCloseTo(0, 6);
  });

  it('默认值附近有足够刻度格（线性刻度在这里会把它吸到 0）', () => {
    const p = Math.round(toPos(500, q));
    const back = fromPos(p, q);
    expect(back).not.toBe(0);
    expect(Math.abs(back - 500) / 500).toBeLessThan(0.02);
    // 对照：线性刻度会算出 0（一格 2000 J）
    expect(fromPos(Math.round((500 - -1e6) / (2e6) * POS_MAX), { ...q, min: -1e6, max: 1e6 }))
      .toBeGreaterThanOrEqual(0);
  });

  it('正负对称：toPos(-v) 与 toPos(v) 关于中点对称', () => {
    for (const v of [1, 100, 1e4, 5e5]) {
      expect(toPos(v, q) + toPos(-v, q)).toBeCloseTo(POS_MAX, 6);
    }
  });

  it('全程单调、有限、在区间内（逐格扫）', () => {
    let prev = -Infinity;
    for (let p = 0; p <= POS_MAX; p += 1) {
      const v = fromPos(p, q);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-1e6);
      expect(v).toBeLessThanOrEqual(1e6);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(fromPos(0, q)).toBeCloseTo(-1e6, 0);
    expect(fromPos(POS_MAX, q)).toBeCloseTo(1e6, 0);
  });

  it('从 0 起的那种（K-T2-08 qc）也能正常拖', () => {
    const z = inp({ min: 0, max: 1e6, default: 600 });
    expect(scaleKind(z)).toBe('symlog');
    expect(fromPos(0, z)).toBe(0);
    expect(fromPos(POS_MAX, z)).toBe(1e6);
    const back = fromPos(Math.round(toPos(600, z)), z);
    expect(Math.abs(back - 600) / 600).toBeLessThan(0.02);
  });

  it('默认值是 0 时不除零', () => {
    const z = inp({ min: -1e6, max: 1e6, default: 0 });
    expect(Number.isFinite(fromPos(500, z))).toBe(true);
    expect(Number.isFinite(toPos(0, z))).toBe(true);
  });
});

/* ============================================================
   全量数据：193 个 input 逐格扫
   ============================================================ */

describe('全量 193 个 input（formula-lab.json）', () => {
  it('数量对得上：78 条 formula / 193 个 input', () => {
    const labs = Object.values(LABS).filter((l) => l.kind === 'formula');
    expect(labs).toHaveLength(78);
    expect(labs.reduce((n, l) => n + l.inputs.length, 0)).toBe(193);
  });

  it('每个 input 的 fromPos 全程有限、在 [min,max] 内、单调不减', () => {
    const bad: string[] = [];
    for (const { labId, inp: i } of allInputs()) {
      let prev = -Infinity;
      for (let p = 0; p <= POS_MAX; p += 1) {
        const v = fromPos(p, i);
        if (!Number.isFinite(v)) {
          bad.push(`${labId}/${i.key} p=${p} → 非有限数`);
          break;
        }
        if (v < i.min - Math.abs(i.min) * 1e-9 || v > i.max + Math.abs(i.max) * 1e-9) {
          bad.push(`${labId}/${i.key} p=${p} → ${v} 跑出 [${i.min}, ${i.max}]`);
          break;
        }
        if (v < prev) {
          bad.push(`${labId}/${i.key} p=${p} → ${v} 比上一格 ${prev} 还小（不单调）`);
          break;
        }
        prev = v;
      }
    }
    expect(bad).toEqual([]);
  });

  it('每个 input 的两端都精确落在 min / max 上', () => {
    const bad: string[] = [];
    for (const { labId, inp: i } of allInputs()) {
      const lo = fromPos(0, i);
      const hi = fromPos(POS_MAX, i);
      if (Math.abs(lo - i.min) > Math.abs(i.min) * 1e-6 + 1e-12) {
        bad.push(`${labId}/${i.key} 左端 ${lo} ≠ min ${i.min}`);
      }
      if (Math.abs(hi - i.max) > Math.abs(i.max) * 1e-6 + 1e-12) {
        bad.push(`${labId}/${i.key} 右端 ${hi} ≠ max ${i.max}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('每个 input 的默认值都落在最近的一格上（误差不超过半格）', () => {
    const bad: string[] = [];
    for (const { labId, inp: i } of allInputs()) {
      const dv = clamp(Number.isFinite(i.default) ? i.default : i.min, i.min, i.max);
      const pos = toPos(dv, i);
      const snapped = fromPos(Math.round(pos), i);
      const err = Math.abs(snapped - dv) / Math.max(Math.abs(dv), Number.MIN_VALUE);

      /**
       * 允许的最大误差 = 「半格」：滑杆只有 1001 个位置，默认值一定会被吸到
       * 最近的一格上，而一格在数值上有多宽取决于这条用哪种刻度：
       *   线性：span / 1000
       *   对数：一格 = (max/min)^(1/1000) 倍，跨 N 个数量级时半格就是
       *         (max/min)^(1/2000) - 1（例：K-T4-03 的 omega 跨 30 个量级 → 3.5%）
       *   对称对数：两侧各自按上式估，取更大的那边
       * 真正要盯的是「被吸到 0 / 吸到端点」这种定性错误，下面那句单独断言。
       */
      const span = i.max - i.min;
      let halfTick = span / POS_MAX / Math.max(Math.abs(dv), Number.MIN_VALUE);
      if (scaleKind(i) === 'log') {
        halfTick = Math.pow(i.max / i.min, 1 / (2 * POS_MAX)) - 1;
      } else if (scaleKind(i) === 'symlog') {
        halfTick = Math.max(halfTick, 0.02);
      }
      if (err > halfTick + 1e-9) {
        bad.push(
          `${labId}/${i.key} 默认 ${dv} → 格点 ${snapped}（差 ${(err * 100).toFixed(2)}%，允许 ${(halfTick * 100).toFixed(2)}%）`,
        );
      }
      if (dv !== 0 && snapped === 0) bad.push(`${labId}/${i.key} 默认 ${dv} 被吸到 0`);
    }
    expect(bad).toEqual([]);
  });

  it('默认值的定性误差：最多差半个数量级，绝不会被吸到 0 / 端点（原来的 bug）', () => {
    const worst: Array<{ key: string; err: number }> = [];
    for (const { labId, inp: i } of allInputs()) {
      const dv = clamp(Number.isFinite(i.default) ? i.default : i.min, i.min, i.max);
      const snapped = fromPos(Math.round(toPos(dv, i)), i);
      const err = Math.abs(snapped - dv) / Math.max(Math.abs(dv), Number.MIN_VALUE);
      worst.push({ key: `${labId}/${i.key}`, err });
    }
    worst.sort((a, b) => b.err - a.err);
    // 最差的几个都是「对数格点」本身的粗糙度（0.5 ~ 3.5%），不是逻辑错
    expect(worst[0].err).toBeLessThan(0.04);
    expect(worst[0].key).toBe('K-T4-03/omega'); // 30 个数量级、一格 7%
  });

  it('默认值→位置→默认值 往返无损（位置不取整时）', () => {
    const bad: string[] = [];
    for (const { labId, inp: i } of allInputs()) {
      const dv = clamp(Number.isFinite(i.default) ? i.default : i.min, i.min, i.max);
      const back = fromPos(toPos(dv, i), i);
      const err = Math.abs(back - dv) / Math.max(Math.abs(dv), Number.MIN_VALUE);
      if (err > 1e-9) bad.push(`${labId}/${i.key} ${dv} → ${back}（差 ${err.toExponential(2)}）`);
    }
    expect(bad).toEqual([]);
  });

  it('每个格点上的值都能原样写成输入框文字（不会变成空串 / 越界 / 精度崩）', () => {
    const bad: string[] = [];
    for (const { labId, inp: i } of allInputs()) {
      for (let p = 0; p <= POS_MAX; p += 1) {
        const v = fromPos(p, i);
        const text = numText(v);
        if (text === '') {
          bad.push(`${labId}/${i.key} p=${p} → 空串`);
          break;
        }
        const back = Number(text);
        if (!Number.isFinite(back) || back < i.min || back > i.max) {
          bad.push(`${labId}/${i.key} p=${p} → "${text}" 读回来是 ${back}，越界`);
          break;
        }
        // 指数写法 4 位有效数字，误差最多 0.1%
        const err = Math.abs(back - v) / Math.max(Math.abs(v), Number.MIN_VALUE);
        if (err > 2e-3) {
          bad.push(`${labId}/${i.key} p=${p} → "${text}" 与 ${v} 差 ${(err * 100).toFixed(3)}%`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('刻度分布：91 线性 / 99 对数 / 3 对称对数（数据一变这条会提醒）', () => {
    const counts = { linear: 0, log: 0, symlog: 0 };
    for (const { inp: i } of allInputs()) counts[scaleKind(i)] += 1;
    expect(counts).toEqual({ linear: 91, log: 99, symlog: 3 });
  });

  it('其中 min = 0 的 13 个、跨零的 10 个，全部不走对数', () => {
    const rows = allInputs();
    const zeroMin = rows.filter((r) => r.inp.min === 0);
    const crossing = rows.filter((r) => r.inp.min < 0 && r.inp.max > 0);
    expect(zeroMin).toHaveLength(13);
    expect(crossing).toHaveLength(10);
    for (const r of [...zeroMin, ...crossing]) {
      expect(scaleKind(r.inp), `${r.labId}/${r.inp.key} 不该走对数`).not.toBe('log');
    }
  });
});
