import { useMemo, useState } from 'react';
import type { Stage } from '../../core/contracts';
import { KNOWLEDGE, CHALLENGES, MISCONCEPTIONS } from '../../data/content';
import PLATFORM_MAP from '@knowledge/PLATFORM-MAP.json';

interface Props {
  onOpenLab: (challengeId: string) => void;
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

type MapItem = { id: string; title: string };

/**
 * 知识地图 · 两层
 *
 *  上层：全平台五大领域 × 四个学段，一眼看清这个平台要讲多少东西、现在做到哪
 *  下层：点开某个「可动手」的知识点，看详情、跳实验台
 *
 * 这一页回答的是「你们这个平台到底有多少内容」，
 * 和首页那张挑战卡片墙回答的「我今天做什么」是两件事。
 */
export default function KnowledgeMap({ onOpenLab }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [onlyReady, setOnlyReady] = useState(false);

  const detail = detailId ? KNOWLEDGE.find((k) => k.id === detailId) : null;

  const disciplines = PLATFORM_MAP.disciplines as Array<{
    key: string;
    label: string;
    en: string;
    desc: string;
    stages: Array<{
      stage: Stage;
      status: string;
      items: MapItem[];
    }>;
  }>;

  const totals = useMemo(() => {
    let all = 0;
    let ready = 0;
    let content = 0;
    disciplines.forEach((d) =>
      d.stages.forEach((s) => {
        all += s.items.length;
        if (s.status === 'ready') ready += s.items.length;
        if (s.status === 'content') content += s.items.length;
      }),
    );
    return { all, ready, content };
  }, [disciplines]);

  const matches = (item: MapItem) => {
    const kw = q.trim().toLowerCase();
    if (!kw) return true;
    return item.id.toLowerCase().includes(kw) || item.title.toLowerCase().includes(kw);
  };

  const challengeFor = (kid: string) => CHALLENGES.find((c) => c.knowledgeIds.includes(kid));

  return (
    <>
      <div className="hub-head" style={{ paddingBottom: 16 }}>
        <span className="eyebrow">Knowledge Map · 全平台知识地图</span>
        <h2>这个平台，一共要讲 {totals.all} 个知识点</h2>
        <p>
          五大领域 × 四个学段，从上往下是一条完整的学习线。
          现在能动手的是光学那 {totals.ready} 条，其余按顺序往后铺。
        </p>
      </div>

      <div className="hub-stats" style={{ marginBottom: 26 }}>
        <div className="stat">
          <div className="v">{totals.all}</div>
          <div className="k">知识点总数</div>
        </div>
        <div className="stat">
          <div className="v">{totals.ready}</div>
          <div className="k">现在能动手</div>
        </div>
        <div className="stat">
          <div className="v">{totals.content}</div>
          <div className="k">有知识卡</div>
        </div>
        <div className="stat">
          <div className="v">3</div>
          <div className="k">规划中的实验</div>
        </div>
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
        <span className="map-count">{STAGE_LABEL.primary} → {STAGE_LABEL.university}</span>
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
                  <span className={`badge ${band.status === 'ready' ? 'on' : band.status === 'content' ? '' : 'off'}`}>
                    {STATUS_LABEL[band.status]}
                  </span>
                  <span className="n" />
                </div>
                <div className="map-grid">
                  {band.items.map((item) => {
                    const card = KNOWLEDGE.find((k) => k.id === item.id);
                    const clickable = band.status === 'ready' && !!card;
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

      {detail && (
        <div className="overlay" onClick={() => setDetailId(null)}>
          <div className="modal kdetail" onClick={(e) => e.stopPropagation()}>
            <span className="kid">
              {detail.id} · {STAGE_LABEL[detail.stage]}
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
                    const c = challengeFor(detail.id)!;
                    setDetailId(null);
                    onOpenLab(c.id);
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
