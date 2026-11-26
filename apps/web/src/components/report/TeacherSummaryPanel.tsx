import { useMemo, useRef, useState } from 'react';
import { AUTO_CHALLENGES, CHALLENGES, MISCONCEPTIONS } from '../../data/content';
import {
  aggregateClassroom,
  buildClassroomMarkdown,
  parseStudentFile,
  type StudentSubmission,
} from '../../core/teacher-summary';

interface Props {
  onToast: (msg: string) => void;
}

export function TeacherSummaryPanel({ onToast }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const allChallenges = useMemo(() => [...CHALLENGES, ...AUTO_CHALLENGES], []);

  const summary = useMemo(
    () =>
      students.length > 0
        ? aggregateClassroom(students, {
            challenges: allChallenges,
            misconceptions: MISCONCEPTIONS,
          })
        : null,
    [students, allChallenges],
  );

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const loaded: StudentSubmission[] = [];
    const failed: string[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
        loaded.push(parseStudentFile(file.name, text));
      } catch (e) {
        failed.push(`${file.name}：${e instanceof Error ? e.message : '解析失败'}`);
      }
    }

    setStudents((prev) => {
      const map = new Map(prev.map((s) => [s.name, s]));
      for (const s of loaded) map.set(s.name, s);
      return [...map.values()];
    });
    setErrors(failed);
    if (loaded.length > 0) {
      onToast(`已导入 ${loaded.length} 份学生记录${failed.length ? `，${failed.length} 份失败` : ''}`);
    } else if (failed.length > 0) {
      onToast(`导入失败：${failed[0]}`);
    }
  };

  const downloadMd = () => {
    if (!summary) return;
    const md = buildClassroomMarkdown(summary);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PhysQuest-课堂汇总-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    onToast('全班课堂汇总报告已导出');
  };

  const copyMd = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(buildClassroomMarkdown(summary));
      onToast('全班汇总 Markdown 已复制到剪贴板');
    } catch {
      onToast('复制失败，请直接点「导出讲评 .md」');
    }
  };

  return (
    <div className="panel">
      <h4>教师端 · 全班学情汇总（零后端）</h4>
      <p style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 10 }}>
        批量选择全班学生导出的 <code>.json</code> 学习记录，在浏览器本地自动统计高频误区榜与各关「先猜」猜错分布，数据不上传任何服务器。
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-primary btn-small" onClick={() => inputRef.current?.click()}>
          批量导入学生记录 (.json)
        </button>
        {summary && (
          <>
            <button className="btn-ghost btn-small" onClick={downloadMd}>
              导出讲评 .md
            </button>
            <button className="btn-ghost btn-small" onClick={copyMd}>
              复制汇总
            </button>
            <button
              className="btn-ghost btn-small"
              onClick={() => {
                setStudents([]);
                setErrors([]);
              }}
            >
              清空列表
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="gate" style={{ marginTop: 10 }}>
          {errors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--label-1)', fontWeight: 500 }}>
            已汇总 {summary.studentCount} 人 · 人均完成 {summary.avgCompleted} 关 · 锁定参数 {summary.totalRuns} 次 · 已写反思 {summary.reflectionCount} 人
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>高频误区排行</div>
            {summary.topMisconceptions.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--label-2)' }}>暂无误区命中记录</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                {summary.topMisconceptions.slice(0, 6).map((m) => (
                  <li key={m.id}>
                    <b>{m.belief}</b>（{m.studentCount} 人踩坑 / 共 {m.totalHits} 次）—— {m.truth}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {summary.predictionStats.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                各关「先猜」猜错率（按从高到低排序）
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {summary.predictionStats.slice(0, 6).map((p) => (
                  <div
                    key={p.challengeId}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--bg-2, rgba(127,127,127,0.08))',
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <b>{p.title}</b>
                      <span>
                        猜错率 {Math.round(p.wrongRate * 100)}%（{p.totalGuesses} 人）
                      </span>
                    </div>
                    {p.optionCounts.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--label-2)' }}>
                        <span>
                          {opt.label}
                          {opt.isCorrect ? ' ✓' : ''}
                        </span>
                        <span>{opt.count} 人</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
