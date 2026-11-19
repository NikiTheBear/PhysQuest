import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LensMetrics, LensParams } from '../../core/contracts';
import { chat, isConfigured, loadAIConfig, type AIConfig, type ChatMessage } from '../../ai/client';
import {
  parseAction,
  parseQuiz,
  systemPrompt,
  TASK_EXPLAIN,
  TASK_NEXT_STEP,
  TASK_OBSERVE,
  TASK_QUIZ,
  type AIAction,
} from '../../ai/prompts';

interface Props {
  open: boolean;
  onClose: () => void;
  params: LensParams;
  metrics: LensMetrics;
  knowledgeTitle?: string;
  onApplyAction: (a: AIAction) => void;
  onConfigChange: (c: AIConfig) => void;
  onWidthChange?: (w: number) => void;
  /** 由 App 统一持有，顶栏齿轮改成什么样这里就是什么样 */
  config: AIConfig;
}

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  action?: AIAction | null;
  quiz?: ReturnType<typeof parseQuiz>;
}

const WIDTH_KEY = 'physquest.ai.width.v1';
const MIN_W = 340;
const MAX_W = 760;

/** 本地兜底回答：没配 Key 也能用 */
function localAnswer(params: LensParams, metrics: LensMetrics): string {
  const { u, f } = params;
  if (metrics.isParallel) {
    return `现在物距正好等于焦距（u = f = ${f} cm）。所有出射光线互相平行，交点跑到无穷远处去了，所以光屏上什么都没有。这不是"像特别大"，是根本没有像。`;
  }
  if (u < f) {
    const m = Math.abs(metrics.m);
    return `现在物体在焦点以内（u = ${u} cm < f = ${f} cm），成的是正立、放大的虚像，放大约 ${m.toFixed(
      1,
    )} 倍。虚像不能被光屏承接——因为折射后的光线还是发散的，只有反向延长才交于一点。把眼睛凑到透镜右边就能看见，这就是放大镜。`;
  }
  return `现在 u = ${u} cm，f = ${f} cm，像是${metrics.description}。光屏在 ${params.screenX} cm 处${
    metrics.screenHasImage ? '，正好对上了' : '，离像的位置还差一点'
  }。记住这条：成实像的时候，物近、像远、像变大——你可以把蜡烛往透镜挪一点试试。`;
}

