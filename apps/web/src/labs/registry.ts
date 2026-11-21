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

/** 从力学搬去声学的振动与波 5 条 —— 力学不再包含它们 */
const MOVED_TO_ACOUSTICS = ['K-M3-14', 'K-M3-15', 'K-M3-16', 'K-M4-05', 'K-M4-06'];

const KNOWLEDGE_IDS_OPTICS = idsOf(['K-O']);
const KNOWLEDGE_IDS_MECH = idsOf(['K-M']).filter((id) => !MOVED_TO_ACOUSTICS.includes(id));
const KNOWLEDGE_IDS_EM = idsOf(['K-E']);
const KNOWLEDGE_IDS_ACOUSTICS = [...idsOf(['K-A']), ...MOVED_TO_ACOUSTICS];
import { DEFAULT_LENS_PARAMS } from '../core/contracts';

/**
 * 实验模块登记表
 *
 * 所有入口、导航、实验台都通过这张表走。
 * 加第三个模块时只需在这里加一条 + 提供对应的实验台组件。
 */

export type LabId = 'optics-lens' | 'mechanics' | 'circuits' | 'acoustics';

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

/* 卡片数量、挑战数量都从真实数据算，不写死 —— 加了知识点卡片自动跟上 */
import CARDS_JSON from '@knowledge/knowledge-cards.json';
import AUTO_JSON from '@knowledge/labs/mechanics-challenges.json';
import CIRCUIT_JSON from '@knowledge/labs/circuits-challenges.json';
import OPTICS_JSON from '@knowledge/labs/optics-lens-challenges.json';
import ACOUSTIC_JSON from '@knowledge/labs/acoustics-challenges.json';

const ALL_CARD_IDS = new Set(
  (CARDS_JSON as { cards: Array<{ id: string }> }).cards.map((c) => c.id),
);

type ChallengeFile = { challenges?: Array<{ labId?: string }> };
const AUTO_ALL: Array<{ labId?: string }> = [
  ...((AUTO_JSON as ChallengeFile).challenges ?? []),
  ...((CIRCUIT_JSON as ChallengeFile).challenges ?? []),
  ...((OPTICS_JSON as ChallengeFile).challenges ?? []),
  ...((ACOUSTIC_JSON as ChallengeFile).challenges ?? []),
];

/** 手写挑战（凸透镜那 5 关）+ 自动挑战，按模块数一数 */
function statsOf(labId: string, knowledgeIds: string[], handwritten: number): string[] {
  const cards = knowledgeIds.filter((id) => ALL_CARD_IDS.has(id)).length;
  const auto = AUTO_ALL.filter((c) => c.labId === labId).length;
  return [`${handwritten + auto} 个挑战`, `${knowledgeIds.length} 个知识点`, `${cards} 张卡`];
}

export const LABS: LabMeta[] = [
  {
    id: 'optics-lens',
    title: '光学',
    subtitle: '从光的直线传播到薄透镜成像',
    discipline: 'optics',
    stages: ['primary', 'junior', 'senior', 'university'],
    intro: '光怎么走、怎么拐弯、怎么被透镜收拢。从小学的影子和放大镜，一路到大学的 ABCD 矩阵。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: statsOf('optics-lens', KNOWLEDGE_IDS_OPTICS, 5),
    knowledgeIds: KNOWLEDGE_IDS_OPTICS,
  },
  {
    id: 'mechanics',
    title: '力与运动',
    subtitle: '力学 · 从推小车到能量守恒',
    discipline: 'mechanics',
    stages: ['junior', 'senior'],
    intro: '刚体、弹簧、斜面、滑轮——从推小车到能量守恒。每个都先猜一句再动手。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: statsOf('mechanics', KNOWLEDGE_IDS_MECH, 0),
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
    stats: statsOf('circuits', KNOWLEDGE_IDS_EM, 0),
    knowledgeIds: KNOWLEDGE_IDS_EM,
  },
  {
    id: 'acoustics',
    title: '声与波',
    subtitle: '声学 · 从振动到干涉',
    discipline: 'acoustics',
    stages: ['junior', 'senior'],
    intro:
      '点声源、指向性声源、测量麦克风。改频率、挪距离、加第二个源，看声压怎么变——声波看不见，但能测。',
    badge: '有引导',
    mode: 'guided',
    defaultParams: DEFAULT_LENS_PARAMS,
    stats: statsOf('acoustics', KNOWLEDGE_IDS_ACOUSTICS, 0),
    knowledgeIds: KNOWLEDGE_IDS_ACOUSTICS,
  },
];

export const labById = (id: string | null | undefined): LabMeta | null =>
  LABS.find((l) => l.id === id) ?? null;

export const labForDiscipline = (discipline: string): LabMeta | null =>
  LABS.find((l) => l.discipline === discipline) ?? null;
