import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import GradingPanel, { pickGradeChallenge } from './GradingPanel';
import { buildReport } from './ReportView';
import { MarkdownLite } from './MarkdownLite';
import type { GradeResult } from '../../core/grading/types';
import { emptyLearner, EXAMPLE_A, learnerWith, snap } from '../../core/grading/test-fixtures';

const NOT_GRADED: GradeResult = {
  version: 1,
  challengeId: 'CH-O2-01',
  total: null,
  level: 'not_graded',
  passed: false,
  dimensions: [],
  claims: [],
  summary: '还没有任何记录',
  by: 'template',
  refused: { code: 'NO_EVIDENCE', message: '还没有任何记录' },
  evidence: { facts: [], changes: [], checks: [] },
  at: 1,
};

const GRADED: GradeResult = {
  version: 1,
  challengeId: 'CH-O2-01',
  total: 48,
  level: 'improve',
  passed: false,
  dimensions: [
    { key: 'assembly', score: 100, band: 'top', comment: '光具座在，R1 的像距 15.0000 cm。', refs: ['R1'], by: 'template' },
    { key: 'observation', score: 0, band: 'zero', comment: '这一关要读的三个量都没有记录。', refs: [], by: 'template' },
    { key: 'variables', score: null, band: 'insufficient', comment: '只有一条记录，本次不评。', refs: [], by: 'template' },
    { key: 'conclusion', score: 55, band: 'weak', comment: '这句话和 T2 对不上。', refs: ['T2'], by: 'ai' },
  ],
  claims: [{ quote: '像变大了', checkId: 'T2', verdict: 'agree', note: '对得上' }],
  summary: '总分 48 分',
  by: 'ai',
  refused: { code: 'NO_AI', message: 'AI 评语不可用' },
  evidence: {
    facts: [
      {
        id: 'R1',
        source: 'capture',
        at: 0,
        kinds: ['lens_bench'],
        componentCount: 1,
        params: {},
        channels: {},
        engineError: null,
        metrics: { v: 15, m: -0.5, imageHeight: 1.25, blurDiameter: 0, screenHasImage: true },
      },
    ],
    changes: [],
    checks: [{ id: 'T2', claim: 'R2 的 |m| 比 R1 大', verdict: 'yes' }],
  },
  at: 2,
};

const render = (grade: GradeResult | null, learner = learnerWith({ reflection: '我写了十个字以上的反思内容。' })) =>
  renderToStaticMarkup(
    createElement(GradingPanel, {
      learner,
      grade,
      challenge: {
        id: 'CH-O2-01',
        title: '让像和蜡烛一样大',
        brief: 'x',
        labId: 'optics-lens',
        knowledgeIds: ['K-O2-06'],
      },
    }),
  );

describe('GradingPanel', () => {
  it('没有记录时整块变成一条提示，不显示分数、不崩', () => {
    const html = render(NOT_GRADED);
    expect(html).not.toContain('null');
    expect(html).not.toContain('Infinity');
    expect(html).toContain('还没有任何记录');
    expect(html).toContain('先在实验台上调一组参数');
    expect(html).not.toContain('grade-total');
  });

  it('total = null 但有维度时：不渲染大数字，只写「未评分」', () => {
    const html = render({ ...GRADED, total: null, level: 'not_graded' });
    expect(html).toContain('未评分');
    expect(html).toContain('grade-total none');
  });

  it('四个维度都渲染出来，insufficient 显示「—」和「无法判断」', () => {
    const html = render(GRADED);
    expect(html).toContain('实验搭得对不对');
    expect(html).toContain('观测项选得对不对');
    expect(html).toContain('变量控制');
    expect(html).toContain('结论站不站得住');
    expect(html).toContain('无法判断');
    expect(html).toContain('—');
    // 不要出现 0 分被当成「无法判断」
    expect(html).not.toContain('>null<');
  });

  it('评语里带 refs 按钮，点了能跳证据表', () => {
    const html = render(GRADED);
    expect(html).toContain('grade-ref');
    expect(html).toContain('data-ref="R1"');
    expect(html).toContain('data-ref="T2"');
  });

  it('退回模板的评语会标「本段由规则生成」', () => {
    const html = render(GRADED);
    expect(html).toContain('本段由规则生成');
  });

  it('D1 < 50 时单独一行橘色提醒', () => {
    const low = {
      ...GRADED,
      dimensions: GRADED.dimensions.map((d) => (d.key === 'assembly' ? { ...d, score: 40 } : d)),
    };
    expect(render(low)).toContain('实验还没搭起来');
  });

  it('「不通过」只提示，不拦任何东西（评分卡里没有 disabled 的按钮）', () => {
    const html = render(GRADED);
    expect(html).toContain('待改进');
    // 评分卡自己只有一个「重新评分」按钮，且永远可点（不在评分时）
    expect(html.match(/<button/g)).toHaveLength(3); // 2 个 refs + 1 个重新评分
    expect(html).not.toContain('<button disabled');
  });

  it('观测项自报的选项来自 rubric，不预选', () => {
    const html = render(GRADED, emptyLearner());
    expect(html).toContain('这次你实际盯着哪些读数看');
    expect(html).toContain('放大率 m');
    expect(html).toContain('像高');
    // 一个都没勾
    expect(html).not.toContain('checked');
  });

  it('报告里的评分对象能从真实记录里推出来', () => {
    const learner = learnerWith({ reflection: '随便写，够十个字就行。' });
    const caps = EXAMPLE_A.map((p, i) => snap(p, { challengeId: 'CH-O2-01', time: i }));
    expect(pickGradeChallenge(learner, caps)?.ref.id).toBe('CH-O2-01');
  });

  it('没有任何真实活动时返回 null', () => {
    expect(pickGradeChallenge(emptyLearner(), [])).toBeNull();
  });
});

