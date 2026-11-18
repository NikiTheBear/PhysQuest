import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Challenge,
  LensMetrics,
  LensParams,
  LockedRun,
  QuizItem,
} from './core/contracts';
import { DEFAULT_LENS_PARAMS } from './core/contracts';
import {
  hitMisconception,
  loadLearner,
  pushRun,
  setPrediction as persistPrediction,
  setReflection as persistReflection,
  weakMisconceptions,
} from './core/persistence';
import { solve } from './labs/optics-lens/engine';
import LabStage from './labs/optics-lens/LabStage';
import Hub from './components/hub/Hub';
import KnowledgeMap from './components/knowledge-map/KnowledgeMap';
import ControlPanel from './components/lab-workspace/ControlPanel';
import CurveChart from './components/lab-workspace/CurveChart';
import SatisfactionGate from './components/lab-workspace/SatisfactionGate';
import PredictionPanel from './components/prediction/PredictionPanel';
import PredictionCompare from './components/prediction/PredictionCompare';
import KnowledgeCardView, {
  QuizModal,
  QuizResult,
} from './components/knowledge-cards/KnowledgeCards';
import ReportView from './components/report/ReportView';
import { CHALLENGES, KNOWLEDGE, quizForChallenge } from './data/content';

type View = 'hub' | 'map' | 'lab' | 'cards' | 'report';
type Phase = 'predict' | 'explore' | 'gate' | 'compare' | 'quiz' | 'quizResult' | 'done';

