# PhysQuest Experiment v1

扩展名：`.pqexp.json`。编码：UTF-8 JSON。`format` 固定为 `physquest.experiment`，`version` 固定为 `1`。JSON 为数据，不执行脚本或表达式。

```json
{
  "format": "physquest.experiment",
  "version": 1,
  "metadata": {"title": "实验标题", "description": "说明"},
  "experiment": {
    "id": "local-experiment",
    "title": "实验标题",
    "goal": "你的探索目标",
    "mode": "2d",
    "environment": {"gravity": 9.81, "damping": 0.02, "speed": 1, "collisions": true},
    "components": [],
    "connections": [],
    "control": {"running": false, "reset": 0}
  }
}
```

`experiment` 是唯一运行配置；`metadata` 是便于阅读的摘要，导出时从当前配置生成。原版文件在 `experiment.learning` 保留完整题目、提示、预测、知识点、参考条件，在 `experiment.source` 保留项目与提交来源。`learning` 不强制评分、不锁定编辑。组件字段：`id`、`kind`、`name`、`position: [x,y,z]`、`params`、`refs`、`fixed`；可选 `appearance.color`。`kind` 与参数范围以 `list_instruments` 返回值为准。

原版 5 个实验均包含 `lens_bench` 光具座。物距 `u`、焦距 `f`、物高 `h`、光屏 `screenX`、口径 `lensDiameter` 使用 cm；`maskTop` 为 0/1，`objectShape` 为 0 箭头、1 字母 F、2 蜡烛。计算沿用 PhysQuest 原始薄透镜模型；图形是光具座内部示意，不是外部场景的米制尺寸。光具座整体位置由 `position` 控制。内部光学独立于其他激光/透镜器具。

载入会验证参数、重新生成所有空间/器具/连接 ID、重映射机械端点及导线引用、暂停仿真。载入总是新建副本，唯一例外是首次自动载入替换从未编辑的初始空白空间。旧版 Fieldlab 裸配置 JSON 仍可导入。每文件最多 500 KB、64 个器具、128 个连接；最多保留 30 个空间。

MCP / DeepSeek 使用同一套操作：

- `list_experiment_files()`：列出原版文件。
- `load_experiment_file({fileId:"CH-O2-02"})`：立即载入一个可编辑副本。
- `import_experiment({file: ...})`：载入完整文件对象。
- `export_experiment({experimentId: ...})`：返回当前配置的文件对象，可保存到磁盘。
- `update_component` 修改器具；`update_experiment` 修改标题、目标、模式、环境及 `learning`。

新空间没有任何编辑限制，其他领域器具可以继续加入。人通过“实验文件”“导入”“导出实验”使用相同格式；原版 JSON 下载地址为 `/experiments/CH-O2-01.pqexp.json` 至 `CH-O2-05.pqexp.json`。

器具可选 `collider` 字段保存机械碰撞范围：`{ "enabled": true, "shape": "box", "size": [1, 1, 1], "offset": [0, 0, 0] }`。size 为完整宽高深（0.02–60 m），offset 为局部中心偏移（每轴 ±30 m）；shape 也可为 auto（沿用器具几何）。省略字段时保留原有碰撞行为。
