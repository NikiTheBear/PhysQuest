import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LENS_PARAMS, type LensParams } from '../../core/contracts';
import { solve } from '../../labs/optics-lens/engine';
import { knowledgeById } from '../../data/content';
import DemoPreview from './DemoPreview';
import { demoScriptById, type DemoStep } from './scripts';
import { toLensPatch } from './params';

/**
 * AI 演示剧本播放器
 *
 * 数据：[`shared/knowledge-data/optics-lens/demo-scripts.json`]
 * 每条脚本是「一串 (解说词 + 目标参数 + 高亮器材 + 停留时长)」。
 *
 * ─────────────────────────────────────────────────────────────
 * 关于 `onApplyParams` 到底能不能真的把光具座调过去
 * ─────────────────────────────────────────────────────────────
 * 结论：**现在接不上，只做「讲解播放器」。** 三条理由，按重要性排：
 *
 * ① React 这边没有光具座了。
 *    凸透镜光具座已经搬进 Fieldlab 全屏工作台（`/workbench`，iframe）。
 *    App 里的 `params` / `setParams` 仍然存在，但已经没人拿它画图了
 *    ——`ControlPanel` / `CurveChart` 虽然还 import 着，JSX 里并不渲染。
 *    所以在这里调 `setParams` 只会改一个谁都看不见的 state（还会把 AI 助教
 *    看到的参数改脏，让它以为学生真调了实验台）。
 *
 * ② Fieldlab 的 postMessage 协议里没有「设光具座参数」这一条。
 *    看 `platform/web/app.js` 的 bridge（`action==='...'`）只有：
 *    hello / filter-library / build-knowledge / capture / clear-stage /
 *    spaces / help / open-ai / visibility / set-credentials / import-experiment。
 *    `update_component` 只在它自己的命令总线里，没暴露给父窗口。
 *    唯一能改到光具座的路子是 `import-experiment`：父窗口塞一份完整的
 *    .pqexp 文件过去。可那会**每走一步就多出一个实验空间**（工作台最多存 100 个），
 *    还会进撤销栈、被同步到本地服务端——演示越流畅，脏数据越多。
 *    要正经做，得让 Fieldlab 加一条 `set-params`（平台侧改动，本次明确不动 platform/）。
 *
 * ③ 演示入口在 Hub（挑战导览），那时 iframe 根本没挂载。
 *    要边播边动实验台，就得先把视图切到实验台、再把播放器浮在上面，
 *    这是另一种产品形态，不该在一次组件任务里顺手改掉。
 *
 * 所以现在：
 *   · `onApplyParams` 照约定每步都调（Hub 里接一个只 console.log 的处理函数），
 *     接口留着，等 Fieldlab 支持 postMessage 传参后把真正的 setParams 接进来就行；
 *   · 为了不让「讲解」变成「念课文」，播放器用**和实验台同一个引擎**
 *     （`solve` / `traceRays`）把这一步的光路画出来（见 DemoPreview），
 *     学生看得到「像由小变大」；
 *   · UI 上明确写着「这是解说，不会自动改实验台」。
 *
 * TODO（等 Fieldlab 支持 postMessage 传参后再接上）：
 *   在 `platform/web/app.js` 的 bridge 里加
 *     if (action === 'set-lens-params') { … update_component({params}) … }
 *   然后把 Hub 里那个 console.log 处理器换成
 *     ImmersiveLab 提供的 send('set-lens-params', step.targetParams)
 *   本组件不用改一行——它只负责按时把参数交出去。
 */

interface Props {
  /** 从 DEMOS 里选一个 */
  scriptId: string;
  /** 每步把参数交给谁 */
  onApplyParams: (params: Record<string, number>) => void;
  /** 高亮哪些元素（可选，传给孩子去用） */
  onHighlight?: (rigIds: string[]) => void;
  onClose: () => void;
  /**
   * 可选：算预览图用的基准参数（一般不需要传，默认 DEFAULT_LENS_PARAMS）。
   * 剧本里只给「这一步关心的那几个数」，其余沿用基准值。
   */
  baseParams?: LensParams;
  /** 可选：是否画光路示意图（非光学剧本请传 false） */
  preview?: boolean;
  /** 可选：播完之后「去实验台亲手调」的入口，不传就不显示按钮 */
  onGoLab?: () => void;
}

