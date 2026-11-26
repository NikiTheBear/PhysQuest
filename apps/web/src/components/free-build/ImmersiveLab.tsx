import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 全屏实验工作台（iframe 封装）
 *
 * 队友那套平台是一个独立服务，用 iframe 嵌进来。
 * 通信走 postMessage，协议是队友定的：
 *
 *   父 → 子  { source:'physquest', action, ...data }
 *     hello             握手
 *     filter-library    按领域筛选器具库
 *     build-knowledge   用知识点的提示词让 AI 搭一个实验
 *     capture           采集当前实验快照
 *     spaces / help     打开实验文件 / 操作指南
 *     open-ai           打开 AI 对话
 *     visibility        页面可见性
 *     set-credentials   把顶栏配的 Key 交给工作台
 *
 *   子 → 父  { source:'fieldlab', type, ...data }
 *     ready / capture / import-done / import-failed / load-failed
 */

export interface CaptureSnapshot {
  experiment: {
    id: string;
    title: string;
    mode: string;
    goal: string;
    components: Array<{ id: string; name: string; kind: string; params?: Record<string, number> }>;
    connections: Array<{ id: string }>;
  };
  time: number;
  readings: {
    channels: Record<string, { label: string; value: number; unit: string; valid?: boolean }>;
  };
  circuitError: string | null;
}

interface Props {
  staticMode: boolean;
  /** 打开时要自动载入哪个实验（挑战 id） */
  loadExperiment?: string;
  /** 点「记录此刻」拿到快照 */
  onCapture?: (snapshot: CaptureSnapshot) => void;
  /** 用知识点提示词让 AI 搭 */
  buildRequest?: { knowledgeId: string; title: string; prompt: string } | null;
  /** 顶栏 ☰ 收起时回到上一页 */
  onExit?: () => void;
  onMessage?: (text: string) => void;
  /** 顶栏配的 AI 配置，传给工作台 */
  aiConfig?: { apiKey: string; model: string; endpoint: string; connection: string } | null;
  /** 挑战标题，显示在顶栏 */
  challengeTitle?: string;
  /** 挑战的题面，显示在顶栏 */
  challengeBrief?: string;
  /** 这一步是「先猜」阶段还是「探索」阶段 */
  phaseLabel?: string;
  /** 顶栏右侧的主按钮 */
  primaryAction?: { label: string; onClick: () => void } | null;
}

const workbenchUrl = (staticMode: boolean) =>
  staticMode ? `${import.meta.env.BASE_URL}workbench.html?offline=1` : '/workbench';

