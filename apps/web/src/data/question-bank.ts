/**
 * 题库：按知识点 + 三个难度
 *
 * 结构：每个知识点 → { easy, medium, hard }
 *   easy   基础概念（记住就能答）
 *   medium 简单应用（要推一步）
 *   hard   综合判断（要两步以上，或识别误区）
 *
 * 生成策略：
 *   光学 26 个知识点用手写题（真实中考风格）
 *   其余知识点从 knowledge-prompts.json 的 objective / formula / limitations
 *   派生题目——把「实验目标」变成问题，「模型边界」变成干扰项
 *
 * 题库独立于实验台：报告之前单独走一遍。
 */

export type QuizLevel = 'easy' | 'medium' | 'hard';

export interface BankQuestion {
  id: string;
  knowledgeId: string;
  level: QuizLevel;
  type: 'single' | 'judge';
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  /** 挂在哪个误区上（有就记进错题本） */
  misconceptionId?: string;
}

/**
 * 手写题：凸透镜 26 个知识点里的核心部分
 * 题目参考中考真题风格，答案由我们的引擎验证过
 */
export const HANDWRITTEN: BankQuestion[] = [
  {
    id: 'BQ-O2-05-easy',
    knowledgeId: 'K-O2-05',
    level: 'easy',
    type: 'single',
    question: '焦距 f = 10 cm 的凸透镜，把蜡烛放在距透镜 30 cm 处。光屏上成的像是什么？',
    options: ['倒立、缩小的实像', '倒立、放大的实像', '正立、放大的虚像'],
    answerIndex: 0,
    explanation: 'u = 30 cm > 2f = 20 cm，物距大于二倍焦距，成倒立缩小的实像。照相机就是这个原理。',
    misconceptionId: 'MIS-O2-05',
  },
  {
    id: 'BQ-O2-05-medium',
    knowledgeId: 'K-O2-05',
    level: 'medium',
    type: 'single',
    question:
      '焦距 f = 8 cm。蜡烛在 20 cm 处，光屏在透镜另一侧。下列说法正确的是？',
    options: [
      '像是倒立缩小的，光屏要放在 13.3 cm 附近',
      '像是倒立放大的，光屏要放在 30 cm 附近',
      '不成像，光屏上什么都没有',
    ],
    answerIndex: 0,
    explanation:
      'u = 20 cm > 2f = 16 cm，成倒立缩小实像。由 1/f = 1/u + 1/v 得 v = uf/(u−f) = 160/12 ≈ 13.3 cm。',
  },
  {
    id: 'BQ-O2-05-hard',
    knowledgeId: 'K-O2-05',
    level: 'hard',
    type: 'single',
    question:
      '同一凸透镜，第一次蜡烛在 3f 处，第二次在 4f 处。两次都在光屏上得到清晰的像。比较两次的像，正确的是？',
    options: [
      '第二次的像更大，光屏要放得更远',
      '第二次的像更小，光屏要放得更近',
      '两次像一样大，只是光屏位置不同',
    ],
    answerIndex: 1,
    explanation:
      'u 从 3f 增到 4f，v = uf/(u−f) 从 1.5f 减到 1.33f。物越远，像越近越小——这就是「物远像近像变小」。',
    misconceptionId: 'MIS-O2-06',
  },
  {
    id: 'BQ-O2-09-easy',
    knowledgeId: 'K-O2-09',
    level: 'easy',
    type: 'single',
    question: '焦距 f = 10 cm。蜡烛放在距透镜 6 cm 处。光屏上能找到像吗？',
    options: ['能，像是放大的', '不能，成的是虚像', '能，但是缩小的'],
    answerIndex: 1,
    explanation: 'u = 6 cm < f = 10 cm，物距小于焦距，成正立放大的虚像。虚像不能被光屏承接。',
    misconceptionId: 'MIS-O2-01',
  },
  {
    id: 'BQ-O2-09-medium',
    knowledgeId: 'K-O2-09',
    level: 'medium',
    type: 'single',
    question:
      '拿一个凸透镜当放大镜看书上的字，字变大了。此时字到透镜的距离满足什么条件？',
    options: ['小于一倍焦距', '在一倍到二倍焦距之间', '大于二倍焦距'],
    answerIndex: 0,
    explanation:
      '放大镜成的是正立放大的虚像，只有 u < f 时才会出现。一旦超过焦距，就变成倒立的实像了。',
  },
  {
    id: 'BQ-O2-08-easy',
    knowledgeId: 'K-O2-08',
    level: 'easy',
    type: 'single',
    question: '把蜡烛正好放在凸透镜的焦点上（u = f），光屏上会看到什么？',
    options: ['一个特别大的像', '什么都没有', '一个特别小的像'],
    answerIndex: 1,
    explanation:
      'u = f 时出射光线互相平行，交点跑到无穷远，光屏上接不到任何像。这不是「像特别大」，是「没有像」。',
    misconceptionId: 'MIS-O2-02',
  },
  {
    id: 'BQ-O2-08-hard',
    knowledgeId: 'K-O2-08',
    level: 'hard',
    type: 'single',
    question:
      '某同学移动光屏，在很远处隐约看到一个极模糊的亮斑，就认为「u = f 时像在无穷远处」。这个判断哪里有问题？',
    options: [
      '没问题，u = f 时确实成像在无穷远',
      'u = f 时不成像，那个亮斑是透镜孔径形成的弥散斑',
      '应该把光屏放到透镜左侧去找',
    ],
    answerIndex: 1,
    explanation:
      '平行光不会相交，所以没有「像点」，也就没有「成像在无穷远」这回事。屏上那个亮斑是整块透镜透过的光直接照出来的，直径约等于透镜口径。',
  },
  {
    id: 'BQ-O2-13-easy',
    knowledgeId: 'K-O2-13',
    level: 'easy',
    type: 'single',
    question: '已经调出清晰的像。用纸片遮住透镜的上半部分，像会怎样？',
    options: ['只剩上面一半', '只剩下面一半', '像完整，但变暗了'],
    answerIndex: 2,
    explanation:
      '像的位置和大小只由物距和焦距决定，与透镜通光面积无关。遮住一半只减少进光量，像会完整保留并变暗。',
    misconceptionId: 'MIS-O2-04',
  },
  {
    id: 'BQ-O2-13-medium',
    knowledgeId: 'K-O2-13',
    level: 'medium',
    type: 'single',
    question: '光屏上没找到像，最可能的原因是什么？',
    options: ['透镜坏了', '光屏放的位置不对', '蜡烛不够亮'],
    answerIndex: 1,
    explanation:
      '最常见的原因是光屏没放到像的位置。前后挪一挪就能看到——从模糊到清晰再到模糊，最清楚的那一点就是像。',
    misconceptionId: 'MIS-O2-07',
  },
  {
    id: 'BQ-O2-13-hard',
    knowledgeId: 'K-O2-13',
    level: 'hard',
    type: 'single',
    question:
      '光屏上的像有点模糊。下面三种做法，哪种一定能变清晰？',
    options: [
      '把蜡烛往透镜方向挪一点',
      '把光屏前后移动，找到最清晰的位置',
      '把透镜换成焦距更大的',
    ],
    answerIndex: 1,
    explanation:
      '「模糊」的直接原因是光屏不在像的位置（弥散圆不为零）。挪光屏是在「对准」，一定有效；挪蜡烛或换透镜会改变像的位置，得重新对焦，不能保证立刻清晰。',
  },
  {
    id: 'BQ-O2-06-easy',
    knowledgeId: 'K-O2-06',
    level: 'easy',
    type: 'single',
    question: '物距等于两倍焦距时，像是什么样？',
    options: ['倒立、等大的实像', '倒立、缩小的实像', '正立、等大的虚像'],
    answerIndex: 0,
    explanation: 'u = 2f 时 v = 2f，放大率恰好是 −1，成倒立等大的实像。这是「放大」和「缩小」的分界线。',
  },
  {
    id: 'BQ-O2-07-medium',
    knowledgeId: 'K-O2-07',
    level: 'medium',
    type: 'single',
    question: '焦距 f = 10 cm，物体在 15 cm 处。像的性质和像距分别是？',
    options: ['倒立放大，v = 30 cm', '倒立缩小，v = 6 cm', '正立放大，v = −30 cm'],
    answerIndex: 0,
    explanation:
      'f < u = 15 cm < 2f = 20 cm，属于「一倍到二倍焦距之间」。由 1/f = 1/u + 1/v 得 v = 30 cm，放大率 2 倍。投影仪就是这个原理。',
  },
  {
    id: 'BQ-O2-10-easy',
    knowledgeId: 'K-O2-10',
    level: 'easy',
    type: 'judge',
    question: '虚像是「假的」，所以实际上并不存在。这句话对吗？',
    options: ['对，虚像只是错觉', '不对，虚像真实存在，只是光屏接不住'],
    answerIndex: 1,
    explanation:
      '虚像真实存在：眼睛能看到、相机也拍得到。它只是不能被光屏承接，因为光线并没有在那里真的相交。',
    misconceptionId: 'MIS-O2-03',
  },
  {
    id: 'BQ-O2-11-medium',
    knowledgeId: 'K-O2-11',
    level: 'medium',
    type: 'single',
    question:
      '成实像时，把蜡烛从远处慢慢移近透镜（仍在焦距以外），光屏该怎么配合？',
    options: ['往透镜方向挪', '往远离透镜的方向挪', '不用挪'],
    answerIndex: 1,
    explanation:
      '物近像远。u 变小，由 1/f = 1/u + 1/v 得 v 变大，光屏要往远处挪。这也是照相机对焦时镜头的动作。',
  },
  {
    id: 'BQ-O2-11-hard',
    knowledgeId: 'K-O2-11',
    level: 'hard',
    type: 'single',
    question:
      '蜡烛从 2f 处继续向焦点移动。像距和像高会怎么变？',
    options: [
      '像距变大、像高变大，而且越来越快',
      '像距变大、像高变大，速度均匀',
      '像距变大，但像高不变',
    ],
    answerIndex: 0,
    explanation:
      'v = uf/(u−f)，u 逼近 f 时分母趋于 0，v 趋于无穷——所以变化越来越快。像高 = |v/u|·h 也跟着爆涨。这正是把物体放在焦点附近做投影很危险的原因。',
    misconceptionId: 'MIS-O2-06',
  },
  {
    id: 'BQ-O2-03-easy',
    knowledgeId: 'K-O2-03',
    level: 'easy',
    type: 'single',
    question: '平行于主光轴的光射向凸透镜，折射后会怎样？',
    options: ['仍然平行', '经过另一侧的焦点', '经过光心'],
    answerIndex: 1,
    explanation: '平行光经过凸透镜后会聚于焦点——这正是焦距的定义方式：用太阳光测焦距就是靠这一条。',
  },
  {
    id: 'BQ-O2-04-medium',
    knowledgeId: 'K-O2-04',
    level: 'medium',
    type: 'single',
    question:
      '画光路图时，如果一条光线经过透镜光心，它的方向会怎样？',
    options: ['偏向主光轴', '远离主光轴', '方向不变'],
    answerIndex: 2,
    explanation:
      '过光心的光线方向不变。因为它穿过透镜中心那一点，两侧表面平行，偏折相互抵消。三条特殊光线里，这条最省事。',
  },
  {
    id: 'BQ-O2-15-medium',
    knowledgeId: 'K-O2-15',
    level: 'medium',
    type: 'single',
    question: '照相机、投影仪、放大镜用的都是凸透镜。它们的区别在哪？',
    options: ['镜片材料不同', '物体放在不同的物距区间', '透镜大小不同'],
    answerIndex: 1,
    explanation:
      '镜片本身没变，变的是物体放在哪一段：u > 2f 是相机，f < u < 2f 是投影仪，u < f 是放大镜。',
    misconceptionId: 'MIS-O2-08',
  },
  {
    id: 'BQ-O2-14-easy',
    knowledgeId: 'K-O2-14',
    level: 'easy',
    type: 'single',
    question: '近视眼需要戴什么透镜矫正？',
    options: ['凸透镜', '凹透镜', '不需要戴'],
    answerIndex: 1,
    explanation:
      '近视是晶状体会聚太猛，像落在视网膜前面。凹透镜先让光散一散，把它推回视网膜上。远视相反，用凸透镜。',
  },
  {
    id: 'BQ-O3-01-hard',
    knowledgeId: 'K-O3-01',
    level: 'hard',
    type: 'single',
    question:
      'f = 10 cm，u = 8 cm。用 1/f = 1/u + 1/v 算出来 v = −40 cm。这个负号表示什么？',
    options: [
      '算错了，像距不能是负数',
      '像在透镜左侧，是虚像',
      '像在透镜右侧 40 cm 处',
    ],
    answerIndex: 1,
    explanation:
      '按符号约定，v < 0 表示像和物体同侧（透镜左侧），也就是虚像。负号不是「算错」，而是「虚」的标记。',
    misconceptionId: 'MIS-O2-03',
  },
];

