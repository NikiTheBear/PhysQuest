/**
 * 凸透镜成像 · 物理引擎
 *
 * 铁律：
 *  1. 纯函数。无状态、无副作用、无网络、不读写存储。
 *  2. 网页层和实验室层调用同一个函数，必须得到同一组数字。
 *  3. 任何人改这个文件，跑 `npm test` 必须全绿。
 *
 * 符号约定（薄透镜，近轴）：
 *  - u 物距，恒正（物体在透镜左侧）
 *  - f 焦距，恒正
 *  - v = uf/(u−f)。v > 0 → 实像在透镜右侧；v < 0 → 虚像在透镜左侧
 *  - m = −v/u。m < 0 → 倒立；m > 0 → 正立；|m| 是放大倍数
 */

import type { LensMetrics, LensParams } from '../../core/contracts';

/** 弥散圆小于这个值 → 肉眼认为「清晰」 (cm) */
export const SHARP_BLUR_TOLERANCE = 0.15;

/** 弥散圆超过这个值 → 光屏上「看不见像」了 (cm) */
export const SCREEN_IMAGE_TOLERANCE = 1.5;

/** |u − f| 小于这个值就当作「压在一倍焦距上」 (cm) */
const PARALLEL_EPS = 1e-3;

/** 当作无穷远的替代值 */
const FAR = 1e6;

const round = (x: number, d = 4) => {
  const p = 10 ** d;
  return Math.round(x * p) / p;
};

export function solve(p: LensParams): LensMetrics {
  const { u, f, h, screenX, maskTop, lensDiameter } = p;

  const uu = Math.max(u, 1e-6);
  const ff = Math.max(f, 1e-6);
  const D = Math.max(lensDiameter, 1e-6);

  const isParallel = Math.abs(uu - ff) < PARALLEL_EPS;

  /* ---------- 像距与放大率 ---------- */
  let v: number;
  if (isParallel) {
    v = FAR;
  } else {
    v = (uu * ff) / (uu - ff);
  }

  const real = v > 0 && !isParallel;
  const m = isParallel ? Number.POSITIVE_INFINITY : -v / uu;

  /* ---------- 像的位置与大小 ---------- */
  const imageHeight = isParallel ? Number.POSITIVE_INFINITY : Math.abs(m) * h;
  const imageX = isParallel ? FAR : v;
  const imageY = isParallel ? 0 : m * h; // 倒立 -> 负（主光轴下方）

  /* ---------- 弥散圆 ----------
   * 光线从透镜口径 D 汇聚（或发散）于 x = v 处。
   * 在光屏 x = screenX 处的光锥截面直径：
   *     blur = D · |screenX − v| / |v|
   * 压在一倍焦距时 v→∞，光锥是平行光，blur = D。
   */
  let blurDiameter: number;
  if (isParallel) {
    blurDiameter = D;
  } else {
    blurDiameter = (D * Math.abs(screenX - v)) / Math.abs(v);
  }
  blurDiameter = Math.max(blurDiameter, 0);

  /* ---------- 光屏上有没有像 ---------- */
  // 只有实像能被光屏承接；且偏离太远时只剩一团光斑
  const screenHasImage = real && blurDiameter <= SCREEN_IMAGE_TOLERANCE;

  /* ---------- 相对亮度 ----------
   * 两个因素：
   *  1. 遮住上半 → 进光面积减半
   *  2. 离焦 → 同样的光摊在更大面积上，单位面积变暗
   */
  const maskFactor = maskTop ? 0.5 : 1;
  const defocusFactor = 1 / (1 + (blurDiameter / D) ** 2);
  const relativeIlluminance = Math.min(1, maskFactor * defocusFactor);

  /* ---------- 一句话描述 ---------- */
  const description = describe({ isParallel, real, m, u: uu, f: ff });

  return {
    v: round(v),
    m: Number.isFinite(m) ? round(m) : m,
    real,
    isParallel,
    imageHeight: Number.isFinite(imageHeight) ? round(imageHeight) : imageHeight,
    imageX: round(imageX),
    imageY: round(imageY),
    screenHasImage,
    blurDiameter: round(blurDiameter),
    relativeIlluminance: round(relativeIlluminance, 3),
    description,
  };
}

