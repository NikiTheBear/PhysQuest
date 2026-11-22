import { describe, expect, it } from 'vitest';
import {
  bandOf,
  buildChanges,
  buildChecks,
  fmt,
  levelOf,
  passedOf,
  scoreAssembly,
  scoreObservation,
  scoreVariables,
  total,
} from './rules';
import { factFromCapture } from './comparison';
import { checkWin } from './win';
import { solve } from '../../labs/optics-lens/engine';
import { EXAMPLE_A, EXAMPLE_B, P, snap } from './test-fixtures';
import type { RunFact } from './types';

const factsFrom = (list: ReturnType<typeof P>[]): RunFact[] =>
  list.map((p, i) => factFromCapture(snap(p, { challengeId: 'CH-O2-01', time: i }), i));

/* ============================================================
 * D1 组装（§1.2 的算法逐条）
 * ========================================================== */

describe('D1 组装合法', () => {
  it('空实验台 = 0', () => {
    const r = scoreAssembly({
      componentCount: 0,
      kinds: [],
      requiredKinds: ['lens_bench'],
      engineError: null,
      invalidChannels: 0,
    });
    expect(r.score).toBe(0);
    expect(r.facts[0]).toContain('没有任何器具');
  });

  it('引擎报错 = 20，且原话原样透传', () => {
    const raw = '电路节点矩阵奇异，请检查连接和参数';
    const r = scoreAssembly({
      componentCount: 2,
      kinds: ['battery', 'resistor'],
      requiredKinds: ['battery'],
      engineError: raw,
      invalidChannels: 0,
    });
    expect(r.score).toBe(20);
    expect(r.facts[0]).toContain(raw); // 不改写成「电路接错啦」
  });

  it('缺一件 = 50（requiredKinds 两件里有一件）', () => {
    const r = scoreAssembly({
      componentCount: 1,
      kinds: ['laser'],
      requiredKinds: ['laser', 'detector'],
      engineError: null,
      invalidChannels: 0,
    });
    // 20 + round(60 * 1 / 2) = 50
    expect(r.score).toBe(50);
    expect(r.facts[0]).toContain('缺少器具');
  });

  it('缺一半器具是连续值，不是先取档', () => {
    const r = scoreAssembly({
      componentCount: 4,
      kinds: ['a', 'b', 'c', 'd'],
      requiredKinds: ['a', 'b', 'x', 'y'],
      engineError: null,
      invalidChannels: 0,
    });
    expect(r.score).toBe(20 + Math.round((60 * 2) / 4)); // 50
  });

  it('齐全但有无效通道 = 80', () => {
    const r = scoreAssembly({
      componentCount: 1,
      kinds: ['lens_bench'],
      requiredKinds: ['lens_bench'],
      engineError: null,
      invalidChannels: 3,
    });
    expect(r.score).toBe(80);
    expect(r.facts[0]).toContain('3 个读数');
  });

  it('齐全无错 = 100，facts 点名齐了什么', () => {
    const r = scoreAssembly({
      componentCount: 1,
      kinds: ['lens_bench'],
      requiredKinds: ['lens_bench'],
      engineError: null,
      invalidChannels: 0,
    });
    expect(r.score).toBe(100);
    expect(r.facts[0]).toContain('lens_bench');
  });

  it('u = f（m 无定义）走「齐全但有无效读数」这一档，不是报错', () => {
    const facts = factsFrom([P({ u: 10, f: 10, screenX: 15 })]);
    // 引擎返回 Infinity → 通道 valid:false
    expect(Object.values(facts[0].channels).filter((c) => c.valid === false).length).toBeGreaterThan(0);
    expect(facts[0].metrics.m).toBeNull();
  });
});

/* ============================================================
 * D2 观测项（§1.3）
 * ========================================================== */

describe('D2 观测项', () => {
  it('required 为空 → insufficient，不是 0', () => {
    expect(scoreObservation([], [], ['m']).score).toBeNull();
  });

  it('看全了 = 100', () => {
    const r = scoreObservation(['m', 'v', 'imageHeight'], [], ['m', 'v', 'imageHeight']);
    expect(r.score).toBe(100);
    expect(r.hits).toHaveLength(3);
  });

  it('只看了一个 = 33（例 B 的真实分数）', () => {
    expect(scoreObservation(['m', 'v', 'blurDiameter'], ['screenHasImage'], ['m']).score).toBe(33);
  });

  it('可选量不加分，只进 bonus', () => {
    const r = scoreObservation(['m', 'v'], ['screenHasImage'], ['m', 'v', 'screenHasImage']);
    expect(r.score).toBe(100);
    expect(r.bonus).toEqual(['screenHasImage']);
  });

  it('多看无关的量不加分', () => {
    expect(scoreObservation(['m'], [], ['v', 'blurDiameter']).score).toBe(0);
  });
});

