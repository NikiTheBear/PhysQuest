import type { LearnerState } from './contracts';
import { previewImport } from './persistence';

export interface ChallengeMeta {
  id: string;
  title: string;
  prediction?: {
    prompt: string;
    options: string[];
    answerIndex: number;
  };
}

export interface MisconceptionMeta {
  id: string;
  belief: string;
  truth: string;
}

export interface StudentSubmission {
  /** 文件名（去掉 .json 后缀作为匿名/学生标识） */
  name: string;
  learner: LearnerState;
}

export interface MisconceptionRank {
  id: string;
  belief: string;
  truth: string;
  studentCount: number;
  totalHits: number;
}

export interface PredictionStat {
  challengeId: string;
  title: string;
  totalGuesses: number;
  correctGuesses: number;
  wrongRate: number;
  optionCounts: Array<{ label: string; count: number; isCorrect: boolean }>;
}

export interface ClassroomSummary {
  studentCount: number;
  totalRuns: number;
  avgCompleted: number;
  reflectionCount: number;
  topMisconceptions: MisconceptionRank[];
  predictionStats: PredictionStat[];
  reflections: Array<{ studentName: string; challengeId: string; challengeTitle: string; text: string }>;
}

const emptyLearner = (): LearnerState => ({
  stage: 'junior',
  completed: {},
  runs: [],
  predictions: {},
  reflections: {},
  misconceptions: {},
});

/** 解析单份学生导出的 .json 文件，复用 persistence.ts 的全 5 模块校验 */
export function parseStudentFile(fileName: string, text: string): StudentSubmission {
  const { learner } = previewImport(text, emptyLearner());
  const cleanName = fileName.replace(/\.json$/i, '').trim() || '未命名学生';
  return { name: cleanName, learner };
}

/** 聚合多份学生学习记录，生成全班课堂讲评数据（纯函数、零后端） */
export function aggregateClassroom(
  students: StudentSubmission[],
  catalog: {
    challenges: ChallengeMeta[];
    misconceptions: MisconceptionMeta[];
  },
): ClassroomSummary {
  const chMap = new Map(catalog.challenges.map((c) => [c.id, c]));
  const misMap = new Map(catalog.misconceptions.map((m) => [m.id, m]));

  let totalRuns = 0;
  let totalCompleted = 0;
  let reflectionCount = 0;

  const misAgg = new Map<string, { studentCount: number; totalHits: number }>();
  const predAgg = new Map<string, Map<number, number>>();
  const reflections: ClassroomSummary['reflections'] = [];

  for (const s of students) {
    totalRuns += s.learner.runs.length;
    totalCompleted += Object.values(s.learner.completed).filter(Boolean).length;

    const studentRefls = Object.entries(s.learner.reflections).filter(([, r]) => r.text.trim().length > 0);
    if (studentRefls.length > 0) reflectionCount += 1;
    for (const [cid, r] of studentRefls) {
      reflections.push({
        studentName: s.name,
        challengeId: cid,
        challengeTitle: chMap.get(cid)?.title ?? cid,
        text: r.text.trim(),
      });
    }

    for (const [mid, hits] of Object.entries(s.learner.misconceptions)) {
      if (!(hits > 0)) continue;
      const cur = misAgg.get(mid) ?? { studentCount: 0, totalHits: 0 };
      cur.studentCount += 1;
      cur.totalHits += hits;
      misAgg.set(mid, cur);
    }

    for (const [cid, pred] of Object.entries(s.learner.predictions)) {
      const bucket = predAgg.get(cid) ?? new Map<number, number>();
      bucket.set(pred.chosenIndex, (bucket.get(pred.chosenIndex) ?? 0) + 1);
      predAgg.set(cid, bucket);
    }
  }

  const topMisconceptions: MisconceptionRank[] = [...misAgg.entries()]
    .map(([id, stat]) => {
      const meta = misMap.get(id);
      return {
        id,
        belief: meta?.belief ?? id,
        truth: meta?.truth ?? '—',
        studentCount: stat.studentCount,
        totalHits: stat.totalHits,
      };
    })
    .sort((a, b) => b.studentCount - a.studentCount || b.totalHits - a.totalHits);

  const predictionStats: PredictionStat[] = [...predAgg.entries()]
    .map(([cid, counts]) => {
      const meta = chMap.get(cid);
      const options = meta?.prediction?.options ?? [];
      const answerIdx = meta?.prediction?.answerIndex ?? -1;
      let totalGuesses = 0;
      let correctGuesses = 0;

      const maxIdx = Math.max(options.length - 1, ...counts.keys());
      const optionCounts: PredictionStat['optionCounts'] = [];
      for (let i = 0; i <= maxIdx; i++) {
        const count = counts.get(i) ?? 0;
        totalGuesses += count;
        const isCorrect = i === answerIdx;
        if (isCorrect) correctGuesses += count;
        optionCounts.push({
          label: options[i] ?? `选项 ${String.fromCharCode(65 + i)}`,
          count,
          isCorrect,
        });
      }

      const wrongRate = totalGuesses > 0 ? (totalGuesses - correctGuesses) / totalGuesses : 0;
      return {
        challengeId: cid,
        title: meta?.title ?? cid,
        totalGuesses,
        correctGuesses,
        wrongRate,
        optionCounts,
      };
    })
    .sort((a, b) => b.wrongRate - a.wrongRate || b.totalGuesses - a.totalGuesses);

  return {
    studentCount: students.length,
    totalRuns,
    avgCompleted: students.length > 0 ? Number((totalCompleted / students.length).toFixed(1)) : 0,
    reflectionCount,
    topMisconceptions,
    predictionStats,
    reflections,
  };
}

