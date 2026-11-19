import { useMemo, useState } from 'react';
import type { Stage } from '../../core/contracts';
import { KNOWLEDGE, MISCONCEPTIONS } from '../../data/content';
import { KNOWLEDGE_PROMPTS, promptById } from '../../data/knowledge-prompts';
import PromptDialog from '../knowledge-prompts/PromptDialog';
import PLATFORM_MAP from '@knowledge/PLATFORM-MAP.json';

interface Props {
  /** 打开自由实验台，只筛选器具，不装入预设。 */
  onOpenModule: (labId: string) => void;
  /** 直接跳到某个知识点对应的实验台 */
  onOpenKnowledge: (knowledgeId: string) => void;
  onBuildKnowledge: (id:string,title:string,prompt:string) => void;
}

const STAGE_LABEL: Record<Stage, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
  university: '大学',
};

const STATUS_LABEL: Record<string, string> = {
  ready: '有知识卡',
  content: '内容整理中',
  planned: 'AI 搭建提示词',
};

interface MapItem {
  id: string;
  title: string;
}

export default function KnowledgeMap({ onOpenModule, onOpenKnowledge, onBuildKnowledge }: Props) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
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

  const detail = detailId ? KNOWLEDGE.find((k) => k.id === detailId) : null;
  const promptDetail=detailId?promptById(detailId):null;
  const accepts=(item:MapItem)=>matches(item)&&(filter==='all'||filter==='cards'&&KNOWLEDGE.some(c=>c.id===item.id)||filter==='prompts'&&!!promptById(item.id)||promptById(item.id)?.support===filter);
  const visibleCount=disciplines.reduce((count,d)=>count+d.stages.reduce((n,s)=>n+s.items.filter(accepts).length,0),0);

  return (
    <>
      <div className="pq-map-hero">
        <div className="pq-hero-copy"><span className="eyebrow">PHYSQUEST / 探理实验室</span>
          <h2>让问题，<br />在实验中有答案。</h2>
          <p>从知识出发，用器具验证。自由搭建声、光、电、磁与力学实验，在二维与三维之间探索物理规律。</p>
          <button className="btn-primary" onClick={() => onOpenModule('all')}>进入自由实验台</button>
          <span className="pq-hero-note">自由组合 · 实验文件 · AI 协作</span>
        </div>
        <div className="pq-orbit" aria-hidden="true"><span className="pq-orbit-ring r1" /><span className="pq-orbit-ring r2" /><span className="pq-orbit-ring r3" /><span className="pq-nucleus">p<span>q</span></span><span className="pq-orbit-dot d1" /><span className="pq-orbit-dot d2" /><span className="pq-orbit-dot d3" /><span className="pq-orbit-label">OBSERVE · BUILD · DISCOVER</span></div>
      </div>
      <div className="pq-domain-grid" aria-label="按领域查看器具">
        {[
          {id: 'mechanics', label: '力学', en: 'MECHANICS', text: '刚体、弹簧、绳索与力', mark: 'F = ma'},
          {id: 'optics', label: '光学', en: 'OPTICS', text: '光源、透镜与光线传播', mark: '1/f'},
          {id: 'circuit', label: '电与磁', en: 'ELECTROMAGNETISM', text: '电路元件、电荷与磁场', mark: 'U = IR'},
          {id: 'acoustics', label: '声学', en: 'ACOUSTICS', text: '声源、传播与干涉', mark: 'f · λ'},
        ].map(d => <button key={d.id} className="pq-domain" onClick={() => onOpenModule(d.id)}><span className="pq-domain-top"><span>{d.en}</span><b>{d.mark}</b></span><h3>{d.label}</h3><p>{d.text}</p><span className="pq-domain-action">查看器具</span></button>)}
      </div>
      {/* ================= 全平台统计 ================= */}
      <div className="hub-stats" style={{ margin: '38px 0 30px' }}>
        <div className="stat">
          <div className="v">{totals.all}</div>
          <div className="k">全平台知识点</div>
        </div>
        <div className="stat">
          <div className="v">{KNOWLEDGE_PROMPTS.length}</div>
          <div className="k">AI 实验搭建提示词</div>
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
        <span>规划中的知识点现已提供实验搭建提示词。选择知识点，让 DeepSeek 调用 MCP 组装器具；每条均标明可计算、类比或概念示意。</span>
      </div>

      <div className="map-toolbar">
        <input
          className="map-search"
          aria-label="搜索知识点"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜知识点或编号，例如「折射」「K-O2-05」"
        />
        <select aria-label="知识点类型" className="pq-map-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部知识点</option><option value="prompts">AI 搭建提示词</option><option value="direct">可计算实验</option><option value="approximation">近似 / 类比实验</option><option value="conceptual">概念示意</option><option value="cards">已有知识卡</option></select>
        <a className="pq-download-prompts" href={import.meta.env.BASE_URL + 'prompts/knowledge-prompts.json'} download="PhysQuest-知识点搭建提示词.json">下载全部提示词</a>
        <span className="map-count">
          {visibleCount} 条结果
        </span>
      </div>
      {visibleCount===0&&<p role="status" className="pq-map-empty">没有匹配的知识点。试试更短的关键词，或切换为“全部知识点”。</p>}

      {disciplines.map((d) => {
        const bands = d.stages
          .map((s) => ({ ...s, items: s.items.filter(accepts) }))
          .filter((s) => s.items.length > 0);
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
                  <span
                    className={`badge ${
                      band.status === 'ready' || band.status === 'planned' ? 'on' : band.status === 'content' ? '' : 'off'
                    }`}
                  >
                    {STATUS_LABEL[band.status]}
                  </span>
                  <span className="n" />
                </div>
                <div className="map-grid">
                  {band.items.map((item) => {
                    const card = KNOWLEDGE.find((k) => k.id === item.id);
                    const prompt=promptById(item.id);
                    const clickable = !!card || !!prompt;
                    const Tag = clickable ? 'button' : 'div';
                    return (
                      <Tag
                        key={item.id}
                        className={`know-pin ${clickable ? '' : 'static'} ${prompt?'has-prompt':''}`}
                        {...(clickable ? { onClick: () => setDetailId(item.id) } : {})}
                      >
                        <span className="kid">{item.id}</span>
                        <h4>{item.title}</h4>
                        {card && <span className="oneline">{card.oneLine}</span>}{prompt&&<span className="oneline">{prompt.objective}</span>}
                        <span className="pin-foot">
                          {clickable ? (
                            <>
                              <span className="dep">{prompt?prompt.supportLabel:'点开看详情'}</span>{prompt&&<span className="pq-prompt-action">查看提示词</span>}

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

      {promptDetail&&<PromptDialog key={promptDetail.id} entry={promptDetail} onClose={()=>setDetailId(null)} onBuild={(id,title,prompt)=>{setDetailId(null);onBuildKnowledge(id,title,prompt);}} />}
      {/* ================= 知识点详情 ================= */}
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
              {(
                <button
                  className="btn-primary"
                  onClick={() => {
                    const kid = detail.id;
                    setDetailId(null);
                    onOpenKnowledge(kid);
                  }}
                >
                  带着问题去搭建
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
