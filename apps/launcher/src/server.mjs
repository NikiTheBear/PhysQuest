/**
 * PhysQuest 本地启动器
 *
 * 只用 Node 内置模块，**零依赖**。Node 18 以上或 Bun 都能跑。
 *
 * 为什么需要它：
 *   浏览器的同源策略（CORS）不允许网页直接调用大多数大模型接口，
 *   直接调会报 "Failed to fetch"，而且浏览器不会告诉你原因。
 *
 * 它做三件事：
 *   1. 在 127.0.0.1:8787 起一个只监听本机的服务
 *   2. 把这台电脑上的网页发出去（顺便让离线版可用）
 *   3. 提供 /api/llm 转发端点，把请求转给你自己配的 AI 接口
 *
 * 安全边界（这个项目最硬的红线）：
 *   - 只监听 127.0.0.1，除了这台机器谁都访问不到
 *   - 不写日志、不落盘 Key、不向任何第三方上报
 *   - 不做"官方中转"——它不是我们的服务器，是学生自己电脑上的进程
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ============================================================
 * 配置
 * ========================================================== */

const HERE = dirname(fileURLToPath(import.meta.url)); // src/
const APP = resolve(HERE, '..'); // apps/launcher
const REPO = resolve(APP, '..', '..'); // 仓库根
const DIST = join(REPO, 'apps', 'web', 'dist');
const CONFIG_FILE = join(APP, 'config.local.json');

const PORT = Number(process.env.PORT ?? 8787);
const HOST = '127.0.0.1';

/**
 * 自由搭建工作台（Fieldlab）是另一个服务，默认跑在 4317。
 * 这个启动器把它的路径反向代理过来，这样学生只需要开一个地址。
 *
 * 哪些路径是我们自己的，哪些转给 Fieldlab，见下面的 route 判断。
 */
const FIELDLAB_PORT = Number(process.env.FIELDLAB_PORT ?? 4317);
const FIELDLAB = `http://127.0.0.1:${FIELDLAB_PORT}`;

/** 这些前缀属于 Fieldlab，转发过去 */
const FIELDLAB_PREFIXES = ['/workbench', '/mcp', '/experiments', '/prompts'];
const FIELDLAB_FILES = new Set([
  '/app.js',
  '/style.css',
  '/light.css',
  '/favicon.svg',
  '/markdown.js',
]);

/** /api/* 里哪些属于 Fieldlab（其余 /api/health、/api/llm 是我们自己的） */
const FIELDLAB_API = new Set(['/api/state', '/api/ai/chat', '/api/command']);

