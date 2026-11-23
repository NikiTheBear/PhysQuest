import { useMemo, useRef, useState } from 'react';
import type { LearnerState } from '../../core/contracts';
import {
  describeImport,
  exportLearner,
  importLearner,
  loadGrade,
  previewImport,
  type LearnerImportSummary,
} from '../../core/persistence';
import { AUTO_CHALLENGES, CHALLENGES, KNOWLEDGE, MISCONCEPTIONS } from '../../data/content';
import type { GradeResult } from '../../core/grading/types';
import { BAND_LABEL, DIM_LABEL, LEVEL_LABEL, W } from '../../core/grading/types';
import { fmt } from '../../core/grading/rules';
import { MarkdownLite } from './MarkdownLite';
import GradingPanel, { pickGradeChallenge } from './GradingPanel';
import { loadCaptures } from '../../core/grading/capture-store';

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
  grade: GradeResult | null = null,
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
    // 不再硬编码光学的 u/f/v/m 四列 —— 平台有五个模块，记录要通用。
    // 每行显示：序号 · 挑战名 · 参数摘要 · 结果 · 我的预测
    lines.push('| # | 挑战 | 参数 | 结果 | 我的预测 |');
    lines.push('|---|---|---|---|---|');
    runs.forEach((r, i) => {
      const ch =
        CHALLENGES.find((c) => c.id === r.challengeId) ??
        AUTO_CHALLENGES.find((c) => c.id === r.challengeId);
      const pred =
        r.prediction && ch?.prediction ? ch.prediction.options[r.prediction.chosenIndex] : '—';
      const nums = Object.entries(r.params ?? {}).filter(
        ([, v]) => typeof v === 'number' && Number.isFinite(v),
      ) as Array<[string, number]>;
      const paramText = nums.length
        ? nums.map(([k, v]) => `${PARAM_LABEL[k] ?? k} ${Number(v.toFixed(2))}`).join('，')
        : '—';
      // 结论：优先用这一关自己的 summary；老记录只有光学 metrics 时退回它的 description
      const conclusion = r.summary ?? r.metrics?.description ?? '—';
      lines.push(
        `| ${i + 1} | ${ch?.title ?? r.challengeId} | ${paramText} | ${conclusion} | ${pred} |`,
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

  /* ---------- 七、实验评分（§5.4） ----------
     **必须是 ##** —— `#` 会触发 MarkdownLite 的老 bug（§2.4 缺口 6）。
     只在用户点了「生成学习报告」之后出现，且评分不影响导出。 */
  lines.push('## 七、实验评分（AI 写评语，数字由本地引擎算出）');
  lines.push('');
  if (!grade || grade.level === 'not_graded') {
    lines.push('_本次没有评分。_');
  } else {
    lines.push(`**总分 ${grade.total} / 100 · ${LEVEL_LABEL[grade.level]}**`);
    lines.push('');
    lines.push('| 维度 | 权重 | 分数 | 档位 | 评语 |');
    lines.push('|---|---|---|---|---|');
    for (const d of grade.dimensions) {
      lines.push(
        `| ${DIM_LABEL[d.key]} | ${Math.round(W[d.key] * 100)}% | ${d.score ?? '—'} | ${BAND_LABEL[d.band]} | ${cell(d.comment)} |`,
      );
    }
    lines.push('');
    if (grade.refused) {
      lines.push(`_${grade.refused.message}。_`);
      lines.push('');
    }
    lines.push('### 证据');
    lines.push('');
    lines.push('读数表 R（引擎原值）：');
    lines.push('');
    if (grade.evidence.facts.length === 0) {
      lines.push('_没有记录。_');
    } else {
      lines.push('| # | 物距u | 焦距f | 光屏位置 | 像距v | 放大率m | 像高 | 弥散圆 | 屏上有像 |');
      lines.push('|---|---|---|---|---|---|---|---|---|');
      for (const f of grade.evidence.facts) {
        lines.push(
          `| ${f.id} | ${f.lens?.u !== undefined ? fmt(f.lens.u, 1) : '—'} | ${
            f.lens?.f !== undefined ? fmt(f.lens.f, 1) : '—'
          } | ${f.lens?.screenX !== undefined ? fmt(f.lens.screenX, 1) : '—'} | ${
            f.metrics.v !== undefined ? fmt(f.metrics.v) : '—'
          } | ${f.metrics.m !== undefined ? fmt(f.metrics.m) : '—'} | ${
            f.metrics.imageHeight !== undefined ? fmt(f.metrics.imageHeight) : '—'
          } | ${f.metrics.blurDiameter !== undefined ? fmt(f.metrics.blurDiameter) : '—'} | ${
            f.metrics.screenHasImage === true ? '是' : f.metrics.screenHasImage === false ? '否' : '—'
          } |`,
        );
      }
    }
    lines.push('');
    lines.push('_以上所有数字由本地物理引擎计算，AI 未参与任何计算。_');
  }
  lines.push('');

  return lines.join('\n');
}

/** 表格单元格：竖线会把列冲散，换行会把表撕开，先拍平 */
function cell(text: string): string {
  return text.replace(/\|/g, '｜').replace(/\s*\n+\s*/g, ' ');
}

/** m 的安全显示：null（JSON 把 Infinity 存成 null）和 1e6 都写成人话 */
const PARAM_LABEL: Record<string, string> = {
  u: '物距', f: '焦距', h: '物高', screenX: '光屏位置',
  lensDiameter: '透镜口径', maskTop: '遮住上半部', objectShape: '物体形状',
  mass: '质量', radius: '半径', stiffness: '劲度系数', restLength: '原长',
  damping: '阻尼', gravity: '重力加速度', friction: '摩擦系数', angle: '角度',
  voltage: '电动势', resistance: '电阻', current: '电流', power: '功率',
  frequency: '频率', amplitude: '声压幅值', phase: '相位', speed: '传播速度',
  temperature: '温度', responseTime: '响应时间', conductivity: '导热系数',
  length: '长度', area: '截面积', heatCapacity: '热容',
};

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

  /**
   * 评分卡挂在这里（而不是 App.tsx）是为了不改 App.tsx：
   * 它自己读证据、自己发请求、自己存缓存，报告页刷新一次就照常能用。
   * 评分**只影响第七节的内容**，不影响任何按钮的可用状态（§5.3）。
   */
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const gradeTarget = useMemo(() => pickGradeChallenge(learner, loadCaptures()), [learner]);

  // 换关卡 / 导入学习记录后，把那一关已有的缓存评分读回来
  const cached = useMemo(
    () => (gradeTarget ? loadGrade(gradeTarget.ref.id) : null),
    [gradeTarget],
  );
  // 只认「同一关」的评分：导入学习记录或换关卡后，state 里那份可能是别的挑战的
  const fresh = grade && gradeTarget && grade.challengeId === gradeTarget.ref.id ? grade : null;
  const effectiveGrade = fresh ?? cached;

  const report = useMemo(
    () => buildReport(learner, reflectionText, challengeTitle, effectiveGrade),
    [learner, reflectionText, challengeTitle, effectiveGrade],
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

      <GradingPanel
        learner={learner}
        challenge={gradeTarget?.ref ?? null}
        grade={effectiveGrade}
        onGrade={setGrade}
      />

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
