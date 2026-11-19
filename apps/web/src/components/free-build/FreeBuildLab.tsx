import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fieldlab 自由搭建工作台（iframe 封装）
 *
 * 队友那套平台是一个独立服务，用 iframe 嵌进来。
 * 通信走 postMessage，协议是队友定的：
 *
 *   父 → 子  { source:'physquest', action, ...data }
 *     hello             握手
 *     filter-library    按领域筛选器具库
 *     build-knowledge   用知识点的提示词让 AI 搭一个实验
 *     capture           采集当前实验快照
 *     spaces / help    打开实验文件 / 操作指南
 *     open-ai           打开 AI 对话
 *     visibility        页面可见性
 *
 *   子 → 父  { source:'fieldlab', type, ...data }
 *     ready             工作台就绪
 *     capture           快照回传
 */

export interface CaptureSnapshot {
  experiment: {
    id: string;
    title: string;
    mode: string;
    goal: string;
    components: Array<{ id: string; name: string; kind: string }>;
    connections: Array<{ id: string }>;
  };
  time: number;
  readings: {
    channels: Record<string, { label: string; value: number; unit: string; valid?: boolean }>;
  };
  circuitError: string | null;
}

interface Props {
  /** GitHub Pages 上用静态单文件版，本地用服务版 */
  staticMode: boolean;
  /** 选定的领域筛选（all / optics / mechanics …） */
  domain?: string;
  /** 打开时要自动载入的实验文件 id（例如 CH-O2-01） */
  loadExperiment?: string;
  /** 点击「记录此刻」后的回调，拿到快照 */
  onCapture?: (snapshot: CaptureSnapshot) => void;
  /** 想用某个知识点提示词搭建时传进来 */
  buildRequest?: { knowledgeId: string; title: string; prompt: string } | null;
  onMessage?: (text: string) => void;
  /** 第 6 关这种「带着目标搭」的场景 */
  goal?: {
    title: string;
    description: string;
    check: (snap: CaptureSnapshot) => { ok: boolean; detail: string } | null;
  } | null;
  /** 达成目标时通知父组件 */
  onGoalReached?: () => void;
  /** 从实验台一键搬过来的实验数据（.pqexp） */
  importExperiment?: unknown | null;
  /** 顶栏配的 AI 配置，传给工作台用 */
  aiConfig?: { apiKey: string; model: string; endpoint: string; connection: string } | null;
}

const workbenchUrl = (staticMode: boolean) =>
  staticMode ? `${import.meta.env.BASE_URL}workbench.html?offline=1` : '/workbench';

