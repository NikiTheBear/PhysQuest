/**
 * 评分规则表（rubric）
 *
 * 内容照抄 local/AI-GRADING-SPEC.md §1.3 的表：13 个光具座挑战，每一关
 * 「该看的通道后缀」写死。**不从 `KnowledgePrompt.models` 生成** ——
 * 文档 §7.3 第 4 条已经证明 models 和实验文件里的器具对不上。
 *
 * 和文档 §6 第 1 步的一处偏差：文档建议把 JSON 放
 * `shared/knowledge-data/grading/rubric-optics-lens.json`，但这次改动的
 * 允许范围只到 `apps/web/src/core/grading/**`，所以 JSON 就放在本目录。
 * 结构完全一致，将来要挪到 shared/ 只需改这一行的 import。
 */

import RAW from './rubric-optics-lens.json';
import ALL_RAW from '@knowledge/grading/rubrics-all.json';
import type { Rubric } from './types';

interface RubricFile {
  labId?: string;
  version: number;
  challenges: Record<
    string,
    {
      requiredKinds?: string[];
      requiredObservations?: string[];
      optionalObservations?: string[];
      unmappableObservations?: string[];
    }
  >;
}

const FILE = RAW as unknown as RubricFile;
const ALL_FILE = ALL_RAW as unknown as RubricFile;

/** 缓存：同一关反复评（改反思重评）不用重复构造 */
const CACHE = new Map<string, Rubric>();

/** 取某一关的评分规则：优先手写光学标准，其次全模块合并标准。没有则返回 null（§4 的 NO_RUBRIC） */
export function loadRubric(challengeId: string): Rubric | null {
  const hit = CACHE.get(challengeId);
  if (hit) return hit;

  const raw = FILE.challenges[challengeId] ?? ALL_FILE.challenges?.[challengeId];
  if (!raw) return null;

  const rubric: Rubric = {
    challengeId,
    requiredKinds: [...(raw.requiredKinds ?? [])],
    requiredObservations: [...(raw.requiredObservations ?? [])],
    optionalObservations: [...(raw.optionalObservations ?? [])],
    unmappableObservations: [...(raw.unmappableObservations ?? [])],
  };
  CACHE.set(challengeId, rubric);
  return rubric;
}

/** rubric 覆盖了哪些挑战（测试和 UI 文案用） */
export function coveredChallengeIds(): string[] {
  return [...new Set([...Object.keys(FILE.challenges), ...Object.keys(ALL_FILE.challenges ?? {})])];
}

/** 这一关有没有评分标准 */
export function hasRubric(challengeId: string): boolean {
  return Boolean(FILE.challenges[challengeId] ?? ALL_FILE.challenges?.[challengeId]);
}

/** 通道后缀 → 人看得懂的名字。取不到就退回后缀本身 */
export function observationLabel(suffix: string): string {
  return CHANNEL_LABEL[suffix] ?? suffix;
}

/** 和 platform/shared/physics.js:178-182 的 label 一一对应 */
export const CHANNEL_LABEL: Record<string, string> = {
  v: '像距 v',
  m: '放大率 m',
  imageHeight: '像高',
  blurDiameter: '弥散圆',
  relativeIlluminance: '相对照度',
  screenHasImage: '光屏上有像',
  real: '实像',
};
