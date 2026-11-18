## 改了什么

<!-- 一句话。比如：修正了虚像画到了轴上边 -->

## 为什么改

<!-- 是哪个问题？如果是修 bug，说说怎么发现的 -->

## 怎么验证的

<!--
跑了什么命令？看到什么结果？
改了界面的话，贴一张截图。
-->

- [ ] `cd apps/web && npm test` 全绿（12 条物理断言）
- [ ] `npx tsc --noEmit` 无类型错误
- [ ] `node shared/knowledge-data/schema/validate.mjs` 输出 `✓ 全部通过`
- [ ] 提交内容里没有任何 API Key（`git diff --cached | grep -i "sk-"` 无输出）

## 检查清单

- [ ] 我只改了自己负责范围内的文件（见 [CONTRIBUTING.md](../CONTRIBUTING.md)）
- [ ] 如果改的是界面，我贴了截图
- [ ] 如果改了物理引擎，我先在 `engine.test.ts` 里加了断言