/* ============================================================
 * D3 变量控制（§1.4，用 §3.4 两个例子的真实参数）
 * ========================================================== */

describe('D3 变量控制', () => {
  it('例 A：三次只动物距 → 100', () => {
    const changes = buildChanges(factsFrom(EXAMPLE_A));
    expect(changes).toHaveLength(2);
    expect(changes[0].changed).toEqual(['u']);
    // screenX 跟挪是承接需要，豁免
    expect(changes[0].exempt).toContain('screenX');
    expect(scoreVariables(changes).score).toBe(100);
  });

  it('例 B：两次都改了两个量 → 0', () => {
    const changes = buildChanges(factsFrom(EXAMPLE_B));
    expect(changes[0].changed.sort()).toEqual(['f', 'u']);
    expect(changes[0].dirty).toBe(true);
    expect(scoreVariables(changes).score).toBe(0);
  });

  it('只挪光屏不算改自变量 → 仍然 100', () => {
    const facts = factsFrom([
      P({ u: 30, f: 10, screenX: 15 }),
      P({ u: 30, f: 10, screenX: 20 }),
    ]);
    const changes = buildChanges(facts);
    expect(changes[0].changed).toEqual([]);
    expect(changes[0].exempt).toEqual(['screenX']);
    expect(scoreVariables(changes).score).toBe(100);
  });

  it('一次干净一次脏 → 50', () => {
    const facts = factsFrom([
      P({ u: 30, f: 10, screenX: 15 }),
      P({ u: 25, f: 10, screenX: 12.5 }), // 干净
      P({ u: 20, f: 8, screenX: 12.5 }), // 同时改 u 和 f
    ]);
    const changes = buildChanges(facts);
    expect(scoreVariables(changes).score).toBe(50);
  });

  it('只有一次记录 → insufficient，不判零', () => {
    const changes = buildChanges(factsFrom([P({ u: 20 })]));
    const r = scoreVariables(changes);
    expect(changes).toHaveLength(0);
    expect(r.score).toBeNull();
    expect(r.reason).toBe('insufficient');
  });

  it('objectShape 不参与变量控制（它不影响物理）', () => {
    const facts = factsFrom([
      P({ u: 30, objectShape: 'arrow' }),
      P({ u: 30, objectShape: 'candle' }),
    ]);
    const changes = buildChanges(facts);
    expect(changes[0].changed).toEqual([]);
    expect(changes[0].exempt).toEqual([]); // 两边都不进，连豁免都不记
  });

  it('maskTop 算自变量（遮一半是实验条件）', () => {
    const facts = factsFrom([P({ u: 30, maskTop: false }), P({ u: 30, maskTop: true })]);
    expect(buildChanges(facts)[0].changed).toEqual(['maskTop']);
  });
});

/* ============================================================
 * 对照表 T（§1.5）
 * ========================================================== */

