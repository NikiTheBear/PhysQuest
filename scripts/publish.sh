#!/bin/bash
# ============================================================
# PhysQuest · 一键发布
# 用法：bash scripts/publish.sh "提交说明"
#
# 做四件事：
#   1. 本地文档 local/ → 桌面「PhysQuest-本地文档」（不进 GitHub）
#   2. 提交所有更改
#   3. 推送当前分支到 GitHub（main 受保护，不能直推；非 main 就推分支）
#   4. 若不是 main，自动开/复用 PR，并打印链接
# ============================================================
set -u
cd "$(dirname "$0")/.." || exit 1

REPO="NikiTheBear/PhysQuest"
MSG="${1:-自动更新}"
DESK="$HOME/Desktop/PhysQuest-本地文档"
LOG="$DESK/发布日志.md"
STAMP="$(date '+%Y-%m-%d %H:%M')"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "== ① 同步本地文档到桌面 =="
mkdir -p "$DESK"
if [ -d local ]; then
  cp -R local/. "$DESK/"
  echo "  local/ → $DESK （$(ls local | wc -l | tr -d ' ') 个文件）"
fi

echo "== ② 提交 =="
git add -A
if git diff --cached --quiet; then
  echo "  没有需要提交的更改"
else
  git commit -m "$MSG" -q && echo "  已提交：$MSG"
fi

if [ "$BRANCH" = "main" ]; then
  echo "== ③ main 受保护，不能直推 =="
  echo "  请先建分支：git switch -c codex/<说明>，再跑一次发布。"
  PUSHED="⚠ 未推送（main 受保护）"
  PRURL=""
else
  echo "== ③ 推送分支 $BRANCH =="
  if git push -u origin "$BRANCH" 2> /tmp/physquest-push.err; then
    echo "  已推送"
    PUSHED="✅ 已推送分支 $BRANCH"
  else
    echo "  ⚠ 推送失败："
    sed 's/^/    /' /tmp/physquest-push.err | head -6
    if grep -qi "could not read Username\|Device not configured\|Authentication" /tmp/physquest-push.err; then
      echo "    还没登录：双击桌面「PhysQuest-登录GitHub.command」输一次令牌。"
    fi
    PUSHED="❌ 推送失败"
  fi

  echo "== ④ 开/复用 PR =="
  PRURL="$(bash scripts/open-pr.sh "$BRANCH" 2>/dev/null | tail -1)"
  if [ -n "$PRURL" ]; then
    echo "  $PRURL"
  else
    echo "  （PR 未创建，可手动到 GitHub 开）"
  fi
fi

echo "== ⑤ 写发布日志 =="
{
  echo "### $STAMP — $MSG"
  echo "- 分支：$BRANCH"
  echo "- GitHub：$PUSHED"
  [ -n "${PRURL:-}" ] && echo "- PR：$PRURL"
  echo "- 文档同步：local/ → 桌面"
  echo
} >> "$LOG"
echo "  日志 → $LOG"
echo ""
echo "完成。"
