/**
 * PhysQuest 本地启动器
 *
 * 为什么需要它：
 *   浏览器的同源策略（CORS）不允许网页直接调用大多数大模型接口，
 *   直接调用会报 "Failed to fetch"，而且浏览器不会告诉你原因。
 *
 * 它做三件事：
 *   1. 在 127.0.0.1:8787 起一个只监听本机的服务
 *   2. 把这台电脑上的网页发出去（顺便让离线版可用）
 *   3. 提供 /api/llm 转发端点，把请求转给你自己配的 AI 接口
 *
 * 安全边界（这是这个项目最硬的红线）：
 *   - 只监听 127.0.0.1，除了这台机器，谁都访问不到
 *   - 不写日志、不落盘 Key、不向任何第三方上报
 *   - 不做任何"官方中转"——它不是我们的服务器，是学生自己电脑上的进程
 */

import { serve } from 'bun';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';

/* ============================================================
 * 配置
 * ========================================================== */

const PORT = Number(process.env.PORT ?? 8787);
const HOST = '127.0.0.1';
const HERE = resolve(import.meta.dir, '..');          // apps/launcher
const REPO = resolve(HERE, '..', '..');              // 仓库根
const DIST = join(REPO, 'apps', 'web', 'dist');      // 构建产物
const CONFIG_FILE = join(HERE, 'config.local.json');

interface LocalConfig {
  /** 默认端点，可被前端覆盖 */
  endpoint?: string;
  model?: string;
  /** 建议不要写在这里，但为了方便学校预配也支持 */
  apiKey?: string;
  /** 转发超时（毫秒） */
  timeoutMs?: number;
}

function loadConfig(): LocalConfig {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as LocalConfig;
  } catch (e) {
    console.warn(`  ⚠ config.local.json 格式有问题，已忽略：${(e as Error).message}`);
    return {};
  }
}

const CONFIG = loadConfig();

/* ============================================================
 * 工具
 * ========================================================== */

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

/** 只允许转发到 http/https，防止 file:// 之类的诡异目标 */
function isSafeTarget(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ============================================================
 * 服务
 * ========================================================== */

if (!existsSync(DIST)) {
  console.log('');
  console.log(C.red('  ✗ 找不到 dist/ 目录'));
  console.log(C.dim('    请先在 apps/web 目录下运行：npm run build'));
  console.log(C.dim(`    当前找的是：${DIST}`));
  console.log('');
  process.exit(1);
}

const server = serve({
  hostname: HOST,
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    /* ---------- 健康检查：前端用它判断启动器在不在 ---------- */
    if (url.pathname === '/api/health') {
      // 必须带 CORS 头：网页可能从 localhost:5180（dev）或 127.0.0.1:8787 打开
      return Response.json(
        {
          ok: true,
          name: 'physquest-launcher',
          version: '0.1.0',
          hasConfig: Boolean(CONFIG.apiKey),
          model: CONFIG.model ?? null,
        },
        { headers: corsHeaders(req) },
      );
    }

    /* ---------- LLM 转发 ---------- */
    if (url.pathname === '/api/llm') {
      return handleLLM(req, url);
    }

    /* ---------- 静态文件 ---------- */
    return serveStatic(url.pathname);
  },

  error(err) {
    console.error(C.red('  服务出错：'), err);
    return new Response('Internal Error', { status: 500 });
  },
});

/* ============================================================
 * LLM 转发
 * ========================================================== */

