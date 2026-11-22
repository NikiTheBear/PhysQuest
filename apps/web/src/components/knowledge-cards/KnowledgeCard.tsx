import { useState } from 'react';
import { createPortal } from 'react-dom';
import { promptById } from '../../data/content';
import FormulaLab from '../formula-lab/FormulaLab';
import { hasLab } from '../formula-lab/labData';

/**
 * 单张知识点卡片（双面，可翻转）
 *
 * 这是整个平台最基础的展示单元：
 *   正面 —— 读的（一句话 / 打个比方 / 为什么 / 易错 / 可调什么）
 *   背面 —— 做的（用哪些器具 / 调哪些参数 / 看什么 / 模型边界 / 给 AI 的完整提示词）
 *
 * 三个地方都用它：
 *   ① 知识地图的详情弹层
 *   ② 知识地图的卡片视图
 *   ③ 挑战导览里的知识点回顾
 *
 * 所以它必须自带翻面状态，不能依赖外部。
 */

export interface CardData {
  id: string;
  title: string;
  stage: string;
  domain: string;
  domainLabel: string;
  oneLine: string;
  analogy: string;
  formula: string;
  why: string;
  variables: string[];
  observations: string[];
  support: 'direct' | 'approximation' | 'conceptual';
  misconceptions: string[];
  prerequisites: string[];
  difficulty: string;
  /** ★ 加厚内容（可能为空数组，界面要判断） */
  detail?: string[];
  compare?: Array<{ with: string; diff: string }>;
  everyday?: string[];
  selfCheck?: Array<{ q: string; a: string }>;
}

const STAGE_LABEL: Record<string, string> = {
  primary: '小学',
  junior: '初中',
  senior: '高中',
  university: '大学',
};

const SUPPORT_LABEL: Record<string, { text: string; cls: string; why: string }> = {
  direct: {
    text: '可计算',
    cls: 'pass',
    why: '这一条平台有真实的物理求解器，拖参数会得到真结果。',
  },
  approximation: {
    text: '近似',
    cls: 'warn',
    why: '这一条是近似或类比模型，结论在边界内成立，越过边界就不准了。',
  },
  conceptual: {
    text: '仅示意',
    cls: 'off',
    why: '这一条目前只能做示意图，平台还没有对应的数值求解器——所以它讲的是趋势和关系，不是精确数字。',
  },
};

interface Props {
  card: CardData;
  /** 误区库，用于把 misconception id 翻成中文 */
  misconceptions: Array<{ id: string; belief: string; truth: string }>;
  /** 前置知识，用于把 id 翻成标题 */
  resolveKnowledge?: (id: string) => { title: string } | undefined;
  /** 点「去搭建」 */
  onBuild?: (prompt: string, title: string, knowledgeId: string) => void;
  /** 点前置知识 */
  onJumpKnowledge?: (id: string) => void;
  /** 紧凑模式（弹层里用，字号小一点） */
  compact?: boolean;
  /** 初始是否翻开 */
  defaultFlipped?: boolean;
}

