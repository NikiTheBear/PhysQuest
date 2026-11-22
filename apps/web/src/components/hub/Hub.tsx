import { useMemo, useState } from 'react';
import type { Challenge } from '../../core/contracts';
import {
  ALL_CARDS,
  AUTO_CHALLENGES,
  CHALLENGES,
  MISCONCEPTIONS,
  autoChallengesFor,
  type AutoChallenge,
} from '../../data/content';
import type { LabMeta } from '../../labs/registry';
import DemoPlayer from '../demo/DemoPlayer';
import { demoDurationSec, demoScriptsFor } from '../demo/scripts';

interface Props {
  /** 当前选定的实验模块。null = 还没从知识地图选过 */
  lab: LabMeta;
  completed: Record<string, boolean>;
  weakMisconceptions: string[];
  onPick: (c: Challenge) => void;
  /** 自动生成挑战的点击（走另一条路：直接进自由搭建） */
  onPickAuto?: (c: AutoChallenge) => void;
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

  /**
   * 快速演示：AI 剧本是这个模块（光学）专属的，所以入口放在挑战导览顶部。
   * 注意 demo-scripts.json 的 labId 在文件顶层，不能用 d.labId 直接比（见 demo/scripts.ts）。
   */
  const demos = useMemo(() => demoScriptsFor(lab.id), [lab.id]);
  /** 正在播哪个剧本；null = 没在播 */
  const [playingDemo, setPlayingDemo] = useState<string | null>(null);
  /** 这个剧本对应的挑战 —— 播完可以「去实验台亲手调」 */
  const challengeOf = (scriptId: string) =>
    CHALLENGES.find((c) => c.demoScriptId === scriptId && c.labId === lab.id);

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

      {demos.length > 0 && (
        <>
          <div style={{ height: 30 }} />
          <div className="section-head demo-section-head">
            <h3>快速演示</h3>
            <span>
              先看一遍再动手：跟着解说把凸透镜走一圈。这是<b>讲解</b>，不会自动改实验台。
            </span>
          </div>
          <div className="demo-list">
            {demos.map((d) => (
              <button
                key={d.id}
                className="demo-card"
                onClick={() => setPlayingDemo(d.id)}
                title={`播放演示：${d.title}`}
              >
                <span className="demo-card-play" aria-hidden>
                  ▶
                </span>
                <span className="demo-card-main">
                  <span className="demo-card-title">{d.title}</span>
                  <span className="demo-card-meta">
                    {d.steps.length} 步 · {demoDurationSec(d)} 秒
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
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

      {playingDemo && (
        <DemoPlayer
          scriptId={playingDemo}
          /**
           * 光具座在 Fieldlab 的全屏 iframe 里，那边的 bridge 还没有「设参数」这条消息，
           * 所以这里只能记一笔，不动任何实验台状态（原因见 DemoPlayer 顶部注释）。
           * 等平台加了 set-params，把这里换成转发给工作台即可，DemoPlayer 不用改。
           */
          onApplyParams={(p) =>
            console.log('[demo] 本步目标参数', playingDemo, p, '（演示只讲解，不改实验台）')
          }
          onHighlight={(ids) => console.log('[demo] 高亮器材', ids)}
          onClose={() => setPlayingDemo(null)}
          onGoLab={
            challengeOf(playingDemo)
              ? () => onPick(challengeOf(playingDemo)!)
              : undefined
          }
        />
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
