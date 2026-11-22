import { EXTRA_HANDWRITTEN } from './question-bank-extra';

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
 *   其余知识点从 knowledge-prompts.json 的 objective / construction / formula /
 *   limitations / models 派生题目
 *
 * 每道题都有 explanation（总解析）和 optionNotes（逐项解析，告诉你每个选项
 * 为什么对、为什么错）。选项在显示时会打乱顺序，答案位置不固定。
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
  /** 总解析：正确答案为什么对、这道题考的是什么 */
  explanation: string;
  /** 逐项解析：optionNotes[i] 解释 options[i]（含正确项），比 explanation 更细 */
  optionNotes?: string[];
  /** 挂在哪个误区上（有就记进错题本） */
  misconceptionId?: string;
}

/**
 * 手写题：凸透镜 26 个知识点里的核心部分
 * 题目参考中考真题风格，答案由我们的引擎验证过
 */
const OPTICS_HANDWRITTEN: BankQuestion[] = [
  {
    id: 'BQ-O2-05-easy',
    knowledgeId: 'K-O2-05',
    level: 'easy',
    type: 'single',
    question: '焦距 f = 10 cm 的凸透镜，把蜡烛放在距透镜 30 cm 处。光屏上成的像是什么？',
    options: ['倒立、缩小的实像', '倒立、放大的实像', '正立、放大的虚像'],
    answerIndex: 0,
    explanation: 'u = 30 cm > 2f = 20 cm，物距大于二倍焦距，成倒立缩小的实像。照相机就是这个原理。',
    optionNotes: [
      '对。u = 30 cm > 2f = 20 cm，物距大于二倍焦距，成倒立缩小的实像，照相机就是这个区间。',
      '这是 f < u < 2f 的区间（投影仪），物距要更小才会成放大的像。',
      '正立放大的虚像只在 u < f 时出现，那是放大镜的用法，光屏接不到。',
    ],
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
    optionNotes: [
      '对。u = 20 cm > 2f = 16 cm，v ≈ 13.3 cm，倒立缩小的像落在另一侧 13.3 cm。',
      '倒立放大要 f < u < 2f，20 cm 已超出二倍焦距 16 cm，而且算出来像距也不是 30 cm。',
      '不成像只会发生在 u = f；这里 u = 20 cm 是 f 的 2.5 倍，实像一定存在，只是要找对位置。',
    ],
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
    optionNotes: [
      '方向弄反了：物距变大时像距反而变小，像也跟着变小，不是变大。',
      '对。u 从 3f 增到 4f，v 从 1.5f 减到 1.33f，物远像近像变小，屏要往透镜这边收。',
      '只有 u = 2f 那一点放大率才是 1，3f 和 4f 的放大率分别是 0.5 和 0.33，两次不相等。',
    ],
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
    optionNotes: [
      'u < f 时出射光是发散的，只能反向延长才相交，光屏放在哪儿都接不到。',
      '对。u = 6 cm < f = 10 cm，成正立放大的虚像，只能透过透镜用眼睛看，屏上接不住。',
      '缩小实像要求 u > 2f = 20 cm，这里物距比焦距还小，差了一整个成像区间。',
    ],
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
    optionNotes: [
      '对。放大镜成正立放大的虚像，条件是 u < f，字要放在焦点以内才看得到放大的字。',
      'f < u < 2f 成的是倒立放大的实像，那是投影仪，字会上下颠倒，不能当放大镜用。',
      'u > 2f 成倒立缩小的实像，那是照相机的用法，字反而变小了。',
    ],
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
    optionNotes: [
      'u = f 时出射光线严格平行，没有交点；屏上只有一片均匀的光，不会「特别大」。',
      '对。u = f 时折射光互相平行，交点跑到无穷远，光屏上接不到任何像。',
      'u > 2f 才成特别小的像，物体在焦点上根本没有像点，谈不上大小。',
    ],
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
    optionNotes: [
      '平行光线根本不相交，也就没有像点，「成像在无穷远」只是把 v → ∞ 硬套公式的说法。',
      '对。出射的是平行光，屏上那道亮斑直径约等于透镜口径，怎么看都不是一个「像点」。',
      '透镜左侧是物体所在的那一侧，那里没有出射光相交，把屏挪过去只会挡住物方的光路。',
    ],
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
    optionNotes: [
      '透镜上半被挡只少了那一部分光，每个物点仍有下半的光参与成像，像不会缺一块。',
      '换个方向遮结果一样：缺一半的情况不存在，像的大小形状只由物距和焦距定，跟通光面积无关。',
      '对。像的位置和大小只由 u、f 决定，遮住一半只减少进光量，像完整保留但整体变暗。',
    ],
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
    optionNotes: [
      '透镜损坏这种情况很少见，而且通常一眼就能看出来（有裂纹、划痕），不是首选的怀疑对象。',
      '对。像成在某个特定位置，屏不在那儿就只能看到弥散圆，前后挪一挪就能找到最清晰处。',
      '蜡烛暗只会让像更暗，位置对了仍能看到轮廓；找不到像的典型原因是光屏位置不对。',
    ],
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
    optionNotes: [
      '挪蜡烛会改变像的位置，原来的屏就更对不上了，还得连屏一起重调，不保证变清晰。',
      '对。模糊就是光屏不在像面上，前后移动屏去「对准」像的位置，一定能找到最清晰的那一点。',
      '换透镜等于换了焦距，像距和像高全变，还得重新找位置，同样不保证立刻变清晰。',
    ],
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
    optionNotes: [
      '对。u = 2f 时 v = 2f，|m| = v/u = 1，成倒立等大的实像，这是放大与缩小的分界线。',
      '倒立缩小要求 u > 2f，物体正好在 2f 上时放大率恰好是 1，不会缩小。',
      '正立等大是平面镜给的虚像；凸透镜在 u = 2f 处成的是倒立等大的实像，正倒就记反了。',
    ],
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
    optionNotes: [
      '对。f < u = 15 cm < 2f，v = 150/5 = 30 cm，放大 2 倍，属于投影仪的区间。',
      '倒立缩小要求 u > 2f = 20 cm；像距也不对，15 cm 的物算出来是 30 cm 而不是 6 cm。',
      'v 取负只出现在 u < f 的虚像情形，15 cm 已经大于焦距，成的是实像，像距为正。',
    ],
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
    optionNotes: [
      '虚像不是错觉：眼睛确实接收到了发散光线，相机也拍得下来，只是光屏上接不到。',
      '对。虚像由实际光线反向延长相交而成，真实存在、看得见也拍得到，只是没有光线真的在那里相交。',
    ],
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
    optionNotes: [
      '方向弄反了：物近像远，u 变小 v 就变大，屏要往远离透镜的方向挪，往透镜挪只会更模糊。',
      '对。物近像远像变大，u 减小则 v 增大，光屏要往远离透镜的方向挪才能重新接到清晰的像。',
      '只有 u 不变时才不用挪；物距一改像距必然跟着变，屏不动就只剩一片弥散圆。',
    ],
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
    optionNotes: [
      '对。v = uf/(u−f)，u 逼近 f 时分母趋于零，v 和像高都加速膨胀，变化越来越剧烈。',
      '变化不是均匀的：分母 (u−f) 越来越小，v 的增长是加速的，越靠近焦点越猛烈。',
      '像高 = |v/u|·h，v 变大的同时 u 变小，两者一起把像高推上去，不可能保持不变。',
    ],
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
    optionNotes: [
      '出射后仍平行是凹透镜对平行光的效果；凸透镜一定会把平行光收拢。',
      '对。平行于主光轴的光经凸透镜后必过另一侧焦点，用太阳光测焦距就是靠这一条。',
      '过光心且方向不变的是另一条特殊光线，它本身就是斜着射向光心的，不是平行入射。',
    ],
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
    optionNotes: [
      '向主轴偏折是平行入射光的走法，过光心的光线没有这个偏折。',
      '远离主轴是凹透镜对平行光的效果；凸透镜光心处的偏折正负相抵，方向不变。',
      '对。光心附近两侧表面近似平行，两个界面上的偏折大小相等方向相反，合起来方向不变。',
    ],
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
    optionNotes: [
      '三种器具装的都是玻璃凸透镜，材料并无不同，差别不在镜片上。',
      '对。u > 2f 是照相机（缩小实像），f < u < 2f 是投影仪（放大实像），u < f 是放大镜（虚像）。',
      '透镜口径只影响进光量和亮度，成像性质由 u 与 f 的关系决定，跟镜片大小无关。',
    ],
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
    optionNotes: [
      '凸透镜会聚光，戴上后像落得更靠前，那是矫正远视用的，近视戴了只会更糟。',
      '对。近视是晶状体太会聚、像落在视网膜前，凹透镜先让光发散，把像往后推到视网膜上。',
      '不戴虽然近处还看得清，但远处一直是模糊的，近视的标准矫正办法就是配凹透镜。',
    ],
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
    optionNotes: [
      '负号不是算错，而是符号约定的结果：v < 0 表示像在入射侧，属于虚像。',
      '对。u = 8 cm < f = 10 cm 本就该成虚像，v = −40 cm 表示像在同侧 40 cm，正立放大。',
      '右侧 40 cm 对应的是 v = +40 cm；负号的意义恰恰是「不在右边」，而在物体这一侧。',
    ],
    misconceptionId: 'MIS-O2-03',
  },
  /* ===== 补齐：其余 13 个此前没有题的光学知识点 ===== */
  {
    id: 'BQ-O1-01-easy',
    knowledgeId: 'K-O1-01',
    level: 'easy',
    type: 'single',
    question: '打开手电筒，光为什么能照到对面的墙上？',
    options: ['光沿直线一直往前走，碰到墙才停下', '光会自己拐弯去找墙', '光是墙发出来的'],
    answerIndex: 0,
    explanation: '光在同一种物质里沿直线传播。手电筒对着墙，光就直直地走过去，照到墙上被挡住，那里就亮了。',
    optionNotes: [
      '对。光在同一种均匀介质里沿直线传播，手电筒的光直直打到墙上被挡住，那里就亮了。',
      '光不会自己拐弯去找目标，只有遇到另一种介质发生折射或反射，方向才会改变。',
      '墙不会发光，看到的亮是墙把照上去的光漫反射进眼睛，光源是手电筒而不是墙。',
    ],
  },
  {
    id: 'BQ-O1-01-medium',
    knowledgeId: 'K-O1-01',
    level: 'medium',
    type: 'single',
    question: '下面哪个现象最能说明「光是沿直线传播的」？',
    options: ['晴天树下的影子', '镜子里看见自己', '水里的筷子看起来断了'],
    answerIndex: 0,
    explanation: '影子是光被物体挡住后留下的暗区。如果光会拐弯，它就能绕到物体背后，影子边缘就不会那么清楚，也不会有清晰的轮廓。',
    optionNotes: [
      '对。影子是光被挡住留下的暗区，只有光走直线、绕不到障碍物背后，才留下边缘清楚的影子。',
      '镜中看见自己是光的反射，说明光会改变方向，恰恰不是「沿直线传播」的证据。',
      '筷子看起来断了是折射现象，光在水面拐了弯，反而说明光在不同介质里会偏折。',
    ],
  },
  {
    id: 'BQ-O1-01-hard',
    knowledgeId: 'K-O1-01',
    level: 'hard',
    type: 'single',
    question: '下面哪种情况下，「光沿直线传播」这句话不再成立？',
    options: ['光从空气斜着射进水里时', '光在真空中传播时', '光在均匀的空气中传播时'],
    answerIndex: 0,
    explanation: '「沿直线」有个前提：在同一种均匀物质里。一旦跨到另一种物质（比如空气进水），光在交界面上就会拐弯——那就是折射。',
    optionNotes: [
      '对。光从空气斜射入水会在界面发生折射，方向突然改变，那一段路径不再沿原来的直线。',
      '真空是均匀介质，光在里面严格走直线，这句话在这里完全成立——题目要的是「不成立」的场合。',
      '均匀空气正是「同一种均匀介质」，光在里面走直线，这句话照旧成立，不是要找的反例。',
    ],
  },
  {
    id: 'BQ-O1-02-easy',
    knowledgeId: 'K-O1-02',
    level: 'easy',
    type: 'single',
    question: '用纸盒和小孔看窗外的树，屏上出现的树是？',
    options: ['倒立的', '正立的', '什么都没有'],
    answerIndex: 0,
    explanation: '树顶发出的光穿过小孔后跑到屏的下方，树根的光跑到上方，所以像是倒的。这叫小孔成像。',
    optionNotes: [
      '对。树顶的光穿过小孔落到屏的下方，树根的光落到上方，所以屏上的像是上下颠倒的。',
      '小孔成像一定是上下颠倒的；镜子、放大镜里那些「正立」的像来自虚像，跟小孔无关。',
      '小孔成像不需要透镜，只要孔够小、屏够暗，屏上就一定有像，不会空无一物。',
    ],
  },
  {
    id: 'BQ-O1-02-medium',
    knowledgeId: 'K-O1-02',
    level: 'medium',
    type: 'single',
    question: '小孔成的像为什么是倒的？',
    options: [
      '每个物点发出的光只穿过小孔中的一条，落到对面相反的位置',
      '小孔把光折断了',
      '孔太小导致光乱掉了',
    ],
    answerIndex: 0,
    explanation: '物体上每一点都向四面八方发光，但只有正对小孔的那一条能穿过去，于是各点各就各位，在对面拼出一个上下颠倒的像。',
    optionNotes: [
      '对。物体每点都向四面八方发光，只有正对小孔那一条能穿过，于是上下各点在屏上交叉互换。',
      '小孔不是棱镜，光穿过它基本不改变方向，倒像来自几何上的交叉，与折射无关。',
      '孔小恰恰是成像清楚的原因：每点只放一条光进去；孔大了才会「乱」，反而成不了清晰的像。',
    ],
  },
  {
    id: 'BQ-O1-02-hard',
    knowledgeId: 'K-O1-02',
    level: 'hard',
    type: 'single',
    question: '把小孔开大一些，屏上的像会怎么变？',
    options: ['变亮，但变模糊', '变暗，但更清楚', '完全消失'],
    answerIndex: 0,
    explanation: '孔变大，通过的光变多所以更亮；但每个物点能穿过的不再只有一条光，而是一小片，落在屏上就糊开了。亮和清晰在这里是矛盾的。',
    optionNotes: [
      '对。孔大进光多所以更亮，但每个物点进来的是一小片光，落到屏上摊开成弥散斑，像就糊了。',
      '两处都说反了：孔开大变亮而不是变暗，同时清晰度下降而不是提高。',
      '孔再大也只是变模糊，光还在照，屏上仍有亮斑和轮廓，不会凭空消失。',
    ],
  },
  {
    id: 'BQ-O1-03-easy',
    knowledgeId: 'K-O1-03',
    level: 'easy',
    type: 'single',
    question: '你能在镜子里看见自己，是因为？',
    options: ['光照到你身上，再被镜子反射回你的眼睛', '镜子自己会发光', '眼睛能穿过镜子看到自己'],
    answerIndex: 0,
    explanation: '镜子本身不发光。是光先照到你，你身上反射出去的光碰到镜面弹回来，才进了你的眼睛。没有光就照不出镜子。',
    optionNotes: [
      '对。镜子本身不发光，是光照到你身上，你反射的光碰到镜面再弹回来，才进了你的眼睛。',
      '平面镜不会自己发光，黑屋子里照镜子什么都看不见，正说明它靠的是外界的光。',
      '眼睛看不穿镜子，镜面背后是镀层；你看到的只是镜面前方的反射像。',
    ],
  },
  {
    id: 'BQ-O1-03-medium',
    knowledgeId: 'K-O1-03',
    level: 'medium',
    type: 'single',
    question: '照镜子时，为什么镜子里的钟面左右是反的？',
    options: ['反射把光的方向掉了个头，左右跟着反转', '镜子是特殊材料会翻转图像', '纯粹是眼睛的错觉'],
    answerIndex: 0,
    explanation: '镜子不改变上下，只把前后翻过去。因为我们是站在前面看，前后一翻，看起来就像左右被调换了。',
    optionNotes: [
      '对。平面镜只把前后方向翻过去，上下没变；人站在镜前看，前后一翻就像左右调换了。',
      '镜子没有「翻转图像」的特殊材料，任何光滑金属面效果都一样，靠的是反射定律。',
      '这不是错觉：镜子里的字确实左右相反，用相机去拍镜子得到的结果也一样。',
    ],
  },
  {
    id: 'BQ-O1-03-hard',
    knowledgeId: 'K-O1-03',
    level: 'hard',
    type: 'single',
    question: '一束光垂直照到平面镜上，反射光往哪个方向走？',
    options: ['沿原路返回', '垂直向上飞出去', '贴着镜面滑走'],
    answerIndex: 0,
    explanation: '垂直入射时入射角是 0°，反射角也是 0°，所以光原路返回。夜里骑车反光片特别亮，用的就是这个道理。',
    optionNotes: [
      '对。垂直入射时入射角是 0°，反射角也是 0°，光沿原路返回，自行车尾灯就靠这个。',
      '「飞出去」听起来像光穿过镜面继续往前走了；实际上反射光是回到入射的那一侧，方向与入射光相反。',
      '贴着镜面走要求入射角接近 90°，那叫掠射；这里入射角是 0°，光是正对镜面打上去的。',
    ],
  },
  {
    id: 'BQ-O1-04-easy',
    knowledgeId: 'K-O1-04',
    level: 'easy',
    type: 'single',
    question: '把筷子插进水杯，看起来像断了一截，为什么？',
    options: [
      '光从水进空气时拐了弯，眼睛却以为它一路都是直的',
      '水真的把筷子折断了',
      '杯子玻璃太厚造成的',
    ],
    answerIndex: 0,
    explanation: '水下那截筷子反射的光，从水里出来时在水面拐了个弯。眼睛不知道它拐了，顺着最后的方向往回推，就推到了一个偏了的位置——看起来就断了。',
    optionNotes: [
      '对。水下那段筷子反射的光在水面折射后偏离了原方向，眼睛顺着直线反推，就把它看成错位的。',
      '筷子并没有断，看到的错位是光的折射造成的视觉位置偏差，跟固体形变无关。',
      '杯壁玻璃很薄，造成的偏移远小于水面折射；换成薄壁杯，筷子照样会「断」。',
    ],
  },
  {
    id: 'BQ-O1-04-medium',
    knowledgeId: 'K-O1-04',
    level: 'medium',
    type: 'single',
    question: '光从空气斜着射进水里，会怎么走？',
    options: ['向法线靠拢，折射角比入射角小', '离法线更远', '方向完全不变'],
    answerIndex: 0,
    explanation: '水比空气「光密」，光进去以后变慢，方向就向法线偏。这是折射最基本的规律。',
    optionNotes: [
      '对。水比空气光密，光进水后传播变慢，方向向法线偏折，折射角小于入射角。',
      '这是从水射向空气的情形；空气进水恰好相反，是靠近法线而不是远离。',
      '只有垂直入射时方向才不变；斜射一定要偏折，否则就不会有「筷子变断」的现象。',
    ],
  },
  {
    id: 'BQ-O1-04-hard',
    knowledgeId: 'K-O1-04',
    level: 'hard',
    type: 'single',
    question: '光从空气垂直射进水里，方向会变吗？',
    options: ['不变，仍然垂直向下', '会向法线靠拢', '会全部反射回去'],
    answerIndex: 0,
    explanation: '垂直入射时整束光的对称性没被打破，没有「该往哪边偏」的理由，所以直着进去。这也是为什么隔着玻璃看东西不会变形。',
    optionNotes: [
      '对。垂直入射时入射角为 0°，光线本来就沿法线，折射后仍沿法线，方向不变。',
      '靠拢以「已经偏离法线」为前提；垂直入射时光线就压在法线上，偏折与否方向都一样。',
      '全部反射要求从光密射向光疏且超过临界角；垂直入射进水面时仍有大部分光进入水中。',
    ],
  },
  {
    id: 'BQ-O1-05-easy',
    knowledgeId: 'K-O1-05',
    level: 'easy',
    type: 'single',
    question: '用放大镜看字，想看得更大应该怎么办？',
    options: ['把放大镜靠近字', '把放大镜举得很远', '放哪儿都一样大'],
    answerIndex: 0,
    explanation: '放大镜是凸透镜。东西离它比焦距近的时候成的是正立放大的虚像，靠得越近（但不贴上去）看起来越大。',
    optionNotes: [
      '对。这里比的是视角：眼睛贴着透镜时，字越近张角 h/u 越大，看着更大，但要始终在焦距以内。',
      '举远会超过焦距，像翻成倒立的实像，字不仅不放大还会上下颠倒。',
      '距离一变就跨过焦距、成像性质整个换掉；同一行字放远放近张角也不同，不可能一样大。',
    ],
  },
  {
    id: 'BQ-O1-05-medium',
    knowledgeId: 'K-O1-05',
    level: 'medium',
    type: 'single',
    question: '把放大镜慢慢远离书本，超过某个距离后看到的会变成？',
    options: ['倒过来的像', '更小的正立像', '完全看不见'],
    answerIndex: 0,
    explanation: '一旦物距超过焦距，凸透镜就成倒立的实像了。所以放大镜拿太远，字会突然翻过来——很多人第一次看到都会愣一下。',
    optionNotes: [
      '对。物距一旦超过焦距，凸透镜就成倒立实像，所以字会突然翻过来，距离再大还会变小。',
      '超过焦距后正立虚像变成倒立实像，不存在「更小的正立像」这一档。',
      '光一直都在，眼睛也能接收到实像的光，只是方向翻了，不会完全看不见。',
    ],
  },
  {
    id: 'BQ-O1-05-hard',
    knowledgeId: 'K-O1-05',
    level: 'hard',
    type: 'single',
    question: '用放大镜当放大镜用时，成的像是实像还是虚像？',
    options: ['虚像，接不住，只能用眼睛看', '实像，能投在光屏上', '一半实一半虚'],
    answerIndex: 0,
    explanation: '物距小于焦距时，出射光线是发散的，反向延长才交于一点。这种像没法用光屏接住，只能眼睛看——这就是虚像。',
    optionNotes: [
      '对。u < f 时出射光线发散，只能反向延长相交，光屏接不到，这就是正立放大的虚像。',
      '能投在屏上的是实像，需要 u > f 让光线真的相交；放大镜的工作区间恰好与它相反。',
      '一个像要么实要么虚，取决于出射光线是否真的相交，不存在「一半实一半虚」。',
    ],
  },
  {
    id: 'BQ-O2-01-easy',
    knowledgeId: 'K-O2-01',
    level: 'easy',
    type: 'single',
    question: '光从空气斜射进水里，折射角和入射角的关系是？',
    options: ['折射角小于入射角', '折射角大于入射角', '两者相等'],
    answerIndex: 0,
    explanation: '水比空气光密，光进去变慢，向法线靠拢，所以折射角更小。',
    optionNotes: [
      '对。水比空气光密，光进水后传播变慢并向法线偏折，所以折射角小于入射角。',
      '折射角大于入射角是从水射向空气的情形，方向搞反了。',
      '两角相等只发生在垂直入射（都是 0°）或两侧介质相同时，斜射入水一定不相等。',
    ],
  },
  {
    id: 'BQ-O2-01-medium',
    knowledgeId: 'K-O2-01',
    level: 'medium',
    type: 'single',
    question: '反过来，光从水里斜射进空气，折射角会？',
    options: ['大于入射角', '小于入射角', '等于入射角'],
    answerIndex: 0,
    explanation: '光路是可逆的。从空气进水时折射角变小，那从水出空气时折射角就变大——两个方向永远对得上。',
    optionNotes: [
      '对。光路是可逆的：空气进水时折射角变小，反过来水出空气时折射角就变大。',
      '这是空气射入水的结果；射向光疏介质时方向远离法线，角度反而更大。',
      '只有垂直入射时两个角才都等于 0°；斜射时一定是一大一小，不会相等。',
    ],
  },
  {
    id: 'BQ-O2-01-hard',
    knowledgeId: 'K-O2-01',
    level: 'hard',
    type: 'single',
    question: '入射角逐渐增大时，折射角怎么变？',
    options: ['跟着增大，但增大的幅度更大', '保持不变', '反而减小'],
    answerIndex: 0,
    explanation: '两者同步增大，但不是等比例。从水射向空气时，折射角涨得比入射角快，涨到 90° 就发生全反射——光再也出不去了。',
    optionNotes: [
      '对。两者同步增大但不是等比例，从水射向空气时折射角涨得更快，到 90° 就发生全反射。',
      '入射角一变，折射角必然跟着变，由 n₁sin i = n₂sin r 决定，不会原地不动。',
      '折射角随入射角单调增大，方向始终一致，绝不会反着减小。',
    ],
  },
  {
    id: 'BQ-O2-02-easy',
    knowledgeId: 'K-O2-02',
    level: 'easy',
    type: 'single',
    question: '中间厚、边缘薄的镜片，对光起什么作用？',
    options: ['会聚，叫凸透镜', '发散，叫凹透镜', '什么也不做，叫平面镜'],
    answerIndex: 0,
    explanation: '中间厚就是凸透镜，平行光穿过它会被收拢到焦点上。放大镜、照相机镜头、近视眼镜（凹透镜）都是这个家族。',
    optionNotes: [
      '对。中间厚边缘薄就是凸透镜，平行光穿过会被收拢到焦点，放大镜和照相机镜头都是它。',
      '发散是凹透镜（中间薄、边缘厚）的效果，形状和这个正好相反。',
      '平面镜是反射元件，光是弹回来而不是穿过去，而且表面是平的，不中间厚。',
    ],
  },
  {
    id: 'BQ-O2-02-medium',
    knowledgeId: 'K-O2-02',
    level: 'medium',
    type: 'single',
    question: '平行光射到凹透镜上，出射光线会？',
    options: ['向外散开，反向延长交于一点（虚焦点）', '会聚到一点', '保持平行不变'],
    answerIndex: 0,
    explanation: '凹透镜把光撒开。散开的那些光线往回延长，会交在入射侧的一点上，那叫虚焦点——它不是真的有光聚在那儿。',
    optionNotes: [
      '对。凹透镜让平行光发散，发散光反向延长才交于入射侧一点，那是虚焦点，没有光真的聚在那儿。',
      '会聚到一点是凸透镜的作为；凹透镜把光越推越开，出射光永远不会真的相交。',
      '出射光并不平行，而是以入射侧的虚焦点为中心向外发散，这正是凹透镜的特征。',
    ],
  },
  {
    id: 'BQ-O2-02-hard',
    knowledgeId: 'K-O2-02',
    level: 'hard',
    type: 'single',
    question: '为什么透镜能让光会聚？根本原因是？',
    options: [
      '镜片各处厚度不同，光穿过后偏折的角度不同，叠起来就收拢了',
      '玻璃本身会吸引光',
      '镜片表面镀了特殊膜',
    ],
    answerIndex: 0,
    explanation: '本质还是折射。镜片中间厚、边缘薄，各处折射的角度不一样，合起来的效果就是把平行光收成一个点。',
    optionNotes: [
      '对。本质还是折射：镜片各处楔角不同，光穿过后偏折的角度不同，叠起来就把平行光收成一点。',
      '光在玻璃里只发生折射，没有「吸引光」这回事；会聚靠的是几何形状带来的偏折。',
      '镀膜是增透或滤光用的，不会让光会聚；不镀膜的普通玻璃透镜照样能会聚。',
    ],
  },
  {
    id: 'BQ-O2-12-easy',
    knowledgeId: 'K-O2-12',
    level: 'easy',
    type: 'single',
    question: '做凸透镜成像实验，开始之前要先把什么调到同一高度？',
    options: ['烛焰、透镜中心、光屏中心', '只要透镜和光屏对齐', '不用调，摆上就行'],
    answerIndex: 0,
    explanation: '三个中心要在同一条水平线上（也就是透镜的主轴上），像才会老老实实落在光屏中央。',
    optionNotes: [
      '对。烛焰、透镜中心、光屏中心要在同一高度（都在主光轴上），像才会落在光屏中央。',
      '只对齐透镜和光屏漏了烛焰；烛焰一偏，像整体平移，光屏上照样接不到。',
      '不调高度是实验里最常见的失手，像会偏出光屏，让人误以为「没成像」。',
    ],
  },
  {
    id: 'BQ-O2-12-medium',
    knowledgeId: 'K-O2-12',
    level: 'medium',
    type: 'single',
    question: '如果三心没有同高，最可能出现什么情况？',
    options: ['像偏到光屏外面，你可能以为「根本没成像」', '像会变得更清楚', '透镜的焦距会变'],
    answerIndex: 0,
    explanation: '这是实验里最常见的误判。像其实成了，只是掉到屏上方或下方去了。调高度这件事看着琐碎，不做就会白忙一场。',
    optionNotes: [
      '对。像沿主轴移动，烛焰偏离主轴时像也偏离屏心，常常整块落到屏外，看着就像没成像。',
      '高度错位只会让像偏出去或只露出一角，绝不会让清晰度提高。',
      '焦距由透镜本身的形状和材料决定，摆在什么高度都不会改变。',
    ],
  },
  {
    id: 'BQ-O2-12-hard',
    knowledgeId: 'K-O2-12',
    level: 'hard',
    type: 'single',
    question: '为什么偏偏要三心同高，而不是随便对齐就行？',
    options: [
      '透镜的主轴是水平的，像沿主轴移动，只有三心在轴上像才落在屏中央',
      '纯粹为了实验好看',
      '为了让光少损失一些',
    ],
    answerIndex: 0,
    explanation: '主轴是一条几何线，像点始终在它上面移动。烛焰不在轴上，像就整体平移出屏。所以这不是习惯，是几何决定的。',
    optionNotes: [
      '对。主轴是一条固定的几何线，像点始终落在轴上，只有烛焰也在轴上，像才落在屏中央。',
      '这不是审美问题：三心同高是几何要求，不同高像就整体平移出光屏。',
      '同高并不会减少光损失，它解决的是像落在哪儿的问题，不是亮度问题。',
    ],
  },
  {
    id: 'BQ-O3-02-easy',
    knowledgeId: 'K-O3-02',
    level: 'easy',
    type: 'single',
    question: '放大率公式 m = −v/u 里，那个负号表示什么？',
    options: ['像是倒立的', '像是虚像', '计算出错了'],
    answerIndex: 0,
    explanation: '负号是方向信息：说明像是倒的。正号才是正立。',
    optionNotes: [
      '对。m 是带符号的放大率，负号只表示倒立，绝对值才表示放大或缩小的倍数。',
      '虚实要看 v 的正负或 u 与 f 的关系；倒立实像的 m 为负，虚像的 m 反而是正的。',
      '负号是公式给出的信息，不是算错；删掉它反而丢掉了「倒立」这一条。',
    ],
  },
  {
    id: 'BQ-O3-02-medium',
    knowledgeId: 'K-O3-02',
    level: 'medium',
    type: 'single',
    question: '物距 u = 30 cm，像距 v = 15 cm，放大率是多少？',
    options: ['−0.5，即倒立、缩小一半', '+0.5，即正立、缩小一半', '−2，即倒立、放大两倍'],
    answerIndex: 0,
    explanation: 'm = −v/u = −15/30 = −0.5。绝对值 0.5 表示缩小一半，负号表示倒立。',
    optionNotes: [
      '对。m = −v/u = −15/30 = −0.5，绝对值 0.5 表示缩小一半，负号表示倒立。',
      '符号算丢了：v 和 u 都取正时 m 必为负，得到正的 0.5 说明漏掉了那个负号。',
      '倍数算反了：v/u = 15/30 = 0.5 而不是 2，v 比 u 还小，只能是缩小的像。',
    ],
  },
  {
    id: 'BQ-O3-02-hard',
    knowledgeId: 'K-O3-02',
    level: 'hard',
    type: 'single',
    question: 'm = −2 描述的是什么样的像？',
    options: ['倒立、放大到 2 倍', '正立、缩小到一半', '倒立、缩小到一半'],
    answerIndex: 0,
    explanation: '绝对值 2 = 放大两倍，负号 = 倒立。这就是投影仪的成像状态（f < u < 2f）。',
    optionNotes: [
      '对。绝对值 2 表示放大两倍，负号表示倒立，这正是 f < u < 2f 时投影仪的成像状态。',
      '符号和倍数都不对：正立要求 m > 0，而 −2 是负的；2 表示放大两倍，不是缩小一半。',
      '大小记反了：|m| = 2 是放大到两倍，缩小到一半应该写成 |m| = 0.5。',
    ],
  },
  {
    id: 'BQ-O3-03-easy',
    knowledgeId: 'K-O3-03',
    level: 'easy',
    type: 'single',
    question: '在凸透镜成像公式里，实像的像距 v 取正还是负？',
    options: ['正', '负', '零'],
    answerIndex: 0,
    explanation: '约定是：实像 v > 0（在透镜另一侧），虚像 v < 0（和物体同侧）。',
    optionNotes: [
      '对。约定实像在透镜另一侧，v 取正；虚像与物体同侧，v 取负。',
      'v 取负是虚像的标记（放大镜就是），实像的像距一律取正。',
      'v = 0 意味着像贴在透镜上，没有任何实际成像会这样，实像的像距一定是正值。',
    ],
  },
  {
    id: 'BQ-O3-03-medium',
    knowledgeId: 'K-O3-03',
    level: 'medium',
    type: 'single',
    question: '算出来 v = −20 cm，这说明什么？',
    options: ['成的是虚像，在物体这一侧 20 cm 处', '成的是实像，在透镜另一侧 20 cm', '算错了，像距不能是负的'],
    answerIndex: 0,
    explanation: '负号表示像在入射侧，也就是和物体同一边——这正是虚像的位置。放大镜就是这样。',
    optionNotes: [
      '对。v < 0 表示像在入射侧、与物同侧，是虚像，|v| = 20 cm 是它到透镜的距离。',
      '另一侧 20 cm 对应 v = +20 cm；负号恰恰说明像跑到了物体这一侧。',
      '负号是符号约定的正常结果，u < f 时正是这样，并不是算错了。',
    ],
  },
  {
    id: 'BQ-O3-03-hard',
    knowledgeId: 'K-O3-03',
    level: 'hard',
    type: 'single',
    question: '为什么非要约定一套符号，而不是全部取正数？',
    options: [
      '有了符号，同一条公式能同时管实像和虚像，不用分情况讨论',
      '只是历史上的习惯，没有实际作用',
      '为了让计算步骤更多',
    ],
    answerIndex: 0,
    explanation: '如果不带符号，实像和虚像就要写两套公式，还得先判断是哪种情况。符号约定把这两种情况合并成了一次计算。',
    optionNotes: [
      '对。带符号后 1/f = 1/u + 1/v 对实像虚像通用，算完看符号就知道虚实，不必先分类。',
      '符号有实际作用：它把虚实、正倒都编进了数值里，删掉就得写两套公式。',
      '符号让步骤更少而不是更多：一次代入就能同时处理实像和虚像两种情况。',
    ],
  },
  {
    id: 'BQ-O3-04-easy',
    knowledgeId: 'K-O3-04',
    level: 'easy',
    type: 'single',
    question: '从物点发出的任意一条光线，经凸透镜后一定经过？',
    options: ['像点', '焦点', '光心'],
    answerIndex: 0,
    explanation: '这才是「成像」的定义：所有从同一点发出的光线，出射后重新交于一点。',
    optionNotes: [
      '对。成像的定义就是同一点发出的所有光线出射后重新交于一点，那一点就是像点。',
      '只有平行于主轴的那一条特殊光线过焦点，其他方向的光线并不都过焦点。',
      '只有本身经过光心那条光线才过光心，从物点发出的其他光线一律不过。',
    ],
  },
  {
    id: 'BQ-O3-04-medium',
    knowledgeId: 'K-O3-04',
    level: 'medium',
    type: 'single',
    question: '作图时通常只画三条特殊光线，是因为？',
    options: ['它们的出射方向最好确定，画起来方便', '其他光线不成像', '其他光线会被镜框挡住'],
    answerIndex: 0,
    explanation: '平行于主轴的光过焦点、过光心的光不偏折、过焦点的光出射平行——这三条最好找。但任何一条光线都会过像点，用它们只是图省事。',
    optionNotes: [
      '对。平行主轴的光过焦点、过光心的不偏折、过焦点后出射平行，方向一看就定，作图最省事。',
      '所有光线都会过像点，其他光线照样参与成像，只是出射方向不好确定而已。',
      '理想透镜不设镜框限制，光线能不能过取决于透镜口径，与「是不是特殊光线」无关。',
    ],
  },
  {
    id: 'BQ-O3-04-hard',
    knowledgeId: 'K-O3-04',
    level: 'hard',
    type: 'single',
    question: '如果你画的某条光线出射后没通过像点，说明什么？',
    options: ['作图或计算有错，该重画', '这条光线比较特殊，可以不通过', '透镜坏了'],
    answerIndex: 0,
    explanation: '只要透镜是理想的，就没有例外。画出来不过像点，一定是某一步做错了——这反而是个很好的自检手段。',
    optionNotes: [
      '对。理想透镜下同一点发出的光线必然交于像点，画出来不交只能是作图或算 v 时出了错。',
      '没有「可以不通过」的光线，从物点发出的光都要交于同一像点，这是成像的前提。',
      '画出来不交像点跟透镜好坏无关：理想作图里，物点发出的每条光线都必须交于同一像点。',
    ],
  },
  {
    id: 'BQ-O3-05-easy',
    knowledgeId: 'K-O3-05',
    level: 'easy',
    type: 'single',
    question: '两个凸透镜前后串起来用，第二个透镜的「物」是什么？',
    options: ['第一个透镜成的像', '还是原来那个物体', '什么都没有'],
    answerIndex: 0,
    explanation: '逐级传递：前一个的像，就是后一个的物。显微镜和望远镜都是这么算的。',
    optionNotes: [
      '对。逐级传递是组合透镜的基本规则：前一级的像当作后一级的物，显微镜和望远镜都这么算。',
      '原来那个物体已经被第一片透镜「用」过了，到达第二片的是第一片形成的像。',
      '第二片透镜前总有光在走，也就总有物；说「什么都没有」等于让它退出成像。',
    ],
  },
  {
    id: 'BQ-O3-05-medium',
    knowledgeId: 'K-O3-05',
    level: 'medium',
    type: 'single',
    question: '如果第一个透镜成的是虚像，第二个透镜的物距该怎么处理？',
    options: ['按虚物的规则取负值', '当作没有物体直接跳过', '取零'],
    answerIndex: 0,
    explanation: '虚像落在第二个透镜的入射侧，对第二个透镜来说是「虚物」，物距要带负号。组合透镜的难点基本都在这里。',
    optionNotes: [
      '对。用符号约定写 u₂ = d − v₁ 再判虚实，不能直接量两片之间的距离，这一步最容易错。',
      '跳过等于把第二片透镜删掉了，组合系统的放大率和最终像位置就全没法算。',
      'u = 0 意味着物就贴在透镜上，1/u 直接发散，成像公式根本没有意义。',
    ],
  },
  {
    id: 'BQ-O3-05-hard',
    knowledgeId: 'K-O3-05',
    level: 'hard',
    type: 'single',
    question: '组合透镜计算最容易出错的地方是？',
    options: ['交界处的虚实转换和符号处理', '透镜的直径', '光的颜色'],
    answerIndex: 0,
    explanation: '每一级算完都要判断：这个像是实是虚？落在下一级的哪一侧？符号一旦搞错，后面全错。',
    optionNotes: [
      '对。每一级算完都要判断像是实是虚、落在下一级哪一侧，符号错一次后面就全错。',
      '透镜直径只影响通光量和视场，不进入成像公式，跟组合透镜算得对不对没关系。',
      '颜色会影响折射率与色差，但组合透镜计算最容易翻车的是符号和虚实转换。',
    ],
  },
  {
    id: 'BQ-O3-06-easy',
    knowledgeId: 'K-O3-06',
    level: 'easy',
    type: 'single',
    question: '球差指的是什么？',
    options: ['透镜边缘的光和近轴的光不交于同一点', '镜片是球形的所以看不清', '颜色偏了'],
    answerIndex: 0,
    explanation: '近轴近似只对靠中间的光成立。边缘的光偏折得更厉害，交点在近轴焦点之前，像就糊了。',
    optionNotes: [
      '对。近轴近似只对靠中心的光成立，边缘光偏折更厉害，交在近轴焦点之前，像就糊了。',
      '球差不是「因为是球形所以看不清」，而是离主轴不同高度的光偏折不同，焦点前后错开。',
      '颜色偏了是色差，由不同波长折射率不同引起，跟球差的成因完全是两回事。',
    ],
  },
  {
    id: 'BQ-O3-06-medium',
    knowledgeId: 'K-O3-06',
    level: 'medium',
    type: 'single',
    question: '色差是怎么产生的？',
    options: [
      '不同颜色的光在玻璃里速度不同，折射率不同，焦点位置就不一样',
      '镜片脏了',
      '光的强度不同',
    ],
    answerIndex: 0,
    explanation: '红光折射率小、蓝光折射率大，两者焦点不重合，边缘就会出现彩色的边。',
    optionNotes: [
      '对。玻璃对不同颜色的光折射率不同，红光焦点远、蓝光焦点近，两者不重合，边缘就现出彩边。',
      '镜片脏只会让整体变暗、对比下降，不会让不同颜色分别聚焦到不同位置。',
      '色差来自波长不同导致的折射率差异，与光有多亮无关，弱光下同样有彩边。',
    ],
  },
  {
    id: 'BQ-O3-06-hard',
    knowledgeId: 'K-O3-06',
    level: 'hard',
    type: 'single',
    question: '好镜头为什么要用好几片玻璃叠起来？',
    options: ['让不同类型的像差互相抵消补偿', '为了让镜头更重更稳', '为了单纯提高放大率'],
    answerIndex: 0,
    explanation: '单片透镜的球差和色差没法同时消掉。用不同材质、不同曲率的镜片组合，让各自的偏差互相抵消，才能得到接近理想的成像。',
    optionNotes: [
      '对。单片透镜的球差和色差没法一起消掉，用不同材质、不同曲率的镜片让误差互相抵消才行。',
      '重量和稳定不是光学目的，多片组合是为了让球差、色差这些偏差互相补偿。',
      '放大率主要由焦距决定，多片叠加并不提高放大率，反而常要靠组合来保持总焦距。',
    ],
  },
];

