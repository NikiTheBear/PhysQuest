import { useMemo } from 'react';
import type { LensMetrics, LensParams } from '../../core/contracts';
import { solve } from '../../labs/optics-lens/engine';

interface Props {
  params: LensParams;
  metrics: LensMetrics;
  highlight: 'u' | 'f' | 'v' | null;
}

/**
 * 左屏：实时函数图像
 *  - 主曲线：物距 u → 像距 |v|（固定焦距）
 *  - 当前点用红点标出
 *  - u < f 区域用不同颜色区分（虚像区）
 */
export default function CurveChart({ params, metrics, highlight }: Props) {
  const W = 380;
  const H = 210;
  const PAD = { l: 40, r: 14, t: 14, b: 30 };

  const f = params.f;
  const uMax = Math.max(60, f * 6);
  const uMin = 0.5;

  const pts = useMemo(() => {
    const out: Array<{ u: number; v: number; real: boolean; uu: number; vv: number }> = [];
    const N = 260;
    for (let i = 0; i <= N; i++) {
      const u = uMin + ((uMax - uMin) * i) / N;
      const r = solve({ ...params, u, screenX: params.screenX });
      const v = r.v;
      if (!Number.isFinite(v) || Math.abs(v) > 400) continue;
      out.push({ u, v, real: r.real, uu: 0, vv: 0 });
    }
    return out;
  }, [params, f, uMax]);

  // |v| 的最大值用于纵轴刻度（裁剪极端值）
  const vCap = Math.min(
    Math.max(...pts.map((p) => Math.abs(p.v)), f * 4),
    f * 12,
  );

  const x = (u: number) => PAD.l + ((u - uMin) / (uMax - uMin)) * (W - PAD.l - PAD.r);
  const y = (v: number) =>
    PAD.t + (1 - Math.min(Math.abs(v), vCap) / vCap) * (H - PAD.t - PAD.b);

  const realPts = pts.filter((p) => p.real);
  const virtPts = pts.filter((p) => !p.real);

  const line = (arr: typeof pts) =>
    arr.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.u).toFixed(2)} ${y(p.v).toFixed(2)}`).join(' ');

  const curU = Math.max(uMin, Math.min(params.u, uMax));
  const curV = Math.abs(metrics.v);
  const curVisible = Number.isFinite(curV) && curV <= vCap * 1.02;

  return (
    <div className="curve-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {/* 网格 */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD.l}
            y1={PAD.t + t * (H - PAD.t - PAD.b)}
            x2={W - PAD.r}
            y2={PAD.t + t * (H - PAD.t - PAD.b)}
            className="curve-grid"
            strokeWidth="1"
          />
        ))}

        {/* 虚像区背景（u < f） */}
        <rect
          x={PAD.l}
          y={PAD.t}
          width={Math.max(x(f) - PAD.l, 0)}
          height={H - PAD.t - PAD.b}
          className="curve-zone"
        />
        <line x1={x(f)} y1={PAD.t} x2={x(f)} y2={H - PAD.b} className="curve-virtual" strokeWidth="1" strokeDasharray="3 3" />
        <text x={x(f) + 4} y={PAD.t + 11} className="curve-flabel">
          u = f
        </text>

        {/* 曲线 */}
        <path d={line(realPts)} fill="none" className="curve-real" strokeWidth="2" />
        <path d={line(virtPts)} fill="none" className="curve-virtual" strokeWidth="2" strokeDasharray="4 3" />

        {/* 当前点 */}
        {curVisible && (
          <>
            <line
              x1={x(curU)}
              y1={y(curV)}
              x2={x(curU)}
              y2={H - PAD.b}
              className="curve-guide"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <circle cx={x(curU)} cy={y(curV)} r="4.5" className="curve-dot" stroke="var(--surface)" strokeWidth="1.5" />
          </>
        )}

        {/* 轴 */}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="curve-axis" strokeWidth="1" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} className="curve-axis" strokeWidth="1" />

        <text x={W - PAD.r} y={H - 8} className="curve-label" textAnchor="end">
          物距 u / cm
        </text>
        <text x={PAD.l - 6} y={PAD.t + 8} className="curve-label" textAnchor="end">
          |v|
        </text>

        {[0, 0.5, 1].map((t) => (
          <text
            key={t}
            x={PAD.l - 6}
            y={PAD.t + (1 - t) * (H - PAD.t - PAD.b) + 3}
            className="curve-label"
            textAnchor="end"
          >
            {Math.round(t * vCap)}
          </text>
        ))}
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--curve-real)' }} />
          实像 |v|
        </span>
        <span>
          <i style={{ background: 'var(--curve-virtual)' }} />
          虚像 |v|
        </span>
        <span style={{ color: 'var(--curve-dot)' }}>● 你现在的位置</span>
      </div>
    </div>
  );
}
