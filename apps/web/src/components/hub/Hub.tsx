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

      <div
        className="panel"
        style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={onOpenMap}
      >
        <div>
          <h4 style={{ marginBottom: 6 }}>知识点全景</h4>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            这五个挑战背后，一共压着 {KNOWLEDGE.length} 个知识点——从小学的「光走直线」到高中的
            「符号约定」。想按图索骥、或者想提前看看整条学习线，从这里进。
          </div>
        </div>
        <button className="btn-ghost" style={{ flexShrink: 0 }}>
          打开知识地图 →
        </button>
      </div>
    </div>
  );
}
