#!/bin/bash
# 探理实验室 · 本地启动器（macOS）
# 双击这个文件就能启动。

cd "$(dirname "$0")" || exit 1

clear
echo ""
echo "  🔭 探理实验室"
echo "  ────────────────────────────────────────"
echo ""

# 1) 检查 bun
if ! command -v bun >/dev/null 2>&1; then
  # 常见安装位置兜底
  for p in "$HOME/.bun/bin/bun" "/opt/homebrew/bin/bun" "/usr/local/bin/bun"; do
    if [ -x "$p" ]; then
      export PATH="$(dirname "$p"):$PATH"
      break
    fi
  done
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "  ✗ 找不到 bun"
  echo ""
  echo "    这个启动器需要 bun 才能跑。装一下："
  echo "      curl -fsSL https://bun.sh/install | bash"
  echo ""
  echo "    装完关掉这个窗口，再双击一次。"
  echo ""
  read -r -p "  按回车关掉…"
  exit 1
fi

# 2) 检查网页有没有构建
if [ ! -d "../web/dist" ]; then
  echo "  ⚠ 还没构建网页，正在构建（第一次会慢一点）…"
  echo ""
  (cd ../web && npm install --silent && npm run build)
  if [ ! -d "../web/dist" ]; then
    echo ""
    echo "  ✗ 构建失败。请在终端里手动运行："
    echo "      cd apps/web && npm install && npm run build"
    echo ""
    read -r -p "  按回车关掉…"
    exit 1
  fi
  echo ""
fi

# 3) 起服务
bun run src/server.ts

echo ""
read -r -p "  服务已停止。按回车关掉窗口…"