async function handleLLM(req: Request, url: URL): Promise<Response> {
  // 只接受本机来源的请求，防止别的网页偷偷调这个转发端点
  const origin = req.headers.get('origin') ?? '';
  const allowed =
    origin === '' ||
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ||
    origin === 'null'; // file:// 打开时是 null
  if (!allowed) {
    return json({ error: 'forbidden_origin', detail: '只允许本机页面调用' }, 403);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // 目标地址：优先用 ?target=，没有就用配置文件里的
  const rawTarget = url.searchParams.get('target') ?? CONFIG.endpoint ?? '';
  if (!rawTarget) {
    return json({ error: 'missing_target', detail: '没有指定要转发到哪个接口' }, 400);
  }
  if (!isSafeTarget(rawTarget)) {
    return json({ error: 'bad_target', detail: '只能转发到 http/https 地址' }, 400);
  }

  // 请求体原样转发
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return json({ error: 'bad_body' }, 400);
  }

  // Key：前端传的优先，其次用配置文件里的
  //   —— 注意：这里只是「经过内存」，不写日志、不落盘
  const auth =
    req.headers.get('authorization') ??
    (CONFIG.apiKey ? `Bearer ${CONFIG.apiKey}` : null);
  if (!auth) {
    return json(
      { error: 'missing_api_key', detail: '前端没传 Key，config.local.json 里也没配' },
      400,
    );
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs ?? 60000);

  try {
    const upstream = await fetch(rawTarget, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: bodyText,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        ...corsHeaders(req),
      },
    });
  } catch (e) {
    const aborted = (e as Error).name === 'AbortError';
    if (aborted) {
      return json(
        { error: 'upstream_timeout', detail: `上游 ${CONFIG.timeoutMs ?? 60000}ms 内没响应` },
        504,
      );
    }
    return json(
      {
        error: 'upstream_unreachable',
        detail:
          '连不上这个接口。检查：① 端点地址 ② 网络 / VPN ③ 这家厂商是否需要特定地区访问',
        raw: (e as Error).message,
      },
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/* ============================================================
 * 静态文件
 * ========================================================== */

async function serveStatic(pathname: string): Promise<Response> {
  // 防目录穿越
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(DIST, safePath === '/' ? '/index.html' : safePath);

  if (!filePath.startsWith(DIST)) {
    return new Response('Forbidden', { status: 403 });
  }

  let file = Bun.file(filePath);
  if (!(await file.exists())) {
    // SPA 路由回退
    filePath = join(DIST, 'index.html');
    file = Bun.file(filePath);
    if (!(await file.exists())) return new Response('Not Found', { status: 404 });
  }

  const ext = extname(filePath);
  const headers: Record<string, string> = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
  };
  // 带哈希的资源长缓存，index.html 不缓存
  if (/\.[a-z0-9]{8,}\.(js|css)$/i.test(filePath)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache';
  }

  return new Response(file, { headers });
}

/* ============================================================
 * 启动提示
 * ========================================================== */

const address = `http://${HOST}:${PORT}`;

console.log('');
console.log(C.bold('  🔭 探理实验室 · 本地启动器'));
console.log(C.dim('  ─────────────────────────────────────────'));
console.log(`  ${C.green('✓')} 服务已启动：${C.cyan(address)}`);
console.log(`  ${C.dim('·')} 只监听本机 127.0.0.1，局域网里其他设备访问不到`);
console.log(
  `  ${C.dim('·')} 配置文件：${
    existsSync(CONFIG_FILE) ? C.green('已读取 config.local.json') : C.dim('未找到（可在网页里填 Key）')
  }`,
);
if (CONFIG.model) console.log(`  ${C.dim('·')} 默认模型：${CONFIG.model}`);
console.log('');
console.log(C.dim('  浏览器应该已经自动打开。如果没有，手动访问上面那个地址。'));
console.log(C.dim('  关掉这个窗口就是停止服务。'));
console.log('');

// 自动打开浏览器（macOS / Windows / Linux）
const opener =
  process.platform === 'darwin'
    ? ['open', address]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', '', address]
      : ['xdg-open', address];

try {
  Bun.spawn(opener, { stdio: ['ignore', 'ignore', 'ignore'] });
} catch {
  console.log(C.yellow('  （没能自动打开浏览器，请手动访问上面的地址）'));
  console.log('');
}

/* 优雅退出 */
const shutdown = () => {
  console.log('');
  console.log(C.dim('  正在关闭…'));
  server.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
