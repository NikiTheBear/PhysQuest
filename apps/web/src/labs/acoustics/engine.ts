/**
 * 声学引擎
 *
 * 覆盖 5 个声波挑战里能算的那批：
 *   距离衰减 / 频率与波长 / 双源干涉 / 指向性
 *
 * 纯函数，无状态。
 */

export type SoundMode = 'attenuation' | 'frequency' | 'interference' | 'directivity';

export interface SoundParams {
  mode: SoundMode;
  /** 频率 Hz */
  frequency: number;
  /** 1 m 处的参考声压 Pa */
  amplitude: number;
  /** 麦克风到声源的距离 m */
  micDistance: number;
  /** 双源时麦克风的横向偏移 m */
  micOffset: number;
  /** 双源间距 m */
  sourceGap: number;
  /** 声速 m/s */
  speed: number;
  /** 观察时刻 s */
  time: number;
}

export interface SoundMetrics {
  /** 波长 m */
  wavelength: number;
  /** 周期 s */
  period: number;
  /** 波数 k = 2π/λ */
  waveNumber: number;
  /** 麦克风处声压 Pa */
  pressure: number;
  /** 麦克风处声压幅值 Pa */
  amplitudeAtMic: number;
  /** 相对 1 m 处的衰减倍数 */
  attenuation: number;
  /** 声强相对值（∝ p²） */
  intensity: number;
  /** 两源的路程差 m（只有 interference 模式有效） */
  pathDifference: number;
  /** 路程差 / 波长 */
  pathRatio: number;
  /** 是加强还是减弱 */
  interferenceKind: '加强' | '减弱' | '中间' | '—';
  /** 相对于正向的角度（directivity 模式） */
  angleDeg: number;
  /** 指向性因子 0–1 */
  directivity: number;
  description: string;
}

export const DEFAULT_SOUND: SoundParams = {
  mode: 'attenuation',
  frequency: 120,
  amplitude: 0.5,
  micDistance: 1,
  micOffset: 0,
  sourceGap: 1,
  speed: 343,
  time: 0,
};

const TAU = Math.PI * 2;
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

const safe = (x: number) => (Number.isFinite(x) ? x : 0);

export function solveSound(p: SoundParams): SoundMetrics {
  const f = Math.max(p.frequency, 0.1);
  const c = Math.max(p.speed, 1);
  const wavelength = c / f;
  const period = 1 / f;
  const k = TAU / wavelength;
  const omega = TAU * f;

  const d = Math.max(p.micDistance, 0.01);

  // 单源：p(r,t) = A·(r0/r)·sin(ωt − kr)
  const singleAmp = p.amplitude / d;
  const singlePhase = omega * p.time - k * d;

  let pressure = singleAmp * Math.sin(singlePhase);
  let amplitudeAtMic = singleAmp;
  let pathDifference = 0;
  let interferenceKind: SoundMetrics['interferenceKind'] = '—';

  if (p.mode === 'interference') {
    // 双源：两个点源在麦克风处叠加
    const half = p.sourceGap / 2;
    const y = p.micOffset;

    const r1 = Math.hypot(d, y + half);
    const r2 = Math.hypot(d, y - half);

    const a1 = p.amplitude / Math.max(r1, 0.01);
    const a2 = p.amplitude / Math.max(r2, 0.01);

    const p1 = a1 * Math.sin(omega * p.time - k * r1);
    const p2 = a2 * Math.sin(omega * p.time - k * r2);

    pressure = p1 + p2;
    // 幅值用旋转矢量合成，避免依赖当前时刻
    amplitudeAtMic = Math.hypot(a1 + a2 * Math.cos(k * (r2 - r1)), a2 * Math.sin(k * (r2 - r1)));

    pathDifference = Math.abs(r2 - r1);
  }

  if (p.mode === 'directivity') {
    // 前向余弦指向性：正前方 1，侧面 0.5，背面 0
    const angle = Math.atan2(Math.abs(p.micOffset), d);
    const cos = Math.cos(angle);
    const factor = Math.max(0, cos);
    pressure = singleAmp * factor * Math.sin(singlePhase);
    amplitudeAtMic = singleAmp * factor;
    const angleDeg = round((angle * 180) / Math.PI, 1);
    return finish(p, {
      wavelength,
      period,
      waveNumber: k,
      pressure,
      amplitudeAtMic,
      attenuation: d / 1,
      intensity: amplitudeAtMic ** 2,
      pathDifference,
      pathRatio: 0,
      interferenceKind,
      angleDeg,
      directivity: factor,
    });
  }

  const pathRatio = wavelength > 0 ? pathDifference / wavelength : 0;
  if (p.mode === 'interference') {
    // 路程差是半波长的奇数倍 → 减弱；整数倍 → 加强
    const frac = pathRatio - Math.floor(pathRatio);
    if (pathRotioIsOddHalf(frac)) interferenceKind = '减弱';
    else if (frac < 0.12 || frac > 0.88) interferenceKind = '加强';
    else interferenceKind = '中间';
  }

  return finish(p, {
    wavelength,
    period,
    waveNumber: k,
    pressure,
    amplitudeAtMic,
    attenuation: d / 1,
    intensity: amplitudeAtMic ** 2,
    pathDifference,
    pathRatio,
    interferenceKind,
    angleDeg: 0,
    directivity: 1,
  });
}

