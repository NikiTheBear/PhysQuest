import { describe, expect, it } from 'vitest';
import { exportLearner, previewImport } from './persistence';
import type { LearnerState, LockedRun } from './contracts';

const emptyState = (): LearnerState => ({
  stage: 'junior',
  completed: {},
  runs: [],
  predictions: {},
  reflections: {},
  misconceptions: {},
});

describe('全模块学习记录导出与导入', () => {
  it('光学旧版 LockedRun 导出后能正常导入', () => {
    const opticsRun: LockedRun = {
      challengeId: 'CH-O2-01',
      params: {
        u: 20,
        f: 10,
        h: 2.5,
        screenX: 20,
        maskTop: false,
        lensDiameter: 6,
        objectShape: 'candle',
      },
      metrics: {
        v: 20,
        m: -1,
        real: true,
        imageHeight: 2.5,
        screenHasImage: true,
        blurDiameter: 0,
        description: '倒立、等大的实像',
      },
      prediction: null,
      lockedAt: 1700000000000,
    };
    const state: LearnerState = { ...emptyState(), runs: [opticsRun], completed: { 'CH-O2-01': true } };
    const json = exportLearner(state);
    const { learner, summary } = previewImport(json, emptyState());
    expect(summary.addedRuns).toBe(1);
    expect(learner.runs[0].metrics?.description).toBe('倒立、等大的实像');
  });

  it('电路、力学、热学、声学等非光学模块的 LockedRun 能无损导出并导入', () => {
    const circuitRun: LockedRun = {
      challengeId: 'CH-K-E2-01',
      labId: 'circuits',
      params: { voltage: 12, resistance: 100 },
      readings: [
        { label: '电阻 1 · 电流', value: 0.12, unit: 'A' },
        { label: '电阻 1 · 电压', value: 12, unit: 'V' },
      ],
      summary: '电流 0.12 A，符合欧姆定律',
      prediction: { challengeId: 'CH-K-E2-01', chosenIndex: 1, lockedAt: 1700000001000 },
      lockedAt: 1700000002000,
    };
    const thermalRun: LockedRun = {
      challengeId: 'CH-K-T2-01',
      labId: 'thermal',
      params: { temperature: 100, conductivity: 200 },
      readings: [{ label: '导热棒 1 · 热流', value: 200, unit: 'W' }],
      summary: '稳态热流 200 W',
      prediction: null,
      lockedAt: 1700000003000,
    };
    const state: LearnerState = {
      ...emptyState(),
      runs: [circuitRun, thermalRun],
      completed: { 'CH-K-E2-01': true, 'CH-K-T2-01': true },
    };
    const json = exportLearner(state);
    const { learner, summary } = previewImport(json, emptyState());
    expect(summary.addedRuns).toBe(2);
    expect(learner.runs[0].labId).toBe('circuits');
    expect(learner.runs[0].readings?.[0].value).toBe(0.12);
    expect(learner.runs[1].labId).toBe('thermal');
    expect(learner.runs[1].summary).toBe('稳态热流 200 W');
  });

  it('会过滤非光学 params 中的原型污染键，并拒绝非法 readings 结构', () => {
    const polluted = JSON.stringify({
      format: 'physquest.learner',
      version: 1,
      learner: {
        ...emptyState(),
        runs: [
          {
            challengeId: 'CH-K-M2-01',
            labId: 'mechanics',
            params: JSON.parse('{"mass":2,"__proto__":{"polluted":true}}'),
            prediction: null,
            lockedAt: 1700000004000,
          },
        ],
      },
    });
    const { learner } = previewImport(polluted, emptyState());
    expect(Object.prototype.hasOwnProperty.call(learner.runs[0].params, '__proto__')).toBe(false);
    expect((learner.runs[0].params as Record<string, unknown>).mass).toBe(2);

    const badReadings = JSON.stringify({
      format: 'physquest.learner',
      version: 1,
      learner: {
        ...emptyState(),
        runs: [
          {
            challengeId: 'CH-K-M2-01',
            labId: 'mechanics',
            params: { mass: 2 },
            readings: [{ label: '速度', value: '不是数字', unit: 'm/s' }],
            prediction: null,
            lockedAt: 1700000005000,
          },
        ],
      },
    });
    expect(() => previewImport(badReadings, emptyState())).toThrow(/readings\[0\]/);
  });
});
