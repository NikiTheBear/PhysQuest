import { useMemo } from 'react';
import GenericLab from '../../components/lab-workspace/GenericLab';
import {
  samplePower,
  solveCircuit,
  type CircuitMode,
  type CircuitParams,
} from './engine';

const MODES: Array<{ key: CircuitMode; label: string }> = [
  { key: 'series', label: '串联' },
  { key: 'parallel', label: '并联' },
  { key: 'closed', label: '闭合电路' },
];

export default function CircuitsLab({
  params,
  onChange,
}: {
  params: CircuitParams;
  onChange: (p: Partial<CircuitParams>) => void;
}) {
  const m = useMemo(() => solveCircuit(params), [params]);
  const curve = useMemo(() => samplePower(Math.max(params.emf / Math.max(params.internal, 0.1) * 2, 10)), [params.emf, params.internal]);

  return (
    <GenericLab
      modes={MODES}
      activeMode={params.mode}
      onMode={(k: string) => onChange({ mode: k as CircuitMode })}
      formula={
        params.mode === 'series' ? (
          <>
            R = R₁ + R₂ = {params.r1} + {params.r2} = <b>{m.external.toFixed(1)}</b> Ω · I = ε/R ={' '}
            <b>{m.current.toFixed(2)}</b> A
          </>
        ) : params.mode === 'parallel' ? (
          <>
            1/R = 1/R₁ + 1/R₂ → R = <b>{m.external.toFixed(2)}</b> Ω · 各支路电压都是{' '}
            <b>{m.terminal.toFixed(1)}</b> V
          </>
        ) : (
          <>
            I = ε/(R+r) = {params.emf}/({params.r1}+{params.internal}) = <b>{m.current.toFixed(2)}</b> A ·
            U = ε − Ir = <b>{m.terminal.toFixed(2)}</b> V
          </>
        )
      }
      summary={m.description}
      metrics={[
        { label: '电流 A', value: m.current.toFixed(2), tone: 'plain' },
        { label: '路端电压 V', value: m.terminal.toFixed(1), tone: 'plain' },
        { label: '输出功率 W', value: m.powerOut.toFixed(1), tone: m.isMaxPower ? 'good' : 'plain' },
        { label: '效率', value: `${(m.efficiency * 100).toFixed(0)} %`, tone: m.efficiency > 0.8 ? 'good' : 'warn' },
        { label: '内耗 W', value: m.powerLoss.toFixed(1), tone: 'plain' },
        { label: '发热 J', value: m.heat.toFixed(0), tone: 'plain' },
      ]}
      sliders={[
        {
          key: 'emf',
          label: '电动势 ε',
          value: params.emf,
          min: 1,
          max: 36,
          step: 0.5,
          display: `${params.emf.toFixed(1)} V`,
        },
        {
          key: 'internal',
          label: '内阻 r',
          value: params.internal,
          min: 0,
          max: 10,
          step: 0.1,
          display: `${params.internal.toFixed(1)} Ω`,
          hint: '调到和 R₁ 相等时，输出功率最大（但效率只有 50%）',
        },
        {
          key: 'r1',
          label: '外阻 R₁',
          value: params.r1,
          min: 0.1,
          max: 40,
          step: 0.1,
          display: `${params.r1.toFixed(1)} Ω`,
        },
        {
          key: 'r2',
          label: '外阻 R₂',
          value: params.r2,
          min: 0.1,
          max: 40,
          step: 0.1,
          display: `${params.r2.toFixed(1)} Ω`,
        },
        {
          key: 'time',
          label: '通电时间',
          value: params.time,
          min: 1,
          max: 120,
          step: 1,
          display: `${params.time.toFixed(0)} s`,
        },
      ]}
      onSlider={(key: string, value: number) => onChange({ [key]: value } as Partial<CircuitParams>)}
      presets={[
        { label: 'R = r', patch: { r1: params.internal } },
        { label: 'R = 2r', patch: { r1: params.internal * 2 } },
        { label: 'R = 5r', patch: { r1: params.internal * 5 } },
        { label: '短路 (R→0)', patch: { r1: 0.1 } },
      ]}
      onPreset={(patch: Record<string, number>) => onChange(patch as Partial<CircuitParams>)}
      charts={
        <div className="panel">
          <h4>输出功率与效率</h4>
          <PowerChart points={curve} internal={params.internal} current={params.r1} />
        </div>
      }
      scene={<CircuitScene params={params} metrics={m} />}
      sceneNote="电路图为示意；电流电压由左侧引擎实时计算"
      notes={
        <div className="panel">
          <h4>观察笔记</h4>
          <div className="obs-panel-inline">
            <div className="obs-row">
              <span className="k">当前</span>
              <b>{m.description}</b>
            </div>
            <div className="obs-grid" style={{ marginTop: 10 }}>
              <div className="obs-cell">
                <span className="k">输出功率</span>
                <b className={m.isMaxPower ? 'good' : undefined}>{m.powerOut.toFixed(1)} W</b>
              </div>
              <div className="obs-cell">
                <span className="k">效率</span>
                <b className={m.efficiency > 0.8 ? 'good' : 'warn'}>
                  {(m.efficiency * 100).toFixed(0)}%
                </b>
              </div>
              <div className="obs-cell">
                <span className="k">内耗</span>
                <b>{m.powerLoss.toFixed(1)} W</b>
              </div>
            </div>
            <div className="obs-tip">
              把内阻调成和外阻一样，看输出功率到不到峰顶——但注意效率此刻正好是一半。
              「功率最大」和「效率最高」永远不会同时发生在同一个点上。
            </div>
          </div>
        </div>
      }
    />
  );
}

