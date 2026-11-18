# 贡献指南

> 三个人一起做，最重要的一件事是：**别互相踩**。
> 这份文档说明每个人管哪些文件、怎么提交、什么绝对不能进仓库。

---

## 一、谁能改哪些文件

**一个文件只有一个主人。** 想改别人的文件，先说一声，别直接改。

| 范围 | 主人 | 具体文件 |
|---|---|---|
| **网页主体** | @NikiTheBear | `apps/web/src/App.tsx`<br>`apps/web/src/components/**`（除 ai-tutor）<br>`apps/web/src/core/**`<br>`apps/web/src/data/**`<br>`apps/web/src/styles.css` |
| **物理引擎** | @NikiTheBear | `apps/web/src/labs/optics-lens/engine.ts`<br>`apps/web/src/labs/optics-lens/engine.test.ts` |
| **实验室渲染** | **B** | `apps/web/src/labs/optics-lens/LabStage.tsx`<br>`apps/web/src/labs/optics-lens/rig/**`<br>`apps/web/src/ai/demo/**`<br>`shared/knowledge-data/optics-lens/demo-scripts.json` |
| **内容** | **C** | `shared/knowledge-data/optics-lens/knowledge.json`（只填 `analogy` / `why`）<br>`shared/knowledge-data/optics-lens/quiz.json`<br>`docs/handbook/**` |
| **启动器 / 部署 / 文档** | @NikiTheBear | `apps/launcher/**`<br>`README.md`、`PLAN.md`、`docs/*.md`（除 handbook） |

### 关于物理引擎

`engine.ts` 有 12 条测试锁着。**发现算错了不要自己改，告诉 @NikiTheBear。**

改引擎的唯一方式是：先在 `engine.test.ts` 里写一条新的断言（证明现在算错了），再改 `engine.ts` 让它通过。

---

## 二、绝对不能提交的东西

| ❌ 别提交 | 为什么 | 已经帮你挡了 |
|---|---|---|
| **任何 API Key** | 一旦进了 git 历史，删掉文件也没用，得改写历史 | `.gitignore` 挡了 `config.local.json`、`.env` |
| `node_modules/` | 几百 MB，而且平台相关 | 已忽略 |
| `dist/` | 构建产物，每次都能重新生成 | 已忽略 |
| `.DS_Store` | macOS 的文件夹元数据 | 已忽略 |
| 你自己电脑上的绝对路径 | 别人用不了 | — |

**提交前自查一遍：**

```bash
git diff --cached | grep -i "sk-\|api_key\|apikey\|password\|token"
```

有输出就说明你手滑了。

> 如果真不小心提交了 Key：
> 1. **立刻去厂商控制台把这个 Key 删掉**
> 2. 再告诉我们，改历史是最后的补救，删 Key 才是第一优先

---

## 三、怎么提交

### 分支策略

```
main                永远可用的版本，只有 @NikiTheBear 能合进来
 ├─ b/lab           B 的实验台
 └─ c/content       C 的内容
```

**每人开工时建一次，之后一直在这条分支上干活。**

> ⚠️ **分支保护现在开不了。** GitHub 免费账号的私有仓库不支持。
> 所以 `main` 的保护**靠约定 + CI**：
> - 直接推 `main` 在技术上做得到，但不要这么做
> - 推上去之后 CI 会检查，红了就是不能合
>
> 详见 [`docs/BRANCH-PROTECTION.md`](../docs/BRANCH-PROTECTION.md)。

**B 和 C 各自在自己的分支上干活，做完发 PR 到 `main`。**

不会用 git 也行——**改完文件发给 @NikiTheBear，我来提交。** 这不丢人，效率最高。

### 提交信息怎么写

一句话说清「改了什么 + 为什么」，中文可以。

```
✅ 好
fix: 修正虚像画到了轴上边（y 轴方向反了）
feat: 实验台加左右拖动和全屏
content: 补 K-O2-05 到 K-O2-11 七张卡的生活类比

❌ 差
update
改了一下
提交
```

前缀约定（照着用就行）：

| 前缀 | 什么时候用 |
|---|---|
| `feat:` | 加功能 |
| `fix:` | 修 bug |
| `content:` | 改内容（知识卡、题库、文档） |
| `docs:` | 只改文档 |
| `refactor:` | 重构，行为没变 |
| `chore:` | 依赖、配置、杂事 |

### PR 要求

发 PR 之前，本地跑一遍：

```bash
./scripts/preflight.sh
```

它会依次检查四件事，全绿才打印 `✓ 可以提交`：

| 检查 | 内容 |
|---|---|
| 扫密钥 | 有没有 `sk-` / `ghp_` 之类的东西混进去 |
| TypeScript | `tsc --noEmit` |
| 物理断言 | 12 条必须全绿 |
| 内容校验 | 知识卡 / 题库 / 剧本的 id 引用 |

