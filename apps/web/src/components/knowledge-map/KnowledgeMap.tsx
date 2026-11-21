import { useMemo, useState } from 'react';
import type { Stage } from '../../core/contracts';
import { ALL_CARDS, CHALLENGES, MISCONCEPTIONS, promptById } from '../../data/content';
import { LABS } from '../../labs/registry';
import KnowledgeCard, { STAGE_LABEL, type CardData } from '../knowledge-cards/KnowledgeCard';
import PLATFORM_MAP from '@knowledge/PLATFORM-MAP.json';

interface Props {
  onOpenModule: (labId: string) => void;
  onOpenKnowledge: (knowledgeId: string) => void;
  onBuild?: (prompt: string, title: string, knowledgeId: string) => void;
}

type View = 'module' | 'list';

const STAGE_ORDER: Stage[] = ['primary', 'junior', 'senior', 'university'];

const STAGE_DESC: Record<Stage, string> = {
  primary: '看得见的现象，不出现公式',
  junior: '规律与实验，初中课本主线',
  senior: '定量与公式，高中课本主线',
  university: '模型边界与近似条件',
};

/**
 * 知识地图 · 融合版
 *
 * 之前分成两页（地图 = 目录，知识点 = 卡片集），现在合成一页，两种视图：
 *
 *   ① 模块视图 —— 大卡片，先选一个实验模块去做挑战
 *   ② 卡片视图 —— 166 张双面知识点卡，按学段分组，能直接读、直接翻面、直接去搭
 *
 * 顶部一个切换器。为什么合成一页：因为学生对"我去哪"只有一个心智模型，
 * 分成两个顶级导航会让他每次都要先想"这是地图还是卡片"。
 */