/* ============================================================
 * 自动派生题：从 knowledge-prompts.json 生成
 * ========================================================== */

import PROMPTS from '@knowledge/knowledge-prompts.json';

interface PromptEntry {
  id: string;
  title: string;
  domainLabel: string;
  stageLabel: string;
  support: 'direct' | 'approximation' | 'conceptual';
  objective: string;
  construction: string;
  variables: string[];
  observations: string[];
  limitations: string;
  models: string[];
  formula?: string;
}

const SUPPORT_TEXT: Record<string, string> = {
  direct: '可以用平台的数值求解器算出来',
  approximation: '只能做近似/类比演示，数值不准',
  conceptual: '只有示意图，没有数值求解器',
};

function derive(entry: PromptEntry, all: PromptEntry[]): BankQuestion[] {
  const out: BankQuestion[] = [];
  const base = entry.id;

  // easy：这个知识点学完之后，能观察到什么
  if (entry.observations.length >= 2) {
    out.push({
      id: `BQ-${base}-easy`,
      knowledgeId: entry.id,
      level: 'easy',
      type: 'single',
      question: `研究「${entry.title}」时，下面哪一项是应该去测量的？`,
      options: [
        ...entry.observations.slice(0, 2),
        ...all
          .filter((p) => p.id !== entry.id && p.domainLabel === entry.domainLabel)
          .flatMap((p) => p.observations)
          .slice(0, 1),
      ].slice(0, 3),
      answerIndex: 0,
      explanation: `这一条要看的是：${entry.observations.join('；')}。`,
    });
  }

  // medium：模型边界
  if (entry.limitations) {
    out.push({
      id: `BQ-${base}-medium`,
      knowledgeId: entry.id,
      level: 'medium',
      type: 'single',
      question: `关于「${entry.title}」，下面哪句话是对的？`,
      options: [
        SUPPORT_TEXT[entry.support],
        '这个实验可以精确预测任何真实装置的表现',
        '这一条没有任何适用条件',
      ],
      answerIndex: 0,
      explanation: `平台对这个知识点的标注是「${
        entry.support === 'direct' ? '可计算' : entry.support === 'approximation' ? '近似' : '仅示意'
      }」。边界：${entry.limitations}`,
    });
  }

  // hard：变量与因果
  if (entry.variables.length > 0 && entry.formula) {
    out.push({
      id: `BQ-${base}-hard`,
      knowledgeId: entry.id,
      level: 'hard',
      type: 'single',
      question: `「${entry.title}」涉及 ${entry.formula}。如果要研究它的规律，最合理的做法是？`,
      options: [
        `只改变「${entry.variables[0]}」，其他条件保持不变，看结果怎么变`,
        '把所有变量同时调到最大',
        '只读数不改变任何条件',
      ],
      answerIndex: 0,
      explanation:
        '研究规律要做「控制变量」：一次只改一个，才能把结果的变化归因到它头上。同时改多个，就分不清是谁起的作用。',
    });
  }

  return out;
}

