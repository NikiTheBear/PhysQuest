import { describe, expect, it } from 'vitest';
import { exportLearner } from './persistence';
import {
  aggregateClassroom,
  buildClassroomMarkdown,
  parseStudentFile,
  type ChallengeMeta,
  type MisconceptionMeta,
} from './teacher-summary';
import type { LearnerState } from './contracts';

const CHALLENGES: ChallengeMeta[] = [
  {
    id: 'CH-O2-01',
    title: '让像和蜡烛一样大',
    prediction: { prompt: '像会怎样？', options: ['倒立等大', '倒立放大', '屏上没有像'], answerIndex: 0 },
  },
  {
    id: 'CH-K-E2-01',
    title: '欧姆定律探究',
    prediction: { prompt: '电阻翻倍电流怎么变？', options: ['不变', '减半', '翻倍'], answerIndex: 1 },
  },
];

const MISCONCEPTIONS: MisconceptionMeta[] = [
  { id: 'MIS-O2-04', belief: '遮住透镜一半，像少一半', truth: '像完整但变暗' },
  { id: 'MIS-O2-05', belief: '物近像近', truth: '成实像时物近像远像变大' },
];

const makeLearner = (over: Partial<LearnerState>): LearnerState => ({
  stage: 'junior',
  completed: {},
  runs: [],
  predictions: {},
  reflections: {},
  misconceptions: {},
  ...over,
});

describe('教师端全班学情聚合', () => {
  it('能解析多份学生 JSON（含非光学记录）并准确统计误区榜与猜错率', () => {
    const s1 = parseStudentFile(
      '张三.json',
      exportLearner(
        makeLearner({
          completed: { 'CH-O2-01': true, 'CH-K-E2-01': true },
          predictions: {
            'CH-O2-01': { challengeId: 'CH-O2-01', chosenIndex: 1, lockedAt: 100 },
            'CH-K-E2-01': { challengeId: 'CH-K-E2-01', chosenIndex: 1, lockedAt: 200 },
          },
          misconceptions: { 'MIS-O2-04': 2, 'MIS-O2-05': 1 },
          reflections: { 'CH-O2-01': { text: '遮住一半像居然还在只是变暗了', updatedAt: 300 } },
        }),
      ),
    );
    const s2 = parseStudentFile(
      '李四.json',
      exportLearner(
        makeLearner({
          completed: { 'CH-O2-01': true },
          predictions: {
            'CH-O2-01': { challengeId: 'CH-O2-01', chosenIndex: 2, lockedAt: 101 },
            'CH-K-E2-01': { challengeId: 'CH-K-E2-01', chosenIndex: 1, lockedAt: 201 },
          },
          misconceptions: { 'MIS-O2-04': 1 },
          reflections: {},
        }),
      ),
    );

    const summary = aggregateClassroom([s1, s2], {
      challenges: CHALLENGES,
      misconceptions: MISCONCEPTIONS,
    });

    expect(summary.studentCount).toBe(2);
    expect(summary.avgCompleted).toBe(1.5);
    expect(summary.reflectionCount).toBe(1);
    // MIS-O2-04 2人踩坑共3次，排第一
    expect(summary.topMisconceptions[0]).toMatchObject({
      id: 'MIS-O2-04',
      studentCount: 2,
      totalHits: 3,
    });
    // CH-O2-01 猜错率 100%，排在猜错率 0% 的 CH-K-E2-01 前面
    expect(summary.predictionStats[0].challengeId).toBe('CH-O2-01');
    expect(summary.predictionStats[0].wrongRate).toBe(1);
    expect(summary.predictionStats[1].challengeId).toBe('CH-K-E2-01');
    expect(summary.predictionStats[1].wrongRate).toBe(0);

    const md = buildClassroomMarkdown(summary);
    expect(md).toContain('遮住透镜一半，像少一半');
    expect(md).toContain('猜错率 100%');
    expect(md).toContain('张三');
  });
});
