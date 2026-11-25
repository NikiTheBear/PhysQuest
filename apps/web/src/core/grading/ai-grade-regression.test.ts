import { describe, expect, it } from 'vitest';
import { allowedNumbers, foreignNumbers, sanitize } from './ai-grade';
import { buildGradingInput } from './build-input';
import { loadRubric } from './rubric';
import { EXAMPLE_A, learnerWith, snap } from './test-fixtures';
import type { ChallengeRef } from './build-input';

const CH: ChallengeRef = {
  id: 'CH-O2-01',
  title: '让像和蜡烛一样大',
  brief: '把蜡烛挪一挪',
  labId: 'optics-lens',
  knowledgeIds: ['K-O2-06'],
  winCondition: { metric: 'm', op: '≈', value: -1, tolerance: 0.06 },
};

describe('AI 评分回归测试', () => {
  it('数字守卫放行序数词与常见公式常数（1/f、2f），仍拦截编造读数', () => {
    const input = buildGradingInput({
      learner: learnerWith({ reflection: '物距调到 20 cm 时像和物一样大。', challengeId: CH.id }),
      challenge: CH,
      rubric: loadRubric(CH.id),
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v'],
      stage: 'junior',
    }).input;
    const allowed = allowedNumbers(input);
    expect(foreignNumbers('第 1 组到第 2 组验证了 1/f = 1/u + 1/v，且在 2f 处等大', allowed)).toEqual([]);
    expect(foreignNumbers('第 1 组算出来的放大率是 2.75 倍', allowed)).toEqual(['2.75']);
  });

  it('引用匹配容忍标点与空白差异，同时仍拒绝编造句子', () => {
    const input = buildGradingInput({
      learner: learnerWith({
        reflection: '我把蜡烛从30cm推到20cm，放大率变成-1.0000，像一直是倒立的。',
        challengeId: CH.id,
      }),
      challenge: CH,
      rubric: loadRubric(CH.id),
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v'],
      stage: 'junior',
    }).input;

    const clean = sanitize(
      {
        version: 1,
        challengeId: CH.id,
        dimensions: {
          assembly: { text: '光具座齐全。', refs: ['R1'] },
          observation: { text: '读数完整。', refs: ['R1'] },
          variables: { text: '只动了物距。', refs: ['V1'] },
          conclusion: { text: '结论与读数一致。', refs: ['T1'] },
        },
        claims: [
          // 标点和空格与原文略有差异，但文字内容一致
          { quote: '放大率变成 -1.0000, 像一直是倒立的', checkId: 'T5', verdict: 'agree', note: '一致' },
          // 完全编造的句子仍会被过滤
          { quote: '光屏上出现了正立虚像', checkId: 'T5', verdict: 'contradict', note: '编造' },
        ],
        conclusionBand: 'solid',
        summary: '只动物距，结论一致。',
      },
      input,
    );
    expect(clean).not.toBeNull();
    expect(clean!.claims).toHaveLength(1);
    expect(clean!.claims[0].quote).toContain('像一直是倒立的');
  });
});
