/**
 * PhysQuest · 全项目类型契约
 *
 * 铁律：这个文件里只有类型和常量，没有任何逻辑。
 * 任何人要改接口，先改这里，然后通知全组。
 */

/* ============================================================
 * 1. 学段
 * ========================================================== */

export type Stage = 'primary' | 'junior' | 'senior' | 'university';

export const STAGE_LABEL: Record<Stage, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
  university: '大学',
};

/* ============================================================
 * 2. 物理引擎契约
 *    实现：apps/web/src/labs/optics-lens/engine.ts
 *    调用方：网页层（算指标）+ 实验室层（画图）
 *    要求：纯函数。无状态、无副作用、无网络、不读写存储。
 * ========================================================== */

export interface LensParams {
  /** 物距 (cm)，物体在透镜左侧，恒正 */
  u: number;
  /** 焦距 (cm)，恒正 */
  f: number;
  /** 物高 (cm) */
  h: number;
  /** 光屏位置 (cm)，透镜右侧为正 */
  screenX: number;
  /** 物体形状 */
  objectShape: ObjectShape;
  /** 是否遮住透镜上半部分 */
  maskTop: boolean;
  /** 透镜口径 (cm)，用于算弥散圆与亮度 */
  lensDiameter: number;
}

export type ObjectShape = 'arrow' | 'F' | 'candle';

export interface LensMetrics {
  /** 像距 (cm)。实像为正（透镜右侧），虚像为负（透镜左侧）。不成像时为大数 */
  v: number;
  /** 放大率，带符号。负数 = 倒立，正数 = 正立 */
  m: number;
  /** 是否成实像（能被光屏承接） */
  real: boolean;
  /** 是否处于「物距≈焦距」的平行光状态 */
  isParallel: boolean;
  /** 像高 (cm)，绝对值 */
  imageHeight: number;
  /** 像的位置（沿主光轴，cm，透镜右侧为正） */
  imageX: number;
  /** 像的顶端 y 坐标（cm，向上为正）。倒立时为负 */
  imageY: number;
  /** 光屏上是否成清晰像 */
  screenHasImage: boolean;
  /** 光屏处的弥散圆直径 (cm)。0 = 完全清晰 */
  blurDiameter: number;
  /** 相对亮度 0–1。遮住一半时约 0.5 */
  relativeIlluminance: number;
  /** 一句话描述，如「倒立、缩小的实像」 */
  description: string;
}

/* ============================================================
 * 3. 实验室组件契约
 *    B 负责实现 LabStage。网页层只用这几个 prop。
 * ========================================================== */

export interface LabStageProps {
  /** 当前参数。唯一状态源在网页层 */
  params: LensParams;
  /** 当前学段，决定用哪套皮肤 */
  stage: Stage;
  /** 引擎算出的指标。不传则组件内部自己调 solve（不推荐） */
  metrics: LensMetrics;
  /** 是否显示三条特殊光线 */
  showRays: boolean;
  /** 是否显示虚像的虚线延长线 */
  showVirtualExtensions: boolean;
  /** 需要高亮的器材 id（AI 演示用） */
  highlightIds?: string[];
  /** AI 演示气泡文字，null 表示不显示 */
  narration?: string | null;
  /** 是否处于演示播放模式（会禁用内部动画过渡） */
  demoMode?: boolean;
}

/** 实验室内部可被高亮的器材 id */
export type RigElementId =
  | 'candle'
  | 'lens'
  | 'screen'
  | 'image'
  | 'ray1'
  | 'ray2'
  | 'ray3'
  | 'axis';

/* ============================================================
 * 4. 挑战
 * ========================================================== */

export interface Challenge {
  id: string;
  labId: string;
  title: string;
  /** 一句话任务说明，越短越好 */
  brief: string;
  /** 卡住了可以点开的提示 */
  hint: string;
  winCondition: WinCondition;
  /** true 表示有不止一种正确做法 */
  multiAnswer: boolean;
  knowledgeIds: string[];
  misconceptionIds: string[];
  demoScriptId: string;
  difficulty: 'beginner' | 'advanced';
  /** 进入实验台之前先让学生猜的那个问题 */
  prediction: PredictionQuestion;
}