/* 第 6 件任务：力学 / 电磁 / 热学 / 近代 各 30+ 道手写题（共 131 道） */
export const HANDWRITTEN: BankQuestion[] = [
  ...OPTICS_HANDWRITTEN,
  ...EXTRA_HANDWRITTEN,
];

/* ============================================================
 * 选项打乱 & 逐项解析
 * ========================================================== */

/**
 * 用题目 id 做种子，稳定地打乱选项顺序。
 *
 * 为什么必须打乱：派生题的正确答案原本永远排在第一位，学生做三道就发现
 * 「全选 A」，题就废了。用 id 做种子是为了「同一道题每次看到的样子一样」，
 * 不会因为刷新而变——否则错题回顾会对不上。
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const j = Math.abs(h ^ (h >>> 16)) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 把「正确答案 + 干扰项 + 逐项解析」整理成打乱后的题 */
function pack(
  base: {
    id: string;
    knowledgeId: string;
    level: QuizLevel;
    question: string;
    explanation: string;
  },
  correct: { text: string; note: string },
  wrong: Array<{ text: string; note: string }>,
): BankQuestion {
  const items = [
    { text: correct.text, note: correct.note, right: true },
    ...wrong.map((w) => ({ ...w, right: false })),
  ];
  const shuffled = seededShuffle(items, base.id);
  return {
    id: base.id,
    knowledgeId: base.knowledgeId,
    level: base.level,
    type: 'single',
    question: base.question,
    options: shuffled.map((i) => i.text),
    answerIndex: shuffled.findIndex((i) => i.right),
    explanation: base.explanation,
    optionNotes: shuffled.map((i) => i.note),
  };
}

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

