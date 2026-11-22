import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GRADE_KEY,
  loadGrade,
  loadGrades,
  saveGrade,
  clearGrade,
  loadSeenObservations,
  saveSeenObservations,
  resetProgress,
} from './persistence';
import { GRADE_CACHE_MAX, type GradeResult } from './grading/types';
import { emptyLearner } from './grading/test-fixtures';

/** 真的在 node 里跑的 localStorage 桩子（不引 jsdom，保持测试快） */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    _map: map,
  };
}

const grade = (id: string, at: number): GradeResult => ({
  version: 1,
  challengeId: id,
  total: 80,
  level: 'good',
  passed: true,
  dimensions: [{ key: 'assembly', score: 100, band: 'top', comment: 'x', refs: ['R1'], by: 'template' }],
  claims: [],
  summary: '',
  by: 'template',
  refused: null,
  evidence: { facts: [], changes: [], checks: [] },
  at,
});

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});

describe('评分结果的存取', () => {
  it('存一条能读回来', () => {
    saveGrade(grade('CH-O2-01', 1));
    expect(loadGrade('CH-O2-01')?.total).toBe(80);
    expect(localStorage.getItem(GRADE_KEY)).toContain('CH-O2-01');
  });

  it('同一关重评覆盖，不叠加', () => {
    saveGrade(grade('CH-O2-01', 1));
    saveGrade({ ...grade('CH-O2-01', 2), total: 55, level: 'improve' });
    expect(loadGrades()['CH-O2-01'].total).toBe(55);
    expect(Object.keys(loadGrades())).toHaveLength(1);
  });

  it('超过 20 条时丢掉最老的', () => {
    for (let i = 0; i < GRADE_CACHE_MAX + 5; i++) saveGrade(grade(`CH-${i}`, i));
    const all = loadGrades();
    expect(Object.keys(all)).toHaveLength(GRADE_CACHE_MAX);
    expect(all['CH-0']).toBeUndefined();
    expect(all[`CH-${GRADE_CACHE_MAX + 4}`]).toBeDefined();
  });

  it('坏数据当空，不让报告页崩', () => {
    localStorage.setItem(GRADE_KEY, '{不是 json');
    expect(loadGrades()).toEqual({});
    localStorage.setItem(GRADE_KEY, JSON.stringify({ x: { version: 2 } }));
    expect(loadGrades()).toEqual({});
    localStorage.setItem(GRADE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadGrades()).toEqual({});
  });

  it('clearGrade 只删那一关', () => {
    saveGrade(grade('A', 1));
    saveGrade(grade('B', 2));
    clearGrade('A');
    expect(loadGrade('A')).toBeNull();
    expect(loadGrade('B')).not.toBeNull();
  });

  it('评分不写回 LearnerState（key 是分开的）', () => {
    saveGrade(grade('CH-O2-01', 1));
    expect(localStorage.getItem('physquest.learner.v1')).toBeNull();
  });

  it('resetProgress 会把评分一起清掉', () => {
    saveGrade(grade('CH-O2-01', 1));
    saveSeenObservations('CH-O2-01', ['m']);
    resetProgress();
    expect(localStorage.getItem(GRADE_KEY)).toBeNull();
    expect(loadGrades()).toEqual({});
  });
});

describe('观测项自报的存取', () => {
  it('存了能读回来', () => {
    saveSeenObservations('CH-O2-01', ['m', 'v', 'm']);
    expect(loadSeenObservations(emptyLearner(), 'CH-O2-01')).toEqual(['m', 'v']);
  });

  it('空数组等于删掉（回到「没自报」）', () => {
    saveSeenObservations('CH-O2-01', ['m']);
    saveSeenObservations('CH-O2-01', []);
    expect(loadSeenObservations(emptyLearner(), 'CH-O2-01')).toEqual([]);
  });

  it('LearnerState 里将来有 observations 时优先用它（缺口 3 方案 B 落位后不用改调用方）', () => {
    saveSeenObservations('CH-O2-01', ['m']);
    const learner = emptyLearner();
    (learner as unknown as { observations: Record<string, string[]> }).observations = {
      'CH-O2-01': ['v', 'blurDiameter'],
    };
    expect(loadSeenObservations(learner, 'CH-O2-01')).toEqual(['v', 'blurDiameter']);
  });

  it('没存过时是空数组，不是 undefined', () => {
    expect(loadSeenObservations(emptyLearner(), 'CH-XX')).toEqual([]);
  });
});
