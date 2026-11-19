import type { LensParams, Stage } from '../core/contracts';
import { DEFAULT_LENS_PARAMS } from '../core/contracts';

/**
 * 实验模块登记表
 *
 * 所有入口、导航、实验台都通过这张表走。
 * 加第三个模块时只需在这里加一条 + 提供对应的实验台组件。
 */

export type LabId = 'optics-lens' | 'fieldlab';

export interface LabMeta {
  id: LabId;
  /** 模块名 */
  title: string;
  /** 副标题：领域 · 分支 */
  subtitle: string;
  /** 对应的领域 key（对应 PLATFORM-MAP.json 的 discipline） */
  discipline: string;
  /** 这个模块覆盖哪些学段 */
  stages: Stage[];
  /** 入口卡片上的一句话 */
  intro: string;
  /** 卡片右上角的标签文案 */
  badge: string;
  /** 走的是哪一种学习形态 */
  mode: 'guided' | 'free';
  /** guided 模式才有初始参数 */
  defaultParams?: LensParams;
  /** 卡片底部三个数字 */
  stats: string[];
}

export const LABS: LabMeta[] = [
  {
    id: 'optics-lens',
    title: '凸透镜成像',
    subtitle: '光学 · 几何光学',
    discipline: 'optics',
    stages: ['junior', 'senior'],
    intro: '五个小目标，每个都先猜一句再动手；最后还有一关「自己搭」。猜错了不要紧——那一下才是真正记住的时候。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: ['6 个挑战', '26 个知识点', '26 张卡'],
  },
  {
    id: 'fieldlab',
    title: '自由搭建实验台',
    subtitle: '全领域 · 自由构建',
    discipline: 'all',
    stages: ['junior', 'senior', 'university'],
    intro:
      '从空白空间开始，自己摆器具、连线路、跑仿真。可以让 AI 一起搭，也可以自己动手。',
    badge: '自由',
    mode: 'free',
    stats: ['43 种器具', '2D / 3D', 'AI 协作'],
  },
];

export const labById = (id: string | null | undefined): LabMeta | null =>
  LABS.find((l) => l.id === id) ?? null;

export const labForDiscipline = (discipline: string): LabMeta | null =>
  LABS.find((l) => l.discipline === discipline) ?? null;