/** 导出全班课堂讲评 Markdown 摘要 */
export function buildClassroomMarkdown(summary: ClassroomSummary): string {
  const lines: string[] = [];
  lines.push('# PhysQuest · 课堂学情汇总报告');
  lines.push('');
  lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(
    `提交人数：${summary.studentCount} 人 · 人均完成挑战：${summary.avgCompleted} 个 · 总参数锁定：${summary.totalRuns} 次 · 已写反思：${summary.reflectionCount} 人`,
  );
  lines.push('');

  lines.push('## 一、全班高频误区榜');
  lines.push('');
  if (summary.topMisconceptions.length === 0) {
    lines.push('_本批次未统计到误区命中记录。_');
  } else {
    lines.push('| 排名 | 常见误区 | 踩坑人数 | 总命中次数 | 正确理解 |');
    lines.push('|---|---|---:|---:|---|');
    summary.topMisconceptions.slice(0, 10).forEach((m, i) => {
      lines.push(`| ${i + 1} | ${m.belief} | ${m.studentCount} | ${m.totalHits} | ${m.truth} |`);
    });
  }
  lines.push('');

  lines.push('## 二、各关「先猜」猜错率排行（最适合课堂讲评）');
  lines.push('');
  if (summary.predictionStats.length === 0) {
    lines.push('_本批次暂无先猜记录。_');
  } else {
    for (const p of summary.predictionStats) {
      const pct = Math.round(p.wrongRate * 100);
      lines.push(`### ${p.title}（${p.challengeId}）—— 猜错率 ${pct}%（${p.totalGuesses} 人作答）`);
      for (const opt of p.optionCounts) {
        const mark = opt.isCorrect ? '（正确）' : '';
        lines.push(`- ${opt.label}${mark}：${opt.count} 人`);
      }
      lines.push('');
    }
  }

  if (summary.reflections.length > 0) {
    lines.push('## 三、学生反思摘录');
    lines.push('');
    for (const r of summary.reflections.slice(0, 20)) {
      lines.push(`- **${r.studentName}**（${r.challengeTitle}）：${r.text.replace(/\s*\n+\s*/g, ' ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
