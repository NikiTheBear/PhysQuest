import { useMemo } from 'react';
import type { LensMetrics, LensParams } from '../../core/contracts';
import { solve, traceRays } from '../../labs/optics-lens/engine';

/**
 * 演示预览 —— 用本地引擎画一张「这一步该长什么样」的光路小图
 *
 * 为什么要有它：
 *   光具座现在住在 Fieldlab 的全屏 iframe 里，那边暂时没有「按参数设光具座」
 *   的消息（原因见 DemoPlayer 顶部长注释）。如果只剩解说词在翻页，学生看到的是
 *   几句话，看不到「像由小变大」。
 *   所以这里用和实验室**同一个引擎**（solve / traceRays）把这一步画出来——
 *   数字一定与实验室一致，只是画得简化些。
 *
 * 它是示意图，不是实验台：图下方写着「示意 · 实验台里可以亲手调」。
 */

interface Props {
  /** 本步的完整参数（已和默认值合并） */
  params: LensParams;
  metrics: LensMetrics;
  /** 本步要高亮的器材 id，与剧本里的 RigElementId 对齐 */
  highlight: string[];
  /** 整个剧本共用的坐标系，翻页时画面不跳 */
  frame: { minX: number; maxX: number; halfY: number };
}

const W = 660;
const H = 230;
const PAD = 16;

export default function DemoPreview({ params, metrics, highlight, frame }: Props) {
  const { u, screenX, h, maskTop } = params;
  const on = (id: string) => highlight.includes(id);

  const sx = (x: number) => PAD + ((x - frame.minX) / (frame.maxX - frame.minX)) * (W - PAD * 2);
  const sy = (y: number) => H / 2 - (y / frame.halfY) * (H / 2 - PAD);

  const axisY = sy(0);
  /** 透镜按真实口径画，但别超过画布 */
  const lensHalf = Math.min(params.lensDiameter / 2 || 3, frame.halfY * 0.92);

  const rays = useMemo(() => traceRays(params), [params]);
  const solid = rays.filter((r) => !r.dashed);
  const dashed = rays.filter((r) => r.dashed);

  const path = (points: Array<{ x: number; y: number }>) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');

  /** v 可能是 1e6（压在一倍焦距上），这种就当作「不成像」不画 */
  const showImage =
    Number.isFinite(metrics.v) &&
    !metrics.isParallel &&
    Math.abs(metrics.v) < 1e4 &&
    Math.abs(metrics.imageY) < frame.halfY * 1.7;

  return (
    <div className="demo-preview">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="这一步的光路示意">
        <defs>
          <clipPath id="dp-clip">
            <rect x={0} y={0} width={W} height={H} rx="12" />
          </clipPath>
        </defs>

        <g clipPath="url(#dp-clip)">
          {/* 主光轴 */}
          <line className="dp-axis" x1={PAD} y1={axisY} x2={W - PAD} y2={axisY} />

          {/* 两侧焦点 */}
          {[-params.f, params.f].map((fx, i) => (
            <g key={i} className="dp-focus">
              <line x1={sx(fx)} y1={axisY - 5} x2={sx(fx)} y2={axisY + 5} />
              <text x={sx(fx)} y={axisY + 19} textAnchor="middle">
                {i === 0 ? 'F' : 'F′'}
              </text>
            </g>
          ))}

          {/* 三条特殊光线 */}
          {solid.map((r, i) => (
            <path key={`s${i}`} d={path(r.points)} className={`dp-ray k${r.kind} ${on(`ray${r.kind}`) ? 'on' : ''}`} />
          ))}
          {dashed.map((r, i) => (
            <path
              key={`d${i}`}
              d={path(r.points)}
              className={`dp-ray k${r.kind} dashed ${on(`ray${r.kind}`) ? 'on' : ''}`}
            />
          ))}

          {/* 透镜 */}
          <g className={`dp-lens ${on('lens') ? 'on' : ''}`}>
            <path
              d={`M ${sx(0)} ${sy(lensHalf)} C ${sx(7)} ${sy(lensHalf * 0.42)}, ${sx(7)} ${sy(
                -lensHalf * 0.42,
              )}, ${sx(0)} ${sy(-lensHalf)} C ${sx(-7)} ${sy(-lensHalf * 0.42)}, ${sx(-7)} ${sy(
                lensHalf * 0.42,
              )}, ${sx(0)} ${sy(lensHalf)} Z`}
            />
            {maskTop && (
              <path
                className="dp-mask"
                d={`M ${sx(-7)} ${sy(lensHalf)} L ${sx(7)} ${sy(lensHalf)} L ${sx(7)} ${sy(
                  lensHalf * 0.42,
                )} L ${sx(-7)} ${sy(lensHalf * 0.42)} Z`}
              />
            )}
          </g>

          {/* 蜡烛（物） */}
          <g className={`dp-object ${on('candle') ? 'on' : ''}`}>
            <line x1={sx(-u)} y1={axisY} x2={sx(-u)} y2={sy(h)} />
            <path d={`M ${sx(-u)} ${sy(h)} l -4.5 7 l 9 0 Z`} className="dp-object-tip" />
            <text x={sx(-u)} y={axisY + 19} textAnchor="middle">
              物
            </text>
          </g>

          {/* 光屏 */}
          <g className={`dp-screen ${on('screen') ? 'on' : ''}`}>
            <line x1={sx(screenX)} y1={sy(lensHalf * 0.95)} x2={sx(screenX)} y2={sy(-lensHalf * 0.95)} />
            <text x={sx(screenX)} y={axisY + 19} textAnchor="middle">
              光屏
            </text>
          </g>

          {/* 像 */}
          {showImage && (
            <g className={`dp-image ${on('image') ? 'on' : ''}`}>
              <line
                className={metrics.real ? '' : 'virtual'}
                x1={sx(metrics.imageX)}
                y1={axisY}
                x2={sx(metrics.imageX)}
                y2={sy(metrics.imageY)}
              />
              <circle cx={sx(metrics.imageX)} cy={sy(metrics.imageY)} r={4.5} />
              <text x={sx(metrics.imageX)} y={sy(metrics.imageY) + (metrics.imageY >= 0 ? -11 : 20)} textAnchor="middle">
                {metrics.real ? '实像' : '虚像'}
              </text>
            </g>
          )}
        </g>
      </svg>

      <div className="demo-preview-cap">
        <span>{metrics.description}</span>
        <span className="demo-preview-hint">示意 · 实验台里可以亲手调</span>
      </div>
    </div>
  );
}