export interface WinCondition {
  metric: keyof LensMetrics;
  op: '≈' | '<' | '>' | 'true' | 'false';
  value?: number;
  tolerance?: number;
}

export interface PredictionQuestion {
  prompt: string;
  options: string[];
  /** 正确选项的下标（用于事后对比，不用于判错） */
  answerIndex: number;
}

/* ============================================================
 * 5. 知识卡与误区
 * ========================================================== */

export interface KnowledgeCard {
  id: string;
  stage: Stage;
  title: string;
  /** 一句话结论 */
  oneLine: string;
  /** 生活类比 */
  analogy: string;
  /** 公式，可为空 */
  formula: string;
  /** 为什么 —— 这是「知识学习不够」的病根所在，不许留空 */
  why: string;
  misconceptions: string[];
  prerequisites: string[];
  /** 「看这个 ⤴」按钮会把实验台跳到这组参数 */
  labPreset: Partial<LensParams>;
  difficulty: 'beginner' | 'advanced';
}

export interface Misconception {
  id: string;
  /** 学生的错误想法 */
  belief: string;
  /** 真相 */
  truth: string;
  /** 用哪个挑战打脸 */
  challengedBy: string;
}

/* ============================================================
 * 6. 测验
 * ========================================================== */

export interface QuizItem {
  id: string;
  type: 'single_choice' | 'short_answer';
  question: string;
  options?: string[];
  answerIndex?: number;
  /** 标准答案要点（简答题用，供 AI 参考） */
  answerKey?: string;
  knowledgeId: string;
  misconceptionId: string;
  explanation: string;
}

export interface QuizResult {
  itemId: string;
  correct: boolean;
  chosen: number | string;
}

/* ============================================================
 * 7. AI 演示剧本
 *    逐帧都要过引擎校验，过不了就退回预置剧本。
 * ========================================================== */

export interface AIDemoStep {
  stepIndex: number;
  /** 本步演示对应的核心知识点 */
  knowledgePoint: string;
  /** 气泡讲解文案 */
  narration: string;
  /** 自动驱动实验台调整到的目标参数（只允许参数，不允许画面操作） */
  targetParams: Partial<LensParams>;
  /** 实验台上需要高亮的器材 */
  highlightRigIds: RigElementId[];
  /** 本步停留观察时长 (ms) */
  durationMs: number;
}

export interface AIDemoSequence {
  id: string;
  title: string;
  steps: AIDemoStep[];
}

/* ============================================================
 * 8. 学习记录
 * ========================================================== */

export interface PredictionRecord {
  challengeId: string;
  chosenIndex: number;
  lockedAt: number;
}

export interface LockedRun {
  challengeId: string;
  params: LensParams;
  metrics: Pick<
    LensMetrics,
    'v' | 'm' | 'real' | 'imageHeight' | 'screenHasImage' | 'blurDiameter' | 'description'
  >;
  prediction: PredictionRecord | null;
  lockedAt: number;
}

export interface Reflection {
  text: string;
  updatedAt: number;
}

export interface LearnerState {
  stage: Stage;
  /** challengeId -> 是否已完成 */
  completed: Record<string, boolean>;
  /** 每次锁定参数的记录 */
  runs: LockedRun[];
  predictions: Record<string, PredictionRecord>;
  reflections: Record<string, Reflection>;
  /** misconceptionId -> 命中次数 */
  misconceptions: Record<string, number>;
}

/* ============================================================
 * 9. 常量
 * ========================================================== */

export const DEFAULT_LENS_PARAMS: LensParams = {
  u: 30,
  f: 10,
  h: 2.5,
  screenX: 15,
  objectShape: 'arrow',
  maskTop: false,
  lensDiameter: 6,
};

/** 光屏上「算清晰」的弥散圆上限 (cm) */
export const SHARP_BLUR_TOLERANCE = 0.15;

export const LAB_ID_OPTICS = 'optics-lens';