describe('对照表 T', () => {
  it('例 A 的三条记录：编号先相邻 6 条，再首末 6 条，最后单点', () => {
    const checks = buildChecks(factsFrom(EXAMPLE_A));
    // 2 个相邻对 × 6 + 1 个首末对 × 6 + 3 条记录 × 4 = 12 + 6 + 12 = 30
    expect(checks).toHaveLength(30);
    expect(checks[0].id).toBe('T1');
    expect(checks[checks.length - 1].id).toBe('T30');
    // 编号连续不重复
    expect(new Set(checks.map((c) => c.id)).size).toBe(checks.length);
  });

  it('例 A：R2 的 |m| 比 R1 大，R3 的 |m| 比 R2 大', () => {
    const facts = factsFrom(EXAMPLE_A);
    const checks = buildChecks(facts);
    expect(facts[0].metrics.m).toBeCloseTo(-0.5, 4);
    expect(facts[1].metrics.m).toBeCloseTo(-0.6667, 4);
    expect(checks[0].claim).toBe('R2 的 |m| 比 R1 大（相邻 1）');
    expect(checks[0].verdict).toBe('yes');
    expect(checks[6].claim).toBe('R3 的 |m| 比 R2 大（相邻 2）');
    // 首末对单独标出来，学生写总结时的句子才对得上
    expect(checks[12].claim).toBe('R3 的 |m| 比 R1 大（首末两条）');
  });

  it('例 A：R3 的像高是 2.5000 cm，光屏上有清晰像', () => {
    const checks = buildChecks(factsFrom(EXAMPLE_A));
    expect(checks.some((c) => c.claim.includes('像高是 2.5000 cm'))).toBe(true);
    expect(checks.some((c) => c.claim === 'R3 的光屏上有清晰像')).toBe(true);
  });

  it('正倒判断只出现在「对」的行里（单点固定 4 条不含正倒）', () => {
    const checks = buildChecks(factsFrom(EXAMPLE_A));
    // 每一对的第 6 条是正倒判断
    const upright = checks.filter((c) => c.claim.includes('像是倒立的') || c.claim.includes('像是正立的'));
    expect(upright).toHaveLength(3); // 2 个相邻对 + 1 个首末对
    expect(upright.every((c) => c.verdict === 'yes')).toBe(true);
  });

  it('例 B：R3 的光屏上没有清晰像', () => {
    const checks = buildChecks(factsFrom(EXAMPLE_B));
    expect(checks.some((c) => c.claim === 'R3 的光屏上没有清晰像' && c.verdict === 'yes')).toBe(true);
  });

  it('m = null 时不跳过那一行，verdict 给 unknown', () => {
    const facts = factsFrom([
      P({ u: 30, f: 10, screenX: 15 }),
      P({ u: 10, f: 10, screenX: 15 }), // m 无定义
    ]);
    const checks = buildChecks(facts);
    const undef = checks.filter((c) => c.verdict === 'unknown');
    expect(undef.length).toBeGreaterThan(0);
    expect(undef.some((c) => c.claim.includes('无定义'))).toBe(true);
  });

  it('只有两条记录时没有首末对', () => {
    const checks = buildChecks(factsFrom(EXAMPLE_B.slice(0, 2)));
    expect(checks).toHaveLength(6 + 8); // 1 个相邻对 × 6 + 2 条记录 × 4
  });

  it('同样的输入永远得到同一套编号（可断言）', () => {
    const a = buildChecks(factsFrom(EXAMPLE_A));
    const b = buildChecks(factsFrom(EXAMPLE_A));
    expect(a).toEqual(b);
  });

  it('v 为负数（虚像）时读数照抄原值', () => {
    const checks = buildChecks(factsFrom([P({ u: 8, f: 10, screenX: 15 })]));
    // u < f → v = -40
    expect(checks.some((c) => c.claim.includes('-40.0000'))).toBe(true);
  });
});

/* ============================================================
 * 总分与通过线（§1.6）
 * ========================================================== */

describe('总分与通过线', () => {
  it('例 A：100/100/100/80 → 97 优秀', () => {
    const t = total([
      { key: 'assembly', score: 100 },
      { key: 'observation', score: 100 },
      { key: 'variables', score: 100 },
      { key: 'conclusion', score: 80 },
    ]);
    expect(t).toBe(97);
    expect(levelOf(t)).toBe('excellent');
  });

  it('例 B：100/33/0/0 → 40 待改进', () => {
    const t = total([
      { key: 'assembly', score: 100 },
      { key: 'observation', score: 33 },
      { key: 'variables', score: 0 },
      { key: 'conclusion', score: 0 },
    ]);
    expect(t).toBe(40);
    expect(levelOf(t)).toBe('improve');
  });

  it('三维时按剩余权重归一：(0.3*100 + 0.3*50 + 0.25*0) / 0.85 = 53', () => {
    const t = total([
      { key: 'assembly', score: 100 },
      { key: 'observation', score: 50 },
      { key: 'variables', score: 0 },
      { key: 'conclusion', score: null },
    ]);
    expect(t).toBe(Math.round((0.3 * 100 + 0.3 * 50 + 0.25 * 0) / 0.85));
    expect(t).toBe(53);
  });

  it('全是 null → null，不是 0', () => {
    expect(total([{ key: 'conclusion', score: null }])).toBeNull();
    expect(levelOf(null)).toBe('not_graded');
    expect(passedOf(null, null)).toBe(false);
  });

  it('D1 < 50 时总分再高也不通过（硬条件）', () => {
    const t = total([
      { key: 'assembly', score: 40 },
      { key: 'observation', score: 100 },
      { key: 'variables', score: 100 },
      { key: 'conclusion', score: 100 },
    ]);
    expect(t).toBeGreaterThanOrEqual(60);
    expect(passedOf(t, 40)).toBe(false);
    expect(passedOf(t, 50)).toBe(true);
  });

  it('边界：85 优秀、84 良好、70 良好、69 合格、60 合格、59 待改进', () => {
    expect(levelOf(85)).toBe('excellent');
    expect(levelOf(84)).toBe('good');
    expect(levelOf(70)).toBe('good');
    expect(levelOf(69)).toBe('pass');
    expect(levelOf(60)).toBe('pass');
    expect(levelOf(59)).toBe('improve');
  });
});

