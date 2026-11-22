#!/bin/bash
# ============================================================
# PhysQuest · 一键发布
# 用法：bash scripts/publish.sh "提交说明"
# 做三件事：
#   1. 本地文档 local/ → 桌面「PhysQuest-本地文档」（不进 GitHub）
#   2. 提交所有更改并推送 GitHub（网站/代码）
#   3. 写一条发布日志
# ============================================================
set -u
cd "$(dirname "$0")/.." || exit 1

MSG="${1:-自动更新}"
DESK="$HOME/Desktop/PhysQuest-本地文档"
LOG="$DESK/发布日志.md"
STAMP="$(date '+%Y-%m-%d %H:%M')"

echo "== ① 同步本地文档到桌面 =="
mkdir -p "$DESK"
if [ -d local ]; then
  cp -R local/. "$DESK/"
  echo "  local/ → $DESK （$(ls local | wc -l | tr -d ' ') 个文件）"
fi

echo "== ② 提交并推送 GitHub =="
git add -A
if git diff --cached --quiet; then
  echo "  没有需要提交的更改，跳过 commit"
else
  git commit -m "$MSG" -q && echo "  已提交：$MSG"
fi

if git push origin main 2> /tmp/physquest-push.err; then
  echo "  已推送到 GitHub（main）"
  PUSHED="✅ 已推送"
else
  echo "  ⚠ 推送失败："
  sed 's/^/    /' /tmp/physquest-push.err | head -5
  if grep -qi "could not read Username\|Device not configured\|Authentication failed" /tmp/physquest-push.err; then
    echo ""
    echo "    还没登录 GitHub：双击桌面上的「PhysQuest-登录GitHub.command」输一次令牌即可。"
    echo "    本次改动已经提交在本地，登录后再跑一次发布就会推上去。"
  fi
  PUSHED="❌ 推送失败（见下方错误）"
fi

echo "== ③ 写发布日志 =="
{
  echo "### $STAMP — $MSG"
  echo "- GitHub：$PUSHED"
  echo "- 变更文件数：$(git status --porcelain | wc -l | tr -d ' ')"
  echo "- 文档同步：local/ → 桌面"
  echo
} >> "$LOG"
echo "  日志 → $LOG"
echo ""
echo "完成。"
