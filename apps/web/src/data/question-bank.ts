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

  // easy 第二道：这个实验到底要干什么
  if (entry.objective) {
    const sameDomain = all.filter(
      (p) => p.id !== entry.id && p.domainLabel === entry.domainLabel && p.objective,
    );
    const decoy1 = sameDomain[0]?.objective;
    const decoy2 = sameDomain[1]?.objective;
    if (decoy1 && decoy2) {
      const options = [entry.objective, decoy1, decoy2];
      // 正确答案固定放第一，做题时会打乱显示顺序
      out.push({
        id: `BQ-${base}-easy-2`,
        knowledgeId: entry.id,
        level: 'easy',
        type: 'single',
        question: `在实验台上做「${entry.title}」这个实验，要做的事情是？`,
        options,
        answerIndex: 0,
        explanation: `这一条的实验目标就是：${entry.objective}`,
      });
    }
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
