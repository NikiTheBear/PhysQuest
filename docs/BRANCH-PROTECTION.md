# 分支保护（现在是手动版本）

> 为什么是手动版：**GitHub 免费账号的私有仓库不支持分支保护**。
> 想用真正的分支保护，有两条路：
> - 把仓库改成 Public（免费）
> - 或者升级 GitHub Pro（$4/月）
>
> 在那之前，用下面的约定 + 一个本地脚本代替。

---

## 约定（三个人都遵守）

### 1. `main` 是「随时能跑」的分支

`main` 上的代码任何时刻都应该：

- `npm test` 全绿
- `npx tsc --noEmit` 无报错
- 按下 `npm run dev` 能打开

**如果做不到，就不要合进 `main`。**

### 2. 每人一条长期分支

```
main                 ← 只有 @NikiTheBear 合并进来
 ├─ b/lab            ← B 的实验台
 └─ c/content        ← C 的内容
```

第一次开工时各建一次：

```bash
git checkout -b b/lab
# 或
git checkout -b c/content
```

之后就一直在这条分支上干活，**不要直接往 `main` 推**。

### 3. 推之前跑一遍

```bash
git diff --cached | grep -i "sk-\|api_key\|password\|token"
```

有输出就说明手滑了，`git reset` 掉。

### 4. 想让改动进 `main` 时

在 GitHub 上开 Pull Request：

```
base: main    ←  要合到哪
compare: b/lab  ←  从哪来
```

PR 描述照着模板填。@NikiTheBear review 完再合。

---

## 本地预检脚本

合进 `main` 之前，跑一遍：

```bash
./scripts/preflight.sh
```

它会检查：

| 检查项 | 说明 |
|---|---|
| 有没有疑似 Key | 扫所有暂存的文件 |
| TypeScript | `tsc --noEmit` |
| 物理断言 | `npm test`，12 条必须全绿 |
| 内容校验 | 知识卡 / 题库 / 剧本的 id 引用 |

全部通过才会打印绿色 `✓ 可以提交`。

---

## 等仓库变 Public 之后

我会用一条命令把真正的分支保护加上：

```bash
gh api repos/NikiTheBear/PhysQuest/branches/main/protection -X PUT \
  -f "enforce_admins=false" \
  -F "required_status_checks[strict]=true" \
  -F "required_status_checks[contexts][]=preflight" \
  -F "required_pull_request_reviews[required_approving_review_count]=1" \
  -F "restrictions=null"
```

那时候的规则会变成：

- 不能直接 push 到 `main`
- 必须开 PR，且至少 1 人 review
- 必须通过 CI 检查

**现在做不到，只能靠约定。** 但约定也够用——三个人、一个私有仓库，出不了大事。