function describe(a: { isParallel: boolean; real: boolean; m: number; u: number; f: number }): string {
  const { isParallel, real, m } = a;
  if (isParallel) return '不成像：出射光平行';
  if (!real) return `正立、放大的虚像（放大 ${Math.abs(m).toFixed(1)} 倍）`;
  const k = Math.abs(m);
  if (Math.abs(k - 1) < 0.02) return '倒立、等大的实像';
  if (k < 1) return `倒立、缩小的实像（缩到 ${k.toFixed(2)} 倍）`;
  return `倒立、放大的实像（放大 ${k.toFixed(1)} 倍）`;
}

/* ============================================================
 * 三条特殊光线：给实验室层用，保证「画的光线」和「算的像」一致
 * ========================================================== */

export interface RaySegment {
  points: Array<{ x: number; y: number }>;
  /** 是否是虚线的延长线 */
  dashed: boolean;
  kind: 1 | 2 | 3;
}

/**
 * 生成三条特殊光线。
 *
 * 坐标约定（很重要）：
 *   x —— 厘米，透镜在 x = 0，物体在负 x 侧
 *   y —— 厘米，**向上为正**（物理坐标）。渲染层负责转成 SVG 的向下为正。
 *   imageY 同样是向上为正：倒立像 → imageY < 0。
 *
 *  1. 平行光轴 → 出射过后焦点 F'
 *  2. 过光心 → 方向不变
 *  3. 过前焦点 F → 出射平行主光轴（u < f 时这条打不到透镜，不画）
 *
 * 虚像（u < f）时，真实光线在透镜后方仍然发散，
 * 只有反向延长线才交于像点 —— 用 dashed = true 标出来。
 */
export function traceRays(p: LensParams): RaySegment[] {
  const { u, f, h } = p;
  const metrics = solve(p);
  const xObj = -u;
  const yTip = h; // 物体顶端，向上为正

  const out: RaySegment[] = [];

  // —— 光线 1：从物顶端平行主光轴射出，在透镜高度 yTip 处折射后过后焦点 F'(f, 0)
  {
    const pts = [
      { x: xObj, y: yTip },
      { x: 0, y: yTip },
    ];
    if (metrics.isParallel) {
      // u = f：出射方向指向 F'，出透镜后立刻穿过焦点
      pts.push({ x: f * 2, y: -yTip });
    } else {
      // 出射方向：从 (0, yTip) 朝 (f, 0) 的方向
      const dx = f;
      const dy = -yTip;
      const xEnd = Math.max(metrics.real ? Math.min(metrics.v * 3, f * 8) : f * 6, f * 3);
      const t = (xEnd - 0) / dx;
      pts.push({ x: xEnd, y: yTip + dy * t });
    }
    out.push({ points: pts, dashed: false, kind: 1 });

    // 虚像的延长线：从折射点往回画到虚像顶端
    if (!metrics.real && !metrics.isParallel) {
      out.push({
        points: [
          { x: 0, y: yTip },
          { x: metrics.v, y: metrics.imageY },
        ],
        dashed: true,
        kind: 1,
      });
    }
  }

  // —— 光线 2：从物顶端过光心，方向不变
  {
    const slope = (0 - yTip) / (0 - xObj); // 过原点
    const xEnd = Math.max(f * 6, 30);
    out.push({
      points: [
        { x: xObj, y: yTip },
        { x: 0, y: 0 },
        { x: xEnd, y: slope * xEnd },
      ],
      dashed: false,
      kind: 2,
    });
    if (!metrics.real && !metrics.isParallel) {
      out.push({
        points: [
          { x: 0, y: 0 },
          { x: metrics.v, y: metrics.imageY },
        ],
        dashed: true,
        kind: 2,
      });
    }
  }

  // —— 光线 3：从物顶端朝前焦点 F(-f, 0) 射出，到透镜后出射平行主光轴
  //     u < f 时前焦点落在物体外侧，这条光线实际上打不到透镜，教学上不画。
  {
    if (Math.abs(u - f) > 1e-6 && u > f) {
      // 入射直线：过 (xObj, yTip) 和 (-f, 0)
      const slope = (0 - yTip) / (-f - xObj);
      const yAtLens = yTip + slope * (0 - xObj);
      const xEnd = Math.max(f * 6, 30);
      out.push({
        points: [
          { x: xObj, y: yTip },
          { x: 0, y: yAtLens },
          { x: xEnd, y: yAtLens },
        ],
        dashed: false,
        kind: 3,
      });
      if (!metrics.real && !metrics.isParallel) {
        out.push({
          points: [
            { x: 0, y: yAtLens },
            { x: metrics.v, y: metrics.imageY },
          ],
          dashed: true,
          kind: 3,
        });
      }
    }
  }

  return out;
}