export default function App() {
  const [learner, setLearner] = useState(() => loadLearner());
  const [view, setView] = useState<View>('hub');
  const [challenge, setChallenge] = useState<Challenge>(CHALLENGES[0]);
  const [phase, setPhase] = useState<Phase>('explore');
  const [params, setParams] = useState<LensParams>(DEFAULT_LENS_PARAMS);
  const [activeSlider, setActiveSlider] = useState<keyof LensParams | null>(null);
  const [showRays, setShowRays] = useState(true);
  const [showVirtual, setShowVirtual] = useState(true);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [locked, setLocked] = useState<LockedRun | null>(null);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, { correct: boolean; chosen: number | string }>>({});
  const [reflection, setReflectionDraft] = useState('');

  const metrics = useMemo(() => solve(params), [params]);
  const weak = useMemo(() => weakMisconceptions(learner), [learner]);

  /* 每次换挑战，重置参数到该挑战的推荐起点 */
  const beginChallenge = useCallback((c: Challenge) => {
    setChallenge(c);
    setParams({ ...DEFAULT_LENS_PARAMS, ...presetFor(c) });
    setPrediction(learner.predictions[c.id]?.chosenIndex ?? null);
    setLocked(null);
    setPhase(learner.predictions[c.id] ? 'explore' : 'predict');
    setView('lab');
    setReflectionDraft(learner.reflections[c.id]?.text ?? '');
  }, [learner]);

  const patchParams = useCallback((patch: Partial<LensParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const confirmPrediction = (chosen: number) => {
    setPrediction(chosen);
    setLearner((s) => persistPrediction(s, challenge.id, chosen));
    setPhase('explore');
  };

  const confirmLock = () => {
    const run: LockedRun = {
      challengeId: challenge.id,
      params,
      metrics: {
        v: metrics.v,
        m: metrics.m,
        real: metrics.real,
        imageHeight: metrics.imageHeight,
        screenHasImage: metrics.screenHasImage,
        blurDiameter: metrics.blurDiameter,
        description: metrics.description,
      },
      prediction: learner.predictions[challenge.id] ?? null,
      lockedAt: Date.now(),
    };
    setLocked(run);
    setLearner((s) => {
      let next = pushRun(s, run);
      // 命中的误区记一笔
      challenge.misconceptionIds.forEach((id) => {
        next = hitMisconception(next, id);
      });
      return next;
    });
    setPhase(prediction !== null ? 'compare' : 'quiz');
    if (prediction === null) {
      setQuizItems(quizForChallenge(challenge));
      setPhase('quiz');
    }
  };

  const afterCompare = () => {
    setQuizItems(quizForChallenge(challenge));
    setPhase('quiz');
  };

  const submitQuiz = (answers: Record<string, { correct: boolean; chosen: number | string }>) => {
    setQuizAnswers(answers);
    setPhase('quizResult');
    setLearner((s) => {
      let next = s;
      Object.entries(answers).forEach(([id, a]) => {
        if (!a.correct) {
          const item = quizItems.find((q) => q.id === id);
          if (item?.misconceptionId) next = hitMisconception(next, item.misconceptionId);
        }
      });
      return next;
    });
  };

  const goFix = (knowledgeId: string) => {
    const k = KNOWLEDGE.find((x) => x.id === knowledgeId);
    if (k?.labPreset) {
      patchParams(k.labPreset);
      setView('lab');
    }
  };

  /* 快捷键：数字 1-5 跳到对应挑战 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'hub') return;
      const n = Number(e.key);
      if (n >= 1 && n <= CHALLENGES.length) beginChallenge(CHALLENGES[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, beginChallenge]);

  const relatedCards = challenge.knowledgeIds
    .map((id) => KNOWLEDGE.find((k) => k.id === id))
    .filter(Boolean) as NonNullable<ReturnType<typeof KNOWLEDGE.find>>[];

  /* ============================================================ */

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand" onClick={() => setView('hub')}>
            <span className="logo">🔭</span>
            <div>
              <h1>探理实验室</h1>
              <small>PhysQuest</small>
            </div>
          </div>

          <div className="topnav">
            <button className={view === 'hub' ? 'active' : ''} onClick={() => setView('hub')}>
              全景导览
            </button>
            <button
              className={view === 'lab' ? 'active' : ''}
              onClick={() => setView('lab')}
              disabled={view === 'hub' && !challenge}
            >
              实验台
            </button>
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
              知识地图
            </button>
            <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>
              知识卡
            </button>
            <button className={view === 'report' ? 'active' : ''} onClick={() => setView('report')}>
              我的报告
            </button>
            <span className="badge off" title="M3 阶段接入">
              AI 未连接
            </span>
          </div>
        </div>
      </div>

      {view === 'hub' && (
        <Hub
          completed={learner.completed}
          weakMisconceptions={weak}
          onPick={beginChallenge}
          onOpenMap={() => setView('map')}
        />
      )}

      {view === 'map' && (
        <KnowledgeMap
          onOpenLab={(cid) => {
            const c = CHALLENGES.find((x) => x.id === cid);
            if (c) beginChallenge(c);
          }}
        />
      )}

      {view === 'lab' && (
        <>
          <div className="work-head">
            <div>
              <span className="eyebrow">{challenge.id} · 凸透镜成像</span>
              <h2>{challenge.title}</h2>
              <div className="brief">{challenge.brief}</div>
            </div>
            <div className="work-actions">
              <button className="btn-ghost btn-small" onClick={() => setView('cards')}>
                看知识卡
              </button>
              {prediction === null && (
                <button
                  className="btn-ghost btn-small"
                  onClick={() => setPhase('predict')}
                >
                  还没有预测
                </button>
              )}
              <button className="btn-primary" onClick={() => setPhase('gate')}>
                我满意了，提交这组参数
              </button>
            </div>
          </div>

          <div className="split">
            <div>
              <CurveChart
                params={params}
                metrics={metrics}
                highlight={
                  activeSlider === 'u' ? 'u' : activeSlider === 'f' ? 'f' : null
                }
              />
              <ControlPanel
                params={params}
                metrics={metrics}
                onChange={patchParams}
                activeSlider={activeSlider}
                onSliderFocus={setActiveSlider}
              />
              <div className="panel">
                <h4>提示</h4>
                <div className="hint-box">{challenge.hint}</div>
              </div>
            </div>

            <div>
              <LabStage
                params={params}
                stage="junior"
                metrics={metrics}
                showRays={showRays}
                showVirtualExtensions={showVirtual}
              />
              <div className="panel" style={{ marginTop: 14 }}>
                <div className="toggle-row" style={{ padding: 0 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={showRays}
                      onChange={(e) => setShowRays(e.target.checked)}
                    />
                    显示三条特殊光线
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={showVirtual}
                      onChange={(e) => setShowVirtual(e.target.checked)}
                    />
                    显示虚像延长线（虚线）
                  </label>
                  <span style={{ marginLeft: 'auto', color: '#6b7d9c' }}>
                    黄：平行→焦点 · 青：过光心 · 粉：过焦点→平行
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {view === 'cards' && (
        <>
          <div className="hub-head" style={{ paddingBottom: 14 }}>
            <h2>知识卡</h2>
            <p>
              每张卡下面都有一个「在实验台上看这个」，点一下实验台会直接跳到那个状态 ——
              不用自己猜说的是什么。
            </p>
          </div>
          <KnowledgeCardView
            cards={view === 'cards' ? KNOWLEDGE : relatedCards}
            onJump={(preset) => {
              patchParams(preset);
              setView('lab');
            }}
          />
        </>
      )}

      {view === 'report' && (
        <>
          <div className="hub-head" style={{ paddingBottom: 14 }}>
            <h2>我的学习报告</h2>
            <p>先写一句你自己的话，再生成报告。</p>
          </div>
          <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <ReportView
              learner={learner}
              reflectionText={reflection}
              challengeTitle={challenge.title}
              onReflection={(t) => {
                setReflectionDraft(t);
                setLearner((s) => persistReflection(s, challenge.id, t));
              }}
            />
            <div className="panel">
              <h4>探索记录</h4>
              {learner.runs.length === 0 ? (
                <div className="empty">还没有锁定任何参数</div>
              ) : (
                <table className="log">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>u</th>
                      <th>f</th>
                      <th>|v|</th>
                      <th>m</th>
                      <th>结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learner.runs.slice(-12).map((r, i) => (
                      <tr key={r.lockedAt}>
                        <td>{i + 1}</td>
                        <td>{r.params.u.toFixed(1)}</td>
                        <td>{r.params.f.toFixed(0)}</td>
                        <td>{Math.abs(r.metrics.v).toFixed(1)}</td>
                        <td>{r.metrics.m.toFixed(2)}</td>
                        <td>{r.metrics.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== 弹层 ===== */}
      {phase === 'predict' && (
        <PredictionPanel challenge={challenge} onLock={confirmPrediction} />
      )}

      {phase === 'gate' && (
        <SatisfactionGate
          challenge={challenge}
          metrics={metrics}
          onCancel={() => setPhase('explore')}
          onConfirm={confirmLock}
        />
      )}

      {phase === 'compare' && locked && learner.predictions[challenge.id] && (
        <PredictionCompare
          challenge={challenge}
          prediction={learner.predictions[challenge.id]}
          metrics={metrics}
          onNext={afterCompare}
        />
      )}

      {phase === 'quiz' && (
        <QuizModal
          items={quizItems}
          onSubmit={submitQuiz}
          onCancel={() => setPhase('explore')}
        />
      )}

      {phase === 'quizResult' && (
        <QuizResult
          items={quizItems}
          answers={quizAnswers}
          onGoFix={(kid) => {
            goFix(kid);
            setPhase('explore');
          }}
          onFinish={() => {
            setPhase('explore');
            setView('report');
          }}
        />
      )}
    </div>
  );
}

/* 每个挑战给一个合理的起始参数 */
function presetFor(c: Challenge): Partial<LensParams> {
  const f = 10;
  switch (c.id) {
    case 'CH-O2-01':
      return { f, u: 30, screenX: 15 };
    case 'CH-O2-02':
      return { f, u: 20, screenX: 20 };
    case 'CH-O2-03':
      return { f, u: 30, screenX: 15 };
    case 'CH-O2-04':
      return { f, u: 30, screenX: 15, maskTop: false };
    case 'CH-O2-05':
      return { f, u: 30, screenX: 15 };
    default:
      return { f, u: 30, screenX: 15 };
  }
}
