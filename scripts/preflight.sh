#!/usr/bin/env bash
# 提交前预检
#
# 用法：./scripts/preflight.sh
#
# 检查四件事，任何一项不过就不算通过：
#   1. 暂存的文件里有没有疑似 API Key
#   2. TypeScript 有没有类型错误
#   3. 12 条物理断言
#   4. 知识库 / 题库 / 剧本的 id 引用

cd "$(dirname "$0")/.." || exit 1

if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; DIM=''; BOLD=''; NC=''
fi
FAIL=0

echo ""
echo "${BOLD}提交前预检${NC}"
echo "${DIM}─────────────────────────────────────${NC}"
echo ""

# ---------- 1. Key 扫描 ----------
echo -n "1. 扫密钥… "
# 扫已暂存的内容 + 工作区的源码（排除 node_modules）
LEAK=$(
  {
    git diff --cached 2>/dev/null
    git ls-files -z 2>/dev/null | xargs -0 cat 2>/dev/null
  } | grep -aE "sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}" \
    | grep -v "sk-\.\.\.\|sk-你的\|sk-test\|sk-fake\|sk-invalid\|placeholder" \
    | head -3
)

if [ -n "$LEAK" ]; then
  echo "${RED}✗ 发现疑似密钥${NC}"
  echo "$LEAK" | sed 's/^/     /'
  FAIL=1
else
  echo "${GREEN}✓${NC}"
fi

# ---------- 2. TypeScript ----------
echo -n "2. TypeScript… "
if (cd apps/web && npx tsc --noEmit >/tmp/pf-tsc.log 2>&1); then
  echo "${GREEN}✓${NC}"
else
  echo "${RED}✗${NC}"
  sed 's/^/     /' /tmp/pf-tsc.log | head -8
  FAIL=1
fi

# ---------- 3. 物理断言 ----------
echo -n "3. 物理断言… "
if (cd apps/web && npx vitest run >/tmp/pf-test.log 2>&1); then
  PASSED=$(grep -oE "Tests +[0-9]+ passed" /tmp/pf-test.log | head -1)
  echo "${GREEN}✓${NC} ${DIM}${PASSED}${NC}"
else
  echo "${RED}✗${NC}"
  tail -20 /tmp/pf-test.log | sed 's/^/     /'
  FAIL=1
fi

# ---------- 4. 内容校验 ----------
echo -n "4. 内容校验… "
if node shared/knowledge-data/schema/validate.mjs >/tmp/pf-content.log 2>&1; then
  echo "${GREEN}✓${NC}"
else
  echo "${RED}✗${NC}"
  grep "✗" /tmp/pf-content.log | head -8 | sed 's/^/     /'
  FAIL=1
fi

# ---------- 结论 ----------
echo ""
if [ "$FAIL" = "0" ]; then
  echo "${GREEN}✓ 可以提交${NC}"
  echo ""
  exit 0
else
  echo "${RED}✗ 有不通过的项目，修完再来${NC}"
  echo ""
  exit 1
fi
