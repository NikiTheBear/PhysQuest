import { useMemo } from 'react';
import type { Challenge } from '../../core/contracts';
import { CHALLENGES, MISCONCEPTIONS, KNOWLEDGE } from '../../data/content';

interface Props {
  completed: Record<string, boolean>;
  weakMisconceptions: string[];
  onPick: (c: Challenge) => void;
  onOpenMap: () => void;
}

export default function Hub({ completed, weakMisconceptions, onPick, onOpenMap }: Props) {
  const doneCount = CHALLENGES.filter((c) => completed[c.id]).length;

  const weakLabels = useMemo(
    () =>
      weakMisconceptions
        .map((id) => MISCONCEPTIONS.find((m) => m.id === id))
        .filter(Boolean)
        .slice(0, 3),
    [weakMisconceptions],
  );

  return (
    <div>
      <div className="hub-head">
        <span className="eyebrow">Optics · 凸透镜成像</span>
        <h2>今天想搞清楚什么？</h2>
        <p>
          五张卡，五个小目标。点一张进去，先猜一个答案，再动手试。
          <br />
          猜错了不要紧——那一下才是真正记住的时候。
        </p>
      </div>

      <div className="hub-stats">
        <div className="stat">
          <div className="v">
            {doneCount}
            <span style={{ fontSize: 15, color: 'var(--ink-4)' }}> / {CHALLENGES.length}</span>
          </div>
          <div className="k">已完成的挑战</div>
        </div>
        <div className="stat">
          <div className="v">{weakMisconceptions.length}</div>
          <div className="k">踩过的坑</div>
        </div>
        <div className="stat">
          <div className="v">{KNOWLEDGE.length}</div>
          <div className="k">可查的知识点</div>
        </div>
        <div className="stat">
          <div className="v">0</div>
          <div className="k">必背的公式</div>
        </div>
      </div>

      {weakLabels.length > 0 && (
        <div className="weak-list">
          {weakLabels.map((m) => (
            <span className="weak-chip" key={m!.id} title={m!.truth}>
              易错：{m!.belief}
            </span>
          ))}
        </div>
      )}

      <div style={{ height: 30 }} />

      <div className="challenge-grid">
        {CHALLENGES.map((c, i) => (
          <button
            key={c.id}
            className={`challenge-card ${completed[c.id] ? 'done' : ''}`}
            onClick={() => onPick(c)}
          >
            <span className="idx">挑战 {String(i + 1).padStart(2, '0')}</span>
            <h3>{c.title}</h3>
            <span className="brief">{c.brief}</span>
            <span className="meta">
              {c.multiAnswer && <span className="badge">多解</span>}
              {c.difficulty === 'advanced' && <span className="badge">进阶</span>}
              <span className="badge">{c.knowledgeIds.length} 个知识点</span>
            </span>
          </button>
        ))}
      </div>

      <div className="map-cta" style={{ marginTop: 28 }} onClick={onOpenMap} role="button" tabIndex={0}>
        <div>
          <h3>回头看看知识地图</h3>
          <p>
            这五个挑战背后压着 {KNOWLEDGE.length} 个知识点，从小学的「光走直线」到高中的「符号约定」。
            想按图索骥，或者想看看整条学习线有多长。
          </p>
        </div>
        <span className="go">打开知识地图 →</span>
      </div>
    </div>
  );
}