/* ============================================================
 * P–R 曲线
 * ========================================================== */

function PowerChart({
  points,
  internal,
  current,
}: {
  points: Array<{ r: number; power: number; efficiency: number }>;
  internal: number;
  current: number;
}) {
  const W = 380;
  const H = 170;
  const PAD = { l: 38, r: 14, t: 12, b: 26 };

  const rMax = points[points.length - 1]?.r || 20;
  const pMax = Math.max(...points.map((p) => p.power), 0.01);

  const x = (r: number) => PAD.l + (r / rMax) * (W - PAD.l - PAD.r);
  const yP = (p: number) => PAD.t + (1 - p / pMax) * (H - PAD.t - PAD.b);
  const yE = (e: number) => PAD.t + (1 - e) * (H - PAD.t - PAD.b);

  const powerPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.r).toFixed(1)} ${yP(p.power).toFixed(1)}`)
    .join(' ');
  const effPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.r).toFixed(1)} ${yE(p.efficiency).toFixed(1)}`)
    .join(' ');

  return (
    <div className="curve-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {/* 峰值虚线 */}
        <line
          x1={x(internal)}
          y1={PAD.t}
          x2={x(internal)}
          y2={H - PAD.b}
          stroke="var(--curve-virtual)"
          strokeDasharray="4 3"
          strokeWidth="1"
        />
        <text x={x(internal) + 4} y={PAD.t + 11} className="curve-flabel">
          R = r
        </text>

        <path d={powerPath} fill="none" className="curve-real" strokeWidth="2" />
        <path d={effPath} fill="none" className="curve-virtual" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* 当前外阻 */}
        <line
          x1={x(Math.min(current, rMax))}
          y1={PAD.t}
          x2={x(Math.min(current, rMax))}
          y2={H - PAD.b}
          stroke="var(--curve-dot)"
          strokeWidth="1.5"
          opacity="0.7"
        />

        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} className="curve-axis" strokeWidth="1" />
        <text x={W - PAD.r} y={H - 8} className="curve-label" textAnchor="end">
          外阻 R / Ω
        </text>
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--curve-real)' }} />
          输出功率
        </span>
        <span>
          <i style={{ background: 'var(--curve-virtual)' }} />
          效率
        </span>
        <span style={{ color: 'var(--curve-dot)' }}>● 当前外阻</span>
      </div>
    </div>
  );
}

/* ============================================================
 * 电路示意图
 * ========================================================== */

