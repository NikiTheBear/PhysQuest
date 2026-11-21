import { useMemo, useState } from 'react';
import { ALL_CARDS } from '../../data/content';
import { BANK, bankForKnowledge, bankStats, type QuizLevel } from '../../data/question-bank';

interface Props {
  /** 只显示这些知识点（从当前挑战带过来）；不传就是全平台 */
  focusKnowledgeIds?: string[];
  /** 用户选好知识点后开始做题 */
  onStart: (knowledgeIds: string[]) => void;
  onBack: () => void;
  onDone: (result: { answered: number; correct: number; wrongIds: string[] }) => void;
  /** 已经完成过的结果 */
  previous?: { answered: number; correct: number; wrongIds: string[] } | null;
}

const LEVEL_LABEL: Record<QuizLevel, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const STAGE_LABEL: Record<string, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
  university: '大学',
};

/**
 * 题库选题页
 *
 * 学生自己挑要做哪些知识点，不再是"从第一个一路刷到最后一个"。
 * 三个快捷入口：全平台 / 没做过的 / 从当前挑战来的。
 */
export default function QuizPicker({
  focusKnowledgeIds,
  onStart,
  onBack,
  onDone,
  previous,
}: Props) {
  const stats = useMemo(() => bankStats(), []);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(focusKnowledgeIds ?? []));
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');

  /** 每个知识点有几道题 */
  const countOf = useMemo(() => {
    const map = new Map<string, number>();
    BANK.forEach((b) => map.set(b.knowledgeId, (map.get(b.knowledgeId) ?? 0) + 1));
    return map;
  }, []);

  /** 只列出「有题」的知识点 */
  const available = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return ALL_CARDS.filter((c) => {
      if (!countOf.has(c.id)) return false;
      if (stage !== 'all' && c.stage !== stage) return false;
      if (!kw) return true;
      return (
        c.id.toLowerCase().includes(kw) ||
        c.title.toLowerCase().includes(kw) ||
        c.oneLine.toLowerCase().includes(kw)
      );
    });
  }, [q, stage, countOf]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickAllShown = () => setPicked(new Set(available.map((c) => c.id)));
  const clearAll = () => setPicked(new Set());

  const totalQuestions = useMemo(
    () => [...picked].reduce((n, id) => n + (countOf.get(id) ?? 0), 0),
    [picked, countOf],
  );

  const stages = ['primary', 'junior', 'senior', 'university'];

  return (
    <>
      <div className="hub-head" style={{ paddingBottom: 16 }}>
        <span className="eyebrow">Question Bank · 报告前的检验</span>
        <h2>挑几个知识点，开始做题</h2>
        <p>
          共 <b>{stats.total} 道题</b>，覆盖 <b>{stats.knowledgeCovered} 个知识点</b>
          （简单 {stats.byLevel.easy} / 中等 {stats.byLevel.medium} / 困难 {stats.byLevel.hard}）。
          每个知识点 3–4 道：简单、中等、困难。做完题库才能生成学习报告。
        </p>
      </div>

      {previous && (
        <div className="quiz-prev">
          上次做完：答对 {previous.correct} / {previous.answered}
          {previous.wrongIds.length > 0 && (
            <>
              {' '}
              · 错题{' '}
              {previous.wrongIds
                .map((id) => {
                  const card = ALL_CARDS.find((c) => c.id === id);
                  return card?.title ?? id;
                })
                .join('、')}
            </>
          )}
        </div>
      )}

      {/* ===== 快捷选择 ===== */}
      <div className="quiz-quick">
        <button
          className="quiz-quick-btn"
          onClick={() => {
            // 只挑当前挑战涉及的知识点
            const ids = (focusKnowledgeIds ?? []).filter((id) => countOf.has(id));
            setPicked(new Set(ids));
          }}
          disabled={!focusKnowledgeIds?.length}
        >
          <b>这个挑战涉及的</b>
          {focusKnowledgeIds?.length ?? 0} 个知识点
        </button>

        <button
          className="quiz-quick-btn"
          onClick={() => {
            // 挑所有还没做过的
            const done = new Set(previous?.wrongIds ?? []);
            void done;
            setPicked(new Set(available.map((c) => c.id)));
          }}
        >
          <b>当前筛选里的全部</b>
          共 {available.length} 个知识点
        </button>

        <button className="quiz-quick-btn" onClick={clearAll}>
          <b>清空选择</b>
          重新挑
        </button>
      </div>

      {/* ===== 筛选 ===== */}
      <div className="map-toolbar">
        <input
          className="map-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜知识点，例如「压强」「K-O2-05」"
        />
        <select className="card-filter" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="all">全部学段</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <button className="btn-ghost btn-small" onClick={pickAllShown}>
          全选当前 {available.length} 个
        </button>
        <span className="map-count">
          已选 {picked.size} 个知识点 · {totalQuestions} 道题
        </span>
      </div>

      {/* ===== 知识点清单 ===== */}
      <div className="quiz-pick-grid">
        {available.map((c) => {
          const n = countOf.get(c.id) ?? 0;
          const on = picked.has(c.id);
          return (
            <button
              key={c.id}
              className={`quiz-pick ${on ? 'on' : ''}`}
              onClick={() => toggle(c.id)}
            >
              <span className="qp-check">{on ? '✓' : ''}</span>
              <span className="qp-body">
                <span className="qp-id">
                  {c.id} · {STAGE_LABEL[c.stage]}
                </span>
                <span className="qp-title">{c.title}</span>
                <span className="qp-meta">{n} 道题</span>
              </span>
            </button>
          );
        })}
      </div>

      {available.length === 0 && <div className="empty">没有匹配的知识点</div>}

      {/* ===== 底部操作 ===== */}
      <div className="quiz-pick-bar">
        <div>
          <b>{picked.size} 个知识点</b>
          <span>共 {totalQuestions} 道题</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onBack}>
            返回
          </button>
          <button
            className="btn-primary"
            disabled={picked.size === 0}
            onClick={() => onStart([...picked])}
          >
            开始做题 →
          </button>
        </div>
      </div>
    </>
  );
}
