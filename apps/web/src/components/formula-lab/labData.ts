import labJson from '@knowledge/formula-lab.json';

/**
 * 公式实验室的数据层
 *
 * 数据来自 shared/knowledge-data/formula-lab.json（97 条：78 条 formula + 19 条 diagram）。
 * 这里只做三件事：给数据补类型、按 id 取、判断某个知识点有没有实验室入口。
 *
 * 注意：JSON 里 78 条 formula 全部带 inputs/outputs/example，19 条 diagram 全部带
 * draw/marks/watch，**没有** inputs/outputs。所以类型必须做成两种 kind 的判别联合，
 * 渲染时先看 kind 再取字段，不要假设字段一定在。
 */

export interface LabInputSpec {
  key: string;
  label: string;
  /** 可能为空字符串（无量纲量），渲染时不要画单位 */
  unit: string;
  min: number;
  max: number;
  default: number;
}

export interface LabOutputSpec {
  key: string;
  label: string;
  unit: string;
  /** 有可能含有 Math.pow / Math.sqrt / Math.exp / Math.log / Math.log10 / Math.PI 等 */
  expr: string;
}

/** 可算的一条：左边调参数，右边实时出数 */
export interface FormulaLabSpec {
  kind: 'formula';
  title: string;
  formula: string;
  inputs: LabInputSpec[];
  outputs: LabOutputSpec[];
  note: string;
  example?: string;
}

/** 只能画的一条：没有可算的单一数字，给的是「画什么 / 哪些点 / 看什么」 */
export interface DiagramLabSpec {
  kind: 'diagram';
  title: string;
  draw: string;
  marks: string[];
  watch: string;
  note: string;
}

export type LabSpec = FormulaLabSpec | DiagramLabSpec;

interface LabFile {
  format: string;
  version: number;
  count: number;
  labs: Record<string, LabSpec>;
}

// 97KB 的字面量让 TS 去推会非常慢，这里直接断言成我们的窄类型（和 content.ts 的做法一致）
const DATA = labJson as unknown as LabFile;

export const LABS: Record<string, LabSpec> = DATA.labs ?? {};

/** 全部实验室条目数（导出给别的地方做统计用） */
export const LAB_COUNT = Object.keys(LABS).length;

export function labById(id: string): LabSpec | undefined {
  if (!id) return undefined;
  return Object.prototype.hasOwnProperty.call(LABS, id) ? LABS[id] : undefined;
}

/** 这个知识点有没有公式实验室 */
export function hasLab(id: string): boolean {
  return !!id && Object.prototype.hasOwnProperty.call(LABS, id);
}