function CircuitScene({
  params,
  metrics,
}: {
  params: CircuitParams;
  metrics: ReturnType<typeof solveCircuit>;
}) {
  const isSeries = params.mode === 'series';
  const isParallel = params.mode === 'parallel';

  // 指针角度：按读数映射到 -45° ~ +45°
  const needle = (ratio: number) => -45 + Math.max(0, Math.min(1, ratio)) * 90;

  const iRatio = Math.min(1, metrics.current / 5);
  const vRatio = Math.min(1, metrics.terminal / Math.max(params.emf, 1));

  return (
    <>
      {/* 主回路 */}
      <rect x="90" y="70" width="460" height="190" fill="none" stroke="#b8c6d2" strokeWidth="2.5" rx="4" />

      {/* 电源 */}
      <g>
        <line x1="90" y1="150" x2="90" y2="180" stroke="#ffffff" strokeWidth="5" />
        <line x1="76" y1="158" x2="104" y2="158" stroke="#5b7183" strokeWidth="2.5" />
        <line x1="82" y1="172" x2="98" y2="172" stroke="#5b7183" strokeWidth="2.5" />
        <text x="60" y="170" fontSize="11" fill="#5b7183" textAnchor="end">
          ε={params.emf.toFixed(1)}V
        </text>
        <text x="60" y="184" fontSize="10" fill="#8b9aa7" textAnchor="end">
          r={params.internal.toFixed(1)}Ω
        </text>
      </g>

      {isSeries && (
        <>
          {/* 两个电阻串联在顶部 */}
          <rect x="200" y="60" width="70" height="20" fill="#e8eef3" stroke="#8fa4b4" strokeWidth="1.5" rx="2" />
          <text x="235" y="54" fontSize="11" fill="#5b7183" textAnchor="middle">
            R₁ = {params.r1.toFixed(1)}Ω
          </text>

          <rect x="370" y="60" width="70" height="20" fill="#e8eef3" stroke="#8fa4b4" strokeWidth="1.5" rx="2" />
          <text x="405" y="54" fontSize="11" fill="#5b7183" textAnchor="middle">
            R₂ = {params.r2.toFixed(1)}Ω
          </text>
        </>
      )}

      {isParallel && (
        <>
          {/* 两个支路 */}
          <path d="M 260 70 L 260 120 L 380 120 L 380 70" fill="none" stroke="#b8c6d2" strokeWidth="2" />
          <rect x="295" y="110" width="50" height="20" fill="#e8eef3" stroke="#8fa4b4" strokeWidth="1.5" rx="2" />
          <text x="320" y="104" fontSize="11" fill="#5b7183" textAnchor="middle">
            R₁ = {params.r1.toFixed(1)}Ω
          </text>

          <path d="M 260 70 L 260 210 L 380 210 L 380 70" fill="none" stroke="#b8c6d2" strokeWidth="2" opacity="0" />
          <rect x="295" y="200" width="50" height="20" fill="#e8eef3" stroke="#8fa4b4" strokeWidth="1.5" rx="2" />
          <text x="320" y="194" fontSize="11" fill="#5b7183" textAnchor="middle">
            R₂ = {params.r2.toFixed(1)}Ω
          </text>
          <path d="M 260 260 L 260 210 L 380 210 L 380 260 L 550 260" fill="none" stroke="#b8c6d2" strokeWidth="2" />
        </>
      )}

      {!isSeries && !isParallel && (
        <>
          {/* 单个外阻 */}
          <rect x="270" y="60" width="80" height="20" fill="#e8eef3" stroke="#8fa4b4" strokeWidth="1.5" rx="2" />
          <text x="310" y="54" fontSize="11" fill="#5b7183" textAnchor="middle">
            R = {params.r1.toFixed(1)}Ω
          </text>
        </>
      )}

      {/* 电流表 */}
      <g transform="translate(480, 70)">
        <circle r="24" fill="#ffffff" stroke="#8fa4b4" strokeWidth="1.5" />
        <text y="4" fontSize="11" fill="#5b7183" textAnchor="middle">
          A
        </text>
        <line
          x1="0"
          y1="6"
          x2={20 * Math.sin((needle(iRatio) * Math.PI) / 180)}
          y2={6 - 20 * Math.cos((needle(iRatio) * Math.PI) / 180)}
          stroke="#c25f52"
          strokeWidth="1.8"
        />
        <text y="40" fontSize="11" fill="#c25f52" textAnchor="middle">
          {metrics.current.toFixed(2)} A
        </text>
      </g>

      {/* 电压表 */}
      <g transform="translate(550, 175)">
        <circle r="24" fill="#ffffff" stroke="#8fa4b4" strokeWidth="1.5" />
        <text y="4" fontSize="11" fill="#5b7183" textAnchor="middle">
          V
        </text>
        <line
          x1="0"
          y1="6"
          x2={20 * Math.sin((needle(vRatio) * Math.PI) / 180)}
          y2={6 - 20 * Math.cos((needle(vRatio) * Math.PI) / 180)}
          stroke="#5f9ea0"
          strokeWidth="1.8"
        />
        <text y="40" fontSize="11" fill="#5f9ea0" textAnchor="middle">
          {metrics.terminal.toFixed(1)} V
        </text>
      </g>

      <text x="320" y="296" fontSize="12" fill="#5b7183" textAnchor="middle">
        {params.mode === 'series' ? '串联电路' : params.mode === 'parallel' ? '并联电路' : '闭合电路'}
        {metrics.isMaxPower && params.mode === 'closed' ? ' · 输出功率已达最大' : ''}
      </text>
    </>
  );
}
