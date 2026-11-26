#!/bin/bash
# 探理实验室 · 一键调用 DeepSeek 批量生成题库和评分标准（macOS）
# 双击即可运行；支持中途关闭窗口，下次双击自动断点续跑。

cd "$(dirname "$0")" || exit 1
clear

echo ""
echo "  🤖 探理实验室 · DeepSeek 批量生产流水线"
echo "  ────────────────────────────────────────"
echo ""

# 自动查找 Node.js
NODE=""
for p in "$(command -v node 2>/dev/null)" \
         "/opt/homebrew/bin/node" \
         "/usr/local/bin/node" \
         "$HOME/.volta/bin/node"; do
  if [ -n "$p" ] && [ -x "$p" ]; then NODE="$p"; break; fi
done

if [ -z "$NODE" ]; then
  echo "  ✗ 找不到 Node.js，请先安装 Node 22+。"
  read -r -p "  按回车关闭…"
  exit 1
fi

export LLM_CONCURRENCY=3

echo "  第 1 步 / 共 2 步：批量生成原创物理题库（176 个知识点）"
echo "  （每完成 1 条会自动保存，随时可 Ctrl+C 暂停，下次双击自动续跑）"
echo ""
"$NODE" scripts/deepseek-content-pipeline.mjs questions

echo ""
echo "  第 2 步 / 共 2 步：批量起草实验评分标准（Rubric）"
echo ""
"$NODE" scripts/deepseek-content-pipeline.mjs rubrics

echo ""
echo "  ✓ 全部任务已结束！"
echo "  生成结果保存在："
echo "    scripts/.tmp/generated-questions.json"
echo "    scripts/.tmp/generated-rubrics.json"
echo ""
read -r -p "  按回车关闭窗口…"
