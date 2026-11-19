import type { ReactNode } from 'react';

export interface SliderSpec {
  key: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
}

export interface MetricSpec {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'plain';
}

interface Props {
  /** 公式区，可以带高亮的变量 */
  formula: ReactNode;
  /** 一句话描述当前状态 */
  summary: string;
  /** 滑块的实时读数网格 */
  metrics: MetricSpec[];
  /** 滑块 */
  sliders: SliderSpec[];
  onSlider: (key: string, value: number) => void;
  /** 快捷预设 */
  presets?: Array<{ label: string; patch: Record<string, number> }>;
  onPreset?: (patch: Record<string, number>) => void;
  /** 模式切换 */
  modes?: Array<{ key: string; label: string }>;
  activeMode?: string;
  onMode?: (key: string) => void;
  /** 左侧图表 */
  charts: ReactNode;
  /** 右侧场景 */
  scene: ReactNode;
  /** 场景下方的说明条 */
  sceneNote?: string;
  /** 场景下方的补充面板（观察笔记之类），用来填掉右侧空白 */
  notes?: ReactNode;
}

/**
 * 通用实验台外壳
 *
 * 三个学科（力学 / 电路 / 声学）共用这一套布局：
 *   左：模式切换 + 公式 + 图表 + 滑块
 *   右：场景 + 读数条
 *
 * 这样加第四个学科时，只要提供 scene 和 sliders 就行。
 */
export default function GenericLab({
  formula,
  summary,
  metrics,
  sliders,
  onSlider,
  presets,
  onPreset,
  modes,
  activeMode,
  onMode,
  charts,
  scene,
  sceneNote,
  notes,
}: Props) {
  return (
    <div className="split">
      <div>
        {modes && modes.length > 0 && (
          <div className="lab-modes">
            {modes.map((m) => (
              <button
                key={m.key}
                className={activeMode === m.key ? 'active' : ''}
                onClick={() => onMode?.(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        <div className="panel">
          <h4>公式 · 实时</h4>
          <div className="formula-box">{formula}</div>
          <div className="lab-summary">{summary}</div>

          <div className="metrics-grid">
            {metrics.map((m) => (
              <div key={m.label} className={`metric ${m.tone ?? ''}`}>
                <div className="v">{m.value}</div>
                <div className="k">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {charts}

        <div className="panel">
          <h4>动手调</h4>
          {sliders.map((s) => (
            <div className="slider-row" key={s.key}>
              <div className="slider-label">
                <span>{s.label}</span>
                <b>{s.display}</b>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.value}
                onChange={(e) => onSlider(s.key, Number(e.target.value))}
              />
              {s.hint && <div className="slider-note">{s.hint}</div>}
            </div>
          ))}

          {presets && presets.length > 0 && (
            <div className="preset-row">
              {presets.map((p) => (
                <button key={p.label} onClick={() => onPreset?.(p.patch)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lab-column">
        <div className="lab-stage">
          <svg
            viewBox="0 0 640 360"
            preserveAspectRatio="xMidYMid meet"
            className="lab-svg"
            role="img"
            aria-label={summary}
          >
            {scene}
          </svg>
        </div>
        {sceneNote && <div className="lab-scene-note">{sceneNote}</div>}
        {notes}
      </div>
    </div>
  );
}
