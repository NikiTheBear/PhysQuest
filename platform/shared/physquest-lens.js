// PhysQuest lens engine, MIT. Source: physquest/apps/web/src/labs/optics-lens/engine.ts
const SHARP_BLUR_TOLERANCE = 0.15;
const SCREEN_IMAGE_TOLERANCE = 1.5;
const PARALLEL_EPS = 1e-3;
const FAR = 1e6;
const round = (x, d = 4) => {
  const p = 10 ** d;
  return Math.round(x * p) / p;
};
function solve(p) {
  const { u, f, h, screenX, maskTop, lensDiameter } = p;
  const uu = Math.max(u, 1e-6);
  const ff = Math.max(f, 1e-6);
  const D = Math.max(lensDiameter, 1e-6);
  const isParallel = Math.abs(uu - ff) < PARALLEL_EPS;
  let v;
  if (isParallel) {
    v = FAR;
  } else {
    v = uu * ff / (uu - ff);
  }
  const real = v > 0 && !isParallel;
  const m = isParallel ? Number.POSITIVE_INFINITY : -v / uu;
  const imageHeight = isParallel ? Number.POSITIVE_INFINITY : Math.abs(m) * h;
  const imageX = isParallel ? FAR : v;
  const imageY = isParallel ? 0 : m * h;
  let blurDiameter;
  if (isParallel) {
    blurDiameter = D;
  } else {
    blurDiameter = D * Math.abs(screenX - v) / Math.abs(v);
  }
  blurDiameter = Math.max(blurDiameter, 0);
  const screenHasImage = real && blurDiameter <= SCREEN_IMAGE_TOLERANCE;
  const maskFactor = maskTop ? 0.5 : 1;
  const defocusFactor = 1 / (1 + (blurDiameter / D) ** 2);
  const relativeIlluminance = Math.min(1, maskFactor * defocusFactor);
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
    description
  };
}
function describe(a) {
  const { isParallel, real, m } = a;
  if (isParallel) return "\u4E0D\u6210\u50CF\uFF1A\u51FA\u5C04\u5149\u5E73\u884C";
  if (!real) return `\u6B63\u7ACB\u3001\u653E\u5927\u7684\u865A\u50CF\uFF08\u653E\u5927 ${Math.abs(m).toFixed(1)} \u500D\uFF09`;
  const k = Math.abs(m);
  if (Math.abs(k - 1) < 0.02) return "\u5012\u7ACB\u3001\u7B49\u5927\u7684\u5B9E\u50CF";
  if (k < 1) return `\u5012\u7ACB\u3001\u7F29\u5C0F\u7684\u5B9E\u50CF\uFF08\u7F29\u5230 ${k.toFixed(2)} \u500D\uFF09`;
  return `\u5012\u7ACB\u3001\u653E\u5927\u7684\u5B9E\u50CF\uFF08\u653E\u5927 ${k.toFixed(1)} \u500D\uFF09`;
}
function traceRays(p) {
  const { u, f, h } = p;
  const metrics = solve(p);
  const xObj = -u;
  const yTip = h;
  const out = [];
  {
    const pts = [
      { x: xObj, y: yTip },
      { x: 0, y: yTip }
    ];
    if (metrics.isParallel) {
      pts.push({ x: f * 2, y: -yTip });
    } else {
      const dx = f;
      const dy = -yTip;
      const xEnd = Math.max(metrics.real ? Math.min(metrics.v * 3, f * 8) : f * 6, f * 3);
      const t = (xEnd - 0) / dx;
      pts.push({ x: xEnd, y: yTip + dy * t });
    }
    out.push({ points: pts, dashed: false, kind: 1 });
    if (!metrics.real && !metrics.isParallel) {
      out.push({
        points: [
          { x: 0, y: yTip },
          { x: metrics.v, y: metrics.imageY }
        ],
        dashed: true,
        kind: 1
      });
    }
  }
  {
    const slope = (0 - yTip) / (0 - xObj);
    const xEnd = Math.max(f * 6, 30);
    out.push({
      points: [
        { x: xObj, y: yTip },
        { x: 0, y: 0 },
        { x: xEnd, y: slope * xEnd }
      ],
      dashed: false,
      kind: 2
    });
    if (!metrics.real && !metrics.isParallel) {
      out.push({
        points: [
          { x: 0, y: 0 },
          { x: metrics.v, y: metrics.imageY }
        ],
        dashed: true,
        kind: 2
      });
    }
  }
  {
    if (Math.abs(u - f) > 1e-6 && u > f) {
      const slope = (0 - yTip) / (-f - xObj);
      const yAtLens = yTip + slope * (0 - xObj);
      const xEnd = Math.max(f * 6, 30);
      out.push({
        points: [
          { x: xObj, y: yTip },
          { x: 0, y: yAtLens },
          { x: xEnd, y: yAtLens }
        ],
        dashed: false,
        kind: 3
      });
      if (!metrics.real && !metrics.isParallel) {
        out.push({
          points: [
            { x: 0, y: yAtLens },
            { x: metrics.v, y: metrics.imageY }
          ],
          dashed: true,
          kind: 3
        });
      }
    }
  }
  return out;
}
export {
  SCREEN_IMAGE_TOLERANCE,
  SHARP_BLUR_TOLERANCE,
  solve,
  traceRays
};
