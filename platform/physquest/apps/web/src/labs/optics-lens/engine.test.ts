import { describe, expect, it } from 'vitest';
import { solve, traceRays } from './engine';
import type { LensParams } from '../../core/contracts';

const base: LensParams = {
  u: 30,
  f: 10,
  h: 2.5,
  screenX: 15,
  objectShape: 'arrow',
  maskTop: false,
  lensDiameter: 6,
};

const P = (over: Partial<LensParams>): LensParams => ({ ...base, ...over });
const close = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) < tol;

/* 8 条核心断言 —— 这就是「物理正确性」的锁 */

describe('凸透镜成像公式', () => {
  it('u = 3f  →  v = 1.5f，倒立缩小，m = −0.5', () => {
    const r = solve(P({ u: 30, f: 10 }));
    expect(close(r.v, 15)).toBe(true);
    expect(close(r.m, -0.5)).toBe(true);
    expect(r.real).toBe(true);
    expect(r.description).toContain('倒立');
    expect(r.description).toContain('缩小');
  });

  it('u = 2f  →  v = 2f，倒立等大，m = −1', () => {
    const r = solve(P({ u: 20, f: 10 }));
    expect(close(r.v, 20)).toBe(true);
    expect(close(r.m, -1)).toBe(true);
    expect(r.description).toContain('等大');
  });

  it('u = 1.5f  →  v = 3f，倒立放大，m = −2', () => {
    const r = solve(P({ u: 15, f: 10 }));
    expect(close(r.v, 30)).toBe(true);
    expect(close(r.m, -2)).toBe(true);
    expect(r.description).toContain('放大');
  });

  it('u = f  →  不成像，出射平行', () => {
    const r = solve(P({ u: 10, f: 10 }));
    expect(r.isParallel).toBe(true);
    expect(r.real).toBe(false);
    expect(r.screenHasImage).toBe(false);
    expect(r.description).toContain('平行');
  });

  it('u = 0.5f  →  虚像，v = −f，正立放大，m = +2', () => {
    const r = solve(P({ u: 5, f: 10 }));
    expect(close(r.v, -10)).toBe(true);
    expect(close(r.m, 2)).toBe(true);
    expect(r.real).toBe(false);
    expect(r.screenHasImage).toBe(false);
    expect(r.description).toContain('正立');
    expect(r.description).toContain('虚像');
  });

  it('光屏正好在像的位置 → 弥散圆为 0，成清晰像', () => {
    const r = solve(P({ u: 30, f: 10, screenX: 15 }));
    expect(close(r.blurDiameter, 0, 0.01)).toBe(true);
    expect(r.screenHasImage).toBe(true);
  });

  it('光屏偏离像的位置 → 弥散圆随偏离量单调增大', () => {
    const at = (dx: number) => solve(P({ u: 30, f: 10, screenX: 15 + dx })).blurDiameter;
    expect(at(0)).toBeLessThan(at(2));
    expect(at(2)).toBeLessThan(at(5));
    expect(at(5)).toBeLessThan(at(10));
  });

  it('遮住透镜上半部分 → 像的位置和大小完全不变，只是变暗', () => {
    const a = solve(P({ u: 30, f: 10, screenX: 15, maskTop: false }));
    const b = solve(P({ u: 30, f: 10, screenX: 15, maskTop: true }));
    expect(b.v).toBe(a.v);
    expect(b.m).toBe(a.m);
    expect(b.imageHeight).toBe(a.imageHeight);
    expect(b.blurDiameter).toBe(a.blurDiameter);
    expect(b.relativeIlluminance).toBeCloseTo(a.relativeIlluminance * 0.5, 2);
  });
});

/* 额外 4 条护栏 */

describe('边界与鲁棒性', () => {
  it('u 极小时不崩（不产生 NaN）', () => {
    const r = solve(P({ u: 0.01, f: 10 }));
    expect(Number.isFinite(r.v)).toBe(true);
    expect(Number.isFinite(r.m)).toBe(true);
    expect(r.real).toBe(false);
  });

  it('u 极大时趋近 v → f', () => {
    const r = solve(P({ u: 100000, f: 10 }));
    expect(Math.abs(r.v - 10) < 0.01).toBe(true);
    expect(Math.abs(r.m)).toBeLessThan(0.001);
  });

  it('虚像永远接不住，无论光屏放哪', () => {
    for (const screenX of [5, 10, 20, 50, 200]) {
      const r = solve(P({ u: 5, f: 10, screenX }));
      expect(r.screenHasImage).toBe(false);
    }
  });

  it('三条特殊光线穿过后确实交于像点', () => {
    const p = P({ u: 30, f: 10 });
    const m = solve(p);
    const rays = traceRays(p);
    const solid = rays.filter((r) => !r.dashed);
    expect(solid.length).toBe(3);

    // 每条实线的最后一点，应当落在从透镜出射后、穿过像点的那条直线上
    for (const ray of solid) {
      const [, atLens, tail] = ray.points;
      if (!atLens || !tail) continue;
      // 直线：(0, atLens.y) → (m.v, m.imageY)
      const slope = (m.imageY - atLens.y) / m.v;
      const expectedY = atLens.y + slope * (tail.x - 0);
      expect(Math.abs(expectedY - tail.y)).toBeLessThan(1e-6);
    }
  });
});
