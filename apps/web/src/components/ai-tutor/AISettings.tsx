import { useState } from 'react';
import {
  clearAIConfig,
  isConfigured,
  loadAIConfig,
  PROVIDERS,
  saveAIConfig,
  testConnection,
  type AIConfig,
  type AIConnection,
} from '../../ai/client';

interface Props {
  config: AIConfig;
  onSave: (c: AIConfig) => void;
  onClose: () => void;
}

type TestState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'ok' } | { kind: 'err'; msg: string; detail?: string };

export default function AISettings({ config, onSave, onClose }: Props) {
  const [c, setC] = useState<AIConfig>(config);
  const [provider, setProvider] = useState('deepseek');
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [showKey, setShowKey] = useState(false);

  const pickProvider = (id: string) => {
    setProvider(id);
    const p = PROVIDERS.find((x) => x.id === id);
    if (!p) return;
    setC((prev) => ({
      ...prev,
      endpoint: p.endpoint,
      model: p.model,
      connection: p.directOK ? prev.connection : 'launcher',
    }));
    setTest({ kind: 'idle' });
  };

  const runTest = async () => {
    setTest({ kind: 'busy' });
    const res = await testConnection(c);
    if (res.ok) setTest({ kind: 'ok' });
    else setTest({ kind: 'err', msg: res.error.message, detail: res.error.detail });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px,100%)' }}>
        <h3>AI 设置</h3>
        <p className="sub">
          密钥只保存在你这台电脑的浏览器里。我们的服务器不接收、不转发、不存储任何 Key。
        </p>

        <div className="field">
          <label>连接方式</label>
          <div className="segmented">
            {(
              [
                ['launcher', '本地启动器（推荐）'],
                ['direct', '浏览器直连'],
              ] as Array<[AIConnection, string]>
            ).map(([v, label]) => (
              <button
                key={v}
                className={c.connection === v ? 'active' : ''}
                onClick={() => {
                  setC({ ...c, connection: v });
                  setTest({ kind: 'idle' });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
            <div className="hint" style={{ marginTop: 0 }}>
              {c.connection === 'launcher'
                ? '走本机 127.0.0.1:8787 转发，绕开跨域，所有厂商都能用。需要先双击启动器。'
                : '浏览器直接请求厂商接口。只有少数厂商允许这样做，大部分会报「跨域」错误。'}
            </div>
          </div>
        </div>

        <div className="field">
          <label>厂商</label>
          <div className="chips">
            {PROVIDERS.map((p) => (
              <span
                key={p.id}
                className="chip"
                onClick={() => pickProvider(p.id)}
                style={
                  provider === p.id
                    ? { background: 'var(--accent)', color: '#fff' }
                    : undefined
                }
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>

        <div className="field">
          <label>端点地址</label>
          <input
            value={c.endpoint}
            onChange={(e) => {
              setC({ ...c, endpoint: e.target.value });
              setTest({ kind: 'idle' });
            }}
            placeholder="https://api.deepseek.com/v1"
            spellCheck={false}
          />
          <div className="hint">只填到 /v1 就行，后面的路径会自动补上。</div>
        </div>

        <div className="field">
          <label>模型名称</label>
          <input
            value={c.model}
            onChange={(e) => {
              setC({ ...c, model: e.target.value });
              setTest({ kind: 'idle' });
            }}
            placeholder="deepseek-chat"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label>API Key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={c.apiKey}
              onChange={(e) => {
                setC({ ...c, apiKey: e.target.value });
                setTest({ kind: 'idle' });
              }}
              placeholder="sk-..."
              spellCheck={false}
              style={{ flex: 1 }}
            />
            <button className="btn-ghost btn-small" onClick={() => setShowKey(!showKey)}>
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <div className="hint">存在 localStorage，清浏览器数据会一起清掉。</div>
        </div>

        {test.kind !== 'idle' && (
          <div
            className={`test-result ${
              test.kind === 'ok' ? 'ok' : test.kind === 'err' ? 'err' : 'info'
            }`}
          >
            {test.kind === 'busy' && '正在测试连接…'}
            {test.kind === 'ok' && '✓ 连上了。可以开始用 AI 助教了。'}
            {test.kind === 'err' && (
              <>
                <b>{test.msg}</b>
                {test.detail && (
                  <div style={{ marginTop: 5, fontSize: 12.5, opacity: 0.85 }}>{test.detail}</div>
                )}
              </>
            )}
          </div>
        )}

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn-ghost"
            onClick={() => {
              clearAIConfig();
              const fresh = loadAIConfig();
              setC(fresh);
              setTest({ kind: 'idle' });
            }}
          >
            清除
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={runTest} disabled={!isConfigured(c) || test.kind === 'busy'}>
              测试连接
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                saveAIConfig(c);
                onSave(c);
              }}
              disabled={!isConfigured(c)}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
