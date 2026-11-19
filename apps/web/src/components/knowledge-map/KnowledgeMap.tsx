import { useMemo, useState } from 'react';
import type { Stage } from '../../core/contracts';
import { ALL_CARDS, CHALLENGES, KNOWLEDGE, MISCONCEPTIONS, promptById } from '../../data/content';
import { LABS } from '../../labs/registry';
import PLATFORM_MAP from '@knowledge/PLATFORM-MAP.json';

interface Props {
  /** 选定了一个模块（进入挑战导览） */
  onOpenModule: (labId: string) => void;
  /** 直接跳到某个知识点对应的实验台 */
  onOpenKnowledge: (knowledgeId: string) => void;
}

const STAGE_LABEL: Record<Stage, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
  university: '大学',
};

const STATUS_LABEL: Record<string, string> = {
  ready: '可动手',
  content: '有卡片',
  planned: '规划中',
};

/** 这一档里有多少条已经有知识卡 */
const bandWithCard = (band: { items: MapItem[] }) =>
  band.items.filter((i) => ALL_CARDS.some((c) => c.id === i.id)).length;

interface MapItem {
  id: string;
  title: string;
}

/**
 * 知识地图 · 全平台的起点
 *
 * 这一页是整个应用的**唯一入口**：
 *   ① 先在这里选模块（大卡片）
 *   ② 再看这个平台的知识线（领域 × 学段）
 *   ③ 或者直接点一个知识点，跳到它对应的实验状态
 *
 * 关键：不在这里选，挑战导览和实验台都是空状态。
 * 不会像以前那样悄悄给你塞一个默认的挑战。
 */