function pathRotioIsOddHalf(frac: number): boolean {
  return Math.abs(frac - 0.5) < 0.12;
}

function finish(p: SoundParams, m: Omit<SoundMetrics, 'description'>): SoundMetrics {
  return { ...m, description: describe(p, m) };
}

function describe(p: SoundParams, m: Omit<SoundMetrics, 'description'>): string {
  switch (p.mode) {
    case 'attenuation':
      return `${p.micDistance.toFixed(1)} m 处声压 ${m.amplitudeAtMic.toFixed(3)} Pa（1 m 处的 ${(1 / Math.max(m.attenuation, 0.01)).toFixed(2)} 倍）`;
    case 'frequency':
      return `${p.frequency.toFixed(0)} Hz，波长 ${m.wavelength.toFixed(2)} m，周期 ${(m.period * 1000).toFixed(1)} ms`;
    case 'interference':
      return `路程差 ${m.pathDifference.toFixed(3)} m = ${m.pathRatio.toFixed(2)} 个波长 → ${m.interferenceKind}`;
    case 'directivity':
      return `偏离正前方 ${m.angleDeg.toFixed(0)}°，声压是正前方的 ${(m.directivity * 100).toFixed(0)}%`;
    default:
      return '';
  }
}

/* ============================================================
 * 曲线采样
 * ========================================================== */

export interface WavePoint {
  t: number;
  p: number;
}

/** 声压-时间曲线（观察固定点的波形） */
export function sampleWave(p: SoundParams, points = 120): WavePoint[] {
  const span = 3 / Math.max(p.frequency, 1); // 画三个周期
  const out: WavePoint[] = [];
  for (let i = 0; i <= points; i++) {
    const t = (span * i) / points;
    const r = solveSound({ ...p, time: t });
    out.push({ t: round(t, 5), p: round(r.pressure, 5) });
  }
  return out;
}

export interface ScanPoint {
  offset: number;
  amplitude: number;
}

/** 横向扫麦克风，看干涉的强弱分布 */
export function scanInterference(p: SoundParams, points = 100): ScanPoint[] {
  const span = Math.max(p.sourceGap * 2.5, 2);
  const out: ScanPoint[] = [];
  for (let i = 0; i <= points; i++) {
    const y = -span + (2 * span * i) / points;
    const r = solveSound({ ...p, mode: 'interference', micOffset: y });
    out.push({ offset: round(y, 3), amplitude: round(r.amplitudeAtMic, 5) });
  }
  return out;
}

/** 扫距离，看 1/r 衰减 */
export function scanDistance(p: SoundParams, points = 80): ScanPoint[] {
  const out: ScanPoint[] = [];
  for (let i = 1; i <= points; i++) {
    const d = (10 * i) / points;
    const r = solveSound({ ...p, mode: 'attenuation', micDistance: d });
    out.push({ offset: round(d, 2), amplitude: round(r.amplitudeAtMic, 5) });
  }
  return out;
}

export { safe };