export default function KnowledgeMap({ onOpenModule, onOpenKnowledge, onBuild }: Props) {
  const [view, setView] = useState<View>('module');
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState('all');
  const [support, setSupport] = useState('all');
  const [onlyReady, setOnlyReady] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const disciplines = PLATFORM_MAP.disciplines as Array<{
    key: string;
    label: string;
    en: string;
    desc: string;
    stages: Array<{ stage: Stage; status: string; items: Array<{ id: string; title: string }> }>;
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

  const domains = useMemo(() => {
    const set = new Map<string, string>();
    ALL_CARDS.forEach((c) => set.set(c.domain, c.domainLabel));
    return Array.from(set.entries());
  }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return ALL_CARDS.filter((c) => {
      if (domain !== 'all' && c.domain !== domain) return false;
      if (support !== 'all' && c.support !== support) return false;
      if (onlyReady && c.support !== 'direct') return false;
      if (!kw) return true;
      return (
        c.id.toLowerCase().includes(kw) ||
        c.title.toLowerCase().includes(kw) ||
        c.oneLine.toLowerCase().includes(kw) ||
        c.analogy.toLowerCase().includes(kw)
      );
    });
  }, [q, domain, support, onlyReady]);

  const detail = detailId ? (ALL_CARDS.find((k) => k.id === detailId) as CardData | undefined) : null;
  const detailPrompt = detailId ? promptById(detailId) : null;
  const challengeFor = (kid: string) => CHALLENGES.find((c) => c.knowledgeIds.includes(kid));
  const resolveKnowledge = (id: string) => ALL_CARDS.find((k) => k.id === id);

  return (
    <>
      <div className="hub-head" style={{ paddingBottom: 18 }}>
        <span className="eyebrow">Knowledge · 从这里开始</span>
        <h2>先选一个模块，或者直接翻知识点</h2>
        <p>
          这个平台把物理学成一条路：<b>{totals.all} 个知识点</b>，横跨五个领域、四个学段。
          你可以从模块进去做挑战，也可以直接翻卡片看某一条到底讲什么。
        </p>
      </div>

      {/* ================= 视图切换 ================= */}
      <div className="segmented" style={{ width: 'fit-content', marginBottom: 22 }}>
        <button className={view === 'module' ? 'active' : ''} onClick={() => setView('module')}>
          按模块
        </button>
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          按知识点 · {ALL_CARDS.length} 张
        </button>
      </div>

      {/* ================= 视图一：模块 ================= */}
      {view === 'module' && (
        <>
          <div className="module-grid">
            {LABS.map((lab) => (
              <button key={lab.id} className="module-card" onClick={() => onOpenModule(lab.id)}>
                <div className="module-card-top">
                  <span className="module-icon">◉</span>
                  <span className="badge on">{lab.badge}</span>
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
            ))}
          </div>

          <div className="hub-stats" style={{ margin: '34px 0 6px' }}>
            <div className="stat">
              <div className="v">{totals.all}</div>
              <div className="k">全平台知识点</div>
            </div>
            <div className="stat">
              <div className="v">{ALL_CARDS.length}</div>
              <div className="k">已写好的卡片</div>
            </div>
            <div className="stat">
              <div className="v">{CHALLENGES.length + 51}</div>
              <div className="k">可做的挑战</div>
            </div>
            <div className="stat">
              <div className="v">{MISCONCEPTIONS.length}</div>
              <div className="k">常见误区</div>
            </div>
          </div>

          <div className="map-cta" onClick={() => setView('list')} role="button" tabIndex={0}>
            <div>
              <h3>或者不选模块，直接翻知识点</h3>
              <p>
                166 张双面卡片，按学段排。正面读知识点，背面写清这条怎么做成实验，
                能一键交给 AI 现场搭。
              </p>
            </div>
            <span className="go">去翻卡片 →</span>
          </div>
        </>
      )}

      {/* ================= 视图二：知识点卡片 ================= */}
      {view === 'list' && (
        <>
          <div className="map-toolbar">
            <input
              className="map-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜知识点，例如「压强」「K-O2-05」"
            />
            <select
              className="card-filter"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              <option value="all">全部领域</option>
              {domains.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="card-filter"
              value={support}
              onChange={(e) => setSupport(e.target.value)}
            >
              <option value="all">全部级别</option>
              <option value="direct">可计算</option>
              <option value="approximation">近似</option>
              <option value="conceptual">仅示意</option>
            </select>
            <button
              className={onlyReady ? 'btn-primary btn-small' : 'btn-ghost btn-small'}
              onClick={() => setOnlyReady(!onlyReady)}
            >
              只看能计算的
            </button>
            <span className="map-count">
              {filtered.length} / {ALL_CARDS.length} 张
            </span>
          </div>

          {STAGE_ORDER.map((st) => {
            const bucket = filtered.filter((c) => c.stage === st);
            if (bucket.length === 0) return null;
            return (
              <section className="kp-stage-band" key={st}>
                <div className="kp-stage-head">
                  <h3>{STAGE_LABEL[st]}</h3>
                  <span className="kp-count">{bucket.length} 张</span>
                  <span className="kp-desc">{STAGE_DESC[st]}</span>
                </div>
                <div className="know-grid">
                  {bucket.map((c) => (
                    <KnowledgeCard
                      key={c.id}
                      card={c as CardData}
                      misconceptions={MISCONCEPTIONS}
                      resolveKnowledge={resolveKnowledge}
                      onBuild={onBuild}
                      onJumpKnowledge={(id) => setDetailId(id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {filtered.length === 0 && <div className="empty">没有匹配的知识点</div>}
        </>
      )}

      {/* ================= 详情弹层（从卡片里点前置知识时用） ================= */}
      {detail && (
        <div className="overlay" onClick={() => setDetailId(null)}>
          <div className="modal kdetail" onClick={(e) => e.stopPropagation()}>
            <KnowledgeCard
              card={detail}
              misconceptions={MISCONCEPTIONS}
              resolveKnowledge={resolveKnowledge}
              onBuild={
                onBuild
                  ? (p, t, k) => {
                      setDetailId(null);
                      onBuild(p, t, k);
                    }
                  : undefined
              }
              onJumpKnowledge={(id) => setDetailId(id)}
              compact
            />

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
                  在实验台上做这个 →
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
