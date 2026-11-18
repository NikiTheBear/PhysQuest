import { useEffect, useMemo, useRef, useState } from 'react';
import type { LensMetrics, LensParams } from '../../core/contracts';
import {
  chat,
  isConfigured,
  loadAIConfig,
  type AIConfig,
  type ChatMessage,
} from '../../ai/client';
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
import AISettings from './AISettings';

interface Props {
  open: boolean;
  onClose: () => void;
  params: LensParams;
  metrics: LensMetrics;
  knowledgeTitle?: string;
  onApplyAction: (a: AIAction) => void;
  onConfigChange: (c: AIConfig) => void;
}

interface Msg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  action?: AIAction | null;
  quiz?: ReturnType<typeof parseQuiz>;
}

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
  const k = Math.abs(metrics.m);
  return `现在 u = ${u} cm，f = ${f} cm，像是${metrics.description}。光屏在 ${params.screenX} cm 处${
    metrics.screenHasImage ? '，正好对上了' : `，离像的位置还差一点`
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
}: Props) {
  const [config, setConfig] = useState<AIConfig>(() => loadAIConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const ready = isConfigured(config);

  useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs, busy]);

  const push = (m: Omit<Msg, 'id'>) => {
    idRef.current += 1;
    setMsgs((prev) => [...prev, { ...m, id: idRef.current }]);
  };

  const ask = async (userText: string, opts: { silentUser?: boolean } = {}) => {
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
  };

  const presets = useMemo(
    () => [
      { label: '讲讲现在这组参数', task: TASK_EXPLAIN },
      { label: '我漏掉了什么', task: TASK_OBSERVE },
      { label: '下一步试什么', task: TASK_NEXT_STEP },
      { label: '考我一题', task: TASK_QUIZ },
    ],
    [],
  );

  if (!open) return null;

  return (
    <>
      <aside className={`ai-dock ${open ? 'open' : ''}`} aria-label="AI 助教">
        <div className="ai-head">
          <span style={{ fontSize: 17 }}>✦</span>
          <span className="t">AI 助教</span>
          <span className={`badge ${ready ? 'on' : 'off'}`}>{ready ? '已连接' : '离线兜底'}</span>
          <span className="spacer" />
          <button onClick={() => setShowSettings(true)} title="AI 设置">
            ⚙
          </button>
          <button onClick={onClose} title="收起">
            ×
          </button>
        </div>

        <div className="ai-ctx">
          u = {params.u.toFixed(1)} · f = {params.f.toFixed(1)} · v ={' '}
          {Number.isFinite(metrics.v) ? Math.abs(metrics.v).toFixed(1) : '∞'} ·{' '}
          {metrics.screenHasImage ? '光屏清晰' : '光屏未对焦'}
        </div>

        <div className="ai-chat" ref={chatRef}>
          {msgs.length === 0 && (
            <div className="msg assistant">
              <div className="who">探理实验室</div>
              我是你的 AI 助教。我现在能看到你屏幕上的这组参数——
              {metrics.description}。
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
              正在想…
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
      </aside>

      {showSettings && (
        <AISettings
          config={config}
          onSave={(c) => {
            setConfig(c);
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
