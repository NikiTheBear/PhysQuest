# PhysQuest（探理实验室）基准版开发计划书（v1.0 Baseline）

> **文档说明**：本文档为开源全学段物理学习平台 **PhysQuest（探理实验室）** 的基准技术与产品规格书，可直接作为仓库根目录下的 `PLAN.md` / `ARCHITECTURE.md` 使用，并作为上下文规范投喂给 AI 编程助手（Agent）执行分模块开发。

---

## 1. 项目定位与核心设计原则

**PhysQuest（探理实验室）** 是一个覆盖**小学科学启蒙 → 初中概念探究 → 高中定量研究 → 大学/前沿物理**的开源交互式物理学习平台。平台打通**“全景导览 → 知识卡片学习 → 自主结果预测 → 双屏调参可视化 → 在线 AI 演示与评分 → 测验与查漏补缺 → 综合学习报告”**的完整探究闭环，并内置**实时交互 AI 助教**。

### 四条核心架构红线

1. **本地物理引擎驱动，可视化零幻觉**
   - 学生拖动滑块调节物理参数时，公式高亮、函数图像与右侧虚拟实验台上的器材位置、光线路径、电表读数，**100% 由本地确定性物理引擎（60fps）实时计算驱动**，确保物理规律绝对准确且零网络延迟。
2. **学生自带接口与密钥（BYOK），服务器零密钥存储**
   - 学生在前端设置面板填入自己的大模型端点（Endpoint URL）、模型名称与 API Key，**密钥仅保存在学生本地浏览器 `localStorage` 中，由浏览器直连目标 AI 接口**。
   - 自有后端服务器**严禁接收、转发或存储**任何用户的 API Key，既保证平台开源后的零 Token 运营成本，又彻底规避密钥泄露风险。
3. **能力分级清晰：基础实验离线可用，深度 AI 评测在线解锁**
   - **未配置 API Key（离线/基础模式）**：支持全景导览、知识卡片学习、双屏调参可视化、自主预测对比、本地知识库检索与基础练习题。
   - **连接学生自有在线 API（在线完整模式）**：解锁 **AI 实验评分、AI 按知识点生成可视化演示实验、实时 AI 助教深度答疑、智能错题查漏补缺诊断**。
4. **先检验、后出报告（Report Gate）**
   - 在生成最终学习报告前，学生必须通过**针对性测试题**检验本节知识掌握度，并结合 AI 的查漏补缺反馈写下**本人实验反思**，确保学习成果可量化、可追溯。

---

## 2. 核心功能模块与完整学习闭环

```text
[① 全景导览首页] ──▶ [② 学习知识点 / 知识卡片] ──▶ [③ 自主预测实验结果]
                                                              │
                                                              ▼
[⑥ 测验与 AI 查漏补缺] ◀── [⑤ 在线 AI 演示与实验评分] ◀── [④ 双屏调参 & 实时可视化]
         │                    (需连接学生自有 API)
         ▼
[⑦ 生成综合学习报告]   ◀═══════ 【全局常驻：实时交互 AI 答疑助手】 ═══════▶
```

### 2.1 全景导览首页（Hub View）
- **学段与难度切换器**：支持一键切换 `小学` / `初中` / `高中` / `大学` 四个学段及 `0 基础` / `进阶` 模式，动态过滤实验列表与知识卡片深度。
- **物理学科阶梯地图**：按力学、电学、光学、热学、近代物理划分实验卡片，展示实验目标、前置知识依赖与完成状态，点击直达对应实验台。
- **学情速览看板**：读取学生学情库，显示已完成实验数、待巩固薄弱知识点，支持一键跳转至薄弱点对应的实验或知识卡片。

### 2.2 学习知识点与知识卡片（Knowledge & Flashcards）
- 每个实验配备一组结构化**知识卡片**，支持翻页浏览与关键词检索：
  - **核心概念与生活类比**：用对应学段能理解的语言解释物理现象；
  - **核心公式与变量说明**：标注公式中每个符号的物理意义与单位；
  - **常见误区与反例警示**：直接点出学生最容易混淆的错误认知；
  - **前置知识链接**：标注学习本实验前需要掌握的低学段知识点。

