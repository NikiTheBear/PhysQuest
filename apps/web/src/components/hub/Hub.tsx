import { useMemo } from 'react';
import type { Challenge } from '../../core/contracts';
import { ALL_CARDS, AUTO_CHALLENGES, CHALLENGES, MISCONCEPTIONS, autoChallengesFor } from '../../data/content';
import type { LabMeta } from '../../labs/registry';

interface Props {
  /** 当前选定的实验模块。null = 还没从知识地图选过 */
  lab: LabMeta;
  completed: Record<string, boolean>;
  weakMisconceptions: string[];
  onPick: (c: Challenge) => void;
  /** 自动生成挑战的点击（走另一条路：直接进自由搭建） */
  onPickAuto?: (c: { id: string; title: string; brief: string; build: { prompt: string }; knowledgeIds: string[] }) => void;
  onBackToMap: () => void;
}

export default function Hub({
  lab,
  completed,
  weakMisconceptions,
  onPick,
  onPickAuto,
  onBackToMap,
}: Props) {
  /** 手写挑战：按模块过滤 */
  const challenges = useMemo(
    () => CHALLENGES.filter((c) => c.knowledgeIds.some((k) => belongsToLab(k, lab))),
    [lab],
  );
  /** 自动挑战：从提示词生成的 */
  const autoOnes = useMemo(() => autoChallengesFor(lab.id), [lab]);

  const cards = useMemo(() => {
    const ids = new Set(lab.knowledgeIds ?? []);
    return ids.size ? ALL_CARDS.filter((k) => ids.has(k.id)) : [];
  }, [lab]);

  const doneCount = challenges.filter((c) => completed[c.id]).length;

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
        <button className="back-link" onClick={onBackToMap}>
          ← 知识地图
        </button>
        <span className="eyebrow">
          {lab.subtitle} · {lab.stages.map((s) => (s === 'junior' ? '初中' : s === 'senior' ? '高中' : s === 'primary' ? '小学' : '大学')).join(' / ')}
        </span>
        <h2>{lab.title}</h2>
        <p>
          {challenges.length + autoOnes.length} 个挑战，{cards.length} 张知识卡。点一张进去，先猜一个答案，再动手试。
          猜错了不要紧——那一下才是真正记住的时候。
        </p>
      </div>

      <div className="hub-stats">
        <div className="stat">
          <div className="v">
            {doneCount}
            <span style={{ fontSize: 15, color: 'var(--label-4)' }}>
              {' '}
              / {challenges.length + autoOnes.length}
            </span>
          </div>
          <div className="k">已完成的挑战</div>
        </div>
        <div className="stat">
          <div className="v">{weakMisconceptions.length}</div>
          <div className="k">踩过的坑</div>
        </div>
        <div className="stat">
          <div className="v">{cards.length}</div>
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
        {challenges.map((c, i) => (
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

      {autoOnes.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 34 }}>
            <h3>按知识点动手</h3>
            <span>
              这些挑战是照着知识点的搭建方案自动排的——每一条都对应一个能真算的实验。
            </span>
          </div>
          <div className="challenge-grid">
            {autoOnes.map((c, i) => (
              <button
                key={c.id}
                className={`challenge-card ${completed[c.id] ? 'done' : ''}`}
                onClick={() => onPickAuto?.(c)}
              >
                <span className="idx">知识点关 {String(i + 1).padStart(2, '0')}</span>
                <h3>{c.title}</h3>
                <span className="brief">{c.brief}</span>
                <span className="meta">
                  <span className="badge">可计算</span>
                  <span className="badge">{c.build.models.length} 种器具</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {challenges.length === 0 && autoOnes.length === 0 && (
        <div className="empty">这个模块还没有挑战，先去看知识点。</div>
      )}
    </div>
  );
}

/** 粗判：这个知识点是不是属于这个模块。
 *  现在只有光学一个模块，用编号前缀区分（K-O* = 光学）。 */
function belongsToLab(knowledgeId: string, lab: LabMeta): boolean {
  const domainLetter = knowledgeId.split('-')[1]?.[0];
  const map: Record<string, string> = {
    M: 'mechanics',
    E: 'electromagnetism',
    O: 'optics',
    T: 'thermodynamics',
    N: 'modern',
  };
  return domainLetter ? map[domainLetter] === lab.discipline : false;
}
