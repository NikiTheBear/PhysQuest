/**
 * 生成「哪些挑战有实验文件」的索引，给网页层用。
 *
 * 为什么需要：热学那 17 条「做不出来」的挑战故意没有 .pqexp.json，
 * 网页层把它们塞进 iframe 会报「打开挑战失败：找不到实验文件」。
 * 网页层读不到文件系统，所以这里生成一份清单。
 *
 * 产出：shared/knowledge-data/experiment-index.json
 *   { "CH-K-T1-01": true, "CH-K-T2-04": false, ... }
 */
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';

const have = new Set(
  readdirSync('platform/experiments')
    .filter((f) => f.endsWith('.pqexp.json'))
    .map((f) => f.replace('.pqexp.json', '')),
);

const ids = [];
for (const lab of ['mechanics', 'circuits', 'optics-lens', 'acoustics', 'thermal']) {
  const file = `shared/knowledge-data/labs/${lab}-challenges.json`;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  for (const c of d.challenges ?? d) ids.push(c.id);
}
const hand = JSON.parse(readFileSync('shared/knowledge-data/optics-lens/challenges.json', 'utf8'));
for (const c of hand.challenges) ids.push(c.id);

/** 只存「有实验文件」的，没有的不出现在表里 */
const index = {};
let withFile = 0;
for (const id of ids) {
  if (have.has(id)) {
    index[id] = true;
    withFile += 1;
  }
}

writeFileSync(
  'shared/knowledge-data/experiment-index.json',
  JSON.stringify({ count: withFile, total: ids.length, has: index }, null, 2) + '\n',
);
console.log(`实验索引：${withFile} / ${ids.length} 个挑战有实验文件`);
