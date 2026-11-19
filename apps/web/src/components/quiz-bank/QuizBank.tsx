import { useMemo, useState } from 'react';
import { ALL_CARDS, promptById } from '../../data/content';
import { BANK, bankStats, quizSetFor, type BankQuestion, type QuizLevel } from '../../data/question-bank';

interface Props {
  onDone: (result: { answered: number; correct: number; wrongIds: string[] }) => void;
  onBack: () => void;
  /** 只考这些知识点（从当前挑战带过来）；不传就是全平台 */
  focusKnowledgeIds?: string[];
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
export default function QuizBank({ onDone, onBack, focusKnowledgeIds }: Props) {
  const stats = useMemo(() => bankStats(), []);

  // 要考的知识点：有 focus 就只考那些，否则全平台
  const targets = useMemo(() => {
    if (!focusKnowledgeIds?.length) return ALL_CARDS;
    const set = new Set(focusKnowledgeIds);
    return ALL_CARDS.filter((c) => set.has(c.id));
  }, [focusKnowledgeIds]);

  const [idx, setIdx] = useState(0);
  const [level, setLevel] = useState<QuizLevel>('easy');
  const [sel, setSel] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<
    Record<string, { correct: boolean; chosen: number }>
  >({});
  const [finished, setFinished] = useState(false);

  const card = targets[idx];
  const set = useMemo(() => (card ? quizSetFor(card.id) : []), [card]);
  const question = set.find((q) => q.level === level) ?? set[0];

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

    // 依次 easy → medium → hard，然后下一个知识点
    const order: QuizLevel[] = ['easy', 'medium', 'hard'];
    const pos = order.indexOf(level);
    const available = order.filter((lv) => set.some((q) => q.level === lv));
    const cur = available.indexOf(level);

    if (cur >= 0 && cur < available.length - 1) {
      setLevel(available[cur + 1]);
      return;
    }
    if (idx < targets.length - 1) {
      setIdx(idx + 1);
      const nextSet = quizSetFor(targets[idx + 1].id);
      const firstLevel = (['easy', 'medium', 'hard'] as QuizLevel[]).find((lv) =>
        nextSet.some((q) => q.level === lv),
      );
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
          共 {stats.total} 道题，覆盖 {stats.knowledgeCovered} 个知识点（简单 {stats.byLevel.easy} / 中等{' '}
          {stats.byLevel.medium} / 困难 {stats.byLevel.hard}）。
          {focusKnowledgeIds?.length
            ? ` 这一轮只考你刚才做的 ${total} 个知识点。`
            : ` 这一轮会走一遍全部 ${total} 个知识点。`}
        </p>
      </div>

      <div className="quiz-progress">
        <div className="qp-bar">
          <i style={{ width: `${(idx / total) * 100}%` }} />
        </div>
        <span className="qp-text">
          第 {idx + 1} / {total} 个知识点 · 已答 {done} 题
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
              const has = set.some((q) => q.level === lv);
              const answered = set.find((q) => q.level === lv);
              const rec = answered ? answers[answered.id] : undefined;
              return (
                <button
                  key={lv}
                  className={`quiz-level ${level === lv ? 'active' : ''} ${
                    rec ? (rec.correct ? 'done-ok' : 'done-bad') : ''
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
                  <span>{LEVEL_DESC[lv]}</span>
                  {rec && <i>{rec.correct ? '✓' : '✗'}</i>}
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
              <div className={`quiz-explain ${sel === question.answerIndex ? 'ok' : 'bad'}`}>
                <b>{sel === question.answerIndex ? '答对了。' : '这题不对。'}</b>
                {question.explanation}
              </div>
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