export default function KnowledgeMap({ onOpenModule, onOpenKnowledge }: Props) {
  const [q, setQ] = useState('');
  const [onlyReady, setOnlyReady] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const disciplines = PLATFORM_MAP.disciplines as Array<{
    key: string;
    label: string;
    en: string;
    desc: string;
    stages: Array<{ stage: Stage; status: string; items: MapItem[] }>;
  }>;

  const totals = useMemo(() => {
    let all = 0;
    let ready = 0;
    disciplines.forEach((d) =>
      d.stages.forEach((s) => {
        all += s.items.length;
        if (s.status === 'ready') ready += s.items.length;
      }),
    );
    return { all, ready };
  }, [disciplines]);

  const matches = (item: MapItem) => {
    const kw = q.trim().toLowerCase();
    if (!kw) return true;
    return item.id.toLowerCase().includes(kw) || item.title.toLowerCase().includes(kw);
  };

  const detail = detailId ? ALL_CARDS.find((k) => k.id === detailId) : null;
  const detailPrompt = detailId ? promptById(detailId) : null;
  const challengeFor = (kid: string) => CHALLENGES.find((c) => c.knowledgeIds.includes(kid));

  return (
    <>
      <div className="hub-head" style={{ paddingBottom: 20 }}>
        <span className="eyebrow">Knowledge Map · 从这里开始</span>
        <h2>先选一个实验模块</h2>
        <p>
          这个平台会把物理学成一条路。现在能动手的是下面这张卡，
          其余的按顺序往后铺——你也可以往下翻，看看整条线有多长。
        </p>
      </div>

      {/* ================= 模块入口 ================= */}
      <div className="module-grid">
        {LABS.map((lab) => {
          const isFree = lab.mode === 'free';
          return (
            <button
              key={lab.id}
              className={`module-card ${isFree ? 'is-free' : ''}`}
              onClick={() => onOpenModule(lab.id)}
            >
              <div className="module-card-top">
                <span className="module-icon">{isFree ? '◎' : '◉'}</span>
                <span className={`badge ${isFree ? 'free' : 'on'}`}>{lab.badge}</span>
              </div>
              <h3>{lab.title}</h3>
              <p className="module-sub">{lab.subtitle}</p>
              <p className="module-intro">{lab.intro}</p>
              <div className="module-stages">
                {lab.stages.map((s) => (
                  <span key={s} className="stage-tag">
                    {STAGE_LABEL[s]}
                  </span>
                ))}
              </div>
              <div className="module-meta">
                {lab.stats.map((t) => (
                  <span key={t}>{t}</span>
                ))}
                <span className="arrow">→</span>
              </div>
            </button>
          );
        })}

        {/* 规划中的模块（点了没反应，明确告诉用户为什么） */}
        {[
          { label: '闭合电路欧姆定律', sub: '电磁 · 高中', note: '正在设计' },
          { label: '太阳能电池 S–Q 极限', sub: '近代 · 大学', note: '正在设计' },
        ].map((m) => (
          <div key={m.label} className="module-card disabled">
            <div className="module-card-top">
              <span className="module-icon">◌</span>
              <span className="badge off">规划中</span>
            </div>
            <h3>{m.label}</h3>
            <p className="module-sub">{m.sub}</p>
            <p className="module-intro">
              光学这块做透之后就轮到它。先把一个模块的每个细节都打磨好，后面的照着做就行。
            </p>
            <div className="module-meta">
              <span>{m.note}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ================= 全平台统计 ================= */}
      <div className="hub-stats" style={{ margin: '38px 0 30px' }}>
        <div className="stat">
          <div className="v">{totals.all}</div>
          <div className="k">全平台知识点</div>
        </div>
        <div className="stat">
          <div className="v">{totals.ready}</div>
          <div className="k">现在能动手</div>
        </div>
        <div className="stat">
          <div className="v">{KNOWLEDGE.length}</div>
          <div className="k">凸透镜知识卡</div>
        </div>
        <div className="stat">
          <div className="v">{MISCONCEPTIONS.length}</div>
          <div className="k">常见误区</div>
        </div>
      </div>

      {/* ================= 知识点全景 ================= */}
      <div className="section-head">
        <h3>知识点全景</h3>
        <span>五大领域 × 四个学段。灰色的还没做，点不动是有意的。</span>
      </div>

      <div className="map-toolbar">
        <input
          className="map-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜知识点或编号，例如「折射」「K-O2-05」"
        />
        <button
          className={onlyReady ? 'btn-primary btn-small' : 'btn-ghost btn-small'}
          onClick={() => setOnlyReady(!onlyReady)}
        >
          只看能动手的
        </button>
        <span className="map-count">
          {STAGE_LABEL.primary} → {STAGE_LABEL.university}
        </span>
      </div>

      {disciplines.map((d) => {
        const bands = d.stages
          .map((s) => ({ ...s, items: s.items.filter(matches) }))
          .filter((s) => s.items.length > 0)
          .filter((s) => !onlyReady || s.status === 'ready');
        if (bands.length === 0) return null;

        return (
          <section key={d.key} className="map-discipline">
            <div className="disc-head">
              <span className="disc-label">{d.label}</span>
              <span className="disc-en">{d.en}</span>
              <span className="disc-desc">{d.desc}</span>
            </div>

            {bands.map((band) => (
              <div className="map-band" key={band.stage}>
                <div className="map-band-head">
                  <span className="lvl">{STAGE_LABEL[band.stage]}</span>
                  <span className="desc">{band.items.length} 条</span>
                  <span className={`badge ${bandWithCard(band) > 0 ? 'on' : 'off'}`}>
                    {bandWithCard(band) > 0 ? `${bandWithCard(band)} 张卡` : '规划中'}
                  </span>
                  <span className="n" />
                </div>
                <div className="map-grid">
                  {band.items.map((item) => {
                    const card = ALL_CARDS.find((k) => k.id === item.id);
                    // 有卡就能点 —— 不再看 PLATFORM-MAP 里写的 status
                    const clickable = !!card;
                    const Tag = clickable ? 'button' : 'div';
                    return (
                      <Tag
                        key={item.id}
                        className={`know-pin ${clickable ? '' : 'static'}`}
                        {...(clickable ? { onClick: () => setDetailId(item.id) } : {})}
                      >
                        <span className="kid">{item.id}</span>
                        <h4>{item.title}</h4>
                        {card && <span className="oneline">{card.oneLine}</span>}
                        <span className="pin-foot">
                          {clickable ? (
                            <>
                              <span className="dep">点开看详情</span>
                              <span className="arrow">→</span>
                            </>
                          ) : (
                            <span className="dep">{STATUS_LABEL[band.status]}</span>
                          )}
                        </span>
                      </Tag>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {/* ================= 知识点详情 ================= */}
      {detail && (
        <div className="overlay" onClick={() => setDetailId(null)}>
          <div className="modal kdetail" onClick={(e) => e.stopPropagation()}>
            <span className="kid">
              {detail.id} · {STAGE_LABEL[detail.stage as Stage] ?? detail.stage} · {detail.domainLabel}
            </span>
            <h3>{detail.title}</h3>
            <div className="oneline">{detail.oneLine}</div>

            {detail.formula && (
              <div className="sect">
                <div className="lbl">公式</div>
                <div className="formula-box" style={{ marginBottom: 0 }}>
                  {detail.formula}
                </div>
              </div>
            )}

            <div className="sect">
              <div className="lbl">打个比方</div>
              <p>{detail.analogy}</p>
            </div>

            <div className="sect">
              <div className="lbl">为什么会这样</div>
              <p>{detail.why}</p>
            </div>

            {detail.variables?.length > 0 && (
              <div className="sect">
                <div className="lbl">可以调什么</div>
                <div className="chips">
                  {detail.variables.map((v: string) => (
                    <span className="chip static" key={v}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detailPrompt && (
              <div className="sect">
                <div className="lbl">怎么把它搭出来</div>
                <p>{detailPrompt.construction}</p>
                {detailPrompt.limitations && (
                  <p style={{ marginTop: 8, color: 'var(--orange)' }}>
                    模型边界：{detailPrompt.limitations}
                  </p>
                )}
              </div>
            )}

            {detail.misconceptions.length > 0 && (
              <div className="sect warnbox">
                <div className="lbl">最容易错在</div>
                {detail.misconceptions.map((mid) => {
                  const m = MISCONCEPTIONS.find((x) => x.id === mid);
                  if (!m) return null;
                  return (
                    <p key={mid} style={{ marginBottom: 7 }}>
                      <b>{m.belief}</b>
                      <br />
                      <span style={{ fontSize: 12.8, opacity: 0.82 }}>{m.truth}</span>
                    </p>
                  );
                })}
              </div>
            )}

            {detail.prerequisites.length > 0 && (
              <div className="sect">
                <div className="lbl">要先会这些</div>
                <div className="chips">
                  {detail.prerequisites.map((pid) => {
                    const p = KNOWLEDGE.find((x) => x.id === pid);
                    return (
                      <span
                        key={pid}
                        className="chip"
                        onClick={() => setDetailId(pid)}
                        title={p?.title}
                      >
                        {pid} {p ? p.title : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="modal-actions">
              {challengeFor(detail.id) && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    const kid = detail.id;
                    setDetailId(null);
                    onOpenKnowledge(kid);
                  }}
                >
                  在实验台上看这个 →
                </button>
              )}
              <button className="btn-ghost" onClick={() => setDetailId(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
