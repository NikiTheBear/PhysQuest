import type { LensParams, Stage } from '../core/contracts';
import { DEFAULT_LENS_PARAMS } from '../core/contracts';

/**
 * 实验模块登记表
 *
 * 现在只有一个模块（凸透镜），但所有入口、导航、实验台都通过这张表走，
 * 这样加第二个模块时不用改导航逻辑，只需在这里加一条 + 提供对应的实验台组件。
 */

export type LabId = 'optics-lens';

export interface LabMeta {
  id: LabId;
  /** 模块名 */
  title: string;
  /** 副标题：领域 · 分支 */
  subtitle: string;
  /** 对应 PLATFORM-MAP.json 里的 discipline key */
  discipline: string;
  /** 这个模块覆盖哪些学段 */
  stages: Stage[];
  /** 进入实验台时的初始参数 */
  defaultParams: LensParams;
  /** 空状态 / 入口卡片上的一句话 */
  intro: string;
}

export const LABS: LabMeta[] = [
  {
    id: 'optics-lens',
    title: '凸透镜成像',
    subtitle: '光学 · 几何光学',
    discipline: 'optics',
    stages: ['junior', 'senior'],
    defaultParams: DEFAULT_LENS_PARAMS,
    intro: '一块透镜、一根蜡烛、一张光屏。拖一拖，看看像会怎么变。',
  },
];

export const labById = (id: string | null | undefined): LabMeta | null =>
  LABS.find((l) => l.id === id) ?? null;

export const labForDiscipline = (discipline: string): LabMeta | null =>
  LABS.find((l) => l.discipline === discipline) ?? null;
