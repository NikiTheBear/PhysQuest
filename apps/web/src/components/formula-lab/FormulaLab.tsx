import { useEffect, useId, useMemo, useState } from 'react';
import type { DiagramLabSpec, FormulaLabSpec, LabInputSpec, LabSpec } from './labData';
import { labById } from './labData';
import { safeEval } from './safeEval';
import {
  POS_MAX,
  SCALE_TITLE,
  clamp,
  formatNumber,
  fromPos,
  numText,
  scaleKind,
  toPos,
} from './sliderScale';

/**
 * 公式实验室
 *
 * 两种条目，一套组件：
 *   formula —— 左边调参数、右边实时出数（78 条）
 *   diagram —— 没有可算的单一数字，只讲「画什么 / 标什么 / 看什么」（19 条）
 *
 * 设计上守的两条：
 *   ① 数字是从表达式**算**出来的，不是写死的。所以参数一动，结果立刻变，
 *      学生能看见「我把 k 调大一倍，声压就大一倍」这种比例关系。
 *   ② 表达式是**数据**，走 safeEval 的白名单沙箱（见 safeEval.ts），
 *      算不出来就显示「—」，绝不把 Infinity / NaN 印在屏幕上装成答案。
 */

interface Props {
  /** 知识点 id，用来从 formula-lab.json 里取 */
  knowledgeId: string;
  /** 关闭（如果放在弹层里） */
  onClose?: () => void;
}

/* ============================================================
   滑杆刻度 & 数字格式在 sliderScale.ts（纯函数，单独有 test）
   ============================================================ */
/** 输入框里现在这串字，是不是一个能用的数（空串算「还没输完」，不算错） */
function badText(inp: LabInputSpec, raw: string | undefined): boolean {
  const t = (raw ?? '').trim();
  if (t === '') return false;
  const n = Number(t);
  if (!Number.isFinite(n)) return true;
  return n < inp.min || n > inp.max;
}

function initialValues(spec: LabSpec): Record<string, number> {
  const out: Record<string, number> = {};
  if (spec.kind !== 'formula') return out;
  for (const inp of spec.inputs) {
    const d = Number.isFinite(inp.default) ? inp.default : inp.min;
    out[inp.key] = clamp(d, inp.min, inp.max);
  }
  return out;
}

/* ============================================================
   组件
   ============================================================ */

export default function FormulaLab({ knowledgeId, onClose }: Props) {
  const spec = labById(knowledgeId);

  if (!spec) {
    return (
      <div className="formula-lab">
        <div className="fl-empty">
          这一条还没有公式实验室（{knowledgeId || '未知知识点'}）。
        </div>
        {onClose && (
          <div className="fl-actions">
            <button className="btn-ghost" onClick={onClose}>
              关闭
            </button>
          </div>
        )}
      </div>
    );
  }

  // 换知识点时靠 key 重挂载，参数自动回到默认值，不用写同步逻辑
  return <LabBody key={knowledgeId} spec={spec} onClose={onClose} />;
}

