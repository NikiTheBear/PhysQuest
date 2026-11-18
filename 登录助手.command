#!/bin/bash
# 只做一件事：登录 GitHub
# 双击 → 按提示选几下 → 粘一个 8 位代码 → 完事

cd "$(dirname "$0")" || exit 1
clear

echo ""
echo "  GitHub 登录助手"
echo "  ────────────────────────────────────────"
echo ""

GH="/Users/frankzhang/Library/Application Support/CherryStudio/Toolchain/mise/installs/gh/2.103.3/gh_2.103.3_macOS_arm64/bin/gh"

if [ ! -x "$GH" ]; then
  echo "  ✗ 找不到 gh。先用 brew install gh 装一下。"
  echo ""
  read -r -p "  按回车关掉…"
  exit 1
fi

echo "  接下来会问你四件事，这样选："
echo ""
echo "    ① What account do you want to log into?"
echo "         → 选 GitHub.com"
echo ""
echo "    ② What is your preferred protocol for Git operations?"
echo "         → 选 HTTPS"
echo ""
echo "    ③ Authenticate Git with your GitHub credentials?"
echo "         → 选 Yes"
echo ""
echo "    ④ How would you like to authenticate GitHub CLI?"
echo "         → 选 Login with a web browser"
echo ""
echo "  然后屏幕会给一个 8 位代码（像 A1B2-C3D4）。"
echo "  按下回车会自动打开浏览器，把代码粘进去，点 Authorize。"
echo ""
read -r -p "  准备好了就按回车…"

echo ""

# 关键：用干净的环境跑，绕开 CherryStudio 的 mise
env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" TERM="$TERM" \
  "$GH" auth login --hostname github.com --git-protocol https --web

echo ""
if env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin" "$GH" auth status >/dev/null 2>&1; then
  echo "  ✓ 登录成功！"
  echo ""
  echo "    现在双击 push-to-github.command 就能推送了。"
else
  echo "  ✗ 还是没登录成功。"
  echo ""
  echo "    可能的原因：浏览器里那一步没点完，或者代码过期了（它只有几分钟有效期）。"
  echo "    再双击这个文件试一次就行。"
fi

echo ""
read -r -p "  按回车关掉…"
