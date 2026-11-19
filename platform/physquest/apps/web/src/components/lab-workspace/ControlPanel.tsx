import type { LensMetrics, LensParams } from '../../core/contracts';

interface Props {
  params: LensParams;
  metrics: LensMetrics;
  onChange: (p: Partial<LensParams>) => void;
  activeSlider: keyof LensParams | null;
  onSliderFocus: (k: keyof LensParams | null) => void;
}

const Row = ({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  active,
  onChange,
  onFocus,
}: {
  label: string;
  hint?: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  active: boolean;
  onChange: (n: number) => void;
  onFocus: () => void;
}) => (
  <div className="slider-row">
    <div className="slider-label">
      <span style={{ color: active ? 'var(--accent)' : undefined, fontWeight: active ? 700 : 400 }}>
        {label}
      </span>
      <b>{display}</b>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerDown={onFocus}
      onFocus={onFocus}
    />
    {hint && <div className="slider-note">{hint}</div>}
  </div>
);

export default function ControlPanel({
  params,
  metrics,
  onChange,
  activeSlider,
  onSliderFocus,
}: Props) {
  const f = params.f;
  const isVirtual = params.u < f;
  const nearFocus = Math.abs(params.u - f) < 0.6;

  return (
    <>
      <div className="panel">
        <h4>公式 · 实时</h4>
        <div className="formula-box">
          <span className={`var ${activeSlider === 'f' ? 'hl' : ''}`}>1/{f.toFixed(0)}</span>
          {' = '}
          <span className={`var ${activeSlider === 'u' ? 'hl' : ''}`}>1/{params.u.toFixed(1)}</span>
          {' + '}
          <span className="var">1/{Number.isFinite(metrics.v) ? Math.abs(metrics.v).toFixed(1) : '∞'}</span>
        </div>
        <div className="formula-box" style={{ fontSize: 13.5 }}>
          放大率 m = {Number.isFinite(metrics.m) ? metrics.m.toFixed(2) : '∞'}
          <span style={{ color: 'var(--label-2)', marginLeft: 8 }}>
            {Number.isFinite(metrics.m) ? (Math.abs(metrics.m) > 1 ? '放大' : '缩小') : '—'}
            {Number.isFinite(metrics.m) ? (metrics.m < 0 ? ' · 倒立' : ' · 正立') : ''}
          </span>
        </div>

        <div className="metrics-grid">
          <div className="metric">
            <div className="v">{params.u.toFixed(1)}</div>
            <div className="k">物距 u</div>
          </div>
          <div className="metric">
            <div className="v">{Number.isFinite(metrics.v) ? Math.abs(metrics.v).toFixed(1) : '∞'}</div>
            <div className="k">像距 |v|</div>
          </div>
          <div className={`metric ${metrics.screenHasImage ? 'good' : 'warn'}`}>
            <div className="v">{metrics.screenHasImage ? '清晰' : '模糊'}</div>
            <div className="k">光屏</div>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--label-2)' }}>
          <span style={{ color: metrics.real ? 'var(--green)' : 'var(--img-virtual)' }}>
            {metrics.isParallel ? '不成像（平行光）' : metrics.description}
          </span>
        </div>
      </div>

      <div className="panel">
        <h4>动手调</h4>

        <Row
          label="物距 u"
          hint={
            nearFocus
              ? '⚠ 正好在焦点上，不成像'
              : isVirtual
                ? '物体在焦点以内 → 成虚像，光屏接不住'
                : undefined
          }
          value={params.u}
          display={`${params.u.toFixed(1)} cm`}
          min={1}
          max={80}
          step={0.5}
          active={activeSlider === 'u'}
          onChange={(v) => onChange({ u: v })}
          onFocus={() => onSliderFocus('u')}
        />

        <Row
          label="光屏位置"
          hint={
            metrics.screenHasImage
              ? '✓ 对上了，像很清楚'
              : metrics.real
                ? `还差 ${Math.abs(params.screenX - metrics.v).toFixed(1)} cm`
                : undefined
          }
          value={params.screenX}
          display={`${params.screenX.toFixed(1)} cm`}
          min={1}
          max={120}
          step={0.5}
          active={activeSlider === 'screenX'}
          onChange={(v) => onChange({ screenX: v })}
          onFocus={() => onSliderFocus('screenX')}
        />

        <Row
          label="焦距 f（换透镜）"
          hint="换一块透镜，同样的位置，结果全变"
          value={params.f}
          display={`${params.f.toFixed(0)} cm`}
          min={5}
          max={25}
          step={1}
          active={activeSlider === 'f'}
          onChange={(v) => onChange({ f: v, u: Math.max(v * 0.8, params.u > 40 ? 40 : params.u) })}
          onFocus={() => onSliderFocus('f')}
        />

        <div className="preset-row">
          {[
            ['u = 3f', { u: f * 3, screenX: (f * 3 * f) / (f * 3 - f) }],
            ['u = 2f', { u: f * 2, screenX: f * 2 }],
            ['u = 1.5f', { u: f * 1.5, screenX: (f * 1.5 * f) / (f * 1.5 - f) }],
            ['u = f', { u: f }],
            ['u = 0.6f', { u: f * 0.6 }],
          ].map(([label, patch]) => (
            <button key={label as string} onClick={() => onChange(patch as Partial<LensParams>)}>
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h4>让它更真实一点</h4>

        <div className="slider-row">
          <div className="slider-label">
            <span>遮住透镜上半部分</span>
          </div>
          <div className="preset-row" style={{ marginTop: 2 }}>
            <button
              onClick={() => onChange({ maskTop: false })}
              style={
                !params.maskTop
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                  : undefined
              }
            >
              不遮
            </button>
            <button
              onClick={() => onChange({ maskTop: true })}
              style={
                params.maskTop
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                  : undefined
              }
            >
              遮上半
            </button>
          </div>
        </div>

        <div className="slider-row">
          <div className="slider-label">
            <span>物体形状</span>
          </div>
          <div className="preset-row" style={{ marginTop: 2 }}>
            {(
              [
                ['arrow', '箭头'],
                ['F', 'F 字'],
                ['candle', '蜡烛'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => onChange({ objectShape: v })}
                style={
                  params.objectShape === v
                    ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                    : undefined
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Row
          label="物高 h"
          value={params.h}
          display={`${params.h.toFixed(1)} cm`}
          min={1}
          max={6}
          step={0.5}
          active={activeSlider === 'h'}
          onChange={(v) => onChange({ h: v })}
          onFocus={() => onSliderFocus('h')}
        />
      </div>
    </>
  );
}