### 2.3 双屏互动、调参数与可视化（Interactive Dual-View Lab）
- **左屏（公式与数据可视化区）**：
  - 展示动态物理公式（当学生拖动某个参数滑块时，公式中对应变量同步高亮）；
  - 提供参数滑块、快捷预设按钮与实时函数图像（如物距-像距曲线、功率-电阻曲线、效率-带隙曲线）。
- **右屏（虚拟实验器材台 `RigCanvas`）**：
  - 基于组件化器材库渲染可交互实验台（如光具座、蜡烛、透镜、光屏、电源、滑动变阻器、电表、光谱与电池结构示意）；
  - 参数改变时，实验台器材位置、动态光线、电表指针与能量流动效果实时同步变化。

### 2.4 学生自主预测实验结果（Student Prediction）
- 在开始自由调参或切换关键实验条件前，系统引导学生在**预测面板**填写预期结果（支持定量数值预测或定性趋势选择，如“像变大/变小”“功率先增后减”）。
- 提交预测后，系统锁定该预测记录；随后学生调参或运行实验，界面自动对比**“学生预测值 vs 物理引擎真实计算值”**，计算偏差并记入实验日志。

### 2.5 在线 AI 演示实验与实验评分（需连接学生自有 API）
当学生完成探索并锁定“最满意的实验参数与设计理由”后，点击**「提交实验并请求 AI 评测」**（仅在已配置有效在线 API 时激活完整功能）：

1. **AI 按知识点生成可视化演示实验（AI Visual Demonstration）**
   - AI 根据当前实验的知识点与学生暴露出的盲区，生成一套**结构化可视化演示剧本（`AIDemoSequence`）**。
   - 右侧虚拟实验台自动进入“演示播放模式”：按照知识点分步自动调节器材参数、高亮关键器材与光线/电流路径、弹出步骤讲解气泡（例如：“第一步：将物体移至 $2f$ 处观察等大实像；第二步：继续移近至 $f < u < 2f$ 观察像距变化……”），帮助学生用眼睛看懂因果规律。
2. **AI 实验评分与多维诊断（AI Rubric Grading）**
   - **客观物理分（本地引擎锁定）**：依据物理指标达成度与预测准确度由本地算法计算硬分，防止大模型算错数；
   - **推理与边界分（在线 AI 评判）**：AI 结合知识库标准，对学生的“参数选择合理性”“实验证据引用充分度”“模型适用边界意识”进行逐项打分，给出具体改进建议，并将识别出的误区标签写入学生学情库。

### 2.6 实时交互 AI 助手（Real-Time Interactive AI Tutor）
- **全局常驻侧边栏**：学生在浏览知识卡片、做预测、调参数或看演示的任何时刻，均可随时向右侧 AI 助手提问。
- **上下文自动感知**：每次发送问题时，前端自动将**当前实验状态（材料/参数/实时计算指标）+ 命中的知识卡片切片 + 学生历史错题画像**注入提示词，使 AI 能够结合学生眼前正在操作的画面进行针对性答疑，并支持下发白名单快捷操作按钮（如“点此将参数调至临界点观察”）。

### 2.7 报告前测试题目与 AI 查漏补缺（Pre-Report Quiz & Gap-Filling）
在正式生成学习报告**之前**，系统触发**学习成果检验关卡**：
1. **针对性测试题目**：系统从知识库题库中抽取（或由在线 AI 动态生成）3–5 道紧扣本实验核心知识点与常见误区的测试题（包含概念辨析、现象预测与边界判断）。
2. **AI 查漏补缺诊断**：
   - 学生提交答案后，系统自动批改并更新学情库中的知识点掌握度；
   - 若发现某题答错或命中预设误区标签，在线 AI 立即启动**查漏补缺**：指出错误根源，并沿着知识库的**前置依赖图谱**溯源（例如发现高中电路功率题出错是因为初中串联分压未掌握），精准推送对应的前置知识卡片或 2 分钟微实验供学生补救。

