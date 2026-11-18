#!/bin/bash
# 一键推送到 GitHub
# 用法：双击这个文件，或者在终端里 ./push-to-github.command

cd "$(dirname "$0")" || exit 1
echo ""
echo "  探理实验室 · 推送到 GitHub"
echo "  ────────────────────────────────────────"
echo ""

# 1) 检查有没有登录
if ! gh auth status >/dev/null 2>&1; then
  echo "  还没有登录 GitHub。现在开始登录，跟着提示走："
  echo ""
  rm -rf .git/gh-noop 2>/dev/null
  gh auth login --git-protocol https --web
  if ! gh auth status >/dev/null 2>&1; then
    echo ""
    echo "  ✗ 登录没成功。重新双击这个文件再试一次。"
    echo ""
    read -r -p "  按回车关掉…"
    exit 1
  fi
  echo ""
fi

echo "  ✓ 已登录：$(gh api user --jq .login 2>/dev/null)"
echo ""

# 2) 让 git 用 gh 的凭证
gh auth setup-git 2>/dev/null

# 3) 推送
echo "  正在推送…"
echo ""
if git push -u origin main --force; then
  echo ""
  echo "  ✓ 推送成功"
  echo "    https://github.com/NikiTheBear/PhysQuest"
else
  echo ""
  echo "  ✗ 推送失败。把上面的报错发到群里。"
fi

echo ""
read -r -p "  按回车关掉…"
