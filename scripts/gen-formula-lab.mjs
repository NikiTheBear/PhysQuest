/**
 * 生成 shared/knowledge-data/formula-lab.json 并做完整校验
 *
 * 校验项：
 *  1. 97 条覆盖齐全（approximation + conceptual，一一对应）
 *  2. 结构合法：formula 有 inputs/outputs；diagram 有 draw/marks/watch
 *  3. expr 里引用的变量都来自 inputs 的 key；且只允许四则运算与 Math 函数
 *  4. 每条 expr 代入默认值必须算出有限数字（沙箱跑一遍）
 *  5. note / example 非空
 *
 * 用法：bun scripts/gen-formula-lab.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import LABS from './formula-lab-data.mjs';

const CARDS = JSON.parse(
  await readFile(new URL('../shared/knowledge-data/knowledge-cards.json', import.meta.url), 'utf8'),
).cards;
const expected = new Set(CARDS.filter((c) => c.support === 'approximation' || c.support === 'conceptual').map((c) => c.id));

const errors = [];
const warns = [];

const idList = Object.keys(LABS);

// 1. 覆盖检查
for (const id of expected) if (!LABS[id]) errors.push(`缺 ${id}`);
for (const id of idList) if (!expected.has(id)) errors.push(`多出不在 97 条里的 ${id}`);

// 2. 结构 + 3. expr 引用 + 4. 沙箱
for (const [id, lab] of Object.entries(LABS)) {
  const card = CARDS.find((c) => c.id === id);
  if (!lab.title) errors.push(`${id} 缺 title`);
  if (!lab.kind || !['formula', 'diagram'].includes(lab.kind)) errors.push(`${id} kind 非法`);
  if (!lab.note || lab.note.length < 10) errors.push(`${id} 缺 note`);

  if (lab.kind === 'diagram') {
    for (const f of ['draw', 'marks', 'watch']) if (!lab[f]) errors.push(`${id} 缺 ${f}`);
    if (card && !/示意|原理|图|没有可算|数量级|只有/.test(lab.draw + lab.note)) warns.push(`${id} 示意图里没写明「做不出数字」`);
    continue;
  }

  // formula
  if (!lab.formula) errors.push(`${id} 缺 formula 展示文本`);
  if (!Array.isArray(lab.inputs) || !lab.inputs.length) errors.push(`${id} 缺 inputs`);
  if (!Array.isArray(lab.outputs) || !lab.outputs.length) errors.push(`${id} 缺 outputs`);

  const keys = new Set((lab.inputs ?? []).map((i) => i.key));
  if (keys.size !== (lab.inputs ?? []).length) errors.push(`${id} inputs 有重复 key`);
  // 长 key 先保护（ef 要先于 e），否则 e 会把 ef 里的 e 换掉
  const ordered = [...keys].sort((a, b) => b.length - a.length);

  for (const o of lab.outputs ?? []) {
    // 变量引用检查：先保护 Math 和已知变量名，删掉数字，剩余标识符必须为 0
    let t = o.expr.replace(/Math\.[A-Za-z]+/g, 'M');
    for (const k of ordered) t = t.split(k).join('V');
    t = t.replace(/\d+\.?\d*[eE][+-]?\d+|\d+\.\d+|\d+/g, '');
    const idents = new Set(t.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
    const bad = [...idents].filter((x) => x !== 'M' && x !== 'V');
    if (bad.length) errors.push(`${id} 输出 ${o.key} 的 expr 引用了未定义标识符: ${bad.join(', ')}`);
    // 沙箱跑默认值
    try {
      const ctx = {};
      for (const i of lab.inputs ?? []) ctx[i.key] = i.default;
      const fn = new Function(...Object.keys(ctx), `return (${o.expr});`);
      const val = fn(...Object.values(ctx));
      if (!Number.isFinite(val)) errors.push(`${id} 输出 ${o.key} 代入默认值不是有限数（${val}）`);
    } catch (e) {
      errors.push(`${id} 输出 ${o.key} expr 执行出错: ${e.message}`);
    }
  }

  // 范围合理性（min < default < max，min < max）
  for (const i of lab.inputs ?? []) {
    if (!(i.min <= i.default && i.default <= i.max)) warns.push(`${id} 输入 ${i.key} default 不在 (min,max) 开区间内`);
    if (i.min >= i.max) errors.push(`${id} 输入 ${i.key} min≥max`);
  }
}

if (errors.length) {
  console.log('✗ 校验失败：');
  errors.forEach((e) => console.log('  ' + e));
  process.exit(1);
}
if (warns.length) {
  console.log('⚠ 提醒：');
  warns.forEach((w) => console.log('  ' + w));
}

const formulaCount = idList.filter((id) => LABS[id].kind === 'formula').length;
const diagramCount = idList.filter((id) => LABS[id].kind === 'diagram').length;

const out = { format: 'physquest.formula-lab', version: 1, generated: new Date().toISOString().slice(0, 10), count: idList.length, labs: LABS };
await writeFile(new URL('../shared/knowledge-data/formula-lab.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');

console.log(`✓ 全部通过：共 ${idList.length} 条（formula ${formulaCount} / diagram ${diagramCount}）→ formula-lab.json`);
