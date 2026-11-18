#!/bin/bash
# 探理实验室 · 本地启动器（macOS / Linux）
# 双击这个文件就能启动。不需要 bun，不需要 npm install。

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
         "$HOME/.volta/bin/node" \
         "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin/node"; do
  if [ -n "$p" ] && [ -x "$p" ]; then NODE="$p"; break; fi
done

if [ -z "$NODE" ]; then
  echo "  ✗ 找不到 Node.js"
  echo ""
  echo "    这个启动器需要 Node.js 18 以上。装一下："
  echo "      https://nodejs.org   （下载 LTS 版本，一路下一步就行）"
  echo ""
  echo "    装完关掉这个窗口，再双击一次。"
  echo ""
  read -r -p "  按回车关掉…"
  exit 1
fi

# 检查网页有没有构建
if [ ! -f "../web/dist/index.html" ]; then
  echo "  ⚠ 还没构建网页，正在构建（第一次会慢一点）…"
  echo ""
  (cd ../web && npm install --silent && npm run build)
  if [ ! -f "../web/dist/index.html" ]; then
    echo ""
    echo "  ✗ 构建失败。请在终端里手动运行："
    echo "      cd apps/web && npm install && npm run build"
    echo ""
    read -r -p "  按回车关掉…"
    exit 1
  fi
  echo ""
fi

"$NODE" src/server.mjs

echo ""
read -r -p "  服务已停止。按回车关掉窗口…"
