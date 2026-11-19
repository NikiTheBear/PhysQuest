import { useState } from 'react';
import type { Challenge } from '../../core/contracts';
import { KNOWLEDGE, MISCONCEPTIONS } from '../../data/content';

interface Props {
  challenge: Challenge;
  onLock: (chosenIndex: number) => void;
}

/** 预测面板：提交后锁定，不可改。这是全篇最重要的一个设计。 */
export default function PredictionPanel({ challenge, onLock }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const [showCards, setShowCards] = useState(false);
  const q = challenge.prediction;

  const cards = challenge.knowledgeIds
    .map((id) => KNOWLEDGE.find((k) => k.id === id))
    .filter(Boolean);

  return (
    <div className="overlay">
      <div className="modal">
        <h3>先别动手，猜一下</h3>
        <p className="sub">
          猜错才有意思。选完就锁定了，改不了 —— 等会儿实验台会告诉你猜得准不准。
        </p>

        <p style={{ fontSize: 15, marginBottom: 18, lineHeight: 1.7 }}>{q.prompt}</p>

        {q.options.map((opt, i) => (
          <button
            key={i}
            className={`opt ${sel === i ? 'sel' : ''}`}
            onClick={() => setSel(i)}
          >
            <span className="mark">{String.fromCharCode(65 + i)}</span>
            {opt}
          </button>
        ))}

        {/* 学生想先看知识卡再看的话，这里给个入口。不强制，因为先猜后学才是这个产品的设计 */}
        {cards.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <button
              className="btn-ghost btn-small"
              onClick={() => setShowCards(!showCards)}
              style={{ width: '100%', textAlign: 'left' }}
            >
              {showCards ? '▾' : '▸'} 没把握？先看看相关的 {cards.length} 张知识卡
            </button>

            {showCards && (
              <div style={{ marginTop: 12 }}>
                {cards.map((c) => (
                  <div key={c!.id} className="pred-mini-card">
                    <div className="kid">{c!.id}</div>
                    <b>{c!.title}</b>
                    <p>{c!.oneLine}</p>
                    <details>
                      <summary>为什么</summary>
                      <p>{c!.why}</p>
                    </details>
                    {c!.misconceptions.length > 0 && (
                      <p className="mis">
                        易错：
                        {c!.misconceptions
                          .map((id) => MISCONCEPTIONS.find((m) => m.id === id)?.belief)
                          .filter(Boolean)
                          .join(' / ')}
                      </p>
                    )}
                  </div>
                ))}
                <p style={{ fontSize: 12, color: 'var(--label-3)', marginTop: 10, lineHeight: 1.6 }}>
                  看完再猜也没关系——但猜完就锁死了，改不了。
                </p>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-primary" disabled={sel === null} onClick={() => sel !== null && onLock(sel)}>
            锁定我的猜测
          </button>
        </div>
      </div>
    </div>
  );
}
