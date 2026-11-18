import { useMemo, useState } from 'react';
import type { Challenge } from '../../core/contracts';
import { CHALLENGES, MISCONCEPTIONS } from '../../data/content';

interface Props {
  completed: Record<string, boolean>;
  weakMisconceptions: string[];
  onPick: (c: Challenge) => void;
}

export default function Hub({ completed, weakMisconceptions, onPick }: Props) {
  const doneCount = CHALLENGES.filter((c) => completed[c.id]).length;

  const weakLabels = useMemo(
    () =>
      weakMisconceptions
        .map((id) => MISCONCEPTIONS.find((m) => m.id === id))
        .filter(Boolean)
        .slice(0, 4),
    [weakMisconceptions],
  );

  return (
    <div>
      <div className="hub-head">
        <h2>今天想搞清楚什么？</h2>
        <p>五张卡，五个小目标。点一张进去，先猜一个答案，再动手试。</p>
      </div>

      <div className="hub-stats">
        <div className="stat">
          <div className="v">
            {doneCount}/{CHALLENGES.length}
          </div>
          <div className="k">已完成的挑战</div>
        </div>
        <div className="stat">
          <div className="v">{weakMisconceptions.length}</div>
          <div className="k">踩过的坑</div>
        </div>
        <div className="stat">
          <div className="v">3</div>
          <div className="k">可以调的变量</div>
        </div>
        <div className="stat">
          <div className="v">0</div>
          <div className="k">需要背的公式</div>
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

      <div style={{ height: 26 }} />

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
              {c.difficulty === 'advanced' && (
                <span className="badge" style={{ borderColor: '#7c3aed', color: '#c4b5fd' }}>
                  进阶
                </span>
              )}
              <span className="badge">{c.knowledgeIds.length} 个知识点</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
