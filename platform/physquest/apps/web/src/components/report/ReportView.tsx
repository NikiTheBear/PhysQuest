import { useMemo, useState } from 'react';
import type { LearnerState } from '../../core/contracts';
import { CHALLENGES, KNOWLEDGE, MISCONCEPTIONS } from '../../data/content';

interface Props {
  learner: LearnerState;
  onReflection: (text: string) => void;
  reflectionText: string;
}

export function buildReport(
  learner: LearnerState,
  reflectionText: string,
  challengeTitle: string,
): string {
  const runs = learner.runs.slice(-8);
  const lines: string[] = [];

  lines.push('# 凸透镜成像 · 学习报告');
  lines.push('');
  lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`本次挑战：${challengeTitle}`);
  lines.push('');

  lines.push('## 一、模型声明（这份报告的计算边界）');
  lines.push('');
  lines.push('- 采用薄透镜近轴近似，忽略球差与色差；');
  lines.push('- 光线按几何光学直线传播，未考虑衍射；');
  lines.push('- 透镜口径、物高为教学设定值，不代表真实器材规格；');
  lines.push('- 所有数值由本地确定性引擎计算，AI 不参与计算。');
  lines.push('');

  lines.push('## 二、探索记录（预测 vs 实际）');
  lines.push('');
  if (runs.length === 0) {
    lines.push('_还没有锁定任何一组参数。_');
  } else {
    lines.push('| # | 物距u | 焦距f | 像距v | 放大率m | 结果 | 我的预测 |');
    lines.push('|---|---|---|---|---|---|---|');
    runs.forEach((r, i) => {
      const ch = CHALLENGES.find((c) => c.id === r.challengeId);
      const pred = r.prediction && ch ? ch.prediction.options[r.prediction.chosenIndex] : '—';
      lines.push(
        `| ${i + 1} | ${r.params.u.toFixed(1)} | ${r.params.f.toFixed(0)} | ${Math.abs(r.metrics.v).toFixed(1)} | ${r.metrics.m.toFixed(2)} | ${r.metrics.description} | ${pred} |`,
      );
    });
  }
  lines.push('');

  lines.push('## 三、完成情况');
  lines.push('');
  const done = CHALLENGES.filter((c) => learner.completed[c.id]);
  lines.push(`已完成 ${done.length} / ${CHALLENGES.length} 个挑战：`);
  done.forEach((c) => lines.push(`- ${c.title}`));
  lines.push('');

  const walked = Object.entries(learner.misconceptions).sort((a, b) => b[1] - a[1]);
  lines.push('## 四、踩过的坑');
  lines.push('');
  if (walked.length === 0) {
    lines.push('_暂时没有记录到误区命中。_');
  } else {
    walked.forEach(([id, n]) => {
      const m = MISCONCEPTIONS.find((x) => x.id === id);
      if (m) lines.push(`- **${m.belief}** —— 命中 ${n} 次。正确理解：${m.truth}`);
    });
  }
  lines.push('');

  const learned = new Set(done.flatMap((c) => c.knowledgeIds));
  lines.push('## 五、这次涉及的知识点');
  lines.push('');
  learned.forEach((id) => {
    const k = KNOWLEDGE.find((x) => x.id === id);
    if (k) lines.push(`- ${k.id} **${k.title}**：${k.oneLine}`);
  });
  lines.push('');

  lines.push('## 六、我自己的反思（必须本人手写，AI 不代写）');
  lines.push('');
  lines.push(reflectionText.trim() || '_（未填写）_');
  lines.push('');

  return lines.join('\n');
}

export default function ReportView({ learner, onReflection, reflectionText, challengeTitle }: Props & { challengeTitle: string }) {
  const [show, setShow] = useState(false);
  const report = useMemo(
    () => buildReport(learner, reflectionText, challengeTitle),
    [learner, reflectionText, challengeTitle],
  );

  const quizDone = Object.keys(learner.reflections).length > 0;
  const hasReflection = reflectionText.trim().length >= 10;
  const canGenerate = hasReflection;

  const download = () => {
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `PhysQuest-凸透镜-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="panel">
        <h4>我自己的结论</h4>
        <p style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 10 }}>
          这一栏必须你自己写。系统不会提供「帮我写」按钮，AI 也不会。
        </p>
        <textarea
          className="refl"
          value={reflectionText}
          maxLength={1200}
          onChange={(e) => onReflection(e.target.value)}
          placeholder="例如：我发现蜡烛推到两倍焦距的时候，像和物一样大，而且是倒着的。最意外的是遮住透镜一半，像居然还在，只是变暗了……"
        />
        <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 6 }}>
          {reflectionText.trim().length} / 至少 10 字
        </div>
      </div>

      <div className="panel">
        <h4>报告</h4>
        {!canGenerate && (
          <div className="gate">写一句反思（至少 10 个字），报告才能生成。这是这个产品的底线。</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn-primary" disabled={!canGenerate} onClick={() => setShow(true)}>
            生成学习报告
          </button>
          <button className="btn-ghost" disabled={!canGenerate} onClick={download}>
            导出 .md
          </button>
          <button
            className="btn-ghost"
            disabled={!canGenerate}
            onClick={() => navigator.clipboard?.writeText(report)}
          >
            复制
          </button>
        </div>

        {show && canGenerate && (
          <div style={{ marginTop: 14 }}>
            <pre className="report">{report}</pre>
          </div>
        )}
      </div>
    </>
  );
}
