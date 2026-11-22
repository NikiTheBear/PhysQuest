/**
 * 为平台测试生成最小静态资源（.generated/challenges.js、.generated/assets.js）。
 * 完整构建用 scripts/build.mjs；本脚本只产出测试载入 worker 所需的两个模块，
 * 避免在 CI 里跑整套 vite 构建。
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
await mkdir('.generated', { recursive: true });

const challengeFiles = {};
for (const name of await readdir('experiments')) {
  if (name.endsWith('.pqexp.json')) challengeFiles[name.split('.')[0]] = JSON.parse(await readFile('experiments/' + name, 'utf8'));
}
await writeFile('.generated/challenges.js', 'export default ' + JSON.stringify(challengeFiles));

// 测试只访问 /api 与 /mcp 路由；静态页面资源留空即可（/missing 等 404 断言依赖这一点）。
await writeFile('.generated/assets.js', 'export const ASSETS = {};');
console.log('Generated test assets.');
