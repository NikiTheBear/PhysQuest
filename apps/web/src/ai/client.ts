/**
 * AI 客户端（BYOK）
 *
 * 红线：
 *  1. 密钥只存在 localStorage，只在你自己的浏览器里
 *  2. 我们不接收、不转发、不存储任何人的 Key
 *  3. 没配 Key 时全部功能降级到本地兜底，不崩
 *
 * 两种连接方式（见 PLAN.md §3.6）：
 *  - direct：浏览器直连厂商接口（只有部分厂商允许跨域）
 *  - launcher：走本机 127.0.0.1:8787 的小代理，绕开跨域，所有厂商都能用
 */

import { estimateTokens, recordUsage } from './usage';

export type AIConnection = 'direct' | 'launcher';

export interface AIConfig {
  connection: AIConnection;
  endpoint: string;
  model: string;
  apiKey: string;
}

const STORE_KEY = 'physquest.ai.v1';

/** 常见厂商预设（只放确认可以直连的，其余走启动器） */
export const PROVIDERS: Array<{
  id: string;
  name: string;
  endpoint: string;
  model: string;
  directOK: boolean;
  note: string;
}> = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    directOK: false,
    note: '需要本地启动器',
  },
  {
    id: 'qwen',
    name: '通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    directOK: false,
    note: '需要本地启动器',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    endpoint: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    directOK: false,
    note: '需要本地启动器',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    directOK: false,
    note: '需要本地启动器',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    directOK: true,
    note: '支持浏览器直连',
  },
  {
    id: 'custom',
    name: '自定义',
    endpoint: '',
    model: '',
    directOK: true,
    note: '自己填端点和模型',
  },
];

export const LAUNCHER_BASE = 'http://127.0.0.1:8787';

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults();
}

function defaults(): AIConfig {
  return {
    connection: 'launcher',
    endpoint: PROVIDERS[0].endpoint,
    model: PROVIDERS[0].model,
    apiKey: '',
  };
}

export function saveAIConfig(c: AIConfig) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {
    /* 隐私模式忽略 */
  }
}

export function clearAIConfig() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

export function isConfigured(c: AIConfig): boolean {
  // 启动器模式允许 Key 留空（Key 可能在 config.local.json 里）
  if (c.connection === 'launcher') {
    return Boolean(c.endpoint.trim() && c.model.trim());
  }
  return Boolean(c.apiKey.trim() && c.endpoint.trim() && c.model.trim());
}

/** 把端点规范化成完整的 chat/completions 地址 */
/* ============================================================
 * 启动器探测
 * ========================================================== */

export interface LauncherInfo {
  ok: boolean;
  version?: string;
  model?: string | null;
  hasConfig?: boolean;
}

/**
 * 探测本机启动器在不在。
 * 用 GET /api/health，2 秒超时 —— 探不到就是没开，不要卡住界面。
 */
export async function probeLauncher(timeoutMs = 2000): Promise<LauncherInfo> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${LAUNCHER_BASE}/api/health`, {
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return {
      ok: Boolean(data?.ok),
      version: data?.version,
      model: data?.model ?? null,
      hasConfig: Boolean(data?.hasConfig),
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export function resolveUrl(c: AIConfig): string {
  const base = c.endpoint.trim().replace(/\/+$/, '');
  const full = /\/chat\/completions$/i.test(base)
    ? base
    : /\/v1$/i.test(base) || /\/v4$/i.test(base)
      ? `${base}/chat/completions`
      : `${base}/v1/chat/completions`;

  if (c.connection === 'launcher') {
    // 走本地代理：把目标地址作为参数传过去，代理只做转发
    return `${LAUNCHER_BASE}/api/llm?target=${encodeURIComponent(full)}`;
  }
  return full;
}

/* ============================================================
 * 错误翻译 —— 新手配 Key 失败，99% 是这几种，别甩英文
 * ========================================================== */

export type AIErrorKind =
  | 'unauthorized'
  | 'quota'
  | 'notfound'
  | 'cors'
  | 'launcher-down'
  | 'forbidden'
  | 'timeout'
  | 'unknown';

export interface AIError {
  kind: AIErrorKind;
  message: string;
  detail?: string;
}

function translateError(status: number, text: string, conn: AIConnection): AIError {
  if (status === 401 || status === 403) {
    return {
      kind: 'unauthorized',
      message: 'Key 无效或已过期',
      detail: '去厂商控制台重新复制一份，注意不要带多余的空格。',
    };
  }
  if (status === 402 || status === 429) {
    return {
      kind: 'quota',
      message: '账户余额不足，或请求太频繁',
      detail: '去厂商控制台看一下余额；如果余额正常，等一分钟再试。',
    };
  }
  if (status === 403) {
    return {
      kind: 'forbidden',
      message: '启动器拒绝了这次请求',
      detail: '通常是从 file:// 打开的页面才会被拒。请用启动器给出的那个地址打开网页。',
    };
  }
  if (status === 404) {
    return {
      kind: 'notfound',
      message: '端点地址写错了',
      detail: '只填到 /v1 就够了，不要带 /chat/completions。也可以直接选上面的预设。',
    };
  }
  if (conn === 'direct') {
    return {
      kind: 'cors',
      message: '这家厂商不允许浏览器直连',
      detail:
        '这是浏览器的跨域限制，不是你的问题。把上面的「连接方式」切到「本地启动器」就能用了。',
    };
  }
  return {
    kind: 'unknown',
    message: `接口返回了 ${status}`,
    detail: text.slice(0, 200),
  };
}

/* ============================================================
 * 调用
 * ========================================================== */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(
  c: AIConfig,
  messages: ChatMessage[],
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<{ ok: true; text: string } | { ok: false; error: AIError }> {
  const url = resolveUrl(c);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c.apiKey}`,
      },
      body: JSON.stringify({
        model: c.model,
        messages,
        temperature: 0.3,
        max_tokens: opts.maxTokens ?? 900,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: translateError(res.status, text, c.connection) };
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';

    // 记用量：优先用厂商返回的 usage，没有就按字符估算
    const promptChars = messages.reduce((n, m) => n + m.content.length, 0);
    const tok =
      Number(data?.usage?.total_tokens) ||
      estimateTokens(messages.map((m) => m.content).join('')) + estimateTokens(text);
    recordUsage(tok || estimateTokens(String(promptChars)), c.model);

    return { ok: true, text: text.trim() };
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    if (aborted) {
      return {
        ok: false,
        error: { kind: 'timeout', message: '等了 45 秒没有响应', detail: '可能是网络慢，换个时间再试。' },
      };
    }
    if (c.connection === 'launcher') {
      return {
        ok: false,
        error: {
          kind: 'launcher-down',
          message: '本地启动器没在跑',
          detail: '回到桌面双击 PhysQuest 启动器，看到窗口后再点一次发送。',
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: 'cors',
        message: '请求没能发出去',
        detail: '大概率是这家厂商不允许浏览器直连。切到「本地启动器」试试。',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 测试连接：发一句最短的话，确认能通 */
export async function testConnection(c: AIConfig) {
  return chat(c, [{ role: 'user', content: '只回复两个字：正常' }], {
    maxTokens: 16,
    timeoutMs: 20000,
  });
}
