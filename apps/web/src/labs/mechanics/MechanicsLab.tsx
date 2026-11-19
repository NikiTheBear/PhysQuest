import { useMemo, useState } from 'react';
import GenericLab from '../../components/lab-workspace/GenericLab';
import {
  DEFAULT_MECHANICS,
  sampleMechanics,
  solveMechanics,
  type MechanicsMode,
  type MechanicsParams,
} from './engine';

const MODES: Array<{ key: MechanicsMode; label: string }> = [
  { key: 'free-fall', label: '自由落体' },
  { key: 'incline', label: '斜面' },
  { key: 'spring', label: '弹簧' },
  { key: 'projectile', label: '平抛' },
  { key: 'collision', label: '碰撞后滑行' },
  { key: 'oscillation', label: '简谐振动' },
];

export default function MechanicsLab({
  params,
  onChange,
}: {
  params: MechanicsParams;
  onChange: (p: Partial<MechanicsParams>) => void;
}) {
  const m = useMemo(() => solveMechanics(params), [params]);
  const samples = useMemo(() => sampleMechanics(params, 60), [params]);

  return (
    <GenericLab
      modes={MODES}
      activeMode={params.mode}
      onMode={(k: string) => onChange({ mode: k as MechanicsMode })}
      formula={
        <>
          {params.mode === 'free-fall' && (
            <>
              <span className="var">v</span> = g·t = {params.gravity} × {params.time.toFixed(1)} ={' '}
              <b>{m.speed.toFixed(2)}</b> m/s
            </>
          )}
          {params.mode === 'incline' && (
            <>
              <span className="var">a</span> = g·sin{params.angle}° − μg·cos{params.angle}° ={' '}
              <b>{m.acceleration.toFixed(2)}</b> m/s²
            </>
          )}
          {params.mode === 'spring' && (
            <>
              <span className="var">F</span> = −k·x = −{params.stiffness} × {m.displacement.toFixed(2)} ={' '}
              <b>{(-params.stiffness * m.displacement).toFixed(1)}</b> N
            </>
          )}
          {params.mode === 'projectile' && (
            <>
              <span className="var">x</span> = v₀·t = {params.velocity} × {params.time.toFixed(1)} ={' '}
              <b>{m.displacement.toFixed(2)}</b> m
            </>
          )}
          {params.mode === 'collision' && (
            <>
              <span className="var">v</span> = v₀ − μg·t = <b>{m.speed.toFixed(2)}</b> m/s
            </>
          )}
          {params.mode === 'oscillation' && (
            <>
              T = 2π√(m/k) = 2π√({params.mass}/{params.stiffness}) ={' '}
              <b>{(2 * Math.PI * Math.sqrt(params.mass / Math.max(params.stiffness, 1e-6))).toFixed(2)}</b> s
            </>
          )}
        </>
      }
      summary={m.description}
      metrics={[
        { label: '加速度', value: `${m.acceleration.toFixed(2)}`, tone: 'plain' },
        { label: '速度', value: `${Math.abs(m.speed).toFixed(2)}`, tone: 'plain' },
        { label: '位移', value: `${Math.abs(m.displacement).toFixed(2)}`, tone: 'plain' },
        { label: '动能 J', value: m.kinetic.toFixed(1), tone: 'good' },
        { label: '合外力 N', value: m.netForce.toFixed(1), tone: 'plain' },
        { label: '动量', value: m.momentum.toFixed(1), tone: 'plain' },
      ]}
      sliders={[
        {
          key: 'time',
          label: '经过时间 t',
          value: params.time,
          min: 0.1,
          max: 5,
          step: 0.1,
          display: `${params.time.toFixed(1)} s`,
        },
        {
          key: 'mass',
          label: '质量 m',
          value: params.mass,
          min: 0.1,
          max: 20,
          step: 0.1,
          display: `${params.mass.toFixed(1)} kg`,
        },
        {
          key: 'gravity',
          label: '重力加速度 g',
          value: params.gravity,
          min: 1,
          max: 20,
          step: 0.1,
          display: `${params.gravity.toFixed(1)} m/s²`,
          hint: '地球 9.8，月球 1.6，木星 24.8',
        },
        {
          key: 'friction',
          label: '摩擦因数 μ',
          value: params.friction,
          min: 0,
          max: 1,
          step: 0.01,
          display: params.friction.toFixed(2),
        },
        {
          key: 'angle',
          label: '斜面倾角',
          value: params.angle,
          min: 1,
          max: 80,
          step: 1,
          display: `${params.angle}°`,
        },
        {
          key: 'stiffness',
          label: '弹簧劲度 k',
          value: params.stiffness,
          min: 1,
          max: 100,
          step: 1,
          display: `${params.stiffness} N/m`,
        },
      ]}
      onSlider={(key: string, value: number) => onChange({ [key]: value } as Partial<MechanicsParams>)}
      presets={[
        { label: '地球重力', patch: { gravity: 9.8 } },
        { label: '月球重力', patch: { gravity: 1.6 } },
        { label: '光滑斜面', patch: { friction: 0 } },
        { label: '粗糙斜面', patch: { friction: 0.6 } },
      ]}
      onPreset={(patch: Record<string, number>) => onChange(patch as Partial<MechanicsParams>)}
      charts={
        <div className="panel">
          <h4>v–t 曲线</h4>
          <VTChart samples={samples} mode={params.mode} />
        </div>
      }
      scene={<MechanicsScene params={params} samples={samples} />}
      sceneNote="场景为示意图；所有读数由左侧引擎实时计算"
      notes={<MechanicsNotes params={params} />}
    />
  );
}

