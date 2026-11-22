import demoFile from '@knowledge/optics-lens/demo-scripts.json';
import { DEMOS } from '../../data/content';

/**
 * 演示剧本的数据入口
 *
 * 原始文件：`shared/knowledge-data/optics-lens/demo-scripts.json`
 *   { "labId": "optics-lens", "scripts": [{ id, title, steps: [...] }, ...] }
 *
 * 有个坑值得记一笔：`DEMOS` 导出的只是 `scripts` 那一层，
 * **`labId` 在文件顶层，每条脚本身上没有**。
 * 所以任务书里那句 `DEMOS.filter(d => d.labId === lab.id)` 实际会永远拿到空数组。
 * 这里把文件顶层的 labId 当作这一批脚本的默认归属，
 * 同时仍然优先读脚本自己的 `labId`（以后一份文件装多个模块时不用改代码）。
 */

export type DemoScript = (typeof DEMOS)[number] & { labId?: string };
export type DemoStep = DemoScript['steps'][number];

/** 整份剧本文件属于哪个模块（文件顶层字段） */
export const DEMO_FILE_LAB_ID: string = (demoFile as { labId?: string }).labId ?? 'optics-lens';

const SCRIPTS = DEMOS as unknown as DemoScript[];

/** 某个模块下有哪些剧本 */
export function demoScriptsFor(labId: string): DemoScript[] {
  return SCRIPTS.filter((d) => (d.labId ?? DEMO_FILE_LAB_ID) === labId);
}

/** 按 id 取一个剧本 */
export function demoScriptById(id: string): DemoScript | undefined {
  return SCRIPTS.find((d) => d.id === id);
}

/** 整个剧本播完要多久（秒），用于入口卡片上的「几秒」 */
export function demoDurationSec(script: DemoScript): number {
  return Math.round(script.steps.reduce((n, s) => n + s.durationMs, 0) / 1000);
}
