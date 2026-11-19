/**
 * 电路引擎
 *
 * 覆盖 E2（初中电路）+ E3（闭合电路）里能真算的那批：
 *   欧姆定律 / 串并联 / 电功率 / 焦耳定律 / 闭合电路 / 输出功率 / 效率
 *
 * 纯函数，无状态。
 */

export type CircuitMode = 'series' | 'parallel' | 'closed';

export interface CircuitParams {
  mode: CircuitMode;
  /** 电动势 V */
  emf: number;
  /** 内阻 Ω */
  internal: number;
  /** 电阻 1 Ω */
  r1: number;
  /** 电阻 2 Ω */
  r2: number;
  /** 通电时间 s */
  time: number;
}

export interface CircuitMetrics {
  /** 外电路总电阻 Ω */
  external: number;
  /** 总电阻 Ω */
  total: number;
  /** 干路电流 A */
  current: number;
  /** 路端电压 V */
  terminal: number;
  /** R1 上的电压 V */
  v1: number;
  /** R2 上的电压 V */
  v2: number;
  /** R1 上的电流 A */
  i1: number;
  /** R2 上的电流 A */
  i2: number;
  /** 外电路总功率 W */
  powerOut: number;
  /** 电源总功率 W */
  powerTotal: number;
  /** 内阻消耗 W */
  powerLoss: number;
  /** 效率 0–1 */
  efficiency: number;
  /** 时间 t 内产生的热量 J */
  heat: number;
  /** 外阻等于内阻时输出功率最大 */
  isMaxPower: boolean;
  description: string;
}

export const DEFAULT_CIRCUIT: CircuitParams = {
  mode: 'closed',
  emf: 12,
  internal: 1,
  r1: 5,
  r2: 10,
  time: 10,
};

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const safe = (x: number) => (Number.isFinite(x) ? x : 0);

export function solveCircuit(p: CircuitParams): CircuitMetrics {
  const { mode, emf, internal, r1, r2, time } = p;

  let external: number;
  let current: number;
  let v1 = 0;
  let v2 = 0;
  let i1 = 0;
  let i2 = 0;

  if (mode === 'series') {
    // 串联：R = R1 + R2，电流处处相等
    external = r1 + r2;
  } else if (mode === 'parallel') {
    // 并联：1/R = 1/R1 + 1/R2
    external = r1 * r2 === 0 ? 0 : (r1 * r2) / (r1 + r2);
  } else {
    // 闭合电路：外阻只有 R1，R2 当备用
    external = r1;
  }

  const total = external + internal;
  current = total > 0 ? emf / total : 0;

  const terminal = emf - current * internal;

  if (mode === 'series') {
    i1 = current;
    i2 = current;
    v1 = current * r1;
    v2 = current * r2;
  } else if (mode === 'parallel') {
    v1 = terminal;
    v2 = terminal;
    i1 = r1 > 0 ? terminal / r1 : 0;
    i2 = r2 > 0 ? terminal / r2 : 0;
  } else {
    i1 = current;
    v1 = terminal;
    i2 = 0;
    v2 = 0;
  }

  const powerOut = safe(terminal * current);
  const powerTotal = safe(emf * current);
  const powerLoss = safe(current * current * internal);
  const efficiency = powerTotal > 0 ? powerOut / powerTotal : 0;
  const heat = safe(current * current * (external + internal) * time);

  // 外阻 = 内阻时输出功率最大
  const isMaxPower = Math.abs(external - internal) < 1e-6;

  return {
    external: round(external),
    total: round(total),
    current: round(current),
    terminal: round(terminal),
    v1: round(v1),
    v2: round(v2),
    i1: round(i1),
    i2: round(i2),
    powerOut: round(powerOut),
    powerTotal: round(powerTotal),
    powerLoss: round(powerLoss),
    efficiency: round(efficiency, 3),
    heat: round(heat),
    isMaxPower,
    description: describeCircuit(p, current, terminal, efficiency, isMaxPower),
  };
}

function describeCircuit(
  p: CircuitParams,
  I: number,
  U: number,
  eff: number,
  maxPower: boolean,
): string {
  if (I < 1e-6) return '电路断开，没有电流';
  if (p.mode === 'series') {
    return `串联：电流 ${I.toFixed(2)} A，R1 分到 ${(I * p.r1).toFixed(1)} V，R2 分到 ${(I * p.r2).toFixed(1)} V`;
  }
  if (p.mode === 'parallel') {
    return `并联：各支路电压都是 ${U.toFixed(1)} V，总电流 ${I.toFixed(2)} A`;
  }
  if (maxPower) {
    return `外阻正好等于内阻，输出功率最大（${(U * I).toFixed(1)} W），但效率只有 ${(eff * 100).toFixed(0)}%`;
  }
  return `路端电压 ${U.toFixed(1)} V，电流 ${I.toFixed(2)} A，效率 ${(eff * 100).toFixed(0)}%`;
}

/* ============================================================
 * 给图表用：扫外阻，画 P_out 与效率曲线
 * ========================================================== */

export interface PowerPoint {
  r: number;
  power: number;
  efficiency: number;
}

export function samplePower(maxR = 20, points = 80): PowerPoint[] {
  const out: PowerPoint[] = [];
  for (let i = 1; i <= points; i++) {
    const r = (maxR * i) / points;
    const m = solveCircuit({ ...DEFAULT_CIRCUIT, mode: 'closed', r1: r });
    out.push({ r: round(r, 2), power: m.powerOut, efficiency: m.efficiency });
  }
  return out;
}
