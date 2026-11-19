import { useMemo } from 'react';
import GenericLab from '../../components/lab-workspace/GenericLab';
import {
  sampleWave,
  scanDistance,
  scanInterference,
  solveSound,
  type SoundMode,
  type SoundParams,
} from './engine';

const MODES: Array<{ key: SoundMode; label: string }> = [
  { key: 'attenuation', label: '距离衰减' },
  { key: 'frequency', label: '频率与波长' },
  { key: 'interference', label: '双源干涉' },
  { key: 'directivity', label: '指向性' },
];

export default function AcousticsLab({
  params,
  onChange,
}: {
  params: SoundParams;
  onChange: (p: Partial<SoundParams>) => void;
}) {
  const m = useMemo(() => solveSound(params), [params]);
  const wave = useMemo(() => sampleWave(params, 100), [params]);

  return (
    <GenericLab
      modes={MODES}
      activeMode={params.mode}
      onMode={(k: string) => onChange({ mode: k as SoundMode })}
      formula={
        <>
          λ = v/f = {params.speed}/{params.frequency.toFixed(0)} = <b>{m.wavelength.toFixed(2)}</b> m · p(r) = (A/r)·sin(ωt−kr)
        </>
      }
      summary={m.description}
      metrics={[
        { label: '波长 m', value: m.wavelength.toFixed(2), tone: 'plain' },
        { label: '周期 ms', value: (m.period * 1000).toFixed(1), tone: 'plain' },
        { label: '麦克风声压 Pa', value: m.amplitudeAtMic.toFixed(3), tone: 'good' },
        { label: '声强（相对）', value: m.intensity.toFixed(3), tone: 'plain' },
        { label: '路程差 m', value: m.pathDifference.toFixed(3), tone: 'plain' },
        { label: '干涉', value: m.interferenceKind, tone: m.interferenceKind === '加强' ? 'good' : 'warn' },
      ]}
      sliders={[
        {
          key: 'frequency',
          label: '频率 f',
          value: params.frequency,
          min: 20,
          max: 2000,
          step: 5,
          display: `${params.frequency.toFixed(0)} Hz`,
          hint: '人耳 20 Hz – 20 kHz，这里取低频段更好观察',
        },
        {
          key: 'micDistance',
          label: '麦克风距离',
          value: params.micDistance,
          min: 0.2,
          max: 8,
          step: 0.1,
          display: `${params.micDistance.toFixed(1)} m`,
        },
        {
          key: 'micOffset',
          label: '麦克风横向偏移',
          value: params.micOffset,
          min: -3,
          max: 3,
          step: 0.05,
          display: `${params.micOffset.toFixed(2)} m`,
        },
        {
          key: 'sourceGap',
          label: '双源间距',
          value: params.sourceGap,
          min: 0.2,
          max: 3,
          step: 0.1,
          display: `${params.sourceGap.toFixed(1)} m`,
        },
        {
          key: 'amplitude',
          label: '1 m 处参考声压',
          value: params.amplitude,
          min: 0.05,
          max: 2,
          step: 0.05,
          display: `${params.amplitude.toFixed(2)} Pa`,
        },
      ]}
      onSlider={(key: string, value: number) => onChange({ [key]: value } as Partial<SoundParams>)}
      presets={[
        { label: '低音 120 Hz', patch: { frequency: 120 } },
        { label: '中音 440 Hz', patch: { frequency: 440 } },
        { label: '正中间', patch: { micOffset: 0 } },
        { label: '偏半波长', patch: { micOffset: params.sourceGap / 2 } },
      ]}
      onPreset={(patch: Record<string, number>) => onChange(patch as Partial<SoundParams>)}
      charts={
        <>
          <div className="panel">
            <h4>声压–时间</h4>
            <WaveChart points={wave} />
          </div>
          {params.mode === 'interference' && (
            <div className="panel">
              <h4>横向扫过的强弱分布</h4>
              <ScanChart points={scanInterference(params, 120)} currentOffset={params.micOffset} />
            </div>
          )}
          {params.mode === 'attenuation' && (
            <div className="panel">
              <h4>声压随距离衰减</h4>
              <ScanChart points={scanDistance(params, 100)} currentOffset={params.micDistance} />
            </div>
          )}
        </>
      }
      scene={<SoundScene params={params} metrics={m} />}
      sceneNote="示意图；读数由左侧引擎实时计算（球面波 1/r 衰减）"
    />
  );
}