### 2.8 综合学习报告生成（Learning Report Generation）
通过测试检验并填写**学生本人反思结论**后，系统一键汇总生成结构化学习报告，支持在线预览与导出（`.md` / `.txt`）：
- **基本信息与模型声明**：实验名称、学段级别、理想化物理模型假设边界；
- **实验探索与预测对照表**：历次调参记录、事前预测值 vs 物理引擎真实值及偏差分析；
- **AI 演示与评分详情**：各维度得分明细、AI 演示的关键知识点回顾与评语；
- **测试题与查漏补缺记录**：测验正确率、识别出的薄弱知识点与补救建议；
- **学生本人总结反思**：完整保留学生手写的实验结论（系统禁止 AI 代写此栏）。

---

## 3. 双数据库架构设计

自有后端服务器（Node.js + SQLite/PostgreSQL）与客户端（IndexedDB）协同维护两套核心数据库，**不存储任何用户的 API Key**：

### 3.1 数据库 A：物理知识库与题库（Knowledge & Quiz DB）
采用**“仓库内结构化 JSON 源文件 + 后端版本分发 + 客户端本地检索缓存”**架构，同时服务离线检索与在线 AI 开卷注入（RAG）：

```json
{
  "knowledgeId": "optics_convex_imaging",
  "labId": "optics-lens",
  "stage": "junior",
  "title": "凸透镜成像规律与物距焦距关系",
  "prerequisites": ["optics_light_straight_line", "optics_refraction_basic"],
  "cards": [
    {
      "cardId": "card_01",
      "heading": "一倍焦距分虚实，二倍焦距分大小",
      "content": "当物距 u > 2f 时，在光屏上成倒立、缩小的实像；当 f < u < 2f 时，成倒立、放大的实像；当 u < f 时，光屏无法承接，透过透镜看到正立、放大的虚像。",
      "formula": "1/f = 1/u + 1/v",
      "intuition": "物体越靠近焦点（在实像区内），折射光线越难会聚，光屏必须往更远处移，像也随之拉大。"
    }
  ],
  "misconceptions": [
    {
      "tag": "lens_closer_always_bigger_real",
      "description": "误以为物体越靠近凸透镜，光屏上的像就一直越大。",
      "remediation": "当物距小于一倍焦距 f 时，折射光线发散，光屏上不再成像，而是变为正立放大的虚像。"
    }
  ],
  "quizBank": [
    {
      "id": "q_lens_01",
      "type": "single_choice",
      "question": "某凸透镜焦距 f = 10 cm，将点燃的蜡烛放在距透镜 8 cm 处，移动光屏会看到什么？",
      "options": ["倒立放大的实像", "正立放大的虚像", "光屏上始终找不到清晰的像"],
      "answerIndex": 2,
      "knowledgeTag": "lens_closer_always_bigger_real",
      "explanation": "u = 8 cm < f = 10 cm，成虚像，虚像不能呈现在光屏上。"
    }
  ]
}
```

### 3.2 数据库 B：学生学情与错题库（Learner State DB）
支持通过**匿名同步码（Sync Code）**跨设备同步学习进度，记录完整探索轨迹以支撑 AI 个性化教学：

```prisma
// apps/server/prisma/schema.prisma
// 安全红线：严禁在此数据库中存储任何用户的 LLM API Key

model Learner {
  id             String               @id @default(cuid())
  syncCode       String               @unique // 匿名学习同步码，免注册即可跨设备同步
  stage          String               @default("junior")
  level          String               @default("beginner")
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  experiments    ExperimentRecord[]
  mastery        KnowledgeMastery[]
  misconceptions MisconceptionLog[]
  reports        FinalReport[]
}

model ExperimentRecord {
  id             String   @id @default(cuid())
  learnerId      String
  learner        Learner  @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  labId          String
  predictionJson String?  // 学生事前预测记录
  finalParams    String   // 学生锁定的最满意参数
  engineMetrics  String   // 本地物理引擎计算的真实结果
  designReason   String   // 学生填写的设计理由
  aiDemoScript   String?  // AI 生成的可视化演示步骤 JSON
  aiScoreJson    String?  // AI 评分明细（仅在线 API 模式生成）
  quizResultJson String?  // 报告前测验题作答记录
  createdAt      DateTime @default(now())
}

model KnowledgeMastery {
  id          String   @id @default(cuid())
  learnerId   String
  learner     Learner  @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  knowledgeId String
  mastery     Int      @default(50) // 0-100 掌握度评分
  updatedAt   DateTime @updatedAt

  @@unique([learnerId, knowledgeId])
}

model MisconceptionLog {
  id          String   @id @default(cuid())
  learnerId   String
  learner     Learner  @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  tag         String   // 关联知识库 misconceptions[].tag
  labId       String
  hitCount    Int      @default(1)
  resolved    Boolean  @default(false)
  lastSeenAt  DateTime @updatedAt

  @@unique([learnerId, tag])
}

model FinalReport {
  id                String   @id @default(cuid())
  learnerId         String
  learner           Learner  @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  labId             String
  studentReflection String   // 学生本人填写的结论与反思
  reportMarkdown    String   // 完整生成的学习报告快照
  createdAt         DateTime @default(now())
}
```