function isFieldlabPath(pathname) {
  if (FIELDLAB_FILES.has(pathname)) return true;
  if (FIELDLAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (FIELDLAB_API.has(pathname)) return true;
  return false;
}

/** 反向代理到 Fieldlab */
async function proxyToFieldlab(req, res, url) {
  const target = FIELDLAB + url.pathname + url.search;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);

  try {
    const method = req.method ?? 'GET';
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const body = hasBody ? await readBody(req) : undefined;

    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (['host', 'connection', 'content-length', 'accept-encoding'].includes(k)) continue;
      if (typeof v === 'string') headers[k] = v;
    }
    if (hasBody) headers['content-length'] = String(Buffer.byteLength(body));

    const upstream = await fetch(target, {
      method,
      headers,
      body,
      signal: ctrl.signal,
      redirect: 'manual',
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    const out = {};
    upstream.headers.forEach((v, k) => {
      if (['content-encoding', 'transfer-encoding', 'connection'].includes(k)) return;
      out[k] = v;
    });
    res.writeHead(upstream.status, out);
    res.end(buf);
  } catch (e) {
    const aborted = e.name === 'AbortError';
    const msg = aborted ? '工作台响应超时' : '连不上工作台';
    res.writeHead(aborted ? 504 : 502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(
      `${msg}（127.0.0.1:${FIELDLAB_PORT}）。\n` +
        `请另开一个终端，在项目根目录运行：node scripts/run-platform.mjs`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    console.warn(`  ⚠ config.local.json 格式有问题，已忽略：${e.message}`);
    return {};
  }
}

const CONFIG = loadConfig();

/* ============================================================
 * 小工具
 * ========================================================== */

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

const MIME = {
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

function isSafeTarget(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function sendJSON(res, obj, status = 200, origin = '') {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(origin),
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/* ============================================================
 * 启动前检查
 * ========================================================== */

if (!existsSync(DIST)) {
  console.log('');
  console.log(C.red('  ✗ 找不到网页构建产物'));
  console.log(C.dim('    请先在 apps/web 目录下运行：npm run build'));
  console.log(C.dim(`    找的位置是：${DIST}`));
  console.log('');
  process.exit(1);
}

/* ============================================================
 * 服务
 * ========================================================== */

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const origin = req.headers.origin ?? '';

  try {
    /* ---------- 转发给 Fieldlab ---------- */
    if (isFieldlabPath(url.pathname)) {
      await proxyToFieldlab(req, res, url);
      return;
    }

    /* ---------- 健康检查 ---------- */
    if (url.pathname === '/api/health') {
      sendJSON(
        res,
        {
          ok: true,
          name: 'physquest-launcher',
          version: '0.2.0',
          runtime: `node ${process.version}`,
          hasConfig: Boolean(CONFIG.apiKey),
          model: CONFIG.model ?? null,
          fieldlab: FIELDLAB,
        },
        200,
        origin,
      );
      return;
    }

    /* ---------- LLM 转发 ---------- */
    if (url.pathname === '/api/llm') {
      await handleLLM(req, res, url, origin);
      return;
    }

    /* ---------- 静态文件 ---------- */
    await serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(C.red('  请求出错：'), err);
    if (!res.headersSent) sendJSON(res, { error: 'internal' }, 500, origin);
  }
});

/* ============================================================
 * LLM 转发
 * ========================================================== */

async function handleLLM(req, res, url, origin) {
  // 只允许本机页面调用，防止别的网页偷偷用这个转发端点
  const allowed =
    origin === '' ||
    origin === 'null' ||
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  if (!allowed) {
    sendJSON(res, { error: 'forbidden_origin', detail: '只允许本机页面调用' }, 403, origin);
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJSON(res, { error: 'method_not_allowed' }, 405, origin);
    return;
  }

  const rawTarget = url.searchParams.get('target') ?? CONFIG.endpoint ?? '';
  if (!rawTarget) {
    sendJSON(res, { error: 'missing_target', detail: '没有指定要转发到哪个接口' }, 400, origin);
    return;
  }
  if (!isSafeTarget(rawTarget)) {
    sendJSON(res, { error: 'bad_target', detail: '只能转发到 http/https 地址' }, 400, origin);
    return;
  }

  const bodyText = await readBody(req);

  // Key：前端传的优先，其次配置文件里的
  // 注意：只经过内存，不写日志、不落盘
  const auth =
    req.headers.authorization || (CONFIG.apiKey ? `Bearer ${CONFIG.apiKey}` : null);
  if (!auth) {
    sendJSON(
      res,
      { error: 'missing_api_key', detail: '前端没传 Key，config.local.json 里也没配' },
      400,
      origin,
    );
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs ?? 60000);

  try {
    const upstream = await fetch(rawTarget, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: bodyText,
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Content-Length': Buffer.byteLength(text),
      ...corsHeaders(origin),
    });
    res.end(text);
  } catch (e) {
    const aborted = e.name === 'AbortError';
    if (aborted) {
      sendJSON(
        res,
        { error: 'upstream_timeout', detail: `上游 ${CONFIG.timeoutMs ?? 60000}ms 内没响应` },
        504,
        origin,
      );
    } else {
      sendJSON(
        res,
        {
          error: 'upstream_unreachable',
          detail:
            '连不上这个接口。检查：① 端点地址 ② 网络 / VPN ③ 这家厂商是否需要特定地区访问',
          raw: e.message,
        },
        502,
        origin,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
 * 静态文件
 * ========================================================== */

async function serveStatic(req, res, pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(DIST, safe === '/' ? '/index.html' : safe);

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) {
    // SPA 路由回退
    filePath = join(DIST, 'index.html');
    info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
  }

  const ext = extname(filePath);
  const headers = {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': String(info.size),
  };
  // 带哈希的资源长缓存，index.html 不缓存
  if (/\.[a-z0-9]{8,}\.(js|css)$/i.test(filePath)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (ext === '.html') {
    headers['Cache-Control'] = 'no-cache';
  }

  const buf = await readFile(filePath);
  res.writeHead(200, headers);
  res.end(buf);
}

/* ============================================================
 * 启动
 * ========================================================== */

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('');
    console.log(C.red(`  ✗ 端口 ${PORT} 已经被占用`));
    console.log(C.dim('    可能是另一个启动器还开着。'));
    console.log(C.dim(`    或者换个端口：PORT=8788 node src/server.mjs`));
    console.log('');
    process.exit(1);
  }
  console.error(C.red('  启动失败：'), e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const address = `http://${HOST}:${PORT}`;

  console.log('');
  console.log(C.bold('  🔭 探理实验室 · 本地启动器'));
  console.log(C.dim('  ─────────────────────────────────────────'));
  console.log(`  ${C.green('✓')} 服务已启动：${C.cyan(address)}`);
  console.log(`  ${C.dim('·')} 只监听本机 127.0.0.1，局域网里其他设备访问不到`);
  console.log(
    `  ${C.dim('·')} 配置文件：${
      existsSync(CONFIG_FILE)
        ? C.green('已读取 config.local.json')
        : C.dim('未找到（可在网页里填 Key）')
    }`,
  );
  if (CONFIG.model) console.log(`  ${C.dim('·')} 默认模型：${CONFIG.model}`);
  console.log('');
  console.log(C.dim('  浏览器应该已经自动打开。如果没有，手动访问上面那个地址。'));
  console.log(C.dim('  关掉这个窗口（或按 Ctrl+C）就是停止服务。'));
  console.log('');

  openBrowser(address);
});

/** 自动打开浏览器 */
async function openBrowser(address) {
  const { spawn } = await import('node:child_process');
  const cmd =
    process.platform === 'darwin'
      ? ['open', [address]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', address]]
        : ['xdg-open', [address]];

  try {
    const child = spawn(cmd[0], cmd[1], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
  } catch {
    console.log(C.yellow('  （没能自动打开浏览器，请手动访问上面的地址）'));
  }
}

/* 优雅退出 */
const shutdown = () => {
  console.log('');
  console.log(C.dim('  正在关闭…'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
