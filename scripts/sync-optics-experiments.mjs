/**
 * 从 shared/knowledge-data/optics-lens/challenges.json 重新生成：
 *   1. platform/experiments/CH-O2-0X.pqexp.json （5 个光具座实验文件）
 *   2. platform/shared/experiment-library.js   （工作台内置的只读副本）
 *
 * 这两个以前是手工维护的，改了 challenges.json 就会和它们对不上
 * （platform/tests/experiment-files.test.mjs 会逐字节比对）。
 *
 * 用法：bun scripts/sync-optics-experiments.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJSON = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));

const { challenges } = await readJSON('shared/knowledge-data/optics-lens/challenges.json');
const existing = {};
for (const name of await readdir(new URL('platform/experiments/', root))) {
  if (/^CH-O2-0\d\.pqexp\.json$/.test(name)) existing[name.split('.')[0]] = await readJSON('platform/experiments/' + name);
}

const files = [];
for (const ch of challenges) {
  const base = existing[ch.id];
  if (!base) {
    console.warn(`⚠ 缺少 ${ch.id}.pqexp.json，跳过（需要先有该实验文件）`);
    continue;
  }
  // learning 字段就是挑战定义本身（工作台据此显示目标/先猜/模型边界）
  const file = { ...base, format: 'physquest.experiment', version: 1, experiment: { ...base.experiment, learning: ch } };
  files.push(file);
  await writeFile(new URL(`platform/experiments/${ch.id}.pqexp.json`, root), JSON.stringify(file, null, 2) + '\n');
}

const banner = '// Converted from PhysQuest, MIT; see physquest/LICENSE.\n';
await writeFile(
  new URL('platform/shared/experiment-library.js', root),
  banner + 'export const EXPERIMENT_FILES = ' + JSON.stringify(files, null, 2) + ';\n',
);

console.log(`✓ 同步 ${files.length} 个光具座实验文件与 experiment-library.js`);
