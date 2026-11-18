import type { LabMeta } from '../../labs/registry';

interface Props {
  onGoMap: () => void;
}

/** 还没在知识地图里选模块 */
export function EmptyPickLab({ onGoMap }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <h3>还没有选实验模块</h3>
      <p>
        这个平台按模块组织。先去知识地图挑一个，挑战和实验台才会跟着那个模块走——
        不会自己塞一个默认的给你。
      </p>
      <button className="btn-primary" onClick={onGoMap}>
        去知识地图选一个 →
      </button>
    </div>
  );
}

/** 选了模块但还没选挑战 */
export function EmptyPickChallenge({
  lab,
  onGoMap,
  onGoHub,
}: {
  lab: LabMeta | null;
  onGoMap: () => void;
  onGoHub: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◉</div>
      <h3>{lab ? `还没选挑战` : '还没有选实验模块'}</h3>
      <p>
        {lab
          ? `${lab.title}有五个挑战，每个都是一个具体的小目标。挑一个进去，先猜一个答案，再动手试。`
          : '先去知识地图挑一个模块，挑战和实验台才会跟着那个模块走。'}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {lab ? (
          <button className="btn-primary" onClick={onGoHub}>
            去看 {lab.title} 的挑战 →
          </button>
        ) : (
          <button className="btn-primary" onClick={onGoMap}>
            去知识地图选一个 →
          </button>
        )}
        {lab && (
          <button className="btn-ghost" onClick={onGoMap}>
            回知识地图
          </button>
        )}
      </div>
    </div>
  );
}
