import type { LearnerState, LockedRun, Stage } from './contracts';

const KEY = 'physquest.learner.v1';

const empty = (): LearnerState => ({
  stage: 'junior',
  completed: {},
  runs: [],
  predictions: {},
  reflections: {},
  misconceptions: {},
});

export function loadLearner(): LearnerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<LearnerState>;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

export function saveLearner(s: LearnerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 隐私模式下写不进去，静默忽略 */
  }
}

export function pushRun(s: LearnerState, run: LockedRun): LearnerState {
  const next: LearnerState = {
    ...s,
    runs: [...s.runs, run].slice(-200),
    completed: { ...s.completed, [run.challengeId]: true },
  };
  saveLearner(next);
  return next;
}

export function setPrediction(
  s: LearnerState,
  challengeId: string,
  chosenIndex: number,
): LearnerState {
  const next: LearnerState = {
    ...s,
    predictions: {
      ...s.predictions,
      [challengeId]: { challengeId, chosenIndex, lockedAt: Date.now() },
    },
  };
  saveLearner(next);
  return next;
}

export function setReflection(s: LearnerState, challengeId: string, text: string): LearnerState {
  const next: LearnerState = {
    ...s,
    reflections: {
      ...s.reflections,
      [challengeId]: { text, updatedAt: Date.now() },
    },
  };
  saveLearner(next);
  return next;
}

export function hitMisconception(s: LearnerState, id: string): LearnerState {
  const next: LearnerState = {
    ...s,
    misconceptions: { ...s.misconceptions, [id]: (s.misconceptions[id] ?? 0) + 1 },
  };
  saveLearner(next);
  return next;
}

export function setStage(s: LearnerState, stage: Stage): LearnerState {
  const next = { ...s, stage };
  saveLearner(next);
  return next;
}

export function weakMisconceptions(s: LearnerState, minHits = 1): string[] {
  return Object.entries(s.misconceptions)
    .filter(([, n]) => n >= minHits)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}


/* ============================================================
 * 重置
 * ========================================================== */


/** 所有本项目的 localStorage key 前缀 */
const PREFIX = 'physquest.';

/** 清掉所有 physquest.* 开头的 key，除了 keep 名单里的 */
function clearAll(keep: string[] = []) {
  try {
    const victims: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && !keep.includes(k)) victims.push(k);
    }
    victims.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * 只清学习进度
 *
 * 清掉：参数记录 / 预测 / 已完成 / 错题 / 自由搭建记录 / 引导标记 / 提示词草稿
 * 保留：主题、AI 设置（端点、模型、Key）、侧栏宽度、用量统计
 */
export function resetProgress(): LearnerState {
  clearAll([
    'physquest.ai.v1',
    'physquest.ai.width.v1',
    'physquest.theme.v1',
    'physquest.usage.v1',
  ]);
  const fresh = empty();
  saveLearner(fresh);
  return fresh;
}

/** 清掉所有本地数据（包括 AI Key），回到第一次打开的状态 */
export function resetEverything(): LearnerState {
  clearAll();
  return empty();
}