/* ============================================================
 * 波形图
 * ========================================================== */

function WaveChart({ points }: { points: Array<{ t: number; p: number }> }) {
  const W = 380;
  const H = 130;
  const PAD = { l: 36, r: 12, t: 12, b: 22 };

  const pMax = Math.max(...points.map((p) => Math.abs(p.p)), 0.001);
  const tMax = points[points.length - 1]?.t || 1;

  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
  const y = (p: number) => PAD.t + ((pMax - p) / (2 * pMax)) * (H - PAD.t - PAD.b);

  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${x(pt.t).toFixed(1)} ${y(pt.p).toFixed(1)}`).join(' ');

  return (
    <div className="curve-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <line x1={PAD.l} y1={y(0)} x2={W - PAD.r} y2={y(0)} className="curve-axis" strokeWidth="1" />
        <path d={d} fill="none" className="curve-real" strokeWidth="1.8" />
        <text x={W - PAD.r} y={H - 5} className="curve-label" textAnchor="end">
          时间 / s
        </text>
        <text x={PAD.l - 5} y={y(pMax) + 3} className="curve-label" textAnchor="end">
          +{pMax.toFixed(2)}
        </text>
        <text x={PAD.l - 5} y={y(-pMax) + 3} className="curve-label" textAnchor="end">
          −{pMax.toFixed(2)}
        </text>
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--curve-real)' }} />
          声压随时间变化（画的是三个周期）
        </span>
      </div>
    </div>
  );
}

/* ============================================================
 * 扫描图（干涉 or 衰减）
 * ========================================================== */

function ScanChart({
  points,
  currentOffset,
}: {
  points: Array<{ offset: number; amplitude: number }>;
  currentOffset: number;
}) {
  const W = 380;
  const H = 140;
  const PAD = { l: 36, r: 12, t: 12, b: 24 };

  const oMin = points[0]?.offset ?? 0;
  const oMax = points[points.length - 1]?.offset ?? 1;
  const aMax = Math.max(...points.map((p) => p.amplitude), 0.001);

  const x = (o: number) => PAD.l + ((o - oMin) / (oMax - oMin || 1)) * (W - PAD.l - PAD.r);
  const y = (a: number) => PAD.t + (1 - a / aMax) * (H - PAD.t - PAD.b);

  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${x(pt.offset).toFixed(1)} ${y(pt.amplitude).toFixed(1)}`).join(' ');

  return (
    <div className="curve-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="curve-axis" strokeWidth="1" />
        <path d={d} fill="none" className="curve-virtual" strokeWidth="1.8" />

        {currentOffset >= oMin && currentOffset <= oMax && (
          <line
            x1={x(currentOffset)}
            y1={PAD.t}
            x2={x(currentOffset)}
            y2={H - PAD.b}
            stroke="var(--curve-dot)"
            strokeWidth="1.5"
            opacity="0.75"
          />
        )}

        <text x={W - PAD.r} y={H - 6} className="curve-label" textAnchor="end">
          {oMin < 0 ? '横向偏移 / m' : '距离 / m'}
        </text>
        <text x={PAD.l - 5} y={PAD.t + 10} className="curve-label" textAnchor="end">
          {aMax.toFixed(2)}
        </text>
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--curve-virtual)' }} />
          声压幅值
        </span>
        <span style={{ color: 'var(--curve-dot)' }}>● 麦克风现在的位置</span>
      </div>
    </div>
  );
}

/* ============================================================
 * 场景
 * ========================================================== */

