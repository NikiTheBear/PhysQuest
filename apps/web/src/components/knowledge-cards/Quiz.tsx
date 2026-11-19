import { useState } from 'react';
import type { QuizItem } from '../../core/contracts';

interface QuizProps {
  items: QuizItem[];
  onSubmit: (answers: Record<string, { correct: boolean; chosen: number | string }>) => void;
  onCancel: () => void;
}

export function QuizModal({ items, onSubmit, onCancel }: QuizProps) {
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, { correct: boolean; chosen: number | string }>>({});

  const item = items[idx];
  const isLast = idx === items.length - 1;
  const isShort = item.type === 'short_answer';

  const commit = () => {
    if (sel === null) return;
    const correct = isShort ? true : sel === item.answerIndex;
    const next = { ...answers, [item.id]: { correct, chosen: sel } };
    setAnswers(next);
    if (isLast) {
      onSubmit(next);
    } else {
      setIdx(idx + 1);
      setSel(null);
    }
  };

  return (
    <div className="overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3>检验一下</h3>
          <span className="badge">
            {idx + 1} / {items.length}
          </span>
        </div>
        <p className="sub">这不是考试。答错了才知道该回去看哪张卡。</p>

        <p style={{ fontSize: 15, marginBottom: 16, lineHeight: 1.7 }}>{item.question}</p>

        {isShort ? (
          <>
            <textarea
              className="refl"
              value={typeof sel === 'string' ? sel : ''}
              onChange={(e) => setSel(e.target.value as unknown as number)}
              placeholder="用你自己的话说，写错也没关系。"
            />
            <div style={{ fontSize: 12, color: 'var(--label-2)', marginTop: 8 }}>
              简答题不打分，但会写进报告，AI 也会给反馈。
            </div>
          </>
        ) : (
          (item.options ?? []).map((opt, i) => (
            <button
              key={i}
              className={`opt ${sel === i ? 'sel' : ''}`}
              onClick={() => setSel(i)}
            >
              <span className="mark">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            待会儿再说
          </button>
          <button className="btn-primary" disabled={sel === null} onClick={commit}>
            {isLast ? '提交，看结果' : '下一题'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * 测验结果 + 查漏补缺
 * ========================================================== */

interface ResultProps {
  items: QuizItem[];
  answers: Record<string, { correct: boolean; chosen: number | string }>;
  onGoFix: (knowledgeId: string) => void;
  onFinish: () => void;
}

export function QuizResult({ items, answers, onGoFix, onFinish }: ResultProps) {
  const wrong = items.filter((i) => answers[i.id] && !answers[i.id].correct);
  const score = Math.round(((items.length - wrong.length) / items.length) * 100);

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{score >= 80 ? '掌握得不错' : score >= 50 ? '还需要再看一眼' : '这块确实有点绕'}</h3>
        <p className="sub">
          对了 {items.length - wrong.length} 题 / 共 {items.length} 题。
        </p>

        {wrong.length === 0 ? (
          <div className="gate" style={{  }}>
            全对。可以去写反思、出报告了。
          </div>
        ) : (
          wrong.map((w) => (
            <div
              key={w.id}
              style={{
                background: 'var(--surface-2)',
                borderRadius: 12,
                padding: '14px 17px',
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 13.5, marginBottom: 6 }}>{w.question}</div>
              <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 4 }}>
                正确理解：{w.explanation}
              </div>
              <button
                className="btn-ghost btn-small"
                onClick={() => onGoFix(w.knowledgeId)}
                style={{ marginTop: 4 }}
              >
                回去看相关的知识卡 ⤴
              </button>
            </div>
          ))
        )}

        <div className="modal-actions">
          <button className="btn-primary" onClick={onFinish}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