export default function ImmersiveLab({
  staticMode,
  loadExperiment,
  onCapture,
  buildRequest,
  onExit,
  onMessage,
  aiConfig,
  challengeTitle,
  challengeBrief,
  phaseLabel,
  primaryAction,
}: Props) {
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [barOpen, setBarOpen] = useState(true);

  const frame = useRef<HTMLIFrameElement>(null);
  const sentBuild = useRef<Props['buildRequest']>(null);
  const captureId = useRef<string | null>(null);
  const captureTimer = useRef<ReturnType<typeof setTimeout>>();

  const send = useCallback((action: string, data: Record<string, string> = {}) => {
    frame.current?.contentWindow?.postMessage(
      { source: 'physquest', action, ...data },
      location.origin,
    );
  }, []);

  useEffect(() => () => clearTimeout(captureTimer.current), []);

  /* ---------- 接收工作台的消息 ---------- */
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.source !== 'fieldlab') return;

      if (event.data.type === 'load-failed') {
        setLoadError(event.data.message);
        return;
      }
      if (event.data.type === 'ready') {
        setReady(true);
        setSlow(false);
        return;
      }
      if (event.data.type === 'stage-cleared') {
        onMessage?.('实验台已清空');
        return;
      }
      if (event.data.type === 'clear-failed') {
        onMessage?.(`清空失败：${event.data.message || '未知原因'}`);
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
      }
    };

    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onCapture, onMessage]);

  /* ---------- 15 秒还没 ready 就提示慢 ---------- */
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [ready]);

  /* ---------- 用知识点提示词搭建 ---------- */
  useEffect(() => {
    if (!ready || !buildRequest || sentBuild.current === buildRequest) return;
    sentBuild.current = buildRequest;
    send('build-knowledge', {
      knowledgeId: buildRequest.knowledgeId,
      title: buildRequest.title,
      prompt: buildRequest.prompt,
    });
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

  /* ---------- 可见性 ---------- */
  useEffect(() => {
    if (ready) send('visibility', { value: 'visible' });
  }, [ready, send]);

  /** 清空实验台：二次确认后让工作台删掉所有器具 */
  const [confirmClear, setConfirmClear] = useState(false);

  const clearStage = () => {
    if (!ready) return;
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    send('clear-stage');
  };

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

  const url = `${workbenchUrl(staticMode)}${
    workbenchUrl(staticMode).includes('?') ? '&' : '?'
  }embed=1${loadExperiment ? `&experiment=${encodeURIComponent(loadExperiment)}` : ''}`;

  return (
    <div className={`immersive-lab ${barOpen ? '' : 'bar-collapsed'}`}>
      {/* ===== 沉浸式顶栏：替代原来的应用顶栏 ===== */}
      <header className="immersive-bar">
        <div className="ib-left">
          <button className="ib-exit" onClick={onExit} title="退出实验">
            ← 退出
          </button>
          {phaseLabel && <span className="ib-phase">{phaseLabel}</span>}
          <div className="ib-title">
            <b>{challengeTitle ?? '自由搭建实验台'}</b>
            {challengeBrief && <span>{challengeBrief}</span>}
          </div>
        </div>

        <div className="ib-right">
          <span className={`ib-ready ${ready ? 'on' : ''}`}>
            {ready ? '● 已连接' : slow ? '● 连接较慢' : '○ 连接中'}
          </span>
          <button
            className={`ib-btn ${confirmClear ? 'danger' : ''}`}
            disabled={!ready}
            onClick={clearStage}
            title="删掉实验台上所有器具，从空白重新开始"
          >
            {confirmClear ? '再点一次确认清空' : '清空实验台'}
          </button>
          {loadExperiment && (
            <button
              className="ib-btn"
              onClick={() => {
                const share = `${location.origin}${location.pathname}?challenge=${encodeURIComponent(loadExperiment)}&view=lab`;
                navigator.clipboard?.writeText(share).then(
                  () => onMessage?.('已复制本关直达链接，发给学生点开即进此关'),
                  () => onMessage?.(`本关链接：${share}`),
                );
              }}
              title="复制这一关的直达分享链接"
            >
              分享链接
            </button>
          )}
          <button className="ib-btn" disabled={!ready || capturing} onClick={capture}>
            {capturing ? '记录中…' : '记录此刻'}
          </button>
          {primaryAction && (
            <button className="ib-btn primary" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          )}
          <button
            className="ib-btn ghost"
            onClick={() => setBarOpen(!barOpen)}
            title={barOpen ? '收起顶栏' : '展开顶栏'}
          >
            {barOpen ? '⌃' : '⌄'}
          </button>
        </div>
      </header>

      {/* ===== 工作台 ===== */}
      <div className="immersive-body">
        {!ready && (
          <div className="freebuild-loading" role="status">
            {loadError ? (
              <>
                <p>{loadError}</p>
                <button
                  onClick={() => {
                    setLoadError('');
                    if (frame.current) frame.current.src = frame.current.src;
                  }}
                >
                  重新载入
                </button>
              </>
            ) : slow ? (
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
          src={url}
          title="Fieldlab 全屏物理实验台"
          className="immersive-frame"
          allowFullScreen
          onLoad={() => send('hello')}
        />
      </div>
    </div>
  );
}
