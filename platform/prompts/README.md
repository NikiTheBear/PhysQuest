# 知识点实验搭建提示词

覆盖 `PLATFORM-MAP.json` 中全部 140 个 `planned` 知识点。`entries.json` 为逐条撰写的内容源；`node scripts/build-knowledge-prompts.mjs` 验证覆盖率、器具类型和长度，然后生成 `physquest/shared/knowledge-data/knowledge-prompts.json`。`npm run build` 会自动运行生成器。

每条包含知识点 ID、学段、领域、目标、搭建方案、变量、观测量、模型边界和完整提示词。界面允许修改草稿、复制、下载单个 `.prompt.txt`，或从 `/prompts/knowledge-prompts.json` 下载全部。草稿存储在本浏览器中，原始内容不变。

- `direct`：用现有求解器计算对应的教学模型。
- `approximation`：近似或类比，必须解释变量映射和无法计算的效应。
- `conceptual`：只做概念结构示意，不提供该理论的数值仿真。特别是量子、核、完整流体等不能以经典小球或无关电路结果代替。

知识地图 → 点击条目 → 编辑提示词 → “用 DeepSeek 搭建”。已有会话 Key 时立即调用；没有 Key 时只预填任务，填写后点击“开始搭建新空间”。Key 不写入草稿或实验文件。每次创建独立空间，保留原有实验；失败时整轮不提交，成功后可整体撤销。点击不会批量生成 140 个实验，也不会预先消耗 API 额度。

DeepSeek 的 Tool Calls 使用本站 MCP 的同名工具定义和共同执行器，在服务内完成调用适配，无需另外配置外部 MCP URL。新增 MCP 工具：

- `list_knowledge_prompts({query,domain,stage,support,offset,limit})`：筛选、分页查询，默认 25 条，最多 50 条。
- `get_knowledge_prompt({knowledgeId})`：返回完整提示词。

知识点搭建任务要求模型真实创建空间、放入器具并调用 `simulate_experiment` 验证最终配置；仅返回文字不算成功。验证是配置/支持模型的数值检查，不代表概念示意成为真实理论仿真。提示词、模型级别和限制会存入实验的 `learning.knowledgePrompt`，随 `.pqexp.json` 导出，继续供人和 AI 编辑。

供应商工具调用依据：[DeepSeek Tool Calls 文档](https://api-docs.deepseek.com/guides/tool_calls/)。物理内容来源见 `SOURCES.md`。
