import { useState } from 'react';
import type { KnowledgeCard, LensParams, QuizItem } from '../../core/contracts';
import { MISCONCEPTIONS } from '../../data/content';

interface Props {
  cards: KnowledgeCard[];
  onJump: (preset: Partial<LensParams>) => void;
}

export default function KnowledgeCardView({ cards, onJump }: Props) {
  return (
    <div className="know-grid">
      {cards.map((c) => {
        const mis = (c.misconceptions ?? [])
          .map((id) => MISCONCEPTIONS.find((m) => m.id === id))
          .filter(Boolean);
        return (
          <div className="know-card" key={c.id}>
            <span className="kid">{c.id}</span>
            <h4>{c.title}</h4>
            <div className="oneline">{c.oneLine}</div>

            {c.formula && (
              <div className="formula-box" style={{ marginBottom: 0, fontSize: 14 }}>
                {c.formula}
              </div>
            )}

            <div className="body">
              <b>打个比方：</b>
              {c.analogy}
            </div>

            <details>
              <summary>为什么？（点开看原因）</summary>
              <div style={{ marginTop: 8 }}>{c.why}</div>
            </details>

            {mis.length > 0 && (
              <div className="mis">
                <b>最容易错在：</b>
                {mis.map((m) => m!.belief).join(' / ')}
              </div>
            )}

            {Object.keys(c.labPreset ?? {}).length > 0 && (
              <button
                className="btn-ghost btn-small"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => onJump(c.labPreset)}
              >
                在实验台上看这个 ⤴
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
 * 测验弹窗
 * ========================================================== */

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
