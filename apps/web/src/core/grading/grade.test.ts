import { describe, expect, it } from 'vitest';
import {
  allowedNumbers,
  enforceBand,
  extractJson,
  foreignNumbers,
  gradeWithAI,
  sanitize,
  type ChatFn,
} from './ai-grade';
import { gradeExperiment } from './grade';
import { buildGradingInput } from './build-input';
import { loadRubric } from './rubric';
import { EXAMPLE_A, EXAMPLE_B, learnerWith, snap } from './test-fixtures';
import type { ChallengeRef } from './build-input';
import type { AIConfig } from '../../ai/client';
import type { GradingInput } from './types';

const CH: ChallengeRef = {
  id: 'CH-O2-01',
  title: '让像和蜡烛一样大',
  brief: '把蜡烛挪一挪',
  labId: 'optics-lens',
  knowledgeIds: ['K-O2-06'],
  winCondition: { metric: 'm', op: '≈', value: -1, tolerance: 0.06 },
};

const CH_B: ChallengeRef = { ...CH, id: 'CH-O2-02', title: '让像比蜡烛大三倍' };

const REFLECTION =
  '我把蜡烛从 30 cm 推到 20 cm，放大率从 -0.5000 变成 -1.0000，像一直是倒立的，最后像和蜡烛一样大。';

const CONFIG: AIConfig = {
  connection: 'direct',
  endpoint: 'https://api.example.com/v1',
  model: 'test-model',
  apiKey: 'sk-test',
};

function makeInput(ch: ChallengeRef = CH, params = EXAMPLE_A): GradingInput {
  return buildGradingInput({
    learner: learnerWith({ reflection: REFLECTION, challengeId: ch.id }),
    challenge: ch,
    rubric: loadRubric(ch.id),
    captures: params.map((p, i) => snap(p, { challengeId: ch.id, time: i })),
    seenObservations: ['m', 'v', 'imageHeight'],
    stage: 'junior',
  }).input;
}

/** 一份合法的 AI 返回 */
function goodPayload(input: GradingInput, over: Record<string, unknown> = {}) {
  return {
    version: 1,
    challengeId: input.challenge.id,
    dimensions: {
      assembly: { text: '光具座在，R1 的像距 15.0000 cm，引擎算得出结果。', refs: ['R1'] },
      observation: { text: '放大率、像距、像高三行都记了，都是 R3 那一组要看的量。', refs: ['R3'] },
      variables: { text: 'V1 和 V2 都只动了物距，变化只能归因于物距。', refs: ['V1', 'V2'] },
      conclusion: { text: '你说像和蜡烛一样大，T2 对得上；也说了是推物距造成的。', refs: ['T2'] },
    },
    claims: [
      { quote: '放大率从 -0.5000 变成 -1.0000', checkId: 'T1', verdict: 'agree', note: '对得上' },
      { quote: '像一直是倒立的', checkId: 'T5', verdict: 'agree', note: 'm 为负' },
    ],
    conclusionBand: 'solid',
    summary: '三次记录只动物距，参数和结论对得上。',
    ...over,
  };
}

const fakeChat = (payload: unknown, opts: { fail?: boolean } = {}): ChatFn => async () => {
  if (opts.fail) return { ok: false, error: { kind: 'launcher-down', message: 'x' } };
  return { ok: true, text: typeof payload === 'string' ? payload : JSON.stringify(payload) };
};

/* ============================================================
 * 解析与清洗
 * ========================================================== */

