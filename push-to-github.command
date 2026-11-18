#!/bin/bash
# 探理实验室 · 推送到 GitHub
#
# 双击这个文件就行。它会：
#   1. 找到 gh（可能在 CherryStudio 的 mise 目录里，不在 PATH 上）
#   2. 没登录就带你登录
#   3. 推送

cd "$(dirname "$0")" || exit 1

clear
echo ""
echo "  探理实验室 · 推送到 GitHub"
echo "  ────────────────────────────────────────"
echo ""

REPO_URL="https://github.com/NikiTheBear/PhysQuest.git"

# ============================================================
# 1. 找 gh
# ============================================================

find_gh() {
  # ① 先看 PATH 里有没有
  if command -v gh >/dev/null 2>&1; then
    command -v gh
    return 0
  fi

  # ② 常见安装位置
  local candidates=(
    "/opt/homebrew/bin/gh"
    "/usr/local/bin/gh"
    "$HOME/.local/bin/gh"
    "$HOME/bin/gh"
    "/Users/frankzhang/Library/Application Support/CherryStudio/Toolchain/mise/shims/gh"
  )

  # ③ mise 装的一堆版本
  local mise_dir="/Users/frankzhang/Library/Application Support/CherryStudio/Toolchain/mise/installs/gh"
  if [ -d "$mise_dir" ]; then
    for d in "$mise_dir"/*/; do
      for sub in "$d"*/bin/gh; do
        [ -x "$sub" ] && candidates+=("$sub")
      done
    done
  fi

  for c in "${candidates[@]}"; do
    if [ -x "$c" ]; then
      echo "$c"
      return 0
    fi
  done

  return 1
}

GH="$(find_gh)"

if [ -z "$GH" ]; then
  echo "  ⚠ 没找到 GitHub 命令行工具 gh"
  echo ""
  echo "    两个选择："
  echo ""
  echo "    A. 装一下 gh（推荐，装完一劳永逸）："
  echo "         brew install gh"
  echo ""
  echo "    B. 不用 gh，直接输账号 + 令牌："
  echo "         往下看下面这段说明"
  echo ""
  echo "  ────────────────────────────────────────"
  echo ""
  echo "  用方式 B 的话，需要先在 GitHub 上生成一个 Personal Access Token："
  echo ""
  echo "    1. 打开 https://github.com/settings/tokens"
  echo "    2. Generate new token (classic)"
  echo "    3. Note 随便填，Expiration 选 90 days"
  echo "    4. 勾上 repo 这一项（其它的都不用）"
  echo "    5. Generate token，复制那一串 ghp_ 开头的"
  echo ""
  echo "  然后在这个窗口里直接跑："
  echo "     git push -u origin main"
  echo "  用户名填 NikiTheBear，密码粘贴刚才那串 token。"
  echo ""
  read -r -p "  按回车关掉…"
  exit 1
fi

echo "  ✓ 找到 gh：$GH"
echo ""

# ============================================================
# 2. 登录
# ============================================================

if ! "$GH" auth status >/dev/null 2>&1; then
  echo "  还没有登录 GitHub。现在开始，跟着提示走："
  echo ""
  echo "  ① 选 GitHub.com"
  echo "  ② 选 HTTPS"
  echo "  ③ Authenticate Git with your GitHub credentials? → Yes"
  echo "  ④ Login with a web browser"
  echo "  ⑤ 屏幕会给一个 8 位代码，按回车会自动开浏览器，粘进去授权"
  echo ""
  read -r -p "  准备好了按回车…"
  echo ""

  "$GH" auth login --hostname github.com --git-protocol https --web

  if ! "$GH" auth status >/dev/null 2>&1; then
    echo ""
    echo "  ✗ 登录没成功。重新双击这个文件再试一次。"
    echo ""
    read -r -p "  按回车关掉…"
    exit 1
  fi
  echo ""
fi

LOGIN="$("$GH" api user --jq .login 2>/dev/null)"
echo "  ✓ 已登录：$LOGIN"
echo ""

# 让 git 用 gh 的凭证
"$GH" auth setup-git 2>/dev/null

# ============================================================
# 3. 推送
# ============================================================

# 远程仓库如果已经有内容（比如建仓库时勾了 README），先拉下来合并
echo "  检查远程仓库状态…"
if git fetch origin main >/dev/null 2>&1; then
  REMOTE_COUNT=$(git rev-list --count origin/main 2>/dev/null || echo 0)
  LOCAL_COUNT=$(git rev-list --count HEAD)
  echo "  远程 $REMOTE_COUNT 次提交 / 本地 $LOCAL_COUNT 次提交"

  if [ "$REMOTE_COUNT" -gt 0 ] && ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    echo ""
    echo "  ⚠ 远程和本地历史不一致（可能是建仓库时勾了 README）"
    echo ""
    echo "    本地这 $LOCAL_COUNT 次提交要覆盖远程那个 Initial commit。"
    echo "    那个 commit 里只有一个空 README，覆盖掉没关系。"
    echo ""
  fi
fi

echo ""
echo "  正在推送…"
echo ""

if git push -u origin main --force; then
  echo ""
  echo "  ✓ 推送成功"
  echo "    $REPO_URL"
  echo ""
  echo "  下一步可以去仓库页面："
  echo "    · 填 About 里的描述和 topics"
  echo "    · Settings → Collaborators 邀请 B 和 C"
else
  echo ""
  echo "  ✗ 推送失败。把上面的报错发到群里。"
fi

echo ""
read -r -p "  按回车关掉…"
