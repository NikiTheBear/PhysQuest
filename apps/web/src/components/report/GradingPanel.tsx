/**
 * 实验评分卡
 *
 * 放在报告页右栏（文档 §5.1）。它可以完全自给自足：
 * 自己读证据（physquest.freebuild.v1）、自己读 AI 配置、自己发一次评分请求，
 * 所以不需要在 App.tsx 里挂状态 —— 报告页刷新一次，评分卡照常能用。
 *
 * 呈现规矩（§5.2 / §5.3）：
 *  - 一行一个维度，四段式：维度名 / 分数 + 档位徽章 / 细进度条 / 一句评语 + 编号
 *  - `score === null` 不显示数字，显示「—」，档位写「无法判断」
 *  - 「不通过」只提示，**永远不解锁/锁死任何按钮**（导出、复制照样能用）
 *  - 不渲染任何形似「帮你写好的反思」的文本（AI 的输出里本来也没有这个字段）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIConfig } from '../../ai/client';
import { isConfigured, loadAIConfig } from '../../ai/client';
import type { LearnerState } from '../../core/contracts';
import { capturesFor, focusOf, loadCaptures } from '../../core/grading/capture-store';
import { gradeExperiment } from '../../core/grading/grade';
import { loadRubric, CHANNEL_LABEL } from '../../core/grading/rubric';
import { fmt } from '../../core/grading/rules';
import type {
  Band,
  DimensionKey,
  GradeResult,
  Level,
  RunFact,
} from '../../core/grading/types';
import { BAND_LABEL, DIM_LABEL, LEVEL_LABEL, W } from '../../core/grading/types';
import { AUTO_CHALLENGES, CHALLENGES } from '../../data/content';
import {
  loadGrade,
  loadSeenObservations,
  saveGrade,
  saveSeenObservations,
} from '../../core/persistence';
import type { ChallengeRef } from '../../core/grading/build-input';

/* ============================================================
 * 1. 找到「这次该评哪一关」
 *
 * ReportView 现在只拿到 challengeTitle，没有 id。为了不用改 App.tsx，
 * 这里从真实活动里推：最近一次记录（快照 / 锁定）> 最近写过的反思。
 * ========================================================== */

export function pickGradeChallenge(
  learner: LearnerState,
  captures: ReturnType<typeof capturesFor>,
): { ref: ChallengeRef; why: string } | null {
  const seen = new Set<string>();
  const candidate = (id: string) => {
    if (!id || seen.has(id)) return null;
    seen.add(id);
    const hand = CHALLENGES.find((c) => c.id === id);
    if (hand) {
      return {
        ref: {
          id: hand.id,
          title: hand.title,
          brief: hand.brief,
          labId: hand.labId,
          knowledgeIds: hand.knowledgeIds,
          winCondition: hand.winCondition,
        } satisfies ChallengeRef,
        why: '手写挑战',
      };
    }
    const auto = AUTO_CHALLENGES.find((c) => c.id === id);
    if (auto) {
      return {
        ref: {
          id: auto.id,
          title: auto.title,
          brief: auto.brief,
          labId: auto.labId,
          knowledgeIds: auto.knowledgeIds,
          // 自动挑战的 winCondition 是假的 {metric:'m', op:'<', value:0}（§7.3 第 3 条），
          // 判出来没有意义，所以干脆不给 —— goalMet 会是 'unknown'。
        } satisfies ChallengeRef,
        why: '自动挑战（目标判定不可用）',
      };
    }
    return null;
  };

  // ① 最近有快照的挑战（快照数组是最新在前）
  for (const c of captures) {
    const id = sourceChallengeId(c);
    if (!id) continue;
    const hit = candidate(id);
    if (hit) return hit;
  }
  // ② 最近锁定的挑战
  const runs = [...learner.runs].sort((a, b) => b.lockedAt - a.lockedAt);
  for (const r of runs) {
    const hit = candidate(r.challengeId);
    if (hit) return hit;
  }
  // ③ 最近写反思的挑战
  const reflections = Object.entries(learner.reflections).sort(
    (a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0),
  );
  for (const [id] of reflections) {
    const hit = candidate(id);
    if (hit) return hit;
  }
  return null;
}

