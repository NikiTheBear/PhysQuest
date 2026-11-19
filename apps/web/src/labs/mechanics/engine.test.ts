import { describe, expect, it } from 'vitest';
import { DEFAULT_MECHANICS, solveMechanics } from './engine';

const P = (over: Partial<typeof DEFAULT_MECHANICS>) => ({ ...DEFAULT_MECHANICS, ...over });
const close = (a: number, b: number, tol = 0.05) => Math.abs(a - b) < tol;

describe('力学引擎', () => {
  it('自由落体 1 秒：位移 ≈ 4.9 m，速度 ≈ 9.8 m/s', () => {
    const r = solveMechanics(P({ mode: 'free-fall', time: 1, mass: 1, gravity: 9.8 }));
    expect(close(r.speed, 9.8, 0.1)).toBe(true);
    expect(close(Math.abs(r.displacement), 4.9, 0.1)).toBe(true);
  });

  it('自由落体 2 秒位移是 1 秒的 4 倍', () => {
    const a = Math.abs(solveMechanics(P({ mode: 'free-fall', time: 1 })).displacement);
    const b = Math.abs(solveMechanics(P({ mode: 'free-fall', time: 2 })).displacement);
    expect(close(b / a, 4, 0.1)).toBe(true);
  });

  it('质量不影响自由落体的加速度', () => {
    const a = solveMechanics(P({ mode: 'free-fall', mass: 1 })).acceleration;
    const b = solveMechanics(P({ mode: 'free-fall', mass: 10 })).acceleration;
    expect(close(a, b, 0.01)).toBe(true);
  });

  it('平抛：水平速度不变，竖直越来越快', () => {
    const r1 = solveMechanics(P({ mode: 'projectile', velocity: 5, time: 1 }));
    const r2 = solveMechanics(P({ mode: 'projectile', velocity: 5, time: 2 }));
    // 水平位移与时间成正比
    expect(close(r2.displacement / r1.displacement, 2, 0.05)).toBe(true);
    // 合速度越来越快
    expect(r2.speed).toBeGreaterThan(r1.speed);
  });

  it('动能 = ½mv²', () => {
    const r = solveMechanics(P({ mode: 'free-fall', mass: 2, time: 1 }));
    expect(close(r.kinetic, 0.5 * 2 * r.speed ** 2, 0.5)).toBe(true);
  });

  it('斜面：角度越大加速度越大', () => {
    const a = solveMechanics(P({ mode: 'incline', angle: 15, friction: 0 })).acceleration;
    const b = solveMechanics(P({ mode: 'incline', angle: 45, friction: 0 })).acceleration;
    expect(b).toBeGreaterThan(a);
  });

  it('斜面：摩擦足够大时不下滑', () => {
    const r = solveMechanics(P({ mode: 'incline', angle: 10, friction: 2 }));
    expect(r.acceleration).toBeLessThanOrEqual(0.01);
  });

  it('简谐振动：周期与振幅无关，只跟质量和劲度有关', () => {
    const t1 = solveMechanics(P({ mode: 'oscillation', mass: 1, stiffness: 4 }));
    const t2 = solveMechanics(P({ mode: 'oscillation', mass: 1, stiffness: 4, velocity: 10 }));
    expect(t1.description).toBe(t2.description);
  });
});