/* ============================================================
 * 显示与格式化（§5.2 的数字规则）
 * ========================================================== */

describe('数字显示规则', () => {
  it('null → 无定义，不显示 Infinity', () => {
    expect(fmt(null)).toBe('无定义');
    expect(fmt(undefined)).toBe('无定义');
    expect(fmt(Number.POSITIVE_INFINITY)).toBe('无穷远');
    expect(fmt(1e6)).toBe('无穷远');
  });

  it('正常数保留 4 位小数', () => {
    expect(fmt(-2.857142857)).toBe('-2.8571');
    expect(fmt(0)).toBe('0.0000');
  });

  it('分数 → 档位', () => {
    expect(bandOf(100)).toBe('top');
    expect(bandOf(80)).toBe('ok');
    expect(bandOf(79)).toBe('weak');
    expect(bandOf(0)).toBe('zero');
    expect(bandOf(null)).toBe('insufficient');
  });
});

/* ============================================================
 * winCondition 判定（§2.4 缺口 4）
 * ========================================================== */

describe('winCondition 判定', () => {
  it('≈ 用容差判，边界含等号', () => {
    expect(checkWin({ metric: 'm', op: '≈', value: -1, tolerance: 0.06 }, { m: -1.06 })).toBe('yes');
    expect(checkWin({ metric: 'm', op: '≈', value: -1, tolerance: 0.06 }, { m: -1.07 })).toBe('no');
  });

  it('u = f 时 m 是 Infinity → unknown，不能崩', () => {
    const m = solve(P({ u: 10, f: 10 }));
    expect(m.m).toBe(Number.POSITIVE_INFINITY);
    expect(checkWin({ metric: 'm', op: '≈', value: -1, tolerance: 0.06 }, m)).toBe('unknown');
  });

  it('m = null（存档里 Infinity 被 JSON 化成 null）→ unknown', () => {
    expect(checkWin({ metric: 'm', op: '<', value: 0 }, { m: null as unknown as number })).toBe('unknown');
  });

  it('true / false 两档', () => {
    expect(checkWin({ metric: 'screenHasImage', op: 'false' }, { screenHasImage: false })).toBe('yes');
    expect(checkWin({ metric: 'real', op: 'false' }, { real: true })).toBe('no');
  });

  it('< 和 > 只对数字有效', () => {
    expect(checkWin({ metric: 'relativeIlluminance', op: '<', value: 0.75 }, { relativeIlluminance: 0.5 })).toBe('yes');
    expect(checkWin({ metric: 'v', op: '>', value: 0 }, { v: -3 })).toBe('no');
  });
});

/* ============================================================
 * 环境参数（重力 / 播放速度）
 * ========================================================== */

describe('环境参数算不算自变量', () => {
  const withEnv = (gravity: number, speed: number): RunFact => {
    const f = factFromCapture(snap(P({ u: 30 }), { challengeId: 'CH-O2-01' }), 0);
    return { ...f, env: { gravity, damping: 0, speed, collisions: 0 } };
  };

  it('改重力算改自变量', () => {
    const changes = buildChanges([withEnv(9.8, 1), withEnv(1.6, 1)], 'mechanics');
    expect(changes[0].changed).toEqual(['gravity']);
  });

  it('改播放速度不算（它不影响物理）', () => {
    const changes = buildChanges([withEnv(9.8, 1), withEnv(9.8, 4)], 'mechanics');
    expect(changes[0].changed).toEqual([]);
    expect(changes[0].exempt).toEqual(['speed']);
    expect(scoreVariables(changes).score).toBe(100);
  });

  it('同时改重力和播放速度 → 干净（只算一个自变量）', () => {
    const changes = buildChanges([withEnv(9.8, 1), withEnv(1.6, 4)], 'mechanics');
    expect(changes[0].changed).toEqual(['gravity']);
    expect(changes[0].dirty).toBe(false);
  });
});