const SUPPORT_WHY: Record<string, string> = {
  direct: '这一条在平台里有真实的物理求解器，拖参数会得到真的数。',
  approximation: '这一条是近似或类比模型，结论在边界内成立。',
  conceptual: '这一条目前只有示意图，讲的是趋势和关系，不是精确数字。',
};

/** 器具 key → 中文名（和工作台器材库一致） */
const MODEL_NAME: Record<string, string> = {
  lens_bench: '凸透镜光具座',
  body: '刚体球',
  anchor: '固定支点',
  spring: '弹簧',
  speaker: '点声源',
  laser: '激光光源',
  lens: '薄透镜',
  mirror: '平面镜',
  charge: '带电粒子',
  power: '信号电源',
  field: '匀强磁场',
  coil: '弹性音圈',
  detector: '光电探测器',
  microphone: '测量麦克风',
  probe: '场强探针',
  box: '长方体',
  floor_slab: '地面',
  ramp: '可调斜面',
  rope: '柔性绳索',
  rod: '刚性连杆',
  damper: '阻尼器',
  force: '力 / 力矩源',
  battery: '直流电源',
  resistor: '电阻',
  capacitor: '电容',
  inductor: '电感',
  switch: '开关',
  lamp: '灯泡',
  voltmeter: '电压表',
  ammeter: '电流表',
  ground: '参考地',
  cylinder: '圆柱滚轮',
  drag: '流体阻力',
  expression_force: '表达式力源',
  harmonic_force: '周期驱动器',
  dynamometer: '弹簧测力计',
  electric_field: '匀强电场',
  bar_magnet: '条形磁铁',
  diverging_lens: '凹透镜',
  aperture: '可调光阑',
  optical_filter: '中性密度滤光片',
  directional_speaker: '指向性声源',
  rheostat: '滑动变阻器',
  ac_source: '交流电压源',
  current_source: '恒流源',
  distance_sensor: '测距仪',
  motion_sensor: '运动传感器',
  wire: '导线',
  box_slab: '地面',
};