---

## 4. 仓库目录结构与核心代码契约

### 4.1 标准目录结构

```text
PhysQuest/
├── apps/
│   ├── web/                          # 前端应用 (Vite + React + TypeScript)
│   │   ├── src/
│   │   │   ├── core/                 # 核心接口契约与探究状态机
│   │   │   │   ├── contracts.ts      # 实验插件、AI 演示指令、评分与报告类型定义
│   │   │   │   └── inquiry-flow.ts   # 状态流转：导览 -> 卡片 -> 预测 -> 实验 -> AI评/演 -> 测验 -> 报告
│   │   │   ├── components/
│   │   │   │   ├── hub/              # 第一页：全景导览首页与学情看板
│   │   │   │   ├── knowledge-cards/  # 知识卡片阅读器与前置知识跳转
│   │   │   │   ├── lab-workspace/    # 双屏实验台（左：公式曲线+预测；右：器材渲染+AI演示播放器）
│   │   │   │   ├── rigs/             # 通用虚拟器材组件库（光学/电学/半导体等）
│   │   │   │   ├── quiz-modal/       # 报告前测试题与 AI 查漏补缺面板
│   │   │   │   ├── report-view/      # 综合学习报告预览与导出
│   │   │   │   └── ai-tutor/         # 常驻实时交互 AI 助手与 BYOK API 设置弹窗
│   │   │   ├── db/                   # 本地 IndexedDB 缓存、知识库检索与后端同步
│   │   │   ├── ai/                   # BYOK 直连客户端（JSON Schema 输出解析）与演示脚本播放器
│   │   │   └── labs/                 # 可插拔物理实验模块
│   │   │       ├── optics-lens/      # [小学/初中] 凸透镜成像规律
│   │   │       ├── circuits-ohm/     # [高中] 闭合电路欧姆定律与最大输出功率
│   │   │       └── pv-sq-limit/      # [大学] 太阳能电池与 S-Q 辐射极限
│   └── server/                       # 自有后端服务 (Node.js + Hono + Prisma)
│       ├── prisma/schema.prisma
│       └── src/routes/               # 知识库分发与匿名同步码学情同步 API
├── shared/
│   └── knowledge-data/               # 结构化物理知识卡片、误区标签与测验题库 (JSON)
├── tests/                            # 物理计算数值断言 & 知识库依赖图校验 (Vitest)
├── docker-compose.yml                # 自有服务器一键部署脚本
└── PLAN.md                           # 本基准计划书
```

### 4.2 核心 TypeScript 接口契约（`apps/web/src/core/contracts.ts`）