function sourceChallengeId(snap: unknown): string | null {
  const id = (snap as { experiment?: { source?: { openedChallenge?: unknown } } })?.experiment?.source
    ?.openedChallenge;
  return typeof id === 'string' && id ? id : null;
}

/* ============================================================
 * 2. 评分卡
 * ========================================================== */

interface Props {
  learner: LearnerState;
  /** 已评出的结果（外部托管时传）。不传就自己管 */
  grade?: GradeResult | null;
  onGrade?: (g: GradeResult) => void;
  /** 指定评哪一关。不传就自己推（pickGradeChallenge） */
  challenge?: ChallengeRef | null;
  /** 为了测试方便注入；生产里不传，内部读 ai/client 的配置 */
  aiConfig?: AIConfig | null;
  /** 测试注入：不真的发请求 */
  gradeFn?: typeof gradeExperiment;
}

export default function GradingPanel({
  learner,
  grade: gradeProp,
  onGrade,
  challenge,
  aiConfig,
  gradeFn,
}: Props) {
  // 证据只从 freeRuns 读（§2.3）：LockedRun.params 是网页层的 params，
  // 不是学生在 iframe 里调到的那组，拿去算 D3 会得到「所有人都是 preset」的荒谬结论。
  const captures = useMemo(() => loadCaptures(), [learner]);
  const target = useMemo(
    () => challenge ?? pickGradeChallenge(learner, captures)?.ref ?? null,
    [challenge, learner, captures],
  );
  const challengeId = target?.id ?? '';

  const rubric = useMemo(() => (challengeId ? loadRubric(challengeId) : null), [challengeId]);

  const [innerGrade, setInnerGrade] = useState<GradeResult | null>(() =>
    challengeId ? loadGrade(challengeId) : null,
  );
  const grade = gradeProp !== undefined ? gradeProp : innerGrade;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** 学生自报（缺口 3 方案 B） */
  const [seen, setSeen] = useState<string[]>(() =>
    challengeId ? loadSeenObservations(learner, challengeId) : [],
  );
  /** 工作台采集的 focus（缺口 3 方案 A）。平台还没加这个字段，现在是空数组 */
  const autoFocus = useMemo(
    () => (challengeId ? focusOf(capturesFor(challengeId, captures)) : []),
    [challengeId, captures],
  );
  /** 评分实际用的「看过哪些」= 自报 ∪ 采集。两者都没有 → D2 自然是 insufficient */
  const seenForGrading = useMemo(
    () => [...new Set([...seen, ...autoFocus])],
    [seen, autoFocus],
  );
  const [config, setConfig] = useState<AIConfig | null>(() => aiConfig ?? safeLoadConfig());

  // 换关卡就换成那一关的缓存和自报
  useEffect(() => {
    if (!challengeId) return;
    setInnerGrade(loadGrade(challengeId));
    setSeen(loadSeenObservations(learner, challengeId));
  }, [challengeId, learner]);

  const evidenceRef = useRef<HTMLDetailsElement | null>(null);

  const run = useCallback(async () => {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    const fresh = aiConfig ?? safeLoadConfig();
    setConfig(fresh);
    try {
      const fn = gradeFn ?? gradeExperiment;
      const result = await fn({
        learner,
        challenge: target,
        captures: capturesFor(target.id, captures),
        seenObservations: seenForGrading,
        stage: learner.stage,
        config: fresh,
      });
      setInnerGrade(result);
      saveGrade(result);
      onGrade?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '评分失败，再试一次。');
    } finally {
      setBusy(false);
    }
  }, [target, busy, aiConfig, gradeFn, learner, captures, seenForGrading, onGrade]);

  const toggleSeen = (suffix: string) => {
    const next = seen.includes(suffix) ? seen.filter((s) => s !== suffix) : [...seen, suffix];
    setSeen(next);
    if (challengeId) saveSeenObservations(challengeId, next);
  };

  /** 点编号 → 展开证据、滚到那一行、高亮 1.5 秒（§5.2） */
  const jump = (refId: string) => {
    const root = evidenceRef.current;
    if (!root) return;
    root.open = true;
    const row = root.querySelector<HTMLElement>(`[data-ref="${refId}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    row.classList.add('hl');
    window.setTimeout(() => row.classList.remove('hl'), 1500);
  };

  const aiReady = config ? isConfigured(config) : false;
  const options = rubric
    ? [...rubric.requiredObservations, ...rubric.optionalObservations]
    : [];

  return (
    <div className="panel grade-panel">
      <h4>实验评分 · 依据来自本地引擎的读数</h4>
      <div className="grade-head-note">
        数字全部由本地物理引擎算出，AI 只写评语。评语里出现的每个数都能在下面的证据表里找到。
        <br />
        评分不代写你的反思，也不会替你改任何东西。
      </div>

      {!target ? (
        <div className="grade-refuse">
          <b>还没有可评的实验。</b>先在实验台上调一组参数、点「记录此刻」，再回来评分。
          评分只认这一关的记录：{rubric ? '这一关有评分标准。' : '这一关暂时还没有评分标准。'}
        </div>
      ) : (
        <>
          <div className="grade-note" style={{ marginBottom: 10 }}>
            本次评分对象：<b>{target.title}</b>
            {!rubric && '（这一关还没有评分标准，只评器具和变量控制）'}
            {!aiReady && '（没配 AI：只给本地三个维度，D4 需要配置 AI 才能评价你的反思）'}
          </div>

          {options.length > 0 && (
            <ObservationPicker
              options={options}
              seen={seen}
              onToggle={toggleSeen}
              disabled={busy}
            />
          )}

          {grade && grade.dimensions.length > 0 ? (
            <GradeBody grade={grade} onJump={jump} evidenceRef={evidenceRef} />
          ) : grade ? (
            <div className="grade-refuse">
              <b>{grade.refused?.message ?? '本次没有评分'}。</b>
              {refuseHint(grade.refused?.code)}
            </div>
          ) : (
            <div className="grade-note">
              还没有评过这次实验。点下面的按钮开始，评一次大约几秒。
            </div>
          )}

          {error && (
            <div className="grade-refuse" role="alert">
              <b>评分没成功：</b> {error}
            </div>
          )}

          <div className="grade-actions">
            <button className="btn-primary btn-small" onClick={() => void run()} disabled={busy}>
              {busy ? '评分中…' : grade ? '重新评分' : '评这次实验'}
            </button>
            <span className="grade-note">
              改完反思可以再评一次；评分不会影响导出和复制。
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
 * 3. 维度列表
 * ========================================================== */

function GradeBody({
  grade,
  onJump,
  evidenceRef,
}: {
  grade: GradeResult;
  onJump: (id: string) => void;
  evidenceRef: React.RefObject<HTMLDetailsElement>;
}) {
  const d1 = grade.dimensions.find((d) => d.key === 'assembly')?.score ?? null;
  return (
    <>
      <div className="grade-total-row">
        {grade.total === null ? (
          <span className="grade-total none">未评分</span>
        ) : (
          <>
            <span className="grade-total" style={{ color: levelColor(grade.level) }}>
              {grade.total}
            </span>
            <span className={`grade-level ${grade.level}`}>{LEVEL_LABEL[grade.level]}</span>
          </>
        )}
      </div>

      {grade.summary && <div className="grade-note" style={{ marginBottom: 12 }}>{grade.summary}</div>}

      {d1 !== null && d1 < 50 && (
        <div className="grade-flag">实验还没搭起来，其他三项的分数仅供参考。</div>
      )}

      {grade.refused?.code === 'NO_AI' && (
        <div className="grade-note" style={{ marginBottom: 10 }}>
          AI 评语不可用（没配 Key 或本地启动器没在跑），下面是规则判定。
        </div>
      )}
      {grade.refused?.code === 'AI_INVALID' && (
        <div className="grade-note" style={{ marginBottom: 10 }}>
          AI 这次没按格式返回，已换成规则判定。
        </div>
      )}

      {grade.dimensions.map((d) => (
        <div className="grade-row" key={d.key}>
          <span className="grade-row-name">
            {DIM_LABEL[d.key]}
            <span className="grade-row-weight">（{Math.round(W[d.key] * 100)}%）</span>
          </span>
          <span className={`grade-row-score ${d.score === null ? 'muted' : ''}`}>
            {d.score === null ? '—' : d.score}
            <span className={`grade-badge ${d.band}`}>{BAND_LABEL[d.band]}</span>
          </span>
          <span className={`grade-bar ${d.band}`}>
            <i style={{ width: `${d.score === null ? 0 : Math.max(0, Math.min(100, d.score))}%` }} />
          </span>
          <span className="grade-comment">
            {d.comment}
            {d.by === 'template' && <span className="from-template">本段由规则生成</span>}
          </span>
          {d.refs.length > 0 && (
            <span className="grade-refs">
              {d.refs.map((r) => (
                <button className="grade-ref" key={r} onClick={() => onJump(r)} title="跳到证据表">
                  {r}
                </button>
              ))}
            </span>
          )}
        </div>
      ))}

      {grade.claims.length > 0 && <Claims claims={grade.claims} />}

      <details className="grade-evidence" ref={evidenceRef}>
        <summary>证据（读数表 R / 变化表 V / 对照表 T）</summary>
        <h5>读数表 R · 引擎原值</h5>
        <FactsTable facts={grade.evidence.facts} />
        <h5>变化表 V · 相邻两次记录之间改了什么</h5>
        <ChangesTable rows={grade.evidence.changes} />
        <h5>对照表 T · 本地算好的判断</h5>
        <ChecksTable rows={grade.evidence.checks} />
      </details>
    </>
  );
}

function Claims({ claims }: { claims: GradeResult['claims'] }) {
  return (
    <div className="grade-claims">
      {claims.map((c, i) => (
        <div className="grade-claim" key={`${c.checkId}-${i}`}>
          <q>{c.quote}</q> —{' '}
          <span className={c.verdict === 'agree' ? 'ok' : c.verdict === 'contradict' ? 'bad' : ''}>
            {c.verdict === 'agree' ? '与读数一致' : c.verdict === 'contradict' ? '与读数相反' : '表里没有对应行'}
          </span>
          {c.checkId ? `（${c.checkId}）` : ''}
          {c.note ? ` ${c.note}` : ''}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
 * 4. 三张证据表
 * ========================================================== */

function FactsTable({ facts }: { facts: RunFact[] }) {
  if (facts.length === 0) return <div className="grade-note">没有记录。</div>;
  return (
    <div className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>
            <th>#</th>
            <th>物距u</th>
            <th>焦距f</th>
            <th>光屏位置</th>
            <th>像距v</th>
            <th>放大率m</th>
            <th>像高</th>
            <th>弥散圆</th>
            <th>屏上有像</th>
            <th>相对照度</th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f) => (
            <tr key={f.id} data-ref={f.id}>
              <td>{f.id}</td>
              <td>{f.lens?.u !== undefined ? fmt(f.lens.u, 1) : '—'}</td>
              <td>{f.lens?.f !== undefined ? fmt(f.lens.f, 1) : '—'}</td>
              <td>{f.lens?.screenX !== undefined ? fmt(f.lens.screenX, 1) : '—'}</td>
              <td>{f.metrics.v !== undefined ? fmt(f.metrics.v) : '—'}</td>
              <td>{f.metrics.m !== undefined ? fmt(f.metrics.m) : '—'}</td>
              <td>{f.metrics.imageHeight !== undefined ? fmt(f.metrics.imageHeight) : '—'}</td>
              <td>{f.metrics.blurDiameter !== undefined ? fmt(f.metrics.blurDiameter) : '—'}</td>
              <td>{yesNo(f.metrics.screenHasImage)}</td>
              <td>
                {f.metrics.relativeIlluminance !== undefined
                  ? fmt(f.metrics.relativeIlluminance, 3)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangesTable({ rows }: { rows: GradeResult['evidence']['changes'] }) {
  if (rows.length === 0) return <div className="grade-note">只有一条记录，没有可比较的两次。</div>;
  return (
    <div className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>
            <th>#</th>
            <th>从</th>
            <th>到</th>
            <th>改了什么</th>
            <th>独立变量改动数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} data-ref={c.id}>
              <td>{c.id}</td>
              <td>{c.from}</td>
              <td>{c.to}</td>
              <td>{c.summary?.trim() ? c.summary : '没有改动任何自变量'}</td>
              <td>{c.changed.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecksTable({ rows }: { rows: GradeResult['evidence']['checks'] }) {
  if (rows.length === 0) return <div className="grade-note">没有可核对的行。</div>;
  return (
    <div className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>
            <th>#</th>
            <th>命题</th>
            <th>引擎判定</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} data-ref={t.id}>
              <td>{t.id}</td>
              <td>{t.claim}</td>
              <td>{t.verdict}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 5. 观测项自报（§5.5）
 *
 * 规矩：不预选、不排序、不暗示「选这个能拿高分」。
 * ========================================================== */

function ObservationPicker({
  options,
  seen,
  onToggle,
  disabled,
}: {
  options: string[];
  seen: string[];
  onToggle: (suffix: string) => void;
  disabled: boolean;
}) {
  return (
    <details className="grade-evidence" style={{ marginTop: 0, marginBottom: 12 }}>
      <summary>这次你实际盯着哪些读数看？（不填也没关系，只是评分时用得上）</summary>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', padding: '8px 0 4px' }}>
        {options.map((k) => (
          <label
            key={k}
            style={{ fontSize: 12.5, color: 'var(--label-2)', display: 'flex', gap: 5 }}
          >
            <input
              type="checkbox"
              checked={seen.includes(k)}
              disabled={disabled}
              onChange={() => onToggle(k)}
            />
            {CHANNEL_LABEL[k] ?? k}
          </label>
        ))}
      </div>
      <div className="grade-note">
        观测项这一维只按你勾的算。不勾就显示「无法判断」，不会给你 0 分。
      </div>
    </details>
  );
}

/* ============================================================
 * 6. 小工具
 * ========================================================== */

function safeLoadConfig(): AIConfig | null {
  try {
    return loadAIConfig();
  } catch {
    return null;
  }
}

function yesNo(v: boolean | undefined): string {
  return v === true ? '是' : v === false ? '否' : '—';
}

function levelColor(level: Level): string {
  if (level === 'excellent' || level === 'good') return 'var(--green)';
  if (level === 'pass') return 'var(--label)';
  if (level === 'improve') return 'var(--orange)';
  return 'var(--label-3)';
}

function refuseHint(code: string | undefined): string {
  switch (code) {
    case 'NO_EVIDENCE':
      return '先在实验台上调一组参数，点「记录此刻」，再回来评分。';
    case 'NO_RUN':
      return '先把器具放上再记录。';
    case 'ENGINE_ERROR':
      return '照着上面那句话改接线，改完再评。';
    case 'NO_REFLECTION':
      return '反思还没写够 10 个字，写完了可以再评一次结论。';
    default:
      return '';
  }
}

export { BAND_LABEL, DIM_LABEL };
export type { Band, DimensionKey };