const MIN_STEP_MS = 600;

export default function DemoPlayer({
  scriptId,
  onApplyParams,
  onHighlight,
  onClose,
  baseParams,
  preview = true,
  onGoLab,
}: Props) {
  const script = useMemo(() => demoScriptById(scriptId), [scriptId]);
  const steps = useMemo<DemoStep[]>(() => script?.steps ?? [], [script]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  /** 重播时用来强制重新走一遍「应用本步」的效果 */
  const [runId, setRunId] = useState(0);

  /**
   * 回调放进 ref：父组件每次渲染都会传新的箭头函数，
   * 如果让 effect 依赖它们，「应用本步」会被重复触发（播放一卡一卡地重放参数）。
   */
  const applyRef = useRef(onApplyParams);
  const highlightRef = useRef(onHighlight);
  applyRef.current = onApplyParams;
  highlightRef.current = onHighlight;

  const step = steps[idx];
  const total = steps.length;

  /* ---------- 应用某一步：交参数 + 交高亮 ---------- */
  useEffect(() => {
    const s = steps[idx];
    if (!s) return;
    // 剧本里 maskTop 是布尔值，接口签名是 Record<string, number>（见 params.ts 注释）
    applyRef.current(s.targetParams as unknown as Record<string, number>);
    highlightRef.current?.(s.highlightRigIds);
  }, [idx, runId, steps]);

  /* ---------- 自动播放：每步停 durationMs ---------- */
  useEffect(() => {
    if (!playing || ended) return;
    const s = steps[idx];
    if (!s) return;
    const wait = Math.max(MIN_STEP_MS, s.durationMs);
    const timer = setTimeout(() => {
      if (idx + 1 >= steps.length) {
        setPlaying(false);
        setEnded(true);
      } else {
        setIdx(idx + 1);
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [playing, ended, idx, steps]);

  /* ---------- 操作 ---------- */
  const goto = useCallback(
    (next: number) => {
      if (!total) return;
      const clamped = Math.max(0, Math.min(total - 1, next));
      setEnded(false);
      setPlaying(false);
      setIdx(clamped);
      // 同一序号也允许重放（比如从「演示结束」退回最后一步）
      setRunId((n) => n + 1);
    },
    [total],
  );

  const togglePlay = useCallback(() => {
    if (ended) {
      setEnded(false);
      setIdx(0);
      setRunId((n) => n + 1);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [ended]);

  const replay = useCallback(() => {
    setEnded(false);
    setIdx(0);
    setRunId((n) => n + 1);
    setPlaying(true);
  }, []);

  const close = useCallback(() => {
    highlightRef.current?.([]);
    onClose();
  }, [onClose]);

  /* ---------- 键盘：Esc 关 / 空格 播放暂停 / ←→ 翻页 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goto(idx - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goto(idx + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, togglePlay, goto, idx]);

  /* ---------- 预览：本步参数 + 全剧本共用的画布范围 ---------- */
  const base = baseParams ?? DEFAULT_LENS_PARAMS;
  const stepParams = useMemo<LensParams>(
    () => ({ ...base, ...toLensPatch(step?.targetParams) }),
    [base, step],
  );
  const metrics = useMemo(() => solve(stepParams), [stepParams]);

  /**
   * 画布范围按「整个剧本」算，而不是按单步算：
   * 每步都自动缩放的话，翻页时蜡烛和光屏会乱跳，看不出「推近」这件事。
   */
  const frame = useMemo(() => {
    let minX = -base.u;
    let maxX = base.u;
    let tallest = base.h;
    for (const s of steps) {
      const p = { ...base, ...toLensPatch(s.targetParams) };
      const m = solve(p);
      minX = Math.min(minX, -p.u);
      maxX = Math.max(maxX, p.screenX);
      if (Number.isFinite(m.v) && Math.abs(m.v) < 1e4) maxX = Math.max(maxX, m.v);
      if (Number.isFinite(m.imageY)) tallest = Math.max(tallest, Math.abs(m.imageY));
      tallest = Math.max(tallest, p.h);
    }
    // 上下留白按「最高的那个像」算，但封顶到物高的 6 倍：
    // 5 倍大的像要是把画布拉到 20 倍，物就缩成一个点了，反而看不出「变大」。
    return { minX: minX - 4, maxX: maxX + 6, halfY: Math.min(tallest * 1.35, base.h * 6) };
  }, [base, steps]);

  /* ---------- 剧本不存在：别静默消失 ---------- */
  if (!script || total === 0) {
    return (
      <div className="overlay" onClick={close}>
        <div className="modal demo-player" onClick={(e) => e.stopPropagation()}>
          <div className="demo-head">
            <div>
              <span className="eyebrow">AI 演示</span>
              <h3>找不到这个演示</h3>
            </div>
            <button className="btn-ghost btn-small" onClick={close} aria-label="关闭演示">
              关闭
            </button>
          </div>
          <p className="demo-narration">
            剧本 <code>{scriptId}</code> 没有出现在 <code>demo-scripts.json</code> 里。
          </p>
        </div>
      </div>
    );
  }

  const kpTitle = step ? knowledgeById(step.knowledgePoint)?.title : undefined;
  const pct = Math.round(((idx + 1) / total) * 100);

  return (
    <div className="overlay demo-overlay" onClick={close}>
      <div
        className="modal demo-player"
        role="dialog"
        aria-modal="true"
        aria-label={`演示：${script.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== 顶部：标题 + 进度 + 关闭 ===== */}
        <div className="demo-head">
          <div className="demo-head-main">
            <span className="eyebrow">AI 演示 · {total} 步</span>
            <h3>{script.title}</h3>
          </div>
          <div className="demo-head-right">
            <span className="demo-progress-label">
              第 {idx + 1} / {total} 步
            </span>
            <button className="btn-ghost btn-small" onClick={close} aria-label="关闭演示">
              ✕ 关闭
            </button>
          </div>
        </div>

        <div className="demo-progress" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>

        {/* ===== 中间：解说词（大字）+ 光路示意 ===== */}
        {ended ? (
          <div className="demo-end">
            <div className="demo-end-title">演示结束</div>
            <p>
              「{script.title}」走完了 {total} 步。
              {onGoLab ? ' 光看不算数——自己去实验台把这几步推一遍。' : ''}
            </p>
            <div className="demo-end-actions">
              <button className="btn-primary" onClick={replay}>
                重播
              </button>
              {onGoLab && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    close();
                    onGoLab();
                  }}
                >
                  去实验台亲手调 →
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="demo-narration">{step?.narration}</p>

            <div className="demo-step-meta">
              {step && (
                <>
                  <span className="badge">{step.knowledgePoint}</span>
                  {kpTitle && <span className="demo-kp">{kpTitle}</span>}
                </>
              )}
              <span className="demo-not-bench">这是解说，不会自动改实验台</span>
            </div>

            {preview && (
              <DemoPreview
                params={stepParams}
                metrics={metrics}
                highlight={step?.highlightRigIds ?? []}
                frame={frame}
              />
            )}
          </>
        )}

        {/* ===== 底部：上一步 / 播放暂停 / 下一步 / 重播 ===== */}
        <div className="demo-controls">
          <button
            className="btn-ghost"
            onClick={() => goto(idx - 1)}
            disabled={idx === 0}
            title="上一步（←）"
          >
            ◀ 上一步
          </button>

          <button className="btn-primary demo-play" onClick={togglePlay} title="播放 / 暂停（空格）">
            {playing && !ended ? '⏸ 暂停' : '▶ 播放'}
          </button>

          <button
            className="btn-ghost"
            onClick={() => goto(idx + 1)}
            disabled={idx >= total - 1}
            title="下一步（→）"
          >
            下一步 ▶
          </button>

          <button className="btn-ghost demo-replay" onClick={replay} title="从头再放一遍">
            ↺ 重播
          </button>
        </div>
      </div>
    </div>
  );
}
