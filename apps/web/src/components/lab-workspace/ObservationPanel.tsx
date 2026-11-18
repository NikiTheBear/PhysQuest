import type { LensMetrics, LensParams } from '../../core/contracts';

interface Props {
  params: LensParams;
  metrics: LensMetrics;
}

/**
 * 观察笔记 —— 填在实验台下方的空白处
 *
 * 三块内容，都是学生此刻真的需要看的东西：
 *  1. 现在处于哪一段（一倍焦距分虚实，二倍焦距分大小）
 *  2. 光斑多大、多亮
 *  3. 一句话「你可以试试」
 */
export default function ObservationPanel({ params, metrics }: Props) {
  const { u, f } = params;
  const ratio = u / f;

  const seg: 'inside' | 'between' | 'outside' | 'focal' =
    metrics.isParallel ? 'focal' : u < f ? 'inside' : u < 2 * f ? 'between' : 'outside';

  const tip = (() => {
    if (seg === 'focal') return '正好在一倍焦距上。再动一点点，像就会从"没有"变成"有"——试试 u = 9.9 和 10.1。';
    if (seg === 'inside') return '物体在焦点以内，成的是虚像。把光屏往左往右挪都接不到——试试用眼睛从透镜右边看。';
    if (seg === 'between') return '在一倍到二倍焦距之间，像是放大的。这时候越靠近焦点，像越大、越远。';
    return '在两倍焦距以外，像是缩小的。往透镜方向挪，像会变大。';
  })();

  const brightness = Math.round(metrics.relativeIlluminance * 100);

  return (
    <div className="panel obs-panel">
      <h4>观察笔记</h4>

      {/* ===== 一倍焦距分虚实，二倍焦距分大小 ===== */}
      <div className="seg-band">
        <div className={`seg-cell ${seg === 'inside' || seg === 'focal' ? 'on' : ''}`}>
          <span className="seg-range">u &lt; f</span>
          <span className="seg-desc">虚像 · 放大</span>
        </div>
        <div className={`seg-cell ${seg === 'between' ? 'on' : ''}`}>
          <span className="seg-range">f &lt; u &lt; 2f</span>
          <span className="seg-desc">实像 · 放大</span>
        </div>
        <div className={`seg-cell ${seg === 'outside' ? 'on' : ''}`}>
          <span className="seg-range">u &gt; 2f</span>
          <span className="seg-desc">实像 · 缩小</span>
        </div>
        <div className="seg-marker" style={{ left: `${markerPos(ratio)}%` }} aria-hidden />
      </div>

      {/* ===== 三个读数 ===== */}
      <div className="obs-grid">
        <div className="obs-cell">
          <span className="k">物距÷焦距 = u / f</span>
          <b>{ratio.toFixed(2)}</b>
        </div>
        <div className="obs-cell">
          <span className="k">光斑直径</span>
          <b className={metrics.blurDiameter < 0.15 ? 'good' : 'warn'}>
            {metrics.isParallel ? '—' : metrics.blurDiameter.toFixed(2) + ' cm'}
          </b>
        </div>
        <div className="obs-cell">
          <span className="k">相对亮度</span>
          <b>{brightness}%</b>
          <div className="bar">
            <i style={{ width: `${brightness}%` }} />
          </div>
        </div>
      </div>

      <div className="obs-tip">{tip}</div>
    </div>
  );
}

/** 把 u/f 映射到 0–100%，让 f 和 2f 落在固定刻度上（分段线性） */
function markerPos(ratio: number): number {
  if (ratio <= 1) return clamp01(ratio) * 33;
  if (ratio <= 2) return 33 + (ratio - 1) * 33;
  return 66 + clamp01((ratio - 2) / 2) * 34;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
