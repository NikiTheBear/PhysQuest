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

# 已有未关闭的 PR 就复用（用 json 解析，不靠 grep 猜）
EXISTING=$(BRANCH="$BRANCH" REPO="$REPO" curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/pulls?state=open&per_page=100" \
  | BRANCH="$BRANCH" python3 -c "
import json, os, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if isinstance(data, list):
    for p in data:
        if p.get('head', {}).get('ref') == os.environ['BRANCH']:
            print(p['html_url']); break
")
if [ -n "$EXISTING" ]; then
  echo "$EXISTING"
  unset TOKEN
  exit 0
fi

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
  | python3 -c "
import json, sys
try: d = json.load(sys.stdin)
except Exception: sys.exit(0)
print(d.get('html_url') or '')
")
unset TOKEN
echo "$URL"