```typescript
export type Stage = 'primary' | 'junior' | 'senior' | 'university';

/** 1. 实验插件标准接口 */
export interface LabPlugin {
  id: string;
  title: string;
  discipline: 'mechanics' | 'electromagnetism' | 'optics' | 'thermodynamics' | 'modern';
  stages: Stage[];
  knowledgeIds: string[];
  modelAssumptions: string[];
  solve(params: Record<string, number | string>): {
    metrics: Record<string, number>;
    rigState: Record<string, unknown>;
    summaryText: string;
  };
}

/** 2. AI 按知识点生成的“可视化演示实验”剧本 */
export interface AIDemoStep {
  stepIndex: number;
  knowledgePoint: string;              // 本步演示对应的核心知识点
  narration: string;                   // 演示气泡讲解文案
  targetParams: Record<string, number>;// 自动驱动实验台调整到的目标参数
  highlightRigIds: string[];           // 实验台上需要高亮的器材组件 ID
  durationMs: number;                  // 本步停留观察时长
}

/** 3. 在线 AI 实验评测与演示返回结构（需学生配置自有 API） */
export interface OnlineAIEvaluation {
  demoSequence: {
    title: string;
    steps: AIDemoStep[];               // 由右侧虚拟实验台逐步播放可视化演示
  };
  scores: {
    physicsObjectiveScore: number;     // 0-35（由本地物理引擎计算锁定）
    reasoningScore: number;            // 0-25（论证与因果解释）
    evidenceScore: number;             // 0-25（是否引用了实验观测与预测对比）
    boundaryScore: number;             // 0-15（模型适用边界意识）
    totalScore: number;                // 0-100（边界拒答场景下为 null）
    isBoundaryCase: boolean;
    verdict: string;
  };
  detectedMisconceptionTags: string[]; // 写入学情库错题本
  tutorFeedback: string;
}

/** 4. 报告前测试题与 AI 查漏补缺结果 */
export interface QuizAndGapAnalysis {
  score: number;
  wrongKnowledgeIds: string[];
  aiGapDiagnosis: string;              // AI 针对错题的个性化诊断
  recommendedPrerequisite?: {
    knowledgeId: string;
    labId: string;
    reason: string;
  };
}
```

---

## 5. 首批三阶实验规划（从基础到大学）

| 学段层级 | 实验名称（`labId`） | 知识卡片与测验重点 | 双屏可视化与 AI 演示机制 |
| :--- | :--- | :--- | :--- |
| **小学 / 初中** | **凸透镜成像规律**<br>(`optics-lens`) | 一倍焦距分虚实、二倍焦距分大小、光屏承接实像条件 | 左屏实时显示成像公式与物距/像距曲线；右屏光具座实时折射三条特殊光线。AI 演示时自动将蜡烛推过 $2f$、$f$ 临界点并高亮虚像延长线 |
| **高中** | **闭合电路欧姆定律与最大输出功率**<br>(`circuits-ohm`) | 路端电压随外阻变化、$R=r$ 时输出功率最大但效率为 50% | 左屏实时绘制 $P_{\text{out}}\text{–}R$ 曲线与效率曲线；右屏电路图电表指针实时偏转。AI 演示时自动对比 $R=r$ 与 $R=5r$ 两种工况的功率与效率差异 |
| **大学 / 前沿** | **太阳能电池与 S–Q 辐射极限**<br>(`pv-sq-limit`) | 光子能量阈值 $E \ge E_g$、透射与热化损失权衡、黑体模型边界 | 左屏实时求解详细平衡积分并绘制 $\eta\text{–}E_g$ 与 $J\text{–}V$ 曲线；右屏太阳光谱图实时填充透射、热化与有效电能面积，保留室内弱光边界拒答机制 |

---

## 6. 分阶段开发实施路线图

- **阶段一：基础框架与核心契约搭建**
  - 初始化前后端工程结构，落地 `contracts.ts` 与 Prisma 双数据库表结构；
  - 完成**全景导览首页**与**知识卡片阅读组件**，建立跨学段前置知识图谱校验。
- **阶段二：双屏实验室与三阶物理引擎开发**
  - 实现通用虚拟器材渲染器 `RigCanvas`、参数滑块联动与**学生事前预测对比模块**；
  - 完成《凸透镜成像》《闭合电路欧姆定律》与《太阳能电池 S–Q 极限》三个实验的物理求解器与可视化界面。
- **阶段三：BYOK 在线 AI 闭环与学情同步**
  - 接入前端自定义 Endpoint / API Key 配置（纯本地存储）与**实时交互 AI 答疑助手**；
  - 打通**“提交满意实验 → AI 按知识点播放可视化演示实验 + 多维评分 → 报告前测试题与 AI 查漏补缺 → 写入学情库 → 生成综合学习报告”**全链路，并完善离线降级兜底逻辑。
- **阶段四：开源发布与教学验证**
  - 编写中英文 `README.md`、一键 `docker-compose.yml` 部署配置与新实验接入指南，发布至 GitHub 并开展多学段学生实测迭代。