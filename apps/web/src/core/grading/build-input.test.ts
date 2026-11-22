import { describe, expect, it } from 'vitest';
import { buildGradingInput, isRunEmpty, normalizeSeen, selectCaptures } from './build-input';
import { loadRubric } from './rubric';
import { factFromLocked } from './comparison';
import {
  emptyLearner,
  EXAMPLE_A,
  learnerWith,
  P,
  snap,
} from './test-fixtures';
import type { LockedRun } from '../contracts';
import type { ChallengeRef } from './build-input';

const CH: ChallengeRef = {
  id: 'CH-O2-01',
  title: '让像和蜡烛一样大',
  brief: '把蜡烛挪一挪，让光屏上的像恰好和蜡烛一样大。',
  labId: 'optics-lens',
  knowledgeIds: ['K-O2-06'],
  winCondition: { metric: 'm', op: '≈', value: -1, tolerance: 0.06 },
};

const CAPS = EXAMPLE_A.map((p, i) => snap(p, { challengeId: 'CH-O2-01', time: i }));

const build = (over: Partial<Parameters<typeof buildGradingInput>[0]> = {}) =>
  buildGradingInput({
    learner: learnerWith({ reflection: '我把蜡烛从 30 cm 推到 20 cm，像就变大了。' }),
    challenge: CH,
    rubric: loadRubric(CH.id),
    captures: CAPS,
    seenObservations: ['m', 'v', 'imageHeight'],
    stage: 'junior',
    ...over,
  });

describe('证据选择（§2.3 的五条规则）', () => {
  it('只取 openedChallenge 对得上的快照', () => {
    const other = snap(P({ u: 12 }), { challengeId: 'CH-O2-02', time: 9 });
    expect(selectCaptures([...CAPS, other], 'CH-O2-01')).toHaveLength(3);
  });

  it('没有 source 的快照不认（对不回挑战）', () => {
    const bare = snap(P({ u: 12 }), { time: 0 });
    expect(selectCaptures([bare], 'CH-O2-01')).toHaveLength(0);
  });

  it('按 at 升序，最多 8 条', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      snap(P({ u: 30 - i }), { challengeId: 'CH-O2-01', time: 100 - i }),
    );
    const r = build({ captures: many });
    expect(r.input.facts).toHaveLength(8);
    const ats = r.input.facts.map((f) => f.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    expect(ats[0]).toBe(93); // 留下的是最晚的 8 条（time 93…100）
  });

  it('captures 为空时退回 runs，按 lockedAt 升序', () => {
    const mk = (u: number, lockedAt: number): LockedRun => ({
      challengeId: 'CH-O2-01',
      params: P({ u }),
      metrics: {
        v: 15,
        m: -0.5,
        real: true,
        imageHeight: 1.25,
        screenHasImage: true,
        blurDiameter: 0,
        description: '倒立、缩小的实像',
      },
      prediction: null,
      lockedAt,
    });
    const learner = learnerWith({ reflection: '随便写一句够十个字。' });
    learner.runs = [mk(25, 200), mk(30, 100)];
    const r = buildGradingInput({
      learner,
      challenge: CH,
      rubric: loadRubric(CH.id),
      captures: [],
      seenObservations: [],
      stage: 'junior',
    });
    expect(r.input.facts.map((f) => f.at)).toEqual([100, 200]);
    expect(r.input.facts.every((f) => f.source === 'locked')).toBe(true);
  });

  it('两边都有时以 captures 为准', () => {
    const learner = learnerWith({ reflection: '随便写一句够十个字。' });
    learner.runs = [
      {
        challengeId: 'CH-O2-01',
        params: P({ u: 12 }),
        metrics: {
          v: -60,
          m: 5,
          real: false,
          imageHeight: 12.5,
          screenHasImage: false,
          blurDiameter: 8.25,
          description: '虚像',
        },
        prediction: null,
        lockedAt: 1,
      },
    ];
    const r = build({ learner });
    expect(r.input.facts).toHaveLength(3);
    expect(r.input.facts.every((f) => f.source === 'capture')).toBe(true);
  });

  it('一条证据都没有 → hasEvidence = false（触发 NO_EVIDENCE）', () => {
    const r = build({ captures: [], learner: emptyLearner() });
    expect(r.hasEvidence).toBe(false);
    expect(r.input.facts).toHaveLength(0);
  });

  it('空实验台的快照会被数出来（触发 NO_RUN）', () => {
    const r = build({ captures: [snap(P({}), { challengeId: 'CH-O2-01', empty: true, time: 1 })] });
    expect(r.hasEvidence).toBe(true);
    expect(r.emptyFacts).toBe(1);
    expect(isRunEmpty(r.input.facts[0])).toBe(true);
  });
});

describe('输入内容', () => {
  it('分数表里的三个数就是本地算的', () => {
    const r = build();
    expect(r.input.scores.assembly.score).toBe(100);
    expect(r.input.scores.observation.score).toBe(100); // m/v/imageHeight 都自报了
    expect(r.input.scores.variables.score).toBe(100);
  });

  it('目标判定用最后一条记录', () => {
    const r = build();
    // R3 是 u=20,f=10 → m 正好 -1，达成
    expect(r.input.challenge.goalMet).toBe('yes');
    expect(r.input.challenge.winText).toContain('放大率');
  });

  it('rubric 的观测项原样带进输入', () => {
    const r = build();
    expect(r.input.challenge.requiredObservations).toEqual(['m', 'v', 'imageHeight']);
    expect(r.input.challenge.requiredKinds).toEqual(['lens_bench']);
  });

  it('没有 rubric 时不崩，观测项为空', () => {
    const noRub = buildGradingInput({
      learner: learnerWith({ reflection: '随便写一句够十个字。' }),
      challenge: { ...CH, id: 'CH-UNKNOWN', winCondition: undefined },
      rubric: null,
      captures: CAPS,
      seenObservations: ['m'],
      stage: 'junior',
    });
    expect(noRub.input.challenge.requiredObservations).toEqual([]);
    expect(noRub.input.scores.observation.score).toBeNull();
    expect(noRub.input.challenge.goalMet).toBe('unknown');
  });

  it('反思字数按 trim 后算', () => {
    const r = build({ learner: learnerWith({ reflection: '   一二三   ' }) });
    expect(r.input.reflection.chars).toBe(3);
  });

  it('student 自报里的前缀会被削成后缀', () => {
    const r = build({ seenObservations: ['lens-bench:m', 'v'] });
    expect(r.input.seenObservations.sort()).toEqual(['m', 'v']);
  });

  it('自报里不存在的通道会被过滤掉（防止学生勾了本关没有的量）', () => {
    const facts = build().input.facts;
    expect(normalizeSeen(['m', 'screenHasImage', '不存在的量'], facts).sort()).toEqual([
      'm',
      'screenHasImage',
    ]);
    expect(normalizeSeen(['不存在的量'], facts)).toEqual([]);
  });
});

describe('LockedRun → RunFact', () => {
  it('m = Infinity 存成 null 之后不崩', () => {
    const run: LockedRun = {
      challengeId: 'CH-O2-01',
      params: P({ u: 10, f: 10 }),
      // JSON.stringify 把 Infinity 变成 null，这里模拟读回来的样子
      metrics: {
        v: 1e6,
        m: null as unknown as number,
        real: false,
        imageHeight: null as unknown as number,
        screenHasImage: false,
        blurDiameter: 6,
        description: '不成像：出射光平行',
      },
      prediction: null,
      lockedAt: 1,
    };
    const f = factFromLocked(run, 0);
    expect(f.metrics.m).toBeNull();
    expect(f.metrics.imageHeight).toBeNull();
    // 通道里的 valid 必须是 false，不能是「有效但值为 null」
    expect(f.channels['lens-bench:m'].valid).toBe(false);
  });
});
