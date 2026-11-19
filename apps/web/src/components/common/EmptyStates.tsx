import type { LabMeta } from '../../labs/registry';
import { AUTO_CHALLENGES, CHALLENGES } from '../../data/content';

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
      <div className="empty-actions">
        <button className="btn-primary" onClick={onGoMap}>
          去知识地图选一个 →
        </button>
      </div>
    </div>
  );
}

interface ChallengeProps {
  lab: LabMeta | null;
  onGoMap: () => void;
  onGoHub: () => void;
  /** 直接点进某个挑战 */
  onPick?: (challengeId: string) => void;
}

/** 选了模块但还没选挑战 */
export function EmptyPickChallenge({ lab, onGoMap, onGoHub, onPick }: ChallengeProps) {
  // 把这个模块已有的挑战列出来，让空页面有内容可点
  const hand = CHALLENGES.filter((c) => c.labId === lab?.id);
  const auto = AUTO_CHALLENGES.filter((c) => c.labId === lab?.id);
  const all = [...hand.map((c) => ({ id: c.id, title: c.title })), ...auto.slice(0, 6)];

  return (
    <div className="empty-state">
      <div className="empty-icon">◉</div>
      <h3>{lab ? '选一个挑战开始' : '还没有选实验模块'}</h3>
      <p>
        {lab
          ? `${lab.title} 共 ${hand.length + auto.length} 个挑战。每个都是一个具体的观察任务，进去先猜一个答案，再动手试。`
          : '先去知识地图挑一个模块，挑战和实验台才会跟着那个模块走。'}
      </p>

      <div className="empty-actions">
        {lab ? (
          <>
            <button className="btn-primary" onClick={onGoHub}>
              看全部 {hand.length + auto.length} 个挑战 →
            </button>
            <button className="btn-ghost" onClick={onGoMap}>
              回知识地图
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={onGoMap}>
            去知识地图选一个 →
          </button>
        )}
      </div>

      {lab && all.length > 0 && onPick && (
        <div className="empty-suggest">
          {all.slice(0, 6).map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)}>
              <b>{c.title}</b>
              点这里直接开始
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 挑战导览里「这个模块一个挑战都没有」时的空状态 */
export function HubEmpty({ lab, onGoMap }: { lab: LabMeta; onGoMap: () => void }) {
  return (
    <div className="hub-empty">
      <h3>{lab.title} 还没有挑战</h3>
      <p>
        这个模块的知识点都在知识地图里，可以先看卡片。
        想看能动手的实验，去「自由搭建实验台」自己搭。
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn-primary" onClick={onGoMap}>
          去知识地图看知识点 →
        </button>
      </div>
    </div>
  );
}

/** 报告页在没有任何记录时的空状态 */
export function EmptyReport({ onGoMap }: { onGoMap: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">▤</div>
      <h3>还没有任何记录</h3>
      <p>
        报告是根据你的探索记录生成的。先去一个挑战里调参数、点「我满意了」锁定一组，
        这里就会有内容了。
      </p>
      <div className="empty-actions">
        <button className="btn-primary" onClick={onGoMap}>
          去挑一个挑战 →
        </button>
      </div>
    </div>
  );
}
