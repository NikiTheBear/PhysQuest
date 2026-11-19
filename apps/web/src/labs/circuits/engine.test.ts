import { describe, expect, it } from 'vitest';
import { DEFAULT_CIRCUIT, samplePower, solveCircuit } from './engine';

const P = (o: Partial<typeof DEFAULT_CIRCUIT>) => ({ ...DEFAULT_CIRCUIT, ...o });
const close = (a: number, b: number, tol = 0.02) => Math.abs(a - b) < tol;

describe('电路引擎', () => {
  it('欧姆定律：I = U/R', () => {
    const r = solveCircuit(P({ mode: 'closed', emf: 12, internal: 0, r1: 6 }));
    expect(close(r.current, 2)).toBe(true);
  });

  it('串联：总电阻 = R1 + R2', () => {
    const r = solveCircuit(P({ mode: 'series', r1: 5, r2: 10 }));
    expect(close(r.external, 15)).toBe(true);
  });

  it('并联：总电阻 < 任一分支', () => {
    const r = solveCircuit(P({ mode: 'parallel', r1: 5, r2: 10 }));
    expect(r.external).toBeLessThan(5);
    expect(close(r.external, 50 / 15, 0.05)).toBe(true);
  });

  it('串联分压：电压按电阻比例分', () => {
    const r = solveCircuit(P({ mode: 'series', r1: 5, r2: 10, internal: 0 }));
    expect(close(r.v1 / r.v2, 0.5, 0.02)).toBe(true);
  });

  it('并联：两支路电压相等', () => {
    const r = solveCircuit(P({ mode: 'parallel', r1: 5, r2: 10 }));
    expect(close(r.v1, r.v2, 0.001)).toBe(true);
  });

  it('闭合电路：路端电压 = ε − Ir', () => {
    const r = solveCircuit(P({ mode: 'closed', emf: 12, internal: 2, r1: 4 }));
    expect(close(r.current, 2)).toBe(true);
    expect(close(r.terminal, 8)).toBe(true);
  });

  it('外阻 = 内阻时输出功率最大', () => {
    const r = solveCircuit(P({ mode: 'closed', emf: 12, internal: 3, r1: 3 }));
    expect(r.isMaxPower).toBe(true);
    expect(close(r.powerOut, 12)).toBe(true);
  });

  it('最大功率时效率只有 50%', () => {
    const r = solveCircuit(P({ mode: 'closed', emf: 12, internal: 3, r1: 3 }));
    expect(close(r.efficiency, 0.5, 0.01)).toBe(true);
  });

  it('外阻远大于内阻时效率接近 100%', () => {
    const r = solveCircuit(P({ mode: 'closed', emf: 12, internal: 0.1, r1: 100 }));
    expect(r.efficiency).toBeGreaterThan(0.99);
  });

  it('功率曲线在外阻 = 内阻处有峰值', () => {
    const pts = samplePower(20);
    const peak = pts.reduce((a, b) => (b.power > a.power ? b : a));
    expect(Math.abs(peak.r - DEFAULT_CIRCUIT.internal)).toBeLessThan(0.6);
  });

  it('焦耳定律：Q = I²Rt', () => {
    const r = solveCircuit(P({ mode: 'closed', emf: 12, internal: 0, r1: 6, time: 10 }));
    expect(close(r.heat, 4 * 6 * 10, 1)).toBe(true);
  });
});
