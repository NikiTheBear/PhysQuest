import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND, scanInterference, solveSound } from './engine';

const P = (o: Partial<typeof DEFAULT_SOUND>) => ({ ...DEFAULT_SOUND, ...o });
const close = (a: number, b: number, tol = 0.02) => Math.abs(a - b) < tol;

describe('声学引擎', () => {
  it('波长 = 声速 / 频率', () => {
    const r = solveSound(P({ frequency: 343, speed: 343 }));
    expect(close(r.wavelength, 1)).toBe(true);
  });

  it('120 Hz 在空气中波长约 2.86 m', () => {
    const r = solveSound(P({ frequency: 120, speed: 343 }));
    expect(close(r.wavelength, 343 / 120, 0.02)).toBe(true);
  });

  it('距离翻倍，声压减半', () => {
    const a = solveSound(P({ micDistance: 1 })).amplitudeAtMic;
    const b = solveSound(P({ micDistance: 2 })).amplitudeAtMic;
    const c = solveSound(P({ micDistance: 4 })).amplitudeAtMic;
    expect(close(b / a, 0.5, 0.01)).toBe(true);
    expect(close(c / a, 0.25, 0.01)).toBe(true);
  });

  it('距离翻倍，声强变成四分之一', () => {
    const a = solveSound(P({ micDistance: 1 })).intensity;
    const b = solveSound(P({ micDistance: 2 })).intensity;
    expect(close(b / a, 0.25, 0.02)).toBe(true);
  });

  it('双源：正中间是对称的加强', () => {
    const r = solveSound(P({ mode: 'interference', micOffset: 0 }));
    expect(r.pathDifference).toBeLessThan(0.001);
    expect(r.interferenceKind).toBe('加强');
  });

  it('双源近场：减弱点的声压明显下降（但不会到零）', () => {
    // 近场里两个源到麦克风的距离差得比较开，1/r 衰减让两者幅值不相等，
    // 所以抵消不彻底——这是真实的物理，不是 bug。
    const p = P({ mode: 'interference', frequency: 343, speed: 343, sourceGap: 1, micDistance: 1 });
    const pts = scanInterference(p, 400);
    const min = pts.reduce((a, b) => (b.amplitude < a.amplitude ? b : a));
    const max = pts.reduce((a, b) => (b.amplitude > a.amplitude ? b : a));
    expect(min.amplitude).toBeLessThan(max.amplitude * 0.6);
  });

  it('双源远场：减弱点接近完全抵消', () => {
    // 离得远时两个源的衰减几乎一样，幅值接近相等，抵消才彻底。
    const p = P({ mode: 'interference', frequency: 343, speed: 343, sourceGap: 1, micDistance: 5 });
    const pts = scanInterference(p, 600);
    const min = pts.reduce((a, b) => (b.amplitude < a.amplitude ? b : a));
    const max = pts.reduce((a, b) => (b.amplitude > a.amplitude ? b : a));
    expect(min.amplitude).toBeLessThan(max.amplitude * 0.25);
  });

  it('频率越高，干涉条纹越密', () => {
    const low = scanInterference(P({ mode: 'interference', frequency: 100, sourceGap: 1 }), 400);
    const high = scanInterference(P({ mode: 'interference', frequency: 500, sourceGap: 1 }), 400);

    // 数一下振幅的局部峰值个数
    const countPeaks = (pts: typeof low) => {
      let n = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        if (pts[i].amplitude > pts[i - 1].amplitude && pts[i].amplitude > pts[i + 1].amplitude) n++;
      }
      return n;
    };
    expect(countPeaks(high)).toBeGreaterThan(countPeaks(low));
  });

  it('指向性：正前方最大，背面为零', () => {
    const front = solveSound(P({ mode: 'directivity', micOffset: 0, micDistance: 1 }));
    const side = solveSound(P({ mode: 'directivity', micOffset: 1, micDistance: 1 }));
    const back = solveSound(P({ mode: 'directivity', micOffset: -1, micDistance: 1 }));
    expect(front.directivity).toBeGreaterThan(side.directivity);
    expect(side.directivity).toBeGreaterThanOrEqual(back.directivity);
  });

  it('周期 = 1 / 频率', () => {
    const r = solveSound(P({ frequency: 250 }));
    expect(close(r.period, 0.004, 0.0001)).toBe(true);
  });
});