describe('extractJson', () => {
  it('裸 JSON 能解析', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('被 ``` 包着也能解析', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('前后有闲话也能抠出来', () => {
    expect(extractJson('好的，这是结果：{"a":1} 希望有帮助')).toEqual({ a: 1 });
  });

  it('坏 JSON 返回 null', () => {
    expect(extractJson('{不是 json')).toBeNull();
    expect(extractJson('')).toBeNull();
    expect(extractJson('没有任何花括号')).toBeNull();
  });
});

describe('sanitize：白名单过滤（§3.5）', () => {
  it('合法返回通过，多余字段被丢掉', () => {
    const input = makeInput();
    const raw = goodPayload(input, {
      rewrite: '你可以这样写：……',
      suggestedText: '参考范文',
      example: '像高从……',
      score: 99,
    });
    const clean = sanitize(raw, input);
    expect(clean).not.toBeNull();
    expect(JSON.stringify(clean)).not.toContain('你可以这样写');
    expect(JSON.stringify(clean)).not.toContain('参考范文');
    expect(JSON.stringify(clean)).not.toContain('score');
  });

  it('challengeId 串台 → 整份作废', () => {
    const input = makeInput();
    expect(sanitize(goodPayload(input, { challengeId: 'CH-K-O2-05' }), input)).toBeNull();
  });

  it('档位不认识 → 整份作废', () => {
    const input = makeInput();
    expect(sanitize(goodPayload(input, { conclusionBand: 'great' }), input)).toBeNull();
  });

  it('缺任何一个维度的评语 → 整份作废', () => {
    const input = makeInput();
    const payload = goodPayload(input);
    delete (payload.dimensions as Record<string, unknown>).variables;
    expect(sanitize(payload, input)).toBeNull();
  });

  it('quote 不在反思原文里 → 那一条 claim 丢掉', () => {
    const input = makeInput();
    const payload = goodPayload(input, {
      claims: [
        { quote: '放大率从 -0.5000 变成 -1.0000', checkId: 'T1', verdict: 'agree', note: '' },
        { quote: '这是编的一句', checkId: 'T2', verdict: 'agree', note: '' },
      ],
    });
    const clean = sanitize(payload, input)!;
    expect(clean.claims).toHaveLength(1);
    expect(clean.claims[0].quote).toContain('放大率');
  });

  it('checkId 不在对照表里 → 那条 claim 丢掉', () => {
    const input = makeInput();
    const payload = goodPayload(input, {
      claims: [{ quote: '像一直是倒立的', checkId: 'T999', verdict: 'agree', note: '' }],
    });
    expect(sanitize(payload, input)!.claims).toHaveLength(0);
  });

  it('verdict 不认识 → 那条 claim 丢掉', () => {
    const input = makeInput();
    const payload = goodPayload(input, {
      claims: [{ quote: '像一直是倒立的', checkId: 'T1', verdict: 'maybe', note: '' }],
    });
    expect(sanitize(payload, input)!.claims).toHaveLength(0);
  });
});

/* ============================================================
 * 数字守卫（§3.6）
 * ========================================================== */

describe('数字守卫', () => {
  it('允许集合里有引擎算出的数（多种小数位）', () => {
    const allowed = allowedNumbers(makeInput());
    expect(allowed.has('15.0000')).toBe(true);
    expect(allowed.has('15')).toBe(true);
    expect(allowed.has('-0.6667')).toBe(true);
    // 负数的绝对值写法也放行
    expect(allowed.has('0.6667')).toBe(true);
  });

  it('编出来的数字被揪出来', () => {
    const allowed = allowedNumbers(makeInput());
    expect(foreignNumbers('像高放大了 1.83 倍', allowed)).toEqual(['1.83']);
    expect(foreignNumbers('R2 的像距是 16.6667 cm', allowed)).toEqual([]);
  });

  it('编号里的数字不算外来数字', () => {
    const allowed = allowedNumbers(makeInput());
    expect(foreignNumbers('T2 和 R3 对得上，V12 也是', allowed)).toEqual([]);
  });

  it('百分号和单位不干扰', () => {
    const allowed = allowedNumbers(makeInput());
    expect(foreignNumbers('相对照度 1.000，光屏有像', allowed)).toEqual([]);
  });
});

/* ============================================================
 * 档位硬校验（§1.5）
 * ========================================================== */

describe('结论档位硬校验', () => {
  const clean = (over: Partial<ReturnType<typeof goodPayload>> = {}) => {
    const input = makeInput();
    return sanitize(goodPayload(input, over), input)!;
  };

  it('AI 说 excellent 但 claims 里有 contradict → wrong', () => {
    const d = enforceBand(
      clean({
        conclusionBand: 'excellent',
        claims: [{ quote: '像一直是倒立的', checkId: 'T1', verdict: 'contradict', note: '' }],
      }),
    );
    expect(d.band).toBe('wrong');
    expect(d.note).toContain('矛盾');
  });

  it('AI 说 excellent 但一条 claim 都没有 → shaky', () => {
    const d = enforceBand(clean({ conclusionBand: 'excellent', claims: [] }));
    expect(d.band).toBe('shaky');
  });

  it('solid + 干净 → 保持 solid', () => {
    expect(enforceBand(clean()).band).toBe('solid');
  });

  it('shaky 但有矛盾陈述 → 还是降到 wrong（判据冲突时取严）', () => {
    const d = enforceBand(
      clean({
        conclusionBand: 'shaky',
        claims: [{ quote: '像一直是倒立的', checkId: 'T1', verdict: 'contradict', note: '' }],
      }),
    );
    expect(d.band).toBe('wrong');
  });
});

/* ============================================================
 * gradeWithAI 整链
 * ========================================================== */

describe('gradeWithAI', () => {
  it('正常返回 → 四维评语都拿到', async () => {
    const input = makeInput();
    const out = await gradeWithAI(input, CONFIG, { chat: fakeChat(goodPayload(input)) });
    expect(out.ai).not.toBeNull();
    expect(out.dropped).toHaveLength(0);
    expect(out.refused).toBeNull();
    expect(out.band).toBe('solid');
  });

  it('AI 编了一个新数字 → 那一维退回模板，其他维不受影响', async () => {
    const input = makeInput();
    const payload = goodPayload(input);
    payload.dimensions.observation.text = '像的放大率是 1.83 倍，比 R1 大。';
    const out = await gradeWithAI(input, CONFIG, { chat: fakeChat(payload) });
    expect(out.dropped).toContain('observation');
    expect(out.ai!.dimensions.observation).toBeUndefined();
    expect(out.ai!.dimensions.assembly).toBeDefined();
  });

  it('编剧摘要里的外来数字 → summary 清空，但评语还在', async () => {
    const input = makeInput();
    const out = await gradeWithAI(input, CONFIG, {
      chat: fakeChat(goodPayload(input, { summary: '像放大了 3.7 倍。' })),
    });
    expect(out.ai!.summary).toBe('');
    expect(out.ai!.dimensions.assembly).toBeDefined();
  });

  it('两次都不是合法 JSON → AI_INVALID', async () => {
    const input = makeInput();
    const out = await gradeWithAI(input, CONFIG, { chat: fakeChat('我不是 JSON') });
    expect(out.ai).toBeNull();
    expect(out.refused).toBe('AI_INVALID');
    expect(out.attempts).toBe(2);
  });

  it('第二次成功也算数（只在格式错误时重试）', async () => {
    const input = makeInput();
    let n = 0;
    const chat: ChatFn = async () => {
      n++;
      return n === 1 ? { ok: true, text: '坏的' } : { ok: true, text: JSON.stringify(goodPayload(input)) };
    };
    const out = await gradeWithAI(input, CONFIG, { chat });
    expect(out.ai).not.toBeNull();
    expect(out.attempts).toBe(2);
  });

  it('连不上 → 不重试，直接 NO_AI', async () => {
    const input = makeInput();
    const out = await gradeWithAI(input, CONFIG, { chat: fakeChat(null, { fail: true }) });
    expect(out.refused).toBe('NO_AI');
    expect(out.attempts).toBe(1);
  });
});

/* ============================================================
 * gradeExperiment 的降级路径
 * ========================================================== */

describe('没配 AI 时必须能用', () => {
  it('没有 config → 不调 AI，D1–D3 有分，D4 是模板且 refused=NO_AI', async () => {
    let called = 0;
    const chat: ChatFn = async () => {
      called++;
      return { ok: true, text: '{}' };
    };
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v'],
      stage: 'junior',
      config: null,
      deps: { chat },
    });
    expect(called).toBe(0); // 一次 API 都没发
    expect(r.refused?.code).toBe('NO_AI');
    expect(r.by).toBe('template');
    expect(r.dimensions.find((d) => d.key === 'assembly')!.score).toBe(100);
    expect(r.dimensions.find((d) => d.key === 'conclusion')!.score).toBe(55);
    expect(r.dimensions.find((d) => d.key === 'conclusion')!.comment).toContain('AI');
  });

  it('配了 AI 但没填 Key → 同样降级，不发请求', async () => {
    let called = 0;
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v'],
      stage: 'junior',
      config: { ...CONFIG, apiKey: '' },
      deps: {
        chat: async () => {
          called++;
          return { ok: true, text: '{}' };
        },
      },
    });
    expect(called).toBe(0);
    expect(r.refused?.code).toBe('NO_AI');
    expect(r.total).not.toBeNull();
  });

  it('AI 返回非法 → refused=AI_INVALID，其他维度仍然有分', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v'],
      stage: 'junior',
      config: CONFIG,
      deps: { chat: fakeChat('乱七八糟') },
    });
    expect(r.refused?.code).toBe('AI_INVALID');
    expect(r.dimensions.find((d) => d.key === 'assembly')!.score).toBe(100);
    expect(r.total).not.toBeNull();
  });

  it('AI 正常 → by:ai，四个维度都用 AI 评语', async () => {
    const input = makeInput();
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v', 'imageHeight'],
      stage: 'junior',
      config: CONFIG,
      deps: { chat: fakeChat(goodPayload(input)) },
    });
    expect(r.by).toBe('ai');
    expect(r.refused).toBeNull();
    expect(r.dimensions.every((d) => d.by === 'ai')).toBe(true);
    expect(r.claims).toHaveLength(2);
    // 100 / 100 / 100 / 80 → 97
    expect(r.total).toBe(97);
    expect(r.level).toBe('excellent');
    expect(r.passed).toBe(true);
  });

  it('AI 评语里的换行被拍平（否则会把报告的表格撕开）', async () => {
    const input = makeInput();
    const payload = goodPayload(input);
    payload.dimensions.assembly.text = '光具座在，\nR1 的像距 15.0000 cm。';
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v', 'imageHeight'],
      stage: 'junior',
      config: CONFIG,
      deps: { chat: fakeChat(payload) },
    });
    const c = r.dimensions.find((d) => d.key === 'assembly')!.comment;
    expect(c).not.toContain('\n');
  });

  it('AI 多返回的 rewrite 字段到不了 UI（铁律 3）', async () => {
    const input = makeInput();
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v'],
      stage: 'junior',
      config: CONFIG,
      deps: {
        chat: fakeChat(
          goodPayload(input, {
            rewrite: '建议你改成：像高从 1.25 变成 2.50',
            suggestedText: '参考范文……',
          }),
        ),
      },
    });
    const dumped = JSON.stringify(r);
    expect(dumped).not.toContain('建议你改成');
    expect(dumped).not.toContain('参考范文');
  });
});

