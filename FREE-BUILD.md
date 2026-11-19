# PhysQuest 自由探索版

保留 PhysQuest 知识地图和知识卡，将原来的关卡式实验台替换为 Fieldlab 的自由搭建平台。

双击根目录 `start.command`，或运行 `node scripts/run-platform.mjs`。需要 Node.js 22+，平台源码已包含在仓库的 `platform/` 文件夹；启动器会同步网页源代码、构建并在 http://127.0.0.1:4317 启动。首次缺少依赖时自动安装。

首次进入会自动载入第一个原版实验；已有空间恢复上次编辑内容。实验文件按钮提供原版 5 个实验的 JSON 下载与载入，点击会生成独立副本。新建空间仍可从空白开始。

格式：`physquest.experiment`、版本 `1`、扩展名 `.pqexp.json`。文件包含器具、参数、连接、目标、原版题目和来源。人通过工作台编辑，AI 通过 MCP 或内置 DeepSeek 编辑同一份数据。文件和格式说明见`platform/experiments/`。

凸透镜原实验以「凸透镜光具座」器具载入，保持原版计算模型和 cm 参数。光具座内的物体、透镜、光屏通过参数调整；整体通过 X/Y/Z 移动。图形为示意，光具座独立求解，不和外部激光器混合追迹。

全部 140 个规划知识点提供可编辑搭建提示词。知识地图中点击条目可查看、修改、复制或下载，再用 DeepSeek 调用 MCP 工具创建新空间、制作和放置器具并验证。没有 Key 时会先打开配置面板；提示词分别标明可计算、近似 / 类比和概念示意，不将未实现的物理求解器冒充为已支持。完整内容源在`platform/prompts/entries.json`，生成后在 `shared/knowledge-data/knowledge-prompts.json`；MCP 提供 `list_knowledge_prompts` 与 `get_knowledge_prompt`。

原项目 MIT 许可保留于 LICENSE。Fieldlab 引擎、工具服务、构建脚本和测试均包含在 platform/ 中。

## 实时交互与碰撞范围

工作台支持滑块拖动实时预览，结束操作后统一保存；2D/3D 可以显示碰撞线框，并编辑尺寸、局部中心和启用状态。运行时使用同一碰撞几何体处理阻挡。碰撞配置保留在实验文件、自定义器具和 MCP 操作中。右侧聊天栏可直接给 DeepSeek 发消息，消息气泡独立滚动、输入框固定在底部，可切换器具属性并保留草稿和对话；Key 仍只保留当前页面会话。
