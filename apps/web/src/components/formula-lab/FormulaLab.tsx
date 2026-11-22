import { useEffect, useId, useMemo, useState } from 'react';
import type { DiagramLabSpec, FormulaLabSpec, LabInputSpec, LabSpec } from './labData';
import { labById } from './labData';
import { safeEval } from './safeEval';

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
   数值格式 & 滑杆映射
   ============================================================ */

const POS_MAX = 1000;

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

/** 4~6 位有效数字，非常大 / 非常小的时候用科学计数法（1e-34 那类必须这样） */
function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e6 || a < 1e-3) {
    const s = v.toExponential(3); // "6.674e-11"
    const [mant, exp] = s.split('e');
    return `${trimZeros(mant)}e${exp.replace('+', '')}`;
  }
  return trimZeros(v.toPrecision(5));
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * 输入框里的原文。
 * 极大 / 极小的值写成 1e12 这种，一来输入框放得下（1e20 那类整串数字有 21 位），
 * 二来这些量本来就是「量级」在起作用的，写全反而看不出数量级。
 */
function numText(v: number): string {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e9 || a < 1e-4)) {
    const [mant, exp] = v.toExponential(3).split('e');
    return `${trimZeros(mant)}e${exp.replace('+', '')}`;
  }
  return String(Number(v.toPrecision(8)));
}

/**
 * 滑杆跨几个数量级时（比如 1e20 ~ 2e30 的星体质量、1e-30 ~ 1e-10 的粒子质量），
 * 线性步长 (max-min)/100 会让默认值直接落在 0 步上、滑杆一碰就跳几个量级，
 * 所以这类输入改成对数刻度：滑杆走 0~1000 的「位置」，位置 → 值按比例映射。
 * 数量级不大的输入仍是线性刻度，行为就是普通的 (max-min)/100 步长。
 */
function isLogScale(inp: LabInputSpec): boolean {
  return inp.min > 0 && inp.max / inp.min >= 1000;
}

/** 值 → 滑杆位置（0~1000） */
function toPos(v: number, inp: LabInputSpec): number {
  const span = inp.max - inp.min;
  if (!(span > 0)) return 0;
  if (isLogScale(inp)) {
    const r = clamp(v, inp.min, inp.max) / inp.min;
    return clamp(Math.log(r) / Math.log(inp.max / inp.min), 0, 1) * POS_MAX;
  }
  return clamp((v - inp.min) / span, 0, 1) * POS_MAX;
}

/** 滑杆位置 → 值 */
function fromPos(p: number, inp: LabInputSpec): number {
  const t = clamp(p, 0, POS_MAX) / POS_MAX;
  const raw = isLogScale(inp)
    ? inp.min * Math.pow(inp.max / inp.min, t)
    : inp.min + t * (inp.max - inp.min);
  const v = Number(raw.toPrecision(6));
  return clamp(v, inp.min, inp.max);
}

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
                      title={isLogScale(inp) ? '对数刻度：范围跨了多个数量级' : '线性刻度'}
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