export default function FreeBuildLab({
  staticMode,
  domain = 'all',
  loadExperiment,
  onCapture,
  buildRequest,
  onMessage,
  goal,
  onGoalReached,
  importExperiment,
  aiConfig,
}: Props) {
  const [goalState, setGoalState] = useState<{ ok: boolean; detail: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<{ action: string; data: Record<string, string> } | null>(null);
  const captureId = useRef<string | null>(null);
  const captureTimer = useRef<ReturnType<typeof setTimeout>>();

  const send = useCallback((action: string, data: Record<string, string> = {}) => {
    frame.current?.contentWindow?.postMessage(
      { source: 'physquest', action, ...data },
      location.origin,
    );
  }, []);

  /* ---------- 接收工作台的消息 ---------- */
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.source !== 'fieldlab') return;

      if (event.data.type === 'ready') {
        setReady(true);
        setSlow(false);
        if (pending.current) {
          send(pending.current.action, pending.current.data);
          pending.current = null;
        }
        return;
      }

      if (event.data.type === 'import-done') {
        onMessage?.(`已把「${event.data.title || '实验'}」搬到工作台，可以继续加器具了`);
        return;
      }

      if (event.data.type === 'import-failed') {
        onMessage?.(`搬过来失败：${event.data.message || '格式不被接受'}`);
        return;
      }

      if (event.data.type === 'capture') {
        if (!captureId.current || event.data.requestId !== captureId.current) return;
        clearTimeout(captureTimer.current);
        captureId.current = null;
        setCapturing(false);

        const snapshot = event.data.snapshot as CaptureSnapshot | undefined;
        if (!snapshot?.experiment?.id) {
          onMessage?.('采集失败，请等实验台保存完成后再试。');
          return;
        }
        onCapture?.(snapshot);

        // 有目标时顺便判一下达没达成
        if (goal) {
          const verdict = goal.check(snapshot);
          if (verdict) {
            setGoalState(verdict);
            if (verdict.ok) onGoalReached?.();
          }
        }
      }
    };

    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [send, onCapture, onMessage]);

  /* ---------- 15 秒还没 ready 就提示慢 ---------- */
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [ready]);

  /* ---------- 领域筛选 ---------- */
  useEffect(() => {
    if (!ready) {
      pending.current = { action: 'filter-library', data: { domain } };
      return;
    }
    send('filter-library', { domain });
  }, [domain, ready, send]);

  /* ---------- 用知识点提示词搭建 ---------- */
  useEffect(() => {
    if (!buildRequest) return;
    const data = {
      knowledgeId: buildRequest.knowledgeId,
      title: buildRequest.title,
      prompt: buildRequest.prompt,
    };
    if (ready) send('build-knowledge', data);
    else pending.current = { action: 'build-knowledge', data };
  }, [buildRequest, ready, send]);

  /* ---------- 把 Key 同步给工作台 ---------- */
  useEffect(() => {
    if (!ready || !aiConfig?.apiKey) return;
    send('set-credentials', {
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      endpoint: aiConfig.endpoint,
    });
  }, [ready, aiConfig, send]);

  /* ---------- 从实验台导入 ---------- */
  useEffect(() => {
    if (!importExperiment) return;
    const data = { experiment: JSON.stringify(importExperiment) };
    if (ready) send('import-experiment', data);
    else pending.current = { action: 'import-experiment', data };
  }, [importExperiment, ready, send]);

  /* ---------- 可见性 ---------- */
  useEffect(() => {
    if (ready) send('visibility', { value: 'visible' });
  }, [ready, send]);

  const capture = () => {
    if (!ready || capturing) return;
    const id = crypto.randomUUID();
    captureId.current = id;
    setCapturing(true);
    send('capture', { requestId: id });
    captureTimer.current = setTimeout(() => {
      captureId.current = null;
      setCapturing(false);
      onMessage?.('采集超时，请等实验台保存完成后重试。');
    }, 10000);
  };

  return (
    <>
      <div className="work-head">
        <div>
          <span className="eyebrow">FIELDLAB · 自由搭建</span>
          <h2>自由搭建实验台</h2>
          <div className="brief">
            自己摆器具、连线路、跑仿真。也可以让 AI 一起搭——
            <b> AI 的每一次修改都能撤销</b>，你的实验文件在你手里。
          </div>
        </div>
        <div className="work-actions">
          <button className="btn-ghost btn-small" onClick={() => send('help')} disabled={!ready}>
            操作指南
          </button>
          <button className="btn-ghost btn-small" onClick={() => send('spaces')} disabled={!ready}>
            实验文件
          </button>
          <button className="btn-primary" onClick={capture} disabled={!ready || capturing}>
            {capturing ? '正在记录…' : '记录此刻'}
          </button>
        </div>
      </div>

      {goal && (
        <div className={`freebuild-goal ${goalState?.ok ? 'ok' : ''}`}>
          <div className="fg-main">
            <span className="fg-label">本关目标</span>
            <h3>{goal.title}</h3>
            <p>{goal.description}</p>
          </div>
          <div className="fg-verdict">
            {goalState === null && <span className="fg-hint">搭好后点「记录此刻」验一下</span>}
            {goalState && (
              <>
                <span className={`fg-badge ${goalState.ok ? 'pass' : 'fail'}`}>
                  {goalState.ok ? '达成' : '还没到'}
                </span>
                <span className="fg-detail">{goalState.detail}</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="freebuild-wrap">
        {!ready && (
          <div className="freebuild-loading" role="status">
            {slow ? (
              <>
                <p>工作台加载较慢。</p>
                <a href={workbenchUrl(staticMode)} target="_blank" rel="noreferrer">
                  单独打开工作台 →
                </a>
                <p className="hint">
                  单独打开了还是空白？说明本地服务没起。
                  在项目根目录跑 <code>node scripts/run-platform.mjs</code>。
                </p>
              </>
            ) : (
              '正在连接实验工作台…'
            )}
          </div>
        )}
        <iframe
          ref={frame}
          src={`${workbenchUrl(staticMode)}${workbenchUrl(staticMode).includes('?') ? '&' : '?'}embed=1${loadExperiment ? `&experiment=${encodeURIComponent(loadExperiment)}` : ''}`}
          title="Fieldlab 自由搭建物理实验台"
          className="freebuild-frame"
          onLoad={() => send('hello')}
        />
      </div>
    </>
  );
}
