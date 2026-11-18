import { useState } from 'react';
import type { Challenge } from '../../core/contracts';

interface Props {
  challenge: Challenge;
  onLock: (chosenIndex: number) => void;
}

/** 预测面板：提交后锁定，不可改。这是全篇最重要的一个设计。 */
export default function PredictionPanel({ challenge, onLock }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const q = challenge.prediction;

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

        <div className="modal-actions">
          <button className="btn-primary" disabled={sel === null} onClick={() => sel !== null && onLock(sel)}>
            锁定我的猜测
          </button>
        </div>
      </div>
    </div>
  );
}
