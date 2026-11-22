import { useMemo, useRef, useState } from 'react';
import type { LearnerState } from '../../core/contracts';
import {
  describeImport,
  exportLearner,
  importLearner,
  previewImport,
  type LearnerImportSummary,
} from '../../core/persistence';
import { CHALLENGES, KNOWLEDGE, MISCONCEPTIONS } from '../../data/content';
import { MarkdownLite } from './MarkdownLite';

interface Props {
  learner: LearnerState;
  onReflection: (text: string) => void;
  reflectionText: string;
  /** 题库做完了吗 */
  quizDone?: boolean;
  /** 题库结果 */
  quizResult?: { answered: number; correct: number } | null;
  /** 去题库 */
  onGoQuiz?: () => void;
  /** 导入成功后把新记录交给 App（localStorage 已由 persistence 写好） */
  onImported: (next: LearnerState) => void;
  /** 提示条，App 顶层的 pq-toast 显示 */
  onToast: (msg: string) => void;
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

export default function ReportView({
  learner,
  onReflection,
  reflectionText,
  challengeTitle,
  quizDone = true,
  quizResult = null,
  onGoQuiz,
  onImported,
  onToast,
}: Props & { challengeTitle: string }) {
  const [show, setShow] = useState(false);
  const report = useMemo(
    () => buildReport(learner, reflectionText, challengeTitle),
    [learner, reflectionText, challengeTitle],
  );

  const hasReflection = reflectionText.trim().length >= 10;
  // 报告闸门：题库做完 + 反思写完，两个都要
  const canGenerate = hasReflection && quizDone;

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
          <div className="gate">
            {!quizDone && <div>① 还没做题库。报告前要先做一遍题，看看哪些没掌握。</div>}
            {!hasReflection && <div>② 写一句反思（至少 10 个字）。这一栏必须你自己写，AI 不会替你。</div>}
          </div>
        )}

        {quizResult && (
          <div className="report-quiz-note">
            题库：答对 {quizResult.correct} / {quizResult.answered}
          </div>
        )}

        {!quizDone && onGoQuiz && (
          <button className="btn-ghost btn-small" onClick={onGoQuiz} style={{ marginTop: 10 }}>
            去做题库 →
          </button>
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
            {/* 渲染成真正的标题/列表/表格，原文仍可「复制」或导出 .md */}
            <div className="report">
              <MarkdownLite text={report} />
            </div>
          </div>
        )}
      </div>

      <LearnerBackupPanel learner={learner} onImported={onImported} onToast={onToast} />
    </>
  );
}

/* ============================================================
 * 学习记录的导出 / 导入
 * ========================================================== */

interface BackupProps {
  learner: LearnerState;
  onImported: (next: LearnerState) => void;
  onToast: (msg: string) => void;
}

/** 带日期戳的文件名，例如 physquest-learner-2026-11-22.json */
function exportFileName(): string {
  return `physquest-learner-${new Date().toISOString().slice(0, 10)}.json`;
}

function triggerDownload(text: string, name: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** 挑战 id → 人看得懂的标题（找不到就退回 id，不能空着） */
function challengeLabel(id: string): string {
  return CHALLENGES.find((c) => c.id === id)?.title ?? id;
}

/**
 * 备份面板：导出学习记录 / 导入学习记录。
 *
 * 单独抽出来是因为「报告为空」的页面也要能用 —— 新电脑上一条记录都没有，
 * 学生正是那时候最需要把旧电脑倒的文件导进来。
 */
export function LearnerBackupPanel({ learner, onImported, onToast }: BackupProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  /** 待确认的导入：只有真的会覆盖反思时才弹层，不覆盖就直接导 */
  const [pending, setPending] = useState<{ text: string; summary: LearnerImportSummary } | null>(
    null,
  );

  const doExport = () => {
    triggerDownload(exportLearner(learner), exportFileName());
    onToast(`学习记录已导出：${exportFileName()}`);
  };

  /**
   * 真的写入。这里再预览一次而不是直接用弹层里的旧小结：
   * 弹层打开期间学生可能又改了反思，覆盖条数会变，toast 必须说真实的那份。
   */
  const apply = (text: string) => {
    try {
      const preview = previewImport(text, learner);
      const next = importLearner(text, learner);
      onImported(next);
      onToast(describeImport(preview.summary));
    } catch (e) {
      onToast(`导入失败：${e instanceof Error ? e.message : '文件读不出来。'}`);
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      onToast('导入失败：文件读不出来，可能是权限或文件已损坏。');
      return;
    }
    try {
      const preview = previewImport(text, learner);
      // 会覆盖反思就问一句，否则直接合并
      if (preview.summary.overwrittenReflections > 0) {
        setPending({ text, summary: preview.summary });
        return;
      }
      apply(text);
    } catch (e) {
      onToast(`导入失败：${e instanceof Error ? e.message : '这个文件不是 PhysQuest 导出的记录。'}`);
    }
  };

  return (
    <>
      <div className="panel">
        <h4>备份与迁移</h4>
        <p style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 10 }}>
          学习记录只存在这台电脑的浏览器里。换电脑、换浏览器、清缓存之前，先导出一份带过去。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary btn-small" onClick={doExport}>
            导出学习记录
          </button>
          <button className="btn-ghost btn-small" onClick={() => fileRef.current?.click()}>
            导入学习记录
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // 清空 value，否则同一个文件选第二次不触发 onChange
              e.target.value = '';
              void readFile(file);
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 8, lineHeight: 1.6 }}>
          导入是合并，不会清掉现在的东西：参数记录按时间取并集、重复的跳过；
          反思如果两边写的不一样，用文件里的那份。
        </div>
      </div>

      {pending && (
        <div className="overlay" onClick={() => setPending(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px,100%)' }}
          >
            <h3>有 {pending.summary.overwrittenReflections} 条反思会被覆盖</h3>
            <p className="sub">
              这些挑战你自己写过反思，文件里的内容不一样。导入会换成文件里的那份，
              现在写的这段会被替掉。其它记录是合并，不会丢。
            </p>
            <ul style={{ fontSize: 13.5, lineHeight: 1.9, paddingLeft: 20 }}>
              {pending.summary.overwrittenReflectionIds.map((id) => (
                <li key={id}>{challengeLabel(id)}</li>
              ))}
            </ul>
            <div className="gate">覆盖之后没法撤回。拿不准就先「导出学习记录」留一份当前的。</div>
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => {
                  const p = pending;
                  setPending(null);
                  apply(p.text);
                }}
              >
                确定导入
              </button>
              <button className="btn-ghost" onClick={() => setPending(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