describe('拒绝评分与降级', () => {
  it('没有任何记录 → NO_EVIDENCE，total 是 null 不是 0', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: [],
      stage: 'junior',
      config: null,
    });
    expect(r.refused?.code).toBe('NO_EVIDENCE');
    expect(r.total).toBeNull();
    expect(r.level).toBe('not_graded');
    expect(r.dimensions).toHaveLength(0);
  });

  it('只有空实验台 → NO_RUN', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: [snap(EXAMPLE_A[0], { challengeId: CH.id, empty: true, time: 1 })],
      stage: 'junior',
      config: null,
    });
    expect(r.refused?.code).toBe('NO_RUN');
    expect(r.total).toBeNull();
  });

  it('器具全缺但引擎没报错 → 不整体拒绝，D1 = 20 照常给分', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION, challengeId: 'CH-UNKNOWN-NO-KINDS' }),
      challenge: {
        ...CH,
        id: 'CH-UNKNOWN-NO-KINDS',
      },
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: 'CH-UNKNOWN-NO-KINDS', time: i })),
      seenObservations: [],
      stage: 'junior',
      config: null,
    });
    expect(r.refused?.code).toBe('NO_RUBRIC');
    expect(r.total).not.toBeNull();
  });

  it('所有记录都引擎报错 → ENGINE_ERROR', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: CH,
      captures: [
        snap(EXAMPLE_A[0], { challengeId: CH.id, time: 1, circuitError: '电路节点矩阵奇异，请检查连接和参数' }),
      ],
      stage: 'junior',
      config: null,
    });
    expect(r.refused?.code).toBe('ENGINE_ERROR');
  });

  it('反思不满 10 字 → D4 不评（不是 0 分），其余三维照常，total 按剩余归一', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: '太短' }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      seenObservations: ['m', 'v', 'imageHeight'],
      stage: 'junior',
      config: null,
    });
    const d4 = r.dimensions.find((d) => d.key === 'conclusion')!;
    expect(d4.score).toBeNull();
    expect(d4.band).toBe('insufficient');
    expect(r.refused?.code).toBe('NO_REFLECTION');
    // (0.3*100 + 0.3*100 + 0.25*100) / 0.85 = 100
    expect(r.total).toBe(100);
  });

  it('反思太短时不调 AI（不花 token 让它评空文本）', async () => {
    let called = 0;
    await gradeExperiment({
      learner: learnerWith({ reflection: '太短' }),
      challenge: CH,
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
      stage: 'junior',
      config: CONFIG,
      deps: {
        chat: async () => {
          called++;
          return { ok: true, text: '{}' };
        },
      },
    });
    expect(called).toBe(0);
  });

  it('没有 rubric 的挑战 → NO_RUBRIC，D1/D3 照常，D2 无法判断', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: REFLECTION, challengeId: 'CH-K-O3-05' }),
      challenge: { ...CH, id: 'CH-K-O3-05', title: '组合透镜' },
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: 'CH-K-O3-05', time: i })),
      seenObservations: ['m'],
      stage: 'junior',
      config: null,
    });
    expect(r.refused?.code).toBe('NO_RUBRIC');
    expect(r.dimensions.find((d) => d.key === 'observation')!.score).toBeNull();
    expect(r.dimensions.find((d) => d.key === 'assembly')!.score).not.toBeNull();
  });

  it('例 B：D1 满分但总分不及格（文档 §3.4 例 B）', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: '光屏上也看到了更大的像，所以这一关完成了。', challengeId: CH_B.id }),
      challenge: CH_B,
      captures: EXAMPLE_B.map((p, i) => snap(p, { challengeId: CH_B.id, time: i })),
      seenObservations: ['m'],
      stage: 'junior',
      config: null,
    });
    const d1 = r.dimensions.find((d) => d.key === 'assembly')!;
    const d2 = r.dimensions.find((d) => d.key === 'observation')!;
    const d3 = r.dimensions.find((d) => d.key === 'variables')!;
    expect(d1.score).toBe(100);
    expect(d2.score).toBe(33);
    expect(d3.score).toBe(0);
    // 没配 AI 时 D4 = 55（保守档），所以总分 = 30 + 9.9 + 0 + 8.25 ≈ 48
    expect(r.total).toBe(48);
    expect(r.passed).toBe(false);
  });

  it('不通过也不会拒绝评：level 是 improve，passed 是 false', async () => {
    const r = await gradeExperiment({
      learner: learnerWith({ reflection: '光屏上也看到了更大的像，所以这一关完成了。', challengeId: CH_B.id }),
      challenge: CH_B,
      captures: EXAMPLE_B.map((p, i) => snap(p, { challengeId: CH_B.id, time: i })),
      seenObservations: [],
      stage: 'junior',
      config: null,
    });
    expect(r.level).toBe('improve');
    expect(r.total).not.toBeNull();
  });
});
