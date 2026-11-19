import type { LensParams, Stage } from '../core/contracts';
import PLATFORM_MAP from '@knowledge/PLATFORM-MAP.json';

/** 从平台地图里按前缀取知识点 id */
function idsOf(prefixes: string[]): string[] {
  const out: string[] = [];
  for (const d of (PLATFORM_MAP as { disciplines: Array<{ stages: Array<{ items: Array<{ id: string }> }> }> })
    .disciplines) {
    for (const s of d.stages) {
      for (const i of s.items) {
        if (prefixes.some((p) => i.id.startsWith(p))) out.push(i.id);
      }
    }
  }
  return out;
}

const KNOWLEDGE_IDS_OPTICS = idsOf(['K-O']);
const KNOWLEDGE_IDS_MECH = idsOf(['K-M']);
const KNOWLEDGE_IDS_EM = idsOf(['K-E']);
import { DEFAULT_LENS_PARAMS } from '../core/contracts';

/**
 * 实验模块登记表
 *
 * 所有入口、导航、实验台都通过这张表走。
 * 加第三个模块时只需在这里加一条 + 提供对应的实验台组件。
 */

export type LabId = 'optics-lens' | 'mechanics' | 'circuits' | 'acoustics' | 'fieldlab';

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
  /** 这个模块涉及的知识点 id（用于统计卡片数） */
  knowledgeIds?: string[];
}

export const LABS: LabMeta[] = [
  {
    id: 'optics-lens',
    title: '凸透镜成像',
    subtitle: '光学 · 几何光学',
    discipline: 'optics',
    stages: ['junior', 'senior'],
    intro: '五个小目标，每个都先猜一句再动手。猜错了不要紧——那一下才是真正记得的时候。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: ['5 个挑战', '21 个知识点', '26 张卡'],
    knowledgeIds: KNOWLEDGE_IDS_OPTICS,
  },
  {
    id: 'mechanics',
    title: '力与运动',
    subtitle: '力学 · 从推小车到能量守恒',
    discipline: 'mechanics',
    stages: ['junior', 'senior'],
    intro: '刚体、弹簧、斜面、音叉与麦穗——从推小车到声波叠加，能真算的都在这儿。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: ['29 个挑战', '46 个知识点', '46 张卡'],
    knowledgeIds: KNOWLEDGE_IDS_MECH,
  },
  {
    id: 'circuits',
    title: '电路与电流',
    subtitle: '电磁 · 从欧姆定律到电功率',
    discipline: 'electromagnetism',
    stages: ['junior', 'senior'],
    intro: '12 种电路器具，电压表电流表实时读数。串并联、欧姆定律、电功率都能动手。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: ['21 个挑战', '42 个知识点', '42 张卡'],
    knowledgeIds: KNOWLEDGE_IDS_EM,
  },
  {
    id: 'acoustics',
    title: '声与波',
    subtitle: '声学 · 从振动到干涉',
    discipline: 'acoustics',
    stages: ['junior', 'senior'],
    intro:
      '一个点声源、一支麦克风。改频率、挪距离、再加一个源，看声压怎么变——声波看不见，但能测。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: ['5 个挑战', '4 个知识点', '2 张卡'],
    knowledgeIds: ['K-M3-15', 'K-M3-16'],
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
    stats: ['46 种器具', '2D / 3D', 'AI 协作'],
  },
];

export const labById = (id: string | null | undefined): LabMeta | null =>
  LABS.find((l) => l.id === id) ?? null;

export const labForDiscipline = (discipline: string): LabMeta | null =>
  LABS.find((l) => l.discipline === discipline) ?? null;