const ALL_PROMPTS = PROMPTS as PromptEntry[];
const derived: BankQuestion[] = ALL_PROMPTS.flatMap((e) => derive(e, ALL_PROMPTS));

/** 全部题目 */
export const BANK: BankQuestion[] = [...HANDWRITTEN, ...derived];

export const bankForKnowledge = (knowledgeId: string) =>
  BANK.filter((q) => q.knowledgeId === knowledgeId);

export const bankForLevel = (knowledgeId: string, level: QuizLevel) =>
  BANK.filter((q) => q.knowledgeId === knowledgeId && q.level === level);

/** 给某个知识点抽一套（每级一题，缺的跳过） */
export function quizSetFor(knowledgeId: string): BankQuestion[] {
  const out: BankQuestion[] = [];
  (['easy', 'medium', 'hard'] as QuizLevel[]).forEach((lv) => {
    const hit = bankForLevel(knowledgeId, lv)[0];
    if (hit) out.push(hit);
  });
  return out;
}

/** 统计 */
export const bankStats = () => {
  const byLevel: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  BANK.forEach((q) => (byLevel[q.level] = (byLevel[q.level] ?? 0) + 1));
  const ids = new Set(BANK.map((q) => q.knowledgeId));
  return { total: BANK.length, byLevel, knowledgeCovered: ids.size };
};