describe('报告第七节', () => {
  const learner = learnerWith({ reflection: '我写了十个字以上的反思内容。' });

  it('没有评分时写「本次没有评分」', () => {
    const md = buildReport(learner, '我写了十个字以上的反思内容。', '让像和蜡烛一样大', null);
    expect(md).toContain('## 七、实验评分');
    expect(md).toContain('_本次没有评分。_');
  });

  it('有评分时输出四维度表 + 证据表', () => {
    const md = buildReport(learner, '我写了十个字以上的反思内容。', '让像和蜡烛一样大', GRADED);
    expect(md).toContain('**总分 48 / 100');
    expect(md).toContain('| 维度 | 权重 | 分数 | 档位 | 评语 |');
    expect(md).toContain('| 实验搭得对不对 | 30% | 100 | 满档 |');
    expect(md).toContain('### 证据');
    expect(md).toContain('| R1 |');
    expect(md).toContain('_以上所有数字由本地物理引擎计算，AI 未参与任何计算。_');
  });

  it('第七节用 ## 开头，小节用 ###，没有更深的标题', () => {
    const md = buildReport(learner, '反思', '标题', GRADED);
    for (const line of md.split('\n')) {
      if (!line.startsWith('#')) continue;
      expect(/^#{1,3} /.test(line), line).toBe(true);
    }
    // 节标题只能是 ## 或 ###（一级标题只有文档开头那一个）
    for (const line of md.split('\n')) {
      if (!/^#{2,} /.test(line)) continue;
      expect(line.startsWith('## ') || line.startsWith('### '), line).toBe(true);
    }
  });

  it('整份报告交给 MarkdownLite 渲染不挂、表格没被撕开', () => {
    const md = buildReport(learner, '我写了十个字以上的反思内容。', '让像和蜡烛一样大', GRADED);
    const html = renderToStaticMarkup(createElement(MarkdownLite, { text: md }));
    expect(html).toContain('md-body');
    expect(html).toContain('七、实验评分');
    // 四维度表 + 读数表 = 至少两张表
    expect((html.match(/<table/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('m = null 的读数不崩（u ≈ f 时引擎给 Infinity，存回来变成 null）', () => {
    const learner2 = emptyLearner();
    learner2.runs = [
      {
        challengeId: 'CH-O2-01',
        params: { u: 10, f: 10, h: 2.5, screenX: 15, objectShape: 'arrow', maskTop: false, lensDiameter: 6 },
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
      },
    ];
    // 表格改成通用之后不再逐列格式化 u/f/v/m，但这一条要守住的原意没变：
    // m = null 时报告不能崩，结果列要写引擎自己的说法。
    const md = buildReport(learner2, '', '标题', null);
    expect(md).toContain('不成像：出射光平行');
    expect(md).toContain('探索记录');
  });
});
