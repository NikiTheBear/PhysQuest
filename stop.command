#!/bin/bash
# 停掉探理实验室的所有服务
cd "$(dirname "$0")" || exit 1
clear
echo ""
echo "  正在停止探理实验室…"
echo ""

for f in /tmp/physquest-app.pid /tmp/physquest-fieldlab.pid; do
  if [ -f "$f" ]; then
    pid=$(cat "$f")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo "  ✓ 已停止 PID $pid"
    fi
    rm -f "$f"
  fi
done

pkill -f "apps/launcher/src/server.mjs" 2>/dev/null
pkill -f "platform/scripts/dev.mjs" 2>/dev/null

echo ""
echo "  全部已停止。"
echo ""
read -r -p "  按回车关掉…"
