import { useMemo, useState } from 'react';
import type { Challenge, LensMetrics } from '../../core/contracts';
import { KNOWLEDGE, MISCONCEPTIONS } from '../../data/content';

interface Props {
  challenge: Challenge;
  metrics: LensMetrics;
  onCancel: () => void;
  onConfirm: () => void;
  /** 锁定后直接去做题库 */
  onGoQuiz: () => void;
}

/** 满意度闸门：学生必须自己调到满意才能提交，提交后才解锁 AI 演示。 */
export default function SatisfactionGate({
  challenge,
  metrics,
  onCancel,
  onConfirm,
  onGoQuiz,
}: Props) {
  const [score, setScore] = useState(3);
  const [reason, setReason] = useState('');

  const cards = challenge.knowledgeIds
    .map((id) => KNOWLEDGE.find((k) => k.id === id))
    .filter(Boolean);
  const mis = challenge.misconceptionIds
    .map((id) => MISCONCEPTIONS.find((m) => m.id === id))
    .filter(Boolean);

  return (
    <div className="overlay">
      <div className="modal">
        <h3>这组参数，你自己满意吗？</h3>
        <p className="sub">
          锁定之后才算完成这次探索。锁定后系统会对比你的预测和实际结果，并解锁 AI 讲解。
        </p>

        <div className="compare">
          <div className="box">
            <div className="k">现在这组参数的结果</div>
            <div className="v">{metrics.description}</div>
          </div>
          <div className="box">
            <div className="k">调到什么程度算好</div>
            <div className="v" style={{ fontSize: 13.5, fontWeight: 400 }}>
              由你自己判断。这里的探索没有标准答案。
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 6 }}>
            你给自己这次的探索打几分？
          </div>
          <div className="preset-row" style={{ marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                style={
                  score === n ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined
                }
              >
                {'★'.repeat(n)}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, color: 'var(--label-2)', marginBottom: 6 }}>
            用一句话说说你为什么选这组参数（可以不写，但写了报告里会有）
          </div>
          <textarea
            className="refl"
            style={{ minHeight: 82 }}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：我把蜡烛推到两倍焦距，因为想让像和物一样大，方便观察倒立。"
          />
        </div>

        {cards.length > 0 && (
          <details style={{ marginTop: 16, fontSize: 13, color: 'var(--label-2)' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>
              这次挑战涉及 {cards.length} 个知识点 / {mis.length} 个常见误区
            </summary>
            <ul style={{ margin: '10px 0 0 18px' }}>
              {cards.map((c) => (
                <li key={c!.id} style={{ marginBottom: 4 }}>
                  <b style={{ color: '#cfe0ff' }}>{c!.title}</b> —— {c!.oneLine}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            回去再调调
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              onConfirm();
              onGoQuiz();
            }}
          >
            锁定，去做题库 →
          </button>
        </div>
      </div>
    </div>
  );
}