export default function AITutor({
  open,
  onClose,
  params,
  metrics,
  knowledgeTitle,
  onApplyAction,
  onConfigChange,
  onWidthChange,
  config: configProp,
}: Props) {
  // 配置由 App 统一持有（顶栏齿轮是唯一入口），这里只读
  const [config, setConfig] = useState<AIConfig>(configProp);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(v) && v >= MIN_W && v <= MAX_W ? v : 420;
  });

  const chatRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const ready = isConfigured(config);

  useEffect(() => {
    setConfig(configProp);
  }, [configProp]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs, busy, fullscreen]);

  /* ---------- 拖动改宽度 ---------- */
  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { startX: e.clientX, startW: width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - e.clientX;
    setWidth(Math.max(MIN_W, Math.min(MAX_W, dragRef.current.startW + delta)));
  };
  const onResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  /* ---------- 全屏 AI ---------- */
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  /* ---------- 对话 ---------- */
  const push = useCallback((m: Omit<Msg, 'id'>) => {
    idRef.current += 1;
    setMsgs((prev) => [...prev, { ...m, id: idRef.current }]);
  }, []);

  const ask = useCallback(
    async (userText: string, opts: { silentUser?: boolean } = {}) => {
      if (!userText.trim() || busy) return;
      if (!opts.silentUser) push({ role: 'user', text: userText });
      setInput('');

      if (!ready) {
        push({ role: 'assistant', text: localAnswer(params, metrics) });
        return;
      }

      setBusy(true);
      const history: ChatMessage[] = [
        { role: 'system', content: systemPrompt(params, metrics, knowledgeTitle) },
        ...msgs
          .filter((m) => !m.error)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.text }) as ChatMessage),
        { role: 'user', content: userText },
      ];
      const res = await chat(config, history);
      setBusy(false);

      if (!res.ok) {
        push({
          role: 'assistant',
          text: `${res.error.message}\n${res.error.detail ?? ''}`,
          error: true,
        });
        return;
      }
      const quiz = parseQuiz(res.text);
      const { clean, action } = parseAction(res.text);
      push({ role: 'assistant', text: clean || '（没收到有效回复）', action, quiz });
    },
    [busy, config, knowledgeTitle, metrics, msgs, params, push, ready],
  );

  const presets = useMemo(
    () => [
      { label: '讲讲现在这组参数', task: TASK_EXPLAIN },
      { label: '我漏掉了什么', task: TASK_OBSERVE },
      { label: '下一步试什么', task: TASK_NEXT_STEP },
      { label: '考我一题', task: TASK_QUIZ },
    ],
    [],
  );

  /* ---------- 共用的聊天主体 ---------- */
  const chatBody = (variant: 'dock' | 'full') => (
    <>
      <div className="ai-ctx">
        u = {params.u.toFixed(1)} · f = {params.f.toFixed(1)} · v ={' '}
        {Number.isFinite(metrics.v) ? Math.abs(metrics.v).toFixed(1) : '∞'} ·{' '}
        <span className={metrics.screenHasImage ? 'ctx-good' : 'ctx-warn'}>
          {metrics.screenHasImage ? '光屏清晰' : '光屏未对焦'}
        </span>
      </div>

      <div className={`ai-chat ${variant === 'full' ? 'ai-chat-full' : ''}`} ref={chatRef}>
        {msgs.length === 0 && (
          <div className="msg assistant">
            <div className="who">探理实验室</div>
            我是你的 AI 助教。我现在能看到你屏幕上的这组参数——{metrics.description}。
            {ready
              ? '有什么想不通的，直接问我。'
              : '现在还没有接 AI，我先用内置知识回答你。想要更深入的答疑，点右上角 ⚙ 配一下 Key。'}
          </div>
        )}

        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.role} ${m.error ? 'error' : ''}`}>
            {m.role === 'assistant' && <div className="who">AI 助教</div>}
            <div style={m.error ? { color: 'var(--red)' } : undefined}>{m.text}</div>

            {m.action && (
              <button
                className="btn-ghost btn-small"
                style={{ marginTop: 8 }}
                onClick={() => onApplyAction(m.action!)}
              >
                {m.action.type === 'mask'
                  ? m.action.value
                    ? '遮住透镜上半 →'
                    : '揭开透镜 →'
                  : `把 ${m.action.type} 调到 ${m.action.value} →`}
              </button>
            )}

            {m.quiz && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13.5, marginBottom: 8 }}>{m.quiz.question}</div>
                {m.quiz.options.map((opt, i) => (
                  <button
                    key={i}
                    className="opt"
                    style={{ fontSize: 13.5, padding: '10px 13px' }}
                    onClick={() => {
                      const right = i === m.quiz!.answer;
                      push({
                        role: 'assistant',
                        text: `${right ? '答对了。' : `不对，正确答案是 ${String.fromCharCode(
                          65 + m.quiz!.answer,
                        )}。`}${m.quiz!.explain}`,
                      });
                    }}
                  >
                    <span className="mark">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="msg assistant">
            <div className="who">AI 助教</div>
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>

      <div className="ai-presets">
        {presets.map((p) => (
          <button key={p.label} onClick={() => ask(p.task)} disabled={busy}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="ai-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder={ready ? '问点什么…（Enter 发送）' : '未接 AI，先用内置知识回答'}
        />
        <button onClick={() => ask(input)} disabled={busy || !input.trim()} title="发送">
          ↑
        </button>
      </div>
    </>
  );

  if (!open) return null;

  /* ================= 全屏模式 ================= */
  if (fullscreen) {
    return createPortal(
      <div className="ai-fullscreen" role="dialog" aria-label="AI 助教 全屏">
        <div className="ai-full-head">
          <span style={{ fontSize: 18 }}>✦</span>
          <span className="t">AI 助教</span>
          <span className={`badge ${ready ? 'on' : 'off'}`}>{ready ? '已连接' : '离线兜底'}</span>
          <span className="spacer" />
          <button onClick={() => setFullscreen(false)} title="退出全屏（Esc）">
            ⤡ 退出全屏
          </button>
        </div>
        <div className="ai-full-body">{chatBody('full')}</div>

      </div>,
      document.body,
    );
  }

  /* ================= 侧栏（可调宽度） ================= */
  return (
    <>
      <div
        className="ai-resizer"
        style={{ right: width - 4 }}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        onDoubleClick={() => setWidth(420)}
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整 AI 侧栏宽度"
        title="拖动调宽度 · 双击复原"
      />

      <aside className="ai-dock open" style={{ width }} aria-label="AI 助教">
        <div className="ai-head">
          <span style={{ fontSize: 17 }}>✦</span>
          <span className="t">AI 助教</span>
          <span className={`badge ${ready ? 'on' : 'off'}`}>{ready ? '已连接' : '离线兜底'}</span>
          <span className="spacer" />
          <button onClick={() => setFullscreen(true)} title="全屏">
            ⤢
          </button>
          <button onClick={onClose} title="收起">
            ×
          </button>
        </div>

        {chatBody('dock')}
      </aside>

    </>
  );
}