export default function KnowledgeCard({
  card,
  misconceptions,
  resolveKnowledge,
  onBuild,
  onJumpKnowledge,
  compact = false,
  defaultFlipped = false,
}: Props) {
  const [isBack, setIsBack] = useState(defaultFlipped);
  const [showLab, setShowLab] = useState(false);
  const prompt = promptById(card.id);
  const sup = SUPPORT_LABEL[card.support] ?? SUPPORT_LABEL.conceptual;
  /** 这一条在 formula-lab.json 里有没有实验室（97 条里有 78 条可算 + 19 条只能示意） */
  const labEntry = hasLab(card.id);

  const mis = card.misconceptions
    .map((id) => misconceptions.find((m) => m.id === id))
    .filter(Boolean);

  return (
    <div className={`know-card flip-card ${isBack ? 'flipped' : ''} ${compact ? 'compact' : ''}`}>
      <span className="flip-mark" aria-hidden />

      <div className="fc-head">
        <span className="kid">{card.id}</span>
        <span className={`badge ${sup.cls}`} title={sup.why}>
          {sup.text}
        </span>
        <span className="fc-stage">
          {card.domainLabel} · {STAGE_LABEL[card.stage] ?? card.stage}
        </span>
      </div>

      {/* key 变化时 React 会重挂载这一块，翻面就有动效（只重绘这一张卡） */}
      <div className="fc-face" key={isBack ? 'back' : 'front'}>
        {!isBack ? (
        <>
          <h4>{card.title}</h4>
          <div className="oneline">{card.oneLine}</div>

          {card.formula && (
            <div className="formula-box" style={{ marginBottom: 0, fontSize: compact ? 13 : 14 }}>
              {card.formula}
            </div>
          )}

          <div className="body">
            <b>打个比方：</b>
            {card.analogy}
          </div>

          {card.why && (
            <div className="fc-why">
              <span className="fc-k">为什么</span>
              <p>{card.why}</p>
            </div>
          )}

          {/* ===== 深入讲解 ===== */}
          {card.detail && card.detail.length > 0 && (
            <details className="fc-more" open={!compact}>
              <summary>讲透一点（{card.detail.length} 段）</summary>
              {card.detail.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </details>
          )}

          {/* ===== 易混对比 ===== */}
          {card.compare && card.compare.length > 0 && (
            <div className="fc-compare">
              <span className="fc-k">别搞混</span>
              {card.compare.map((c) => (
                <div className="fc-cmp-row" key={c.with}>
                  <b>{c.with}</b>
                  <span>{c.diff}</span>
                </div>
              ))}
            </div>
          )}

          {/* ===== 生活里在哪见 ===== */}
          {card.everyday && card.everyday.length > 0 && (
            <div className="fc-everyday">
              <span className="fc-k">生活里</span>
              <ul>
                {card.everyday.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {mis.length > 0 && (
            <div className="mis">
              <b>最容易错在：</b>
              {mis.map((m) => m!.belief).join(' / ')}
            </div>
          )}

          {card.variables.length > 0 && (
            <div className="fc-vars">
              <span className="fc-vars-label">可调</span>
              {card.variables.map((v) => (
                <span className="chip static" key={v}>
                  {v}
                </span>
              ))}
            </div>
          )}

          {card.prerequisites.length > 0 && resolveKnowledge && onJumpKnowledge && (
            <div className="fc-vars">
              <span className="fc-vars-label">先会</span>
              {card.prerequisites.map((pid) => {
                const p = resolveKnowledge(pid);
                return (
                  <span
                    className="chip"
                    key={pid}
                    onClick={() => onJumpKnowledge(pid)}
                    title={p?.title}
                  >
                    {pid} {p?.title ?? ''}
                  </span>
                );
              })}
            </div>
          )}

          {/* ===== 自检三问 ===== */}
          {card.selfCheck && card.selfCheck.length > 0 && (
            <div className="fc-check">
              <span className="fc-k">自己考自己</span>
              {card.selfCheck.map((s2, i) => (
                <details key={i} className="fc-q">
                  <summary>
                    <b>{i + 1}.</b> {s2.q}
                  </summary>
                  <p>{s2.a}</p>
                </details>
              ))}
            </div>
          )}

          <div className="fc-actions">
            <button className="btn-ghost btn-small" onClick={() => setIsBack(true)}>
              翻到背面：怎么搭 →
            </button>
          </div>
        </>
      ) : (
        <>
          <h4>怎么把它搭出来</h4>

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
              这一条还没有搭建方案。可以去实验台从空白开始自己搭，或者让 AI 帮你设计。
            </div>
          )}

          <div className="fc-actions">
            <button className="btn-ghost btn-small" onClick={() => setIsBack(false)}>
              ← 翻回正面
            </button>
            {labEntry && (
              <button className="btn-ghost btn-small" onClick={() => setShowLab(true)}>
                打开公式实验室 →
              </button>
            )}
            {prompt && onBuild && (
              <button
                className="btn-primary btn-small"
                onClick={() => onBuild(prompt.prompt, card.title, card.id)}
              >
                去搭建 →
              </button>
            )}
          </div>
        </>
        )}
      </div>

      {/* ===== 公式实验室（弹层）===== */}
      {/* 放在卡片内部：三个使用点（地图详情 / 卡片视图 / 挑战回顾）就都自动有入口了，
          不用每个调用点各自接线。
          用 portal 挂到 body：卡片在网格 / 弹层里，祖先的 transform、overflow、
          z-index 都可能把 position:fixed 关进去，portal 一劳永逸。 */}
      {showLab &&
        labEntry &&
        createPortal(
          <div
            className="overlay"
            onClick={(e) => {
              // 只关这一层：卡片本身可能就在另一个 overlay 里，别顺着 React 树把外层也关了
              e.stopPropagation();
              setShowLab(false);
            }}
          >
            <div className="modal formula-lab-modal" onClick={(e) => e.stopPropagation()}>
              <FormulaLab knowledgeId={card.id} onClose={() => setShowLab(false)} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export { STAGE_LABEL, SUPPORT_LABEL };