function LabBody({ spec, onClose }: { spec: LabSpec; onClose?: () => void }) {
  const uid = useId();
  const initial = useMemo(() => initialValues(spec), [spec]);
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const t: Record<string, string> = {};
    for (const k of Object.keys(initial)) t[k] = numText(initial[k]);
    return t;
  });

  const results = useMemo(() => {
    if (spec.kind !== 'formula') return [];
    return spec.outputs.map((o) => ({ ...o, value: safeEval(o.expr, values) }));
    // values 里任何一个键变都要重算
  }, [spec, values]);

  const isFormula = spec.kind === 'formula';

  // Esc 关掉这一层（外层弹层自己没有监听 Esc，所以不会一起关）
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reset = () => {
    setValues(initial);
    const t: Record<string, string> = {};
    for (const k of Object.keys(initial)) t[k] = numText(initial[k]);
    setTexts(t);
  };

  const onType = (inp: LabInputSpec, raw: string) => {
    setTexts((prev) => ({ ...prev, [inp.key]: raw }));
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n)) return;
    // 边打字边算，但不把输入框里的字回写（否则输 "0.0" 会被吃掉）
    setValues((prev) => ({ ...prev, [inp.key]: clamp(n, inp.min, inp.max) }));
  };

  /** 失焦时收口：把越界 / 半截的输入拉回合法值，并回写成人能读的数字 */
  const onCommit = (inp: LabInputSpec) => {
    const raw = (texts[inp.key] ?? '').trim();
    const n = raw === '' ? NaN : Number(raw);
    const v = Number.isFinite(n) ? clamp(n, inp.min, inp.max) : (values[inp.key] ?? inp.default);
    setValues((prev) => ({ ...prev, [inp.key]: v }));
    setTexts((prev) => ({ ...prev, [inp.key]: numText(v) }));
  };

  const onSlide = (inp: LabInputSpec, pos: number) => {
    const v = fromPos(pos, inp);
    setValues((prev) => ({ ...prev, [inp.key]: v }));
    setTexts((prev) => ({ ...prev, [inp.key]: numText(v) }));
  };

  return (
    <div className="formula-lab">
      <header className="fl-head">
        <div className="fl-head-top">
          <span className="eyebrow">Formula Lab · 公式实验室</span>
          <span className={`badge ${isFormula ? 'on' : 'off'}`}>
            {isFormula ? '可算' : '只能示意'}
          </span>
        </div>
        <h3>{spec.title}</h3>
        {isFormula && spec.formula && (
          <div className="fl-formula" title="这一条在讲的关系">
            {spec.formula}
          </div>
        )}
      </header>

      {spec.kind === 'formula' ? (
        <>
          <div className="fl-body">
            {/* ---------- 左：参数 ---------- */}
            <section className="fl-pane">
              <div className="fl-pane-title">调这些参数</div>
              {spec.inputs.map((inp) => {
                const pos = Math.round(toPos(values[inp.key] ?? inp.default, inp));
                const id = `${uid}-${inp.key}`;
                return (
                  <div className="fl-row" key={inp.key}>
                    <div className="fl-row-head">
                      <label className="fl-name" htmlFor={`${id}-num`}>
                        {inp.label}
                      </label>
                      <span className="fl-sym" title="表达式里用的符号">
                        {inp.key}
                      </span>
                    </div>

                    <div className="fl-input-line">
                      <input
                        id={`${id}-num`}
                        className={`fl-num ${badText(inp, texts[inp.key]) ? 'bad' : ''}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={badText(inp, texts[inp.key])}
                        value={texts[inp.key] ?? ''}
                        onChange={(e) => onType(inp, e.target.value)}
                        onBlur={() => onCommit(inp)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                      />
                      {inp.unit ? <span className="fl-unit">{inp.unit}</span> : null}
                    </div>

                    <input
                      className="fl-range"
                      type="range"
                      min={0}
                      max={POS_MAX}
                      step={1}
                      value={pos}
                      aria-label={`${inp.label} 滑杆`}
                      data-scale={scaleKind(inp)}
                      title={SCALE_TITLE[scaleKind(inp)]}
                      onChange={(e) => onSlide(inp, Number(e.target.value))}
                    />
                    <div className="fl-range-ends">
                      <span>{formatNumber(inp.min)}</span>
                      <span>{formatNumber(inp.max)}</span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* ---------- 右：结果 ---------- */}
            <section className="fl-pane fl-out-pane">
              <div className="fl-pane-title">算出来的数</div>
              {results.map((r) => (
                <div className={`fl-out ${r.value === null ? 'bad' : ''}`} key={r.key}>
                  <div className="fl-out-top">
                    <span className="fl-out-label">{r.label}</span>
                    <span className="fl-sym">{r.key}</span>
                  </div>
                  <div className="fl-out-value">
                    {r.value === null ? (
                      <span className="fl-dash">—</span>
                    ) : (
                      <>
                        {formatNumber(r.value)}
                        {r.unit ? <span className="fl-out-unit">{r.unit}</span> : null}
                      </>
                    )}
                  </div>
                  <div className="fl-out-expr">{r.expr}</div>
                  {r.value === null && (
                    <div className="fl-out-hint">
                      这组参数算不出来：可能除以了零，或结果超出了这个模型的范围
                    </div>
                  )}
                </div>
              ))}
            </section>
          </div>

          <div className="fl-notes">
            <div className="fl-note warn">
              <span className="fl-k">模型边界</span>
              <p>{spec.note}</p>
            </div>
            {spec.example && (
              <div className="fl-note">
                <span className="fl-k">举个例子</span>
                <p>{spec.example}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <DiagramBody spec={spec} />
      )}

      <div className="fl-actions">
        {isFormula && (
          <button className="btn-ghost btn-small" onClick={reset}>
            恢复默认值
          </button>
        )}
        {onClose && (
          <button className="btn-ghost btn-small" onClick={onClose}>
            关闭
          </button>
        )}
      </div>
    </div>
  );
}

/** diagram 类型：没有输入输出，只有「画什么 / 标什么 / 看什么」 */
function DiagramBody({ spec }: { spec: DiagramLabSpec }) {
  return (
    <>
      <div className="fl-diagram">
        {spec.draw && (
          <section className="fl-block">
            <span className="fl-k">这个图画什么</span>
            <p>{spec.draw}</p>
          </section>
        )}

        {(spec.marks ?? []).length > 0 && (
          <section className="fl-block">
            <span className="fl-k">图上标这几件事</span>
            <ul className="fl-marks">
              {(spec.marks ?? []).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        {spec.watch && (
          <section className="fl-block">
            <span className="fl-k">看什么</span>
            <p>{spec.watch}</p>
          </section>
        )}
      </div>

      <div className="fl-notes">
        <div className="fl-note warn">
          <span className="fl-k">模型边界</span>
          <p>{spec.note}</p>
        </div>
      </div>
    </>
  );
}

export type { FormulaLabSpec, DiagramLabSpec, LabSpec };
