import type { Challenge } from '../../core/contracts';

/**
 * 三套通用实验台共用的页头
 * 保持和凸透镜那套一样的视觉结构，只是标题来源换成当前模块。
 */
export function LabWorkHead({
  challenge,
  labTitle,
  onCards,
  onGate,
}: {
  challenge: Challenge;
  labTitle: string;
  onCards: () => void;
  onGate: () => void;
}) {
  return (
    <div className="work-head">
      <div>
        <span className="eyebrow">
          {challenge.id} · {labTitle}
        </span>
        <h2>{challenge.title}</h2>
        <div className="brief">{challenge.brief}</div>
      </div>
      <div className="work-actions">
        <button className="btn-ghost btn-small" onClick={onCards}>
          看知识卡
        </button>
        <button className="btn-primary" onClick={onGate}>
          我满意了
        </button>
      </div>
    </div>
  );
}

/**
 * 实验台底部的出口条
 * 和凸透镜那套的语义一致：先满意，再决定要不要搬去自由搭建。
 */
export function LabGateFooter({
  onGate,
  onToFree,
  hint,
}: {
  onGate: () => void;
  onToFree: () => void;
  hint?: string;
}) {
  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="lab-footer-row">
        <div>
          <b>参数调好了？</b>
          <p>
            {hint ??
              '点「锁定这组参数」记录下来，会自动对比你的预测；也可以直接搬到自由搭建，把它做成真正的装置。'}
          </p>
        </div>
        <div className="lab-footer-actions">
          <button className="btn-ghost btn-small" onClick={onToFree}>
            搬到自由搭建 →
          </button>
          <button className="btn-primary btn-small" onClick={onGate}>
            我满意了
          </button>
        </div>
      </div>
    </div>
  );
}
