#!/bin/bash
# ============================================================
# 给分支开一个 PR（已存在就打印现有链接）
# 用法：bash scripts/open-pr.sh <branch> [base]
# 令牌从 macOS 钥匙串取，不写入任何文件
# ============================================================
set -u
cd "$(dirname "$0")/.." || exit 1
BRANCH="${1:?需要分支名}"
BASE="${2:-main}"
REPO="NikiTheBear/PhysQuest"

CRED=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill 2>/dev/null)
TOKEN=$(echo "$CRED" | sed -n 's/^password=//p')
unset CRED
if [ -z "$TOKEN" ]; then
  echo ""
  exit 0
fi

# 已有未关闭的 PR 就直接复用
EXISTING=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/pulls?state=open&head=$REPO:$BRANCH" \
  | grep -o '"html_url": *"[^"]*"' | head -1 | sed 's/.*"\(https[^"]*\)"/\1/')
if [ -n "$EXISTING" ]; then
  echo "$EXISTING"
  unset TOKEN
  exit 0
fi

# PR 标题用分支名后面那段，正文自动列出这一支的提交
TITLE=$(git log --format=%s -1 "$BRANCH")
BODY=$(git log --format='- %s' "$BASE..$BRANCH")
PAYLOAD=$(BRANCH="$BRANCH" BASE="$BASE" TITLE="$TITLE" BODY="$BODY" python3 - <<'PY'
import json, os
print(json.dumps({
    "title": os.environ["TITLE"],
    "head": os.environ["BRANCH"],
    "base": os.environ["BASE"],
    "body": "## 本次改动\n\n" + os.environ["BODY"] + "\n\n（由 scripts/publish.sh 自动创建）",
}))
PY
)

URL=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/pulls" -d "$PAYLOAD" \
  | grep -o '"html_url": *"[^"]*"' | head -1 | sed 's/.*"\(https[^"]*\)"/\1/')
unset TOKEN
echo "$URL"