推上去之后 GitHub Actions 也会自动跑一遍同样的检查（`.github/workflows/preflight.yml`）。

PR 描述里写清三件事：

1. **改了什么**（一句话）
2. **为什么改**（是哪个问题）
3. **怎么验证的**（跑了什么、看到什么）

如果改的是界面，**贴一张截图**。

---

## 四、各角色的具体要求

### B（实验室）

你负责 `<LabStage />`。它是一个**纯渲染器**：给它参数，它画一张图。

**必须遵守的约定：**

| 约定 | 原因 |
|---|---|
| 只读 `params` 和 `metrics`，不改 | 状态的唯一源头在网页层 |
| 不自己调 `solve()` 重算 | 会跟网页层的数字对不上 |
| 不碰 localStorage、不发网络请求 | 实验室必须能离线跑 |
| ⚠️ **物理坐标 y 向上为正，SVG 的 y 向下为正** | 画之前必须取反，否则像会跑到轴上边 |

最后一条是真实踩过的坑，`LabStage.tsx` 里有个 `Y()` 函数专门干这个，照抄就行。

详细规格见 [`docs/BRIEF-FOR-B.md`](../docs/BRIEF-FOR-B.md)。

### C（内容）

你不需要写代码，只需要填表。

**你的地盘只有两个字段**（`knowledge.json` 里）：

| 字段 | 写什么 | 长度 |
|---|---|---|
| `analogy` | 生活里真的见过的东西 | 20–60 字 |
| `why` | 为什么会这样（不是"是什么"） | 40–120 字 |

其他字段（`id`、`stage`、`prerequisites`、`misconceptionIds`、`labPreset`）**别动**，它们是全项目的胶水。

填完跑：

```bash
node shared/knowledge-data/schema/validate.mjs
```

看到 `✓ 全部通过` 就对了。错了它会告诉你第几个文件的哪个字段有问题。

| ❌ 不合格 | ✅ 合格 |
|---|---|
| 因为物距变大时像距会变小。 | 公式 `1/f = 1/u + 1/v` 里，u 变大，`1/u` 就变小，`1/v` 就得变大才能凑够 `1/f`——所以 v 变小。不是"记规律"，是算术。 |

详细要求见 [`docs/HANDOFF-FOR-C.md`](../docs/HANDOFF-FOR-C.md)。

---

## 五、这个项目的几条硬规矩

这几条不是建议，是底线。谁违反了要回滚。

### 1. 物理必须由本地引擎算，AI 只解释不算数

```ts
// ✅ 对
const metrics = solve(params);

// ❌ 绝对不行
const answer = await askAI('这个物距下像距是多少？');
```

理由：AI 算 \(1/f = 1/u + 1/v\) 十次里有两次会错，而且错得很自信。
一个物理学习平台，公式算错就一文不值。

### 2. 我们的代码里永远不出现能接收 Key 的服务端

- 密钥只存 `localStorage`
- 本地启动器只监听 `127.0.0.1`，不写日志、不落盘
- 任何"官方中转地址"都算 bug

### 3. AI 没有特权

AI 下发的东西只能是**参数值**，走的是和滑块完全相同的通道。
AI 能到达的状态，学生用滑块也一定到得了。

```ts
// ✅ 允许：AI 说"把 u 调到 15"，变成一个按钮，学生点了才生效
{ type: 'u', value: 15 }

// ❌ 禁止：AI 直接操作画面、产生引擎算不出的状态
```

### 4. 反思栏禁止 AI 代写

报告里那一栏必须是学生自己写的。不许加"帮我写"按钮。

### 5. 首屏不许堆说明书

打开就该能动手。教程可以有，但要单独一页，默认不出现。

---

## 六、遇到问题怎么办

| 情况 | 找谁 |
|---|---|
| 物理算错了 | @NikiTheBear（带上一组参数和你手算的结果） |
| 界面/交互不对 | @NikiTheBear（附截图） |
| 内容有物理错误 | @NikiTheBear（这是唯一需要物理专业判断的地方） |
| 不知道自己该干什么 | @NikiTheBear |
| 卡了超过 20 分钟 | 直接问，别耗着 |

---

## 七、开源之后

这个仓库以后可能会公开。所以在写任何东西的时候，问自己一句：

> **这句话如果被一个陌生的物理老师看到，会不会觉得我们专业？**

包括：注释、提交信息、文档、变量名。

具体来说：

- 注释写"为什么"，不写"是什么"（代码本身说明了是什么）
- 不要留 `TODO：这里先这样吧反正能跑`
- 不要留带有私人信息的路径、IP、账号
- 中文英文混着没问题，但一个文件里保持一致