/* ============================================================
 * v–t 曲线
 * ========================================================== */

function VTChart({
  samples,
  mode,
}: {
  samples: Array<{ t: number; v: number; x: number }>;
  mode: MechanicsMode;
}) {
  const W = 380;
  const H = 160;
  const PAD = { l: 38, r: 12, t: 12, b: 24 };

  const vs = samples.map((s) => s.v);
  const vMax = Math.max(...vs.map(Math.abs), 1);
  const tMax = samples[samples.length - 1]?.t || 1;

  const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((vMax - v) / (2 * vMax)) * (H - PAD.t - PAD.b);

  const path = samples.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.t).toFixed(1)} ${y(s.v).toFixed(1)}`).join(' ');

  const zeroY = y(0);

  return (
    <div className="curve-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {/* 零线 */}
        <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} className="curve-axis" strokeWidth="1" />

        {/* 曲线 */}
        <path d={path} fill="none" className="curve-real" strokeWidth="2" />

        {/* 当前时刻的点 */}
        <circle cx={x(tMax)} cy={y(samples[samples.length - 1]?.v ?? 0)} r="4" className="curve-dot" />

        <text x={W - PAD.r} y={H - 6} className="curve-label" textAnchor="end">
          时间 t / s
        </text>
        <text x={PAD.l - 6} y={PAD.t + 8} className="curve-label" textAnchor="end">
          v
        </text>
        <text x={PAD.l - 6} y={zeroY + 3} className="curve-label" textAnchor="end">
          0
        </text>
        <text x={PAD.l - 6} y={y(vMax) + 3} className="curve-label" textAnchor="end">
          {vMax.toFixed(0)}
        </text>
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--curve-real)' }} />
          {mode === 'oscillation' ? '速度（来回变号）' : '速度随时间'}
        </span>
        <span style={{ color: 'var(--curve-dot)' }}>● 当前时刻</span>
      </div>
    </div>
  );
}

/* ============================================================
 * 场景
 * ========================================================== */

function MechanicsScene({
  params,
  samples,
}: {
  params: MechanicsParams;
  samples: Array<{ t: number; v: number; x: number }>;
}) {
  const m = solveMechanics(params);
  const last = samples[samples.length - 1];

  // 统一坐标：地面在 y=300
  const GROUND = 300;

  if (params.mode === 'incline') {
    const rad = (params.angle * Math.PI) / 180;
    const L = 300;
    const x0 = 120;
    const y0 = GROUND - L * Math.sin(rad);
    const x1 = x0 + L * Math.cos(rad);

    // 方块沿斜面下滑的位置
    const travelled = Math.min(Math.abs(m.displacement), L);
    const bx = x0 + travelled * Math.cos(rad) + 14 * Math.cos(rad - Math.PI / 2);
    const by = y0 + travelled * Math.sin(rad) + 14 * Math.sin(rad - Math.PI / 2);

    return (
      <>
        <polygon points={`${x0},${GROUND} ${x1},${GROUND} ${x0},${y0}`} fill="#eef2f6" stroke="#b8c6d2" strokeWidth="1.5" />
        <text x={(x0 + x1) / 2} y={GROUND - 8} fontSize="11" fill="#8b9aa7" textAnchor="middle">
          {params.angle}°
        </text>

        {/* 方块 */}
        <rect
          x={bx - 13}
          y={by - 13}
          width="26"
          height="26"
          rx="3"
          fill="#d7b98a"
          stroke="#a8895b"
          strokeWidth="1.5"
          transform={`rotate(${params.angle} ${bx} ${by})`}
        />

        {/* 重力箭头 */}
        <line x1={bx} y1={by} x2={bx} y2={by + 42} stroke="#c25f52" strokeWidth="2" markerEnd="url(#arrowRed)" />
        <defs>
          <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#c25f52" />
          </marker>
        </defs>

        <text x={bx + 8} y={by + 56} fontSize="11" fill="#c25f52">
          mg
        </text>

        <text x={320} y={40} fontSize="12" fill="#5b7183" textAnchor="middle">
          斜面 {params.angle}° · μ = {params.friction.toFixed(2)}
        </text>
        <text x={320} y={58} fontSize="11" fill="#8b9aa7" textAnchor="middle">
          加速度 {m.acceleration.toFixed(2)} m/s²
        </text>
      </>
    );
  }

  if (params.mode === 'spring' || params.mode === 'oscillation') {
    const cx = 200;
    // 弹簧伸长量映射到像素
    const stretch = Math.max(-120, Math.min(120, m.displacement * 40));
    const anchorX = cx - 60;
    const blockX = anchorX + 60 + stretch;

    const coils = 14;
    const path: string[] = [];
    for (let i = 0; i <= coils; i++) {
      const t = i / coils;
      const px = anchorX + t * (blockX - anchorX);
      const py = 170 + (i % 2 === 0 ? -14 : 14);
      path.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
    }

    return (
      <>
        {/* 天花板 */}
        <rect x={anchorX - 20} y={110} width="24" height="8" fill="#b8c6d2" />
        <line x1={anchorX} y1={118} x2={anchorX} y2={170} stroke="#b8c6d2" strokeWidth="2" />

        {/* 弹簧 */}
        <path d={path.join(' ')} fill="none" stroke="#7fa8c4" strokeWidth="2.2" strokeLinejoin="round" />

        {/* 振子 */}
        <circle cx={blockX} cy={170} r="20" fill="#d7b98a" stroke="#a8895b" strokeWidth="1.5" />
        <text x={blockX} y={175} fontSize="11" fill="#6b5433" textAnchor="middle">
          {params.mass.toFixed(1)}kg
        </text>

        {/* 平衡位置虚线 */}
        <line x1={anchorX + 60} y1={130} x2={anchorX + 60} y2={230} stroke="#c8d4de" strokeDasharray="4 4" />

        <text x={320} y={40} fontSize="12" fill="#5b7183" textAnchor="middle">
          {params.mode === 'oscillation' ? '简谐振动' : '弹簧弹力'} · k = {params.stiffness} N/m
        </text>
        <text x={320} y={58} fontSize="11" fill="#8b9aa7" textAnchor="middle">
          {params.mode === 'oscillation'
            ? `周期 ${(2 * Math.PI * Math.sqrt(params.mass / Math.max(params.stiffness, 1e-6))).toFixed(2)} s`
            : `弹力 ${(-params.stiffness * m.displacement).toFixed(1)} N`}
        </text>
      </>
    );
  }

  if (params.mode === 'projectile') {
    // 抛物线
    const startX = 90;
    const startY = 90;
    const scaleX = 28;
    const scaleY = 9;
    const pts: string[] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = (params.time * i) / N;
      const px = startX + params.velocity * t * scaleX;
      const py = startY + 0.5 * params.gravity * t * t * scaleY;
      if (py > GROUND) break;
      pts.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${Math.min(py, GROUND).toFixed(1)}`);
    }

    const endX = startX + params.velocity * params.time * scaleX;
    const endY = Math.min(startY + 0.5 * params.gravity * params.time ** 2 * scaleY, GROUND);

    return (
      <>
        <line x1={40} y1={GROUND} x2={600} y2={GROUND} stroke="#b8c6d2" strokeWidth="2" />

        {/* 轨迹 */}
        <path d={pts.join(' ')} fill="none" stroke="#7fa8c4" strokeWidth="2" strokeDasharray="5 4" />

        {/* 起点 */}
        <circle cx={startX} cy={startY} r="6" fill="#d7b98a" stroke="#a8895b" strokeWidth="1.5" />

        {/* 当前点 */}
        <circle cx={endX} cy={endY} r="9" fill="#e9a66b" stroke="#c98a4a" strokeWidth="1.5" />

        {/* 速度分量 */}
        <line x1={endX} y1={endY} x2={endX + 40} y2={endY} stroke="#5f9ea0" strokeWidth="2" />
        <line x1={endX} y1={endY} x2={endX} y2={endY + 40} stroke="#c25f52" strokeWidth="2" />
        <text x={endX + 44} y={endY + 4} fontSize="10" fill="#5f9ea0">
          vₓ
        </text>
        <text x={endX + 4} y={endY + 50} fontSize="10" fill="#c25f52">
          v_y
        </text>

        <text x={320} y={40} fontSize="12" fill="#5b7183" textAnchor="middle">
          平抛：v₀ = {params.velocity} m/s · g = {params.gravity} m/s²
        </text>
      </>
    );
  }

  // 自由落体 / 碰撞：小球下落
  const dropH = Math.min(Math.abs(m.displacement) * 30, 200);
  const ballY = Math.min(60 + dropH, GROUND - 12);
  const trailPts: string[] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = (params.time * i) / N;
    const h = 0.5 * params.gravity * t * t * 30;
    if (60 + h > GROUND) break;
    trailPts.push(`${i === 0 ? 'M' : 'L'} ${320} ${(60 + h).toFixed(1)}`);
  }

  return (
    <>
      <line x1={80} y1={GROUND} x2={560} y2={GROUND} stroke="#b8c6d2" strokeWidth="2" />

      {/* 起始位置虚线 */}
      <line x1={280} y1={60} x2={360} y2={60} stroke="#c8d4de" strokeDasharray="4 4" />

      {/* 下落轨迹 */}
      <path d={trailPts.join(' ')} fill="none" stroke="#c8d4de" strokeWidth="1.5" strokeDasharray="3 3" />

      {/* 小球 */}
      <circle cx={320} cy={ballY} r="12" fill="#d7b98a" stroke="#a8895b" strokeWidth="1.5" />

      {/* 重力箭头 */}
      <line x1={320} y1={ballY} x2={320} y2={ballY + 40} stroke="#c25f52" strokeWidth="2" />
      <text x={328} y={ballY + 52} fontSize="10" fill="#c25f52">
        g
      </text>

      <text x={320} y={32} fontSize="12" fill="#5b7183" textAnchor="middle">
        {params.mode === 'collision' ? '碰撞后滑行' : '自由落体'} · g = {params.gravity} m/s²
      </text>
      <text x={320} y={GROUND + 22} fontSize="11" fill="#8b9aa7" textAnchor="middle">
        t = {params.time.toFixed(1)} s · 已下落 {Math.abs(m.displacement).toFixed(1)} m
      </text>
    </>
  );
}

/* ============================================================
 * 底部：观察笔记（填掉右侧空白，参照光学那套）
 * ========================================================== */

function MechanicsNotes({ params }: { params: MechanicsParams }) {
  const m = solveMechanics(params);
  const tips: Record<MechanicsMode, string> = {
    'free-fall': '试试点 2 秒和 4 秒，看位移是不是变成 4 倍——这是平方关系，不是线性。',
    incline: '把摩擦调到刚好让方块不动，那个临界角度就是 arctan(μ)。',
    spring: '同一个弹簧，振幅变大周期不变——这是简谐振动最反直觉的地方。',
    projectile: '把初速度调到 0，它就变成自由落体了。平抛可以拆成两个独立运动。',
    collision: '摩擦因数越大，停下得越快。把摩擦调到 0，它会永远滑下去。',
    oscillation: '把阻尼调大，振荡次数变少；调到很大，就不振荡了，直接回到平衡位置。',
  };

  return (
    <div className="panel">
      <h4>观察笔记</h4>
      <div className="obs-panel-inline">
        <div className="obs-row">
          <span className="k">当前结果</span>
          <b>{m.description}</b>
        </div>
        <div className="obs-grid" style={{ marginTop: 10 }}>
          <div className="obs-cell">
            <span className="k">加速度</span>
            <b>{m.acceleration.toFixed(2)} m/s²</b>
          </div>
          <div className="obs-cell">
            <span className="k">机械能</span>
            <b>{m.mechanical.toFixed(1)} J</b>
          </div>
          <div className="obs-cell">
            <span className="k">动量</span>
            <b>{m.momentum.toFixed(1)} kg·m/s</b>
          </div>
        </div>
        <div className="obs-tip">{tips[params.mode]}</div>
      </div>
    </div>
  );
}