const modelName = (k: string) => MODEL_NAME[k] ?? k;

/** 从容器的搭建方案里抽出器具数量，用来造干扰项 */
function otherModels(entry: PromptEntry, all: PromptEntry[]) {
  return all
    .filter((p) => p.id !== entry.id && p.models.length > 0)
    .map((p) => p.models);
}

function derive(entry: PromptEntry, all: PromptEntry[]): BankQuestion[] {
  const out: BankQuestion[] = [];
  const base = entry.id;
  const supLabel =
    entry.support === 'direct' ? '可计算' : entry.support === 'approximation' ? '近似' : '仅示意';

  /* ---------- easy ①：这条该看什么 ---------- */
  if (entry.observations.length >= 2) {
    const wrongs = all
      .filter((p) => p.id !== entry.id && p.domainLabel === entry.domainLabel)
      .flatMap((p) => p.observations.map((o) => ({ o, from: p })))
      .filter((x) => !entry.observations.includes(x.o))
      .slice(0, 2);
    if (wrongs.length === 2) {
      out.push(
        pack(
          {
            id: `BQ-${base}-easy`,
            knowledgeId: entry.id,
            level: 'easy',
            question: `在实验台上研究「${entry.title}」时，下面哪一项是应该记录的读数？`,
            explanation: `这条知识点要盯的量是：${entry.observations.join('；')}。做实验之前先想清楚「我要读哪个数」，否则拖半天滑块也说不清看到了什么。`,
          },
          {
            text: entry.observations[0],
            note: `对。这是这一条的主观测项，其余两项属于别的研究。`,
          },
          wrongs.map((w, i) => ({
            text: w.o,
            note: `这是「${w.from.title}」要看的量，不是这一条。题目换一条知识点，观测项就跟着换。`,
          })),
        ),
      );
    }
  }

  /* ---------- easy ②：这个实验到底要干什么 ---------- */
  if (entry.objective) {
    const pool = all.filter(
      (p) => p.id !== entry.id && p.domainLabel === entry.domainLabel && p.objective,
    );
    if (pool.length >= 2) {
      out.push(
        pack(
          {
            id: `BQ-${base}-easy-2`,
            knowledgeId: entry.id,
            level: 'easy',
            question: `在实验台上做「${entry.title}」这个实验，要做的事情是？`,
            explanation: `这一条的实验目标是：${entry.objective} 同一个模块里的其他知识点目标都不一样，别做串了。`,
          },
          {
            text: entry.objective,
            note: '对。这是这一条的探索目标，实验台上「实验目标」那一栏写的就是它。',
          },
          pool.slice(0, 2).map((p) => ({
            text: p.objective,
            note: `这是「${p.title}」的目标，不是这一条。两件事看着像，但要测的东西不同。`,
          })),
        ),
      );
    }
  }

  /* ---------- easy ③：要用哪些器具 ---------- */
  if (entry.models.length > 0 && entry.models.length <= 4) {
    const mine = entry.models.map(modelName).join('、');
    const others = otherModels(entry, all);
    const pickWrong = (idx: number) => {
      const cand = others[idx];
      if (!cand || cand.length === 0) return '';
      return cand.slice(0, Math.min(3, cand.length)).map(modelName).join('、');
    };
    const w1 = pickWrong(3);
    const w2 = pickWrong(11);
    if (w1 && w2 && w1 !== mine && w2 !== mine) {
      out.push(
        pack(
          {
            id: `BQ-${base}-easy-3`,
            knowledgeId: entry.id,
            level: 'easy',
            question: `要在实验台上搭出「${entry.title}」，最少需要下面哪一组器具？`,
            explanation: `这一条的搭建方案用的是：${mine}。器具选错了，实验根本做不起来——所以这是动手前的第一道关。`,
          },
          { text: mine, note: `对。${mine} 就是这一条的搭建方案。` },
          [
            { text: w1, note: `这几样是别的知识点用的，凑不出「${entry.title}」。` },
            { text: w2, note: `这几样也是别处的器具。器具和规律是对应的，不能随便换。` },
          ],
        ),
      );
    }
  }

  /* ---------- medium ①：模型边界 ---------- */
  if (entry.limitations) {
    const boundaryHint =
      entry.support === 'conceptual'
        ? '它只有示意图，能说明趋势，但给不出准确数字'
        : entry.support === 'approximation'
          ? '它是近似模型，越过边界就不准了'
          : '它有真实求解器，但同样有前提条件';
    out.push(
      pack(
        {
          id: `BQ-${base}-medium`,
          knowledgeId: entry.id,
          level: 'medium',
          question: `关于「${entry.title}」，下面哪句话是准确的？`,
          explanation: `平台的标注是「${supLabel}」。${SUPPORT_WHY[entry.support]} 这条的边界是：${entry.limitations}`,
        },
        {
          text: `${supLabel}——${entry.limitations}`,
          note: `对。既说清了级别，也说清了边界。这是这个平台对每一条知识点都要求写出来的东西。`,
        },
        [
          {
            text: '它是精确模型，任何真实装置都能算准',
            note: '错。没有哪个物理模型是「任何情况都准」。真实装置里总有模型没算进去的因素，比如摩擦、形变、空气。',
          },
          {
            text: '它没有任何适用条件，随便怎么用都行',
            note: '错。物理规律都有前提。「没有条件」这句话本身就是错的。',
          },
        ],
      ),
    );
  }

  /* ---------- medium ②：怎么操作才叫研究规律 ---------- */
  if (entry.variables.length >= 2) {
    const v0 = entry.variables[0];
    const v1 = entry.variables[1];
    out.push(
      pack(
        {
          id: `BQ-${base}-medium-2`,
          knowledgeId: entry.id,
          level: 'medium',
          question: `研究「${entry.title}」时，「${v0}」和「${v1}」都能调。正确的做法是？`,
          explanation:
            '这就是控制变量法：想弄清是谁在起作用，就必须一次只动一个。同时改两个，结果变了你也说不清是哪个造成的。',
        },
        {
          text: `先固定「${v1}」，只改「${v0}」，看完结果再换另一个`,
          note: '对。一次只动一个变量，因果关系才清楚。这是所有实验科学的基本功。',
        },
        [
          {
            text: '两个一起调，效率更高',
            note: '错。两个一起动，结果变了分不清是谁的功劳。效率高但结论废了。',
          },
          {
            text: '两个都不动，只看默认值',
            note: '错。什么都不改，你只看到一个点，看不出规律。规律是「变」出来的。',
          },
        ],
      ),
    );
  }

  /* ---------- medium ③：搭建方案里第一步做什么 ---------- */
  if (entry.construction) {
    const short = entry.construction.length > 46
      ? `${entry.construction.slice(0, 46)}……`
      : entry.construction;
    out.push(
      pack(
        {
          id: `BQ-${base}-medium-3`,
          knowledgeId: entry.id,
          level: 'medium',
          question: `「${entry.title}」的搭建方案是这样写的：「${short}」这段话主要是在说？`,
          explanation: `完整的搭建方案是：${entry.construction} 它告诉你器具怎么摆、参数设成多少、先看哪一段——照着做就能复现这个实验。`,
        },
        {
          text: '器具怎么摆、参数设多少、先观察什么',
          note: '对。搭建方案就是「操作说明书」，不是结论。',
        },
        [
          {
            text: '这个知识点的结论是什么',
            note: '错。结论在「一句话」和「公式」里，搭建方案讲的是怎么做，不是结果是什么。',
          },
          {
            text: '这个实验为什么不准',
            note: '错。讲局限的是「模型边界」那一栏，不是搭建方案。',
          },
        ],
      ),
    );
  }

  /* ---------- hard ①：变量与因果 ---------- */
  if (entry.variables.length > 0 && entry.formula) {
    out.push(
      pack(
        {
          id: `BQ-${base}-hard`,
          knowledgeId: entry.id,
          level: 'hard',
          question: `「${entry.title}」涉及 ${entry.formula}。要验证这个关系，最合理的做法是？`,
          explanation: `控制变量：只改「${entry.variables[0]}」，其他全保持不动，看结果怎么跟着变。这样量出来的关系才能归因到这一个变量上。`,
        },
        {
          text: `只改「${entry.variables[0]}」，其他条件保持不变，测结果怎么变`,
          note: '对。这是验证一个公式的唯一靠得住的办法。',
        },
        [
          {
            text: '把所有变量同时调到最大',
            note: '错。全调最大只有一个数据点，而且分不清谁起作用。',
          },
          {
            text: '只读数，不改变任何条件',
            note: '错。条件不变，读数也不变，你永远看不到关系。',
          },
        ],
      ),
    );
  }

  /* ---------- hard ②：这条规律管不管得住那个现象 ---------- */
  if (entry.limitations && entry.formula) {
    out.push(
      pack(
        {
          id: `BQ-${base}-hard-2`,
          knowledgeId: entry.id,
          level: 'hard',
          question: `有人用 ${entry.formula} 去算一个远超适用条件的真实装置，结果和实测差很远。最合理的解释是？`,
          explanation: `公式本身没错，是「用超了范围」。这条的边界是：${entry.limitations} 越过它，模型里没算进去的因素就开始占主导。`,
        },
        {
          text: `公式在它的适用范围内是对的，是这个装置已经超出范围了`,
          note: `对。边界是：${entry.limitations}`,
        },
        [
          {
            text: '公式是错的，应该丢掉',
            note: '错。在适用范围内它经得起检验，错的是使用范围不是公式。',
          },
          {
            text: '实测数据测错了',
            note: '错。这是最常见的甩锅。先检查前提条件是否成立，再怀疑数据。',
          },
        ],
      ),
    );
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
