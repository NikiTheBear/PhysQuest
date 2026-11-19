import { useState } from 'react';

interface Props {
  onResetProgress: () => void;
  onResetEverything: () => void;
  onClose: () => void;
  stats: { runs: number; predictions: number; completed: number; misconceptions: number };
}

/**
 * 重置面板
 *
 * 两档，刻意分开：
 *   清进度 —— 只清学习记录，主题和 AI 设置保留（换一批学生用）
 *   全清空 —— 连 AI Key 一起清掉（换一台电脑 / 借给别人用）
 */
export default function ResetPanel({ onResetProgress, onResetEverything, onClose, stats }: Props) {
  const [confirming, setConfirming] = useState<'progress' | 'all' | null>(null);

  const doIt = () => {
    if (confirming === 'progress') onResetProgress();
    if (confirming === 'all') onResetEverything();
    setConfirming(null);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,100%)' }}>
        <h3>重置</h3>
        <p className="sub">
          现在本地存着：{stats.runs} 条参数记录、{stats.predictions} 个预测、
          {stats.completed} 个已完成挑战、{stats.misconceptions} 个踩过的坑。
        </p>

        <div className="reset-option">
          <div>
            <h4>只清学习进度</h4>
            <p>
              清掉参数记录、预测、已完成状态和错题。**主题和 AI 设置会保留。**
              适合：同一台电脑换下一批学生用。
            </p>
          </div>
          <button
            className={confirming === 'progress' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setConfirming(confirming === 'progress' ? null : 'progress')}
          >
            {confirming === 'progress' ? '确认清除？' : '清除进度'}
          </button>
        </div>

        <div className="reset-option">
          <div>
            <h4>全部清空</h4>
            <p>
              连 AI 的 Key 和侧栏宽度一起清掉，回到第一次打开的样子。
              适合：这台电脑要交给别人，或者你要重新演示一遍。
            </p>
          </div>
          <button
            className={confirming === 'all' ? 'btn-danger' : 'btn-ghost'}
            onClick={() => setConfirming(confirming === 'all' ? null : 'all')}
          >
            {confirming === 'all' ? '确认全清？' : '全部清空'}
          </button>
        </div>

        {confirming && (
          <div className="gate" style={{ marginTop: 16 }}>
            这一步做了改不回来。再点一次右边那个按钮确认。
          </div>
        )}

        <div className="modal-actions">
          {confirming && (
            <button className="btn-primary" onClick={doIt}>
              确认执行
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