function SoundScene({
  params,
  metrics,
}: {
  params: SoundParams;
  metrics: ReturnType<typeof solveSound>;
}) {
  const cx = 180;
  const cy = 180;
  const scale = 34; // 每米多少像素

  const micX = cx + params.micDistance * scale * 0.55;
  const micY = cy - params.micOffset * scale * 0.55;

  // 声波圆弧：半径按波长缩放
  const ringCount = 5;
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const r = ((i + 1) * metrics.wavelength * scale * 0.22) % 130;
    return r + 14;
  });

  return (
    <>
      <defs>
        <radialGradient id="waveFade">
          <stop offset="0%" stopColor="#7fa8c4" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7fa8c4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 声波圈 */}
      {rings.map((r, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#7fa8c4"
          strokeWidth="1.6"
          opacity={Math.max(0.08, 0.55 - i * 0.1)}
        />
      ))}

      {/* 第二个声源（干涉模式） */}
      {params.mode === 'interference' && (
        <>
          <circle cx={cx} cy={cy - (params.sourceGap * scale) / 2} r="11" fill="#e9a66b" stroke="#c98a4a" strokeWidth="1.5" />
          <circle cx={cx} cy={cy + (params.sourceGap * scale) / 2} r="11" fill="#e9a66b" stroke="#c98a4a" strokeWidth="1.5" />
          <text x={cx - 20} y={cy} fontSize="10" fill="#8b9aa7" textAnchor="end">
            间距 {params.sourceGap.toFixed(1)} m
          </text>
        </>
      )}

      {/* 主声源 */}
      <circle
        cx={cx}
        cy={cy}
        r={params.mode === 'interference' ? 0 : 13}
        fill={params.mode === 'directivity' ? '#7fa8c4' : '#e9a66b'}
        stroke={params.mode === 'directivity' ? '#5f8ba8' : '#c98a4a'}
        strokeWidth="1.5"
      />
      {params.mode !== 'interference' && (
        <text x={cx} y={cy + 30} fontSize="10" fill="#8b9aa7" textAnchor="middle">
          {params.mode === 'directivity' ? '指向性声源' : '点声源'}
        </text>
      )}

      {/* 指向性模式：画一个扇形 */}
      {params.mode === 'directivity' && (
        <path
          d={`M ${cx} ${cy} L ${cx + 150} ${cy - 70} A 165 165 0 0 1 ${cx + 150} ${cy + 70} Z`}
          fill="rgba(127,168,196,0.14)"
          stroke="#b8d0e0"
          strokeWidth="1"
        />
      )}

      {/* 连线 */}
      <line x1={cx} y1={cy} x2={micX} y2={micY} stroke="#c8d4de" strokeDasharray="4 4" />

      {/* 麦克风 */}
      <g>
        <rect x={micX - 8} y={micY - 16} width="16" height="32" rx="4" fill="#ffffff" stroke="#5b7183" strokeWidth="1.8" />
        <line x1={micX} y1={micY - 12} x2={micX} y2={micY + 12} stroke="#c8d4de" strokeWidth="1" />
        <text x={micX + 14} y={micY + 4} fontSize="10" fill="#5b7183">
          麦克风
        </text>
        <text x={micX + 14} y={micY + 18} fontSize="10" fill="#c25f52">
          {metrics.amplitudeAtMic.toFixed(3)} Pa
        </text>
      </g>

      <text x={320} y={26} fontSize="12" fill="#5b7183" textAnchor="middle">
        {params.frequency.toFixed(0)} Hz · 波长 {metrics.wavelength.toFixed(2)} m
      </text>
      <text x={320} y={44} fontSize="11" fill="#8b9aa7" textAnchor="middle">
        距离 {params.micDistance.toFixed(1)} m
        {params.mode === 'interference' ? ` · 偏移 ${params.micOffset.toFixed(2)} m` : ''}
      </text>

      {params.mode === 'interference' && (
        <text
          x={320}
          y={320}
          fontSize="12"
          textAnchor="middle"
          fill={metrics.interferenceKind === '加强' ? '#459478' : metrics.interferenceKind === '减弱' ? '#c25f52' : '#8b9aa7'}
        >
          {metrics.interferenceKind}
        </text>
      )}
    </>
  );
}
