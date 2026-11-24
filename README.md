# 探理实验室 · PhysQuest

[![预检](https://github.com/Wave-to-Say-HI/PhysQuest/actions/workflows/preflight.yml/badge.svg)](https://github.com/Wave-to-Say-HI/PhysQuest/actions/workflows/preflight.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[English](./README.en.md) · **在线版** → https://wave-to-say-hi.github.io/PhysQuest/

![知识地图](docs/screenshots/01-map.png)

---

一个开源的物理探究平台，从小学的「光走直线」一直排到大学的「ABCD 矩阵」。

核心设计只有一条：**先猜，再做，被推翻，然后想明白。**

学生拖动滑块之前，得先写下一个答案，写完就锁死，改不了。猜错的那一下，他记一辈子。
这个环节跟 AI 完全无关——断网、没配 Key、U 盘拷走，照样能用。

---

## 三个反直觉的地方

模拟器应该让学生「咦？」一下。我们做了三个，都是学生百分百会猜错的：

| 做法 | 学生以为 | 实际 |
|---|---|---|
| 遮住透镜上半部分 | 像只剩一半 | **像完整，只是变暗** |
| 把物体放在焦点上 | 成一个巨大的像 | **不成像**，出射光平行 |
| 把物体放进焦距内 | 光屏上能接到像 | **永远接不到**，但眼睛能看到 |

![遮住透镜一半](docs/screenshots/04-mask.png)

---

## 现在有什么

| | 数量 |
|---|---|
| 知识点 | 176（六个领域 × 四个学段） |
| 双面知识卡 | 176（正面读，背面教你怎么搭） |
| 挑战 | 133 |
| 题库 | 1609 道，每题都有逐项解析 |
| 常见误区 | 46 条 |
| 公式实验室 | 97 条 |
| 器具 | 53 种 |
| 测试 | 310 条前端 + 168 条平台 + 52 条物理断言 |

### 五个模块

| 模块 | 知识点 | 有挑战 | 一句话 |
|---|---|---|---|
| 光学 | 32 | 26 | 从针孔成像到 ABCD 矩阵 |
| 力与运动 | 41 | 35 | 从推小车到粘滞流体 |
| 电路与电流 | 42 | 33 | 从电路通断到自感、电动机 |
| 声与波 | 15 | 15 | 点声源、干涉、指向性 |
| 热学 | 26 | 26 | 温度计、热源、导热棒 |

**176 个知识点里有 135 个能动手做实验。** 剩下 41 条（近代 20 条 + 缺器具的 21 条）只有卡片和题，
每条都写清了「为什么平台做不出来」——我们不把示意图说成能算。

---

## 一次完整的学习

1. **知识地图** —— 选一个模块，或者直接翻知识点卡片
2. **挑战导览** —— 一个模块拆成几十个小挑战，每个只问一件事
3. **先猜** —— 只有一句问题和一个输入框，猜完锁死
4. **进实验台** —— 拖滑块、挪光屏、换透镜，看着光路实时变
5. **我满意了** —— 打星，写一句为什么选这组参数
6. **锁定这组参数** —— 记进探索记录。**不强制做题**，想去才去
7. **题库** —— 自己挑知识点，每个从简单做到困难
8. **写反思** —— 至少 10 个字，AI 不能代写
9. **生成报告** —— 导出 .md，能带走

---

## 跑起来

### 只想用

```bash
cd apps/web && npm install && npm run build
cd ../launcher && node src/server.mjs
```

或者双击 `apps/launcher/start.command`。浏览器会打开 `http://127.0.0.1:8787`。

实验台是另一个服务，另开一个终端：

```bash
node scripts/run-platform.mjs
```

启动器会把实验台反向代理到同一个地址，所以你只需要开一个页面。
详见 [`docs/LAUNCHER.md`](./docs/LAUNCHER.md)。

**为什么要有启动器？** 浏览器的跨域限制不让网页直接调大模型接口。
它只监听 `127.0.0.1`，跑在你自己电脑上——不是我们的服务器。

### 开发

```bash
cd apps/web
npm run dev        # → http://localhost:5180
npm test           # 310 条前端测试
```

### 校验

```bash
node shared/knowledge-data/schema/validate.mjs   # 内容完整性
cd platform && npm test                          # 168 条平台测试
```

### 重新生成内容

```bash
node scripts/gen-knowledge-cards.mjs   # 176 张知识卡
node scripts/gen-challenges.mjs        # 挑战和实验文件
node scripts/gen-experiment-index.mjs  # 哪些挑战有实验文件（网页层要用）
```

---

## 架构

四句话：

1. **物理由本地引擎算，AI 只解释。** 滑块拖到哪，结果就是哪。
2. **实验室是纯参数驱动的渲染器。** 给一组数字，画一张图，没有内部状态。
3. **没有服务器。** 学习记录存浏览器，密钥存浏览器，零后端 = 零学生数据风险。
4. **内容是数据，不是代码。** 176 条知识点、176 张卡、1609 道题全是 JSON。

```
网页层（React）
    │  params
    ▼
实验台（Fieldlab：纯 JS 求解器 + 工作台）
    │  import
    ▲
物理引擎（纯函数，52 条断言）
    ▲
    │  读取
内容层（shared/knowledge-data/ 的 JSON）
```

### 分学段 = 换交互深度

| 学段 | 知识点 | 交互 |
|---|---|---|
| 小学 | 29 | 看得见的现象，不出现公式符号 |
| 初中 | 59 | 光具座、刻度、手动对焦 |
| 高中 | 54 | 公式面板、曲线、作图网格 |
| 大学 | 34 | 模型边界、近似条件、矩阵方法 |

---

## 分工

三个人一起做的。数字是代码行数 + 内容条目数折算的承担量。

| | GitHub | 主要做了什么 | 占比 |
|---|---|---|---|
| **A** | [@NikiTheBear](https://github.com/NikiTheBear) | 网页主体（五个页面 / 23 个组件 / 29,554 行）、物理引擎、**176 张知识卡文案**、**1609 道题**、**176 条 AI 提示词**、本地启动器、CI 部署、中英文档 | 40% |
| **B** | [@FCZ19](https://github.com/FCZ19) | Fieldlab 平台（17,502 行）：物理求解器、**47 种器具**、**25 个 MCP 工具**、全屏工作台、133 条测试 | 34% |
| **C** | [@yoyosiqidai-cpu](https://github.com/yoyosiqidai-cpu) | **97 条公式实验室定义**、**46 条误区库**、**190 道手写题**、30+ 个手写实验、UI 打磨、老师手册 4 篇 | 26% |

> A 后来补了 6 种器具（热学 3 + 光学 3），所以器具总数是 53 种。

### 一个文件只有一个主人

| 范围 | 主人 |
|---|---|
| `apps/web/src/**`、`scripts/**`、`apps/launcher/**`、`.github/**` | A |
| `platform/**`（求解器、工作台、器具库、MCP 工具、测试） | B |
| `shared/knowledge-data/card-text/**`、`card-detail/**`、`question-bank.ts` | A |
| `platform/experiments/*.pqexp.json`、`docs/handbook/**` | C |

---

## 路线图

| | 内容 | 状态 |
|---|---|---|
| M1 | 物理引擎 + 双屏实验台 | ✅ |
| M2 | 完整学习闭环（导览→卡片→预测→实验→测验→报告） | ✅ |
| M2.5 | Fieldlab 并入 + 166 张知识卡 | ✅ |
| M2.6 | 题库可选知识点 + 逐项解析 + 知识卡加厚 | ✅ |
| M2.7 | 光学扩成完整领域 + 176 张卡背面补全 | ✅ |
| M3.1 | 公式实验室（97 条） | ✅ |
| M3.2 | AI 实验评分（本地三维度 + AI 评语） | ✅ |
| M3.3 | 学习记录导出 / 导入 | ✅ |
| M3.4 | 热学成为第五个模块 | ✅ |
| M3.5 | 演示剧本播放器 | ✅ |
| M4 | 近代 20 条的量子示意器具 | ⬜ |
| M5 | 离线单文件版 | ⬜ |

---

## 一条硬红线

**我们永远不会写一行能接收学生 API Key 的服务端代码。**

密钥只存在学生自己的浏览器里；本地启动器只监听 `127.0.0.1`，不写日志、不落盘。
代码里任何「官方中转地址」都算 bug。

---

## 文档

| 文件 | 内容 |
|---|---|
| [`docs/STUDENT-FLOW.md`](./docs/STUDENT-FLOW.md) | 学生从打开网页到导出报告的九步 |
| [`docs/LAUNCHER.md`](./docs/LAUNCHER.md) | 本地启动器：为什么需要、怎么用 |
| [`docs/DELIVERY-TEST.md`](./docs/DELIVERY-TEST.md) | 交付测试清单：10 类场景 |
| [`docs/handbook/`](./docs/handbook/) | 老师手册：五分钟上手 / 一节课怎么安排 / 常见问题 / 接 AI |
| [`platform/experiments/FORMAT.md`](./platform/experiments/FORMAT.md) | 实验文件格式（`.pqexp.json`） |

---

## 授权

[MIT](./LICENSE)
