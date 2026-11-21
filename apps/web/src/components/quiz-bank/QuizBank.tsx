import { useMemo, useState } from 'react';
import { ALL_CARDS, promptById } from '../../data/content';
import { BANK, bankForKnowledge, bankStats, type QuizLevel } from '../../data/question-bank';

interface Props {
  onDone: (result: { answered: number; correct: number; wrongIds: string[] }) => void;
  onBack: () => void;
  /** 学生挑好的知识点（从选题页传进来） */
  knowledgeIds: string[];
}

const LEVEL_LABEL: Record<QuizLevel, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const LEVEL_DESC: Record<QuizLevel, string> = {
  easy: '基础概念，记住就能答',
  medium: '简单应用，要推一步',
  hard: '综合判断，或识别误区',
};

/**
 * 题库（独立页面，不在实验台里）
 *
 * 每个知识点三道题：简单 / 中等 / 困难。
 * 做完才能生成学习报告——这是报告闸门的一部分。
 */
export default function QuizBank({ onDone, onBack, knowledgeIds }: Props) {
  const stats = useMemo(() => bankStats(), []);

  // 只考学生挑的这些
  const targets = useMemo(() => {
    const set = new Set(knowledgeIds);
    return ALL_CARDS.filter((c) => set.has(c.id));
  }, [knowledgeIds]);

  const [idx, setIdx] = useState(0);
  const [level, setLevel] = useState<QuizLevel>('easy');
  const [sel, setSel] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<
    Record<string, { correct: boolean; chosen: number }>
  >({});
  const [finished, setFinished] = useState(false);

  const card = targets[idx];

  // 这个知识点的全部题目，按 简单 → 中等 → 困难 排好
  const set = useMemo(() => {
    if (!card) return [];
    const order: QuizLevel[] = ['easy', 'medium', 'hard'];
    return [...bankForKnowledge(card.id)].sort(
      (a, b) => order.indexOf(a.level) - order.indexOf(b.level),
    );
  }, [card]);

  /** 当前难度里还没答的题优先，都答完了就显示这一档的第一道 */
  const question =
    set.find((q) => q.level === level && !answers[q.id]) ??
    set.find((q) => q.level === level) ??
    set[0];

  const totalQ = useMemo(
    () => targets.reduce((n, c) => n + bankForKnowledge(c.id).length, 0),
    [targets],
  );

  if (!card) {
    return (
      <div className="empty-state">
        <div className="empty-icon">▤</div>
        <h3>没有可考的题目</h3>
        <p>这一组知识点还没有题库内容。</p>
        <button className="btn-primary" onClick={onBack}>
          返回
        </button>
      </div>
    );
  }

  if (finished) {
    const list = Object.entries(answers);
    const correct = list.filter(([, a]) => a.correct).length;
    const wrongIds = list.filter(([, a]) => !a.correct).map(([id]) => id);

    return (
      <div className="quiz-result-page">
        <div className="quiz-result-head">
          <span className="eyebrow">Quiz Result</span>
          <h2>
            答对 {correct} / {list.length}
          </h2>
          <p>
            {correct === list.length
              ? '全对。可以去写反思、生成报告了。'
              : '答错的题在下面，点进去能看对应的知识卡。'}
          </p>
        </div>

        <div className="quiz-result-list">
          {list.map(([qid, a]) => {
            const q = BANK.find((x) => x.id === qid);
            if (!q) return null;
            const k = ALL_CARDS.find((c) => c.id === q.knowledgeId);
            return (
              <div key={qid} className={`quiz-result-item ${a.correct ? 'ok' : 'bad'}`}>
                <div className="qri-head">
                  <span className={`badge ${a.correct ? 'on' : 'off'}`}>
                    {a.correct ? '✓ 对' : '✗ 错'}
                  </span>
                  <span className="qri-kid">{q.knowledgeId}</span>
                  <span className="qri-level">{LEVEL_LABEL[q.level]}</span>
                </div>
                <div className="qri-q">{q.question}</div>
                <div className="qri-explain">{q.explanation}</div>
                {k && (
                  <div className="qri-card">
                    相关知识点：<b>{k.title}</b> —— {k.oneLine}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="quiz-result-actions">
          <button
            className="btn-primary"
            onClick={() => onDone({ answered: list.length, correct, wrongIds })}
          >
            完成，去写反思 →
          </button>
          <button className="btn-ghost" onClick={onBack}>
            再看一遍知识卡
          </button>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (sel === null) return;
    const correct = sel === question.answerIndex;
    setAnswers((p) => ({ ...p, [question.id]: { correct, chosen: sel } }));
    setRevealed(true);
  };

  const next = () => {
    setRevealed(false);
    setSel(null);

    const order: QuizLevel[] = ['easy', 'medium', 'hard'];
    const answeredIds = new Set(Object.keys(answers));

    // ① 这一档还有没答的题 → 留着继续做
    const sameLevelLeft = set.some((q) => q.level === level && !answeredIds.has(q.id));
    if (sameLevelLeft) return;

    // ② 换到下一个还有题的档
    const cur = order.indexOf(level);
    for (let i = cur + 1; i < order.length; i += 1) {
      if (set.some((q) => q.level === order[i])) {
        setLevel(order[i]);
        return;
      }
    }

    // ③ 这个知识点做完了 → 下一个知识点
    if (idx < targets.length - 1) {
      setIdx(idx + 1);
      const nextSet = bankForKnowledge(targets[idx + 1].id);
      const firstLevel = order.find((lv) => nextSet.some((q) => q.level === lv));
      setLevel(firstLevel ?? 'easy');
      return;
    }
    setFinished(true);
  };

  const total = targets.length;
  const done = Object.keys(answers).length;

  return (
    <>
      <div className="hub-head" style={{ paddingBottom: 14 }}>
        <span className="eyebrow">Question Bank · 报告前的检验</span>
        <h2>先做几道题，再出报告</h2>
        <p>
          {`这一轮考你挑的 ${total} 个知识点，共 ${totalQ} 道题。每个知识点从简单做到困难，做完就换下一个。`}
        </p>
      </div>

      <div className="quiz-progress">
        <div className="qp-bar">
          <i style={{ width: `${(done / Math.max(totalQ, 1)) * 100}%` }} />
        </div>
        <span className="qp-text">
          第 {idx + 1} / {total} 个知识点 · 已答 {done} / {totalQ} 题
        </span>
      </div>

      <div className="quiz-main">
        <div className="quiz-left">
          <div className="quiz-know-card">
            <span className="kid">{card.id}</span>
            <h3>{card.title}</h3>
            <p className="oneLine">{card.oneLine}</p>
            <details>
              <summary>看知识点回顾</summary>
              <div className="qk-recall">
                <p>
                  <b>打个比方：</b>
                  {card.analogy}
                </p>
                <p>
                  <b>为什么：</b>
                  {card.why}
                </p>
              </div>
            </details>
          </div>

          <div className="quiz-levels">
            {(['easy', 'medium', 'hard'] as QuizLevel[]).map((lv) => {
              const pool = set.filter((q) => q.level === lv);
              const has = pool.length > 0;
              const answeredN = pool.filter((q) => answers[q.id]).length;
              const correctN = pool.filter((q) => answers[q.id]?.correct).length;
              const allDone = has && answeredN === pool.length;
              return (
                <button
                  key={lv}
                  className={`quiz-level ${level === lv ? 'active' : ''} ${
                    allDone ? (correctN === pool.length ? 'done-ok' : 'done-bad') : ''
                  }`}
                  onClick={() => {
                    if (!has) return;
                    setLevel(lv);
                    setSel(null);
                    setRevealed(false);
                  }}
                  disabled={!has}
                >
                  <b>{LEVEL_LABEL[lv]}</b>
                  <span>
                    {has ? `${answeredN} / ${pool.length} 题` : LEVEL_DESC[lv]}
                  </span>
                  {allDone && <i>{correctN === pool.length ? '✓' : '✗'}</i>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="quiz-right">
          <div className="quiz-question-card">
            <div className="qq-head">
              <span className={`badge ${level === 'hard' ? 'warn' : level === 'medium' ? '' : 'on'}`}>
                {LEVEL_LABEL[level]}
              </span>
              <span className="qq-id">{question.knowledgeId}</span>
            </div>
            <p className="qq-text">{question.question}</p>

            {question.options.map((opt, i) => {
              let cls = 'opt';
              if (revealed) {
                if (i === question.answerIndex) cls += ' right';
                else if (i === sel) cls += ' wrong';
              } else if (sel === i) cls += ' sel';
              return (
                <button key={i} className={cls} onClick={() => !revealed && setSel(i)}>
                  <span className="mark">{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              );
            })}

            {revealed && (
              <>
                <div className={`quiz-explain ${sel === question.answerIndex ? 'ok' : 'bad'}`}>
                  <b>{sel === question.answerIndex ? '答对了。' : '这题不对。'}</b>
                  {question.explanation}
                </div>

                {/* 逐项解析：每个选项为什么对、为什么错 */}
                {question.optionNotes && (
                  <div className="quiz-notes">
                    <span className="qn-title">逐项解析</span>
                    {question.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`qn-row ${
                          i === question.answerIndex
                            ? 'right'
                            : i === sel
                              ? 'wrong'
                              : ''
                        }`}
                      >
                        <span className="qn-mark">{String.fromCharCode(65 + i)}</span>
                        <div className="qn-body">
                          <b>{opt}</b>
                          <span>{question.optionNotes?.[i] ?? ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="quiz-actions">
              {!revealed ? (
                <button className="btn-primary" disabled={sel === null} onClick={submit}>
                  提交答案
                </button>
              ) : (
                <button className="btn-primary" onClick={next}>
                  下一题 →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
