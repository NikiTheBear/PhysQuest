/**
 * 评分测试用的夹具
 *
 * 不 mock 引擎：直接用 `labs/optics-lens/engine.ts` 的 `solve()` 算，
 * 通道构造方式逐行照 `platform/shared/physics.js:178-182` 抄 ——
 * 这样测试里的数字和学生在工作台里看到的完全一致。
 */

import type { CaptureSnapshot } from '../../components/free-build/ImmersiveLab';
import type { LearnerState, LensParams } from '../contracts';
import { DEFAULT_LENS_PARAMS } from '../contracts';
import { solve } from '../../labs/optics-lens/engine';

export const P = (over: Partial<LensParams>): LensParams => ({ ...DEFAULT_LENS_PARAMS, ...over });

/** physics.js:178-182 那一段的忠实翻译 */
export function channelsOf(p: LensParams): CaptureSnapshot['readings']['channels'] {
  const m = solve(p);
  const id = 'lens-bench';
  const rows: Array<[string, string, string, number]> = [
    ['v', '像距', 'cm', m.v],
    ['m', '放大率', '倍', m.m],
    ['imageHeight', '像高', 'cm', m.imageHeight],
    ['blurDiameter', '弥散圆', 'cm', m.blurDiameter],
    ['relativeIlluminance', '相对照度', '比例', m.relativeIlluminance],
    ['screenHasImage', '光屏可见像', '0/1', m.screenHasImage ? 1 : 0],
    ['real', '实像', '0/1', m.real ? 1 : 0],
  ];
  const out: CaptureSnapshot['readings']['channels'] = {};
  for (const [key, label, unit, value] of rows) {
    out[`${id}:${key}`] = {
      label: `凸透镜光具座 · ${label}`,
      // physics.js 的做法：非有限值落成 0 + valid:false
      value: Number.isFinite(value) ? value : 0,
      unit,
      valid: Number.isFinite(value),
    };
  }
  out[id] = {
    label: '凸透镜光具座 · 放大率',
    value: Number.isFinite(m.m) ? m.m : 0,
    unit: '倍',
    valid: Number.isFinite(m.m),
  };
  return out;
}

export interface SnapOpts {
  challengeId?: string;
  time?: number;
  /** 空实验台（没有器具） */
  empty?: boolean;
  /** 电路求解报错 */
  circuitError?: string | null;
}

/** 造一份工作台快照（结构和 app.js:454 的真实 payload 一致） */
export function snap(p: LensParams, opts: SnapOpts = {}): CaptureSnapshot {
  const id = 'lens-bench';
  const components = opts.empty
    ? []
    : [
        {
          id,
          name: '凸透镜光具座',
          kind: 'lens_bench',
          params: {
            u: p.u,
            f: p.f,
            h: p.h,
            screenX: p.screenX,
            lensDiameter: p.lensDiameter,
            // 快照里的 maskTop 是 0/1 数字，不是布尔（§7.4）
            maskTop: p.maskTop ? 1 : 0,
            objectShape: 0,
          },
        },
      ];

  const base: CaptureSnapshot = {
    experiment: {
      id: 'exp-1',
      title: '凸透镜成像',
      mode: 'build',
      goal: '',
      components,
      connections: [],
    },
    time: opts.time ?? 0,
    readings: { channels: opts.empty ? {} : channelsOf(p) },
    circuitError: opts.circuitError ?? null,
  };

  // source 是运行时字段，类型里没声明（§2.4 缺口 2）；测试里直接挂上去
  const withSource = base as CaptureSnapshot & {
    experiment: { source?: { openedChallenge?: string } };
  };
  if (opts.challengeId) {
    withSource.experiment.source = { openedChallenge: opts.challengeId };
  }
  return base;
}

export function emptyLearner(): LearnerState {
  return {
    stage: 'junior',
    completed: {},
    runs: [],
    predictions: {},
    reflections: {},
    misconceptions: {},
  };
}

export function learnerWith(args: {
  reflection?: string;
  challengeId?: string;
  observations?: string[];
}): LearnerState {
  const s = emptyLearner();
  const id = args.challengeId ?? 'CH-O2-01';
  if (args.reflection !== undefined) {
    s.reflections[id] = { text: args.reflection, updatedAt: 1_700_000_000_000 };
  }
  if (args.observations) {
    (s as LearnerState & { observations?: Record<string, string[]> }).observations = {
      [id]: args.observations,
    };
  }
  return s;
}

/** 文档 §3.4 例 A 的三组参数：只动物距 */
export const EXAMPLE_A: LensParams[] = [
  P({ u: 30, f: 10, screenX: 15 }),
  P({ u: 25, f: 10, screenX: 16.6 }),
  P({ u: 20, f: 10, screenX: 20 }),
];

/** 文档 §3.4 例 B 的三组参数：同时改 u 和 f */
export const EXAMPLE_B: LensParams[] = [
  P({ u: 30, f: 10, screenX: 15 }),
  P({ u: 15, f: 8, screenX: 15 }),
  P({ u: 13.5, f: 10, screenX: 15 }),
];
