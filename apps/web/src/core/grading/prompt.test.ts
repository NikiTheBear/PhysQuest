import { describe, expect, it } from 'vitest';
import { buildPrompt, renderGradingPacket, requiredObservationsLabel, SYSTEM } from './prompt';
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

const REFLECTION =
  '我把蜡烛从 30 cm 推到 20 cm，焦距一直是 10，光屏跟着往前挪。放大率从 -0.5000 变成 -1.0000，像高从 1.2500 cm 变成 2.5000 cm，像一直是倒立的。';

function makeInput() {
  return buildGradingInput({
    learner: learnerWith({ reflection: REFLECTION }),
    challenge: CH,
    rubric: loadRubric(CH.id),
    captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: CH.id, time: i })),
    seenObservations: ['m', 'v', 'imageHeight'],
    stage: 'junior',
  }).input;
}

describe('system 提示词（§3.2 逐字复制）', () => {
  it('五条禁令都在', () => {
    expect(SYSTEM).toContain('不许自己算任何物理量');
    expect(SYSTEM).toContain('不许修改、补充、纠正任何读数');
    expect(SYSTEM).toContain('不许在评语里出现');
    expect(SYSTEM).toContain('不许替学生写反思');
    expect(SYSTEM).toContain('不许输出 markdown');
  });

  it('输出结构里没有 score 字段（铁律 1）', () => {
    expect(SYSTEM).not.toContain('"score"');
    expect(SYSTEM).not.toContain('分数": ');
  });

  it('白名单里没有 rewrite / suggested / example（铁律 3）', () => {
    expect(SYSTEM).not.toMatch(/"rewrite"/);
    expect(SYSTEM).not.toMatch(/"suggested/);
    expect(SYSTEM).not.toMatch(/"example"/);
  });

  it('system 里不含任何学生数据（防止把读数拼进固定提示）', () => {
    expect(SYSTEM).not.toContain('15.0000');
    expect(SYSTEM).not.toContain('CH-O2-01');
  });
});

describe('评分包排版（§3.3）', () => {
  const user = renderGradingPacket(makeInput());

  it('三张表都在', () => {
    expect(user).toContain('【分数表】');
    expect(user).toContain('【读数表 R】');
    expect(user).toContain('【变化表 V】');
    expect(user).toContain('【对照表 T】');
  });

  it('分数表写的是本地算好的数', () => {
    expect(user).toContain('组装合法 D1   = 100');
    expect(user).toContain('观测项   D2   = 100');
    expect(user).toContain('变量控制 D3   = 100');
    expect(user).toContain('结论     D4   = 由你判定档位');
  });

  it('读数表有 R1/R2/R3 三行，数字和引擎一致', () => {
    expect(user).toContain('| R1 |');
    expect(user).toContain('| R3 |');
    expect(user).toContain('15.0000'); // R1 的 v
    expect(user).toContain('20.0000'); // R3 的 v
    expect(user).toContain('2.5000'); // R3 的像高
  });

  it('m 的 4 位小数照抄，不四舍五入到 2 位', () => {
    expect(user).toContain('-0.6667');
  });

  it('变化表有两个 V，改了什么写清 u 30→25', () => {
    expect(user).toContain('| V1 |');
    expect(user).toContain('| V2 |');
    expect(user).toContain('u 30→25');
    expect(user).toContain('（光屏，豁免）');
  });

  it('对照表从 T1 开始', () => {
    expect(user).toContain('| T1 |');
    expect(user).toContain('| 引擎判定 |');
  });

  it('反思原文被三引号包住，一个字都没改', () => {
    expect(user).toContain('"""');
    expect(user).toContain(REFLECTION);
  });

  it('本关目标写成人话 + 判定结果', () => {
    expect(user).toContain('放大率 m ≈ -1');
    expect(user).toContain('达成了');
  });

  it('数据不足的维度写「数据不足，本次不评」而不是 0', () => {
    const input = makeInput();
    input.scores.observation.score = null;
    input.scores.variables.score = null;
    const text = renderGradingPacket(input);
    expect(text).toContain('观测项   D2   = 数据不足，本次不评');
    expect(text).toContain('变量控制 D3   = 数据不足，本次不评');
  });

  it('无法映射的观测项会说明「不要拿它当判据」', () => {
    const input = buildGradingInput({
      learner: learnerWith({ reflection: REFLECTION }),
      challenge: { ...CH, id: 'CH-O2-04', title: '遮住透镜上半部分' },
      rubric: loadRubric('CH-O2-04'),
      captures: EXAMPLE_A.map((p, i) => snap(p, { challengeId: 'CH-O2-04', time: i })),
      seenObservations: ['relativeIlluminance'],
      stage: 'junior',
    }).input;
    const text = renderGradingPacket(input);
    expect(text).toContain('无法核对');
    expect(text).toContain('三条光线是否交于像点');
  });

  it('学生没自报时说明白', () => {
    const input = makeInput();
    input.seenObservations = [];
    expect(renderGradingPacket(input)).toContain('学生没有自报看过哪些读数');
  });

  it('buildPrompt 的 system 就是那份常量', () => {
    const { system } = buildPrompt(makeInput());
    expect(system).toBe(SYSTEM);
  });

  it('requiredObservationsLabel 用中文名', () => {
    expect(requiredObservationsLabel(makeInput())).toBe('放大率 m、像距 v、像高');
  });
});
