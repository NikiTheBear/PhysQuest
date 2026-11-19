#!/bin/bash
# 探理实验室 · 一键启动（macOS）
# 双击这个文件就能用。会起两个服务：
#   8787 主应用（你只需要开这个地址）
#   4317 自由搭建工作台（被 8787 代理，不用单独开）

cd "$(dirname "$0")" || exit 1
clear

echo ""
echo "  🔭 探理实验室"
echo "  ────────────────────────────────────────"
echo ""

# 找 node
NODE=""
for p in "$(command -v node 2>/dev/null)" \
         "/opt/homebrew/bin/node" \
         "/usr/local/bin/node" \
         "$HOME/.volta/bin/node"; do
  if [ -n "$p" ] && [ -x "$p" ]; then NODE="$p"; break; fi
done

if [ -z "$NODE" ]; then
  echo "  ✗ 找不到 Node.js"
  echo ""
  echo "    需要 Node.js 18 以上。去 https://nodejs.org 下载 LTS 版本。"
  echo ""
  read -r -p "  按回车关掉…"
  exit 1
fi

# 第一次：装依赖 + 构建
if [ ! -f "apps/web/dist/index.html" ]; then
  echo "  第一次启动，正在构建（要几分钟）…"
  echo ""
  (cd apps/web && npm install --silent && npm run build)
  echo ""
fi

if [ ! -f "platform/dist/server/index.js" ]; then
  echo "  正在准备自由搭建工作台（要几分钟）…"
  echo ""
  (cd platform && npm install --silent && node scripts/sync-physquest.mjs .. && npm --prefix physquest/apps/web ci --silent && npm run build)
  echo ""
fi

# 起工作台（4317）
echo "  → 启动自由搭建工作台…"
(cd platform && node scripts/dev.mjs > /tmp/physquest-fieldlab.log 2>&1 & echo $! > /tmp/physquest-fieldlab.pid)
sleep 4

# 起主应用（8787）
echo "  → 启动主应用…"
(cd apps/launcher && node src/server.mjs > /tmp/physquest-app.log 2>&1 & echo $! > /tmp/physquest-app.pid)
sleep 4

clear
echo ""
echo "  🔭 探理实验室已就绪"
echo "  ────────────────────────────────────────"
echo ""
echo "    打开这个地址：  http://127.0.0.1:8787"
echo ""
echo "  · 主应用和工作台都在这一个地址里"
echo "  · 关掉这个窗口不会停服务"
echo "  · 要停：双击 stop.command"
echo ""
echo "  日志："
echo "    /tmp/physquest-app.log"
echo "    /tmp/physquest-fieldlab.log"
echo ""

open "http://127.0.0.1:8787" 2>/dev/null

read -r -p "  按回车关掉这个窗口（服务继续运行）…"
