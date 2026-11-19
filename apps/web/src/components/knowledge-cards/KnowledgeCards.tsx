import { useMemo, useState } from 'react';
import type { LensParams } from '../../core/contracts';
import { ALL_CARDS, ALL_PROMPTS, promptById } from '../../data/content';

/**
 * 知识卡（全平台，166 张）
 *
 * 卡片是双面的：
 *   正面 —— 给学生读的知识点（一句话 / 类比 / 为什么 / 易错）
 *   背面 —— 给 AI 的搭建提示词（目标 / 器具 / 参数 / 观测 / 边界）
 *
 * 背面不是"技术细节"，是让学生知道「这一条能怎么动手做出来」。
 * 点「去搭建」就把这段提示词交给自由搭建工作台。
 */

const STAGE_LABEL: Record<string, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
  university: '大学',
};

const SUPPORT_LABEL: Record<string, { text: string; cls: string }> = {
  direct: { text: '可计算', cls: 'pass' },
  approximation: { text: '近似', cls: 'warn' },
  conceptual: { text: '仅示意', cls: 'off' },
};

interface Props {
  onJump?: (preset: Partial<LensParams>) => void;
  onBuild?: (prompt: string, title: string, knowledgeId: string) => void;
}

export default function KnowledgeCards({ onBuild }: Props) {
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState('all');
  const [support, setSupport] = useState('all');
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const domains = useMemo(() => {
    const set = new Map<string, string>();
    ALL_CARDS.forEach((c) => set.set(c.domain, c.domainLabel));
    return Array.from(set.entries());
  }, []);

  const cards = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return ALL_CARDS.filter((c) => {
      if (domain !== 'all' && c.domain !== domain) return false;
      if (support !== 'all' && c.support !== support) return false;
      if (!kw) return true;
      return (
        c.id.toLowerCase().includes(kw) ||
        c.title.toLowerCase().includes(kw) ||
        c.oneLine.toLowerCase().includes(kw) ||
        c.analogy.toLowerCase().includes(kw)
      );
    });
  }, [q, domain, support]);

  const toggle = (id: string) => setFlipped((p) => ({ ...p, [id]: !p[id] }));

  return (
    <>
      <div className="map-toolbar">
        <input
          className="map-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜知识点，例如「压强」「K-O2-05」"
        />
        <select className="card-filter" value={domain} onChange={(e) => setDomain(e.target.value)}>
          <option value="all">全部领域</option>
          {domains.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select className="card-filter" value={support} onChange={(e) => setSupport(e.target.value)}>
          <option value="all">全部级别</option>
          <option value="direct">可计算</option>
          <option value="approximation">近似</option>
          <option value="conceptual">仅示意</option>
        </select>
        <span className="map-count">
          {cards.length} / {ALL_CARDS.length} 张
        </span>
      </div>

      <div className="know-grid">
        {cards.map((c) => {
          const prompt = promptById(c.id);
          const isBack = flipped[c.id];
          const sup = SUPPORT_LABEL[c.support] ?? SUPPORT_LABEL.conceptual;

          return (
            <div className={`know-card flip-card ${isBack ? 'flipped' : ''}`} key={c.id}>
              <div className="fc-head">
                <span className="kid">{c.id}</span>
                <span className={`badge ${sup.cls}`}>{sup.text}</span>
                <span className="fc-stage">
                  {c.domainLabel} · {STAGE_LABEL[c.stage] ?? c.stage}
                </span>
              </div>

              {!isBack ? (
                <>
                  <h4>{c.title}</h4>
                  <div className="oneline">{c.oneLine}</div>

                  {c.formula && (
                    <div className="formula-box" style={{ marginBottom: 0, fontSize: 14 }}>
                      {c.formula}
                    </div>
                  )}

                  <div className="body">
                    <b>打个比方：</b>
                    {c.analogy}
                  </div>

                  {c.why && (
                    <div className="fc-why">
                      <span className="fc-k">为什么</span>
                      <p>{c.why}</p>
                    </div>
                  )}

                  {c.variables.length > 0 && (
                    <div className="fc-vars">
                      <span className="fc-vars-label">可调</span>
                      {c.variables.map((v) => (
                        <span className="chip static" key={v}>
                          {v}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="fc-actions">
                    <button className="btn-ghost btn-small" onClick={() => toggle(c.id)}>
                      翻到背面：怎么搭 →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h4>怎么搭出来</h4>
                  {prompt ? (
                    <>
                      <div className="fc-goal">{prompt.objective}</div>

                      <div className="fc-block">
                        <span className="fc-k">器具与步骤</span>
                        <p>{prompt.construction}</p>
                      </div>

                      {prompt.variables.length > 0 && (
                        <div className="fc-block">
                          <span className="fc-k">可以调什么</span>
                          <p>{prompt.variables.join('；')}</p>
                        </div>
                      )}

                      {prompt.observations.length > 0 && (
                        <div className="fc-block">
                          <span className="fc-k">看什么</span>
                          <p>{prompt.observations.join('；')}</p>
                        </div>
                      )}

                      {prompt.limitations && (
                        <div className="fc-block warn">
                          <span className="fc-k">模型边界</span>
                          <p>{prompt.limitations}</p>
                        </div>
                      )}

                      <details className="fc-prompt">
                        <summary>看完整提示词（交给 AI 的原话）</summary>
                        <pre>{prompt.prompt}</pre>
                      </details>
                    </>
                  ) : (
                    <div className="fc-empty">
                      这一条还没有搭建方案。光学那 26 张卡可以直接在实验台上看。
                    </div>
                  )}

                  <div className="fc-actions">
                    <button className="btn-ghost btn-small" onClick={() => toggle(c.id)}>
                      ← 翻回正面
                    </button>
                    {prompt && onBuild && (
                      <button
                        className="btn-primary btn-small"
                        onClick={() => onBuild(prompt.prompt, c.title, c.id)}
                      >
                        去搭建 →
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {cards.length === 0 && <div className="empty">没有匹配的知识卡</div>}
    </>
  );
}

/** 供其它页面复用的工具 */
export const promptCount = ALL_PROMPTS.length;
