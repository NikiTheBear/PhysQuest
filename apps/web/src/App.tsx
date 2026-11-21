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
  resetEverything,
  resetProgress,
} from './core/persistence';
import { applyTheme, loadTheme, saveTheme, useTheme, type Theme } from './core/theme';
import { solve } from './labs/optics-lens/engine';
import LabStage from './labs/optics-lens/LabStage';
import Hub from './components/hub/Hub';
import KnowledgeMap from './components/knowledge-map/KnowledgeMap';
import ControlPanel from './components/lab-workspace/ControlPanel';
import CurveChart from './components/lab-workspace/CurveChart';
import ObservationPanel from './components/lab-workspace/ObservationPanel';
import SatisfactionGate from './components/lab-workspace/SatisfactionGate';
import PredictionPanel from './components/prediction/PredictionPanel';
import { QuizModal, QuizResult } from './components/knowledge-cards/Quiz';
import ReportView from './components/report/ReportView';
import AITutor from './components/ai-tutor/AITutor';
import AISettings from './components/ai-tutor/AISettings';
import HelpGuide from './components/common/HelpGuide';
import QuizBank from './components/quiz-bank/QuizBank';
import QuizPicker from './components/quiz-bank/QuizPicker';
import MechanicsLab from './labs/mechanics/MechanicsLab';
import CircuitsLab from './labs/circuits/CircuitsLab';
import AcousticsLab from './labs/acoustics/AcousticsLab';
import { DEFAULT_MECHANICS, solveMechanics, type MechanicsParams } from './labs/mechanics/engine';
import { DEFAULT_CIRCUIT, solveCircuit, type CircuitParams } from './labs/circuits/engine';
import { DEFAULT_SOUND, type SoundParams } from './labs/acoustics/engine';
import { LabWorkHead, LabGateFooter } from './components/lab-workspace/LabChrome';
import ImmersiveLab, {
  type CaptureSnapshot,
} from './components/free-build/ImmersiveLab';
import type { KnowledgePrompt } from './data/knowledge-prompts';
import PromptDialog from './components/knowledge-prompts/PromptDialog';
import { loadAIConfig, type AIConfig } from './ai/client';
import type { AIAction } from './ai/prompts';
import { AUTO_CHALLENGES, CHALLENGES, KNOWLEDGE, quizForChallenge } from './data/content';
import { LABS, labById, type LabId } from './labs/registry';
import { EmptyPickLab, EmptyReport } from './components/common/EmptyStates';
import ResetPanel from './components/common/ResetPanel';

type View = 'map' | 'hub' | 'lab' | 'quiz-bank' | 'report';
type Phase = 'predict' | 'explore' | 'gate' | 'quiz' | 'quizResult' | 'done';

const LAB_KEY = 'physquest.currentLab.v1';

/** 从 URL 读深链接参数，例如 ?lab=optics-lens&challenge=CH-O2-04&view=lab */
function readDeepLink() {
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      lab: q.get('lab'),
      challenge: q.get('challenge'),
      view: q.get('view'),
      clean: q.get('clean') === '1',
      help: q.get('help'),
    };
  } catch {
    return { lab: null, challenge: null, view: null, clean: false, help: null };
  }
}

const DEEP = readDeepLink();

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  useTheme(theme);

  const [learner, setLearner] = useState(() => loadLearner());
  const [view, setView] = useState<View>(() => {
    const v = DEEP.view as string | null;
    if (v === 'cards') return 'map'; // 知识卡已并入知识地图
    if (v === 'map' || v === 'hub' || v === 'lab' || v === 'quiz-bank' || v === 'report') {
      return v as View;
    }
    if (DEEP.challenge) return 'lab';
    return 'map';
  });
  /** ★ 当前选定的实验模块。null = 还没从知识地图选过，此时一切空状态 */
  const [labId, setLabId] = useState<LabId | null>(() => {
    // URL 里明确指定了就用它 —— 即使带 clean=1 也一样
    const fromUrl = labById(DEEP.lab);
    if (fromUrl) return fromUrl.id;
    if (DEEP.clean) return null;
    const v = localStorage.getItem(LAB_KEY);
    return labById(v) ? (v as LabId) : null;
  });
  const lab = labById(labId);
  /** ★ 不再默认给第一个挑战，而是 null */
  const [challenge, setChallenge] = useState<Challenge | null>(() => {
    if (!DEEP.challenge) return null;
    const hand = CHALLENGES.find((c) => c.id === DEEP.challenge);
    if (hand) return hand;
    // 自动挑战（CH-AUTO-xxx / CH-AC-xx）也能通过 URL 直接打开
    const auto = AUTO_CHALLENGES.find((c) => c.id === DEEP.challenge);
    if (!auto) return null;
    return {
      id: auto.id,
      labId: auto.labId,
      title: auto.title,
      brief: auto.brief,
      hint: auto.hint,
      winCondition: { metric: 'm', op: '<', value: 0 },
      multiAnswer: true,
      knowledgeIds: auto.knowledgeIds,
      misconceptionIds: auto.misconceptionIds,
      demoScriptId: '',
      difficulty: 'beginner',
      prediction: auto.prediction,
    };
  });
  const [phase, setPhase] = useState<Phase>('explore');
  const [params, setParams] = useState<LensParams>(DEFAULT_LENS_PARAMS);
  const [activeSlider, setActiveSlider] = useState<keyof LensParams | null>(null);
  const [showRays, setShowRays] = useState(true);
  const [showVirtual, setShowVirtual] = useState(true);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [locked, setLocked] = useState<LockedRun | null>(null);
  const [quizItems, setQuizItems] = useState<QuizItem[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<
    Record<string, { correct: boolean; chosen: number | string }>
  >({});
  const [reflection, setReflectionDraft] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiWidth, setAiWidth] = useState(() => {
    const v = Number(localStorage.getItem('physquest.ai.width.v1'));
    return Number.isFinite(v) && v >= 340 && v <= 760 ? v : 420;
  });
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => loadAIConfig());
  const [showReset, setShowReset] = useState(false);
  /* 三套新实验台的状态 */
  const [mechParams, setMechParams] = useState<MechanicsParams>(DEFAULT_MECHANICS);
  const [circParams, setCircParams] = useState<CircuitParams>(DEFAULT_CIRCUIT);
  const [soundParams, setSoundParams] = useState<SoundParams>(DEFAULT_SOUND);
  /** 全站唯一的 AI 设置入口（顶栏齿轮打开） */
  const [showAISettings, setShowAISettings] = useState(false);
  // ?help=1 可以直接打开教程页（方便分享链接）
  const [showHelp, setShowHelp] = useState(() => DEEP.help === '1');
  /** 题库：选题 or 做题 */
  const [quizStage, setQuizStage] = useState<'pick' | 'doing'>('pick');
  const [quizPicked, setQuizPicked] = useState<string[]>([]);
  /** 题库完成情况，报告闸门要用 */
  const [quizCompleted, setQuizCompleted] = useState<{
    answered: number;
    correct: number;
    wrongIds: string[];
  } | null>(null);
  /** 第一次进入时是否显示提示条 */
  const [firstVisit, setFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem('physquest.visited.v1');
    } catch {
      return false;
    }
  });
  /** 自由搭建：想用哪个知识点的提示词去搭 */
  const [buildRequest, setBuildRequest] = useState<{
    knowledgeId: string;
    title: string;
    prompt: string;
  } | null>(null);
  /** 自由搭建：提示词弹层 */
  const [promptEntry, setPromptEntry] = useState<KnowledgePrompt | null>(null);
  const [toast, setToast] = useState('');
  /** 自由搭建的记录（和挑战那套分开存） */
  const [freeRuns, setFreeRuns] = useState<CaptureSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem('physquest.freebuild.v1');
      return raw ? (JSON.parse(raw) as CaptureSnapshot[]) : [];
    } catch {
      return [];
    }
  });

  const metrics = useMemo(() => solve(params), [params]);
  /** 当前模块（可能为 null） */
  const currentLab = lab;
  const weak = useMemo(() => weakMisconceptions(learner), [learner]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('physquest.freebuild.v1', JSON.stringify(freeRuns.slice(-40)));
    } catch {
      /* 存不下就算了 */
    }
  }, [freeRuns]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (labId) localStorage.setItem(LAB_KEY, labId);
    else localStorage.removeItem(LAB_KEY);
  }, [labId]);

  /* clean=1：给演示和截图用，打开就是全新状态。
     注意只是清存储，URL 参数照样生效 —— 否则没法截「某个特定状态」的图。 */
  useEffect(() => {
    if (DEEP.clean) {
      try {
        localStorage.clear();
        if (labId) localStorage.setItem(LAB_KEY, labId);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 选定模块 → 进挑战导览 */
  const openModule = useCallback((id: string) => {
    const meta = labById(id);
    if (!meta) return;
    setLabId(meta.id);
    setChallenge(null);
    setPrediction(null);
    setLocked(null);
    setParams(meta.defaultParams ?? DEFAULT_LENS_PARAMS);
    setView('hub');
  }, []);

  /** 从知识点直接进实验台：找到包含这个知识点的挑战，参数跳到卡片给的预设 */
  const openKnowledge = useCallback(
    (knowledgeId: string) => {
      const card = KNOWLEDGE.find((k) => k.id === knowledgeId);
      const ch = CHALLENGES.find((c) => c.knowledgeIds.includes(knowledgeId));
      if (!card || !ch) return;
      const meta = labById('optics-lens');
      if (!meta) return;
      setLabId(meta.id);
      setChallenge(ch);
      setParams({ ...(meta.defaultParams ?? DEFAULT_LENS_PARAMS), ...card.labPreset });
      setPrediction(learner.predictions[ch.id]?.chosenIndex ?? null);
      setLocked(null);
      setPhase(learner.predictions[ch.id] ? 'explore' : 'predict');
      setReflectionDraft(learner.reflections[ch.id]?.text ?? '');
      setView('lab');
    },
    [learner],
  );

  const beginChallenge = useCallback(
    (c: Challenge) => {
      const meta = labById(labId ?? 'optics-lens');
      setChallenge(c);
      setParams({ ...(meta?.defaultParams ?? DEFAULT_LENS_PARAMS), ...presetFor(c) });
      setPrediction(learner.predictions[c.id]?.chosenIndex ?? null);
      setLocked(null);
      setPhase(learner.predictions[c.id] ? 'explore' : 'predict');
      setView('lab');
      setReflectionDraft(learner.reflections[c.id]?.text ?? '');
    },
    [learner, labId],
  );

  /** 从快照里读出凸透镜光具座的放大率（Fieldlab 的通道名是 `<id>:m`，label 含「放大率」） */
  const readMetric = (snap: CaptureSnapshot, metric: string): number | null => {
    const ch = snap.readings?.channels ?? {};
    for (const [key, val] of Object.entries(ch)) {
      if (!val || typeof val.value !== 'number' || val.valid === false) continue;
      if (key.endsWith(':' + metric)) return val.value;
    }
    return null;
  };

  const readMagnification = (snap: CaptureSnapshot): number | null => {
    const m = readMetric(snap, 'm');
    return m === null ? null : Math.abs(m);
  };

  /** 自由搭建：把「记录此刻」的快照存下来 */
  const handleCapture = useCallback((snap: CaptureSnapshot) => {
    setFreeRuns((prev) => [snap, ...prev].slice(0, 40));
    setToast(`已记录：「${snap.experiment.title}」   t = ${snap.time.toFixed(3)} s`);
  }, []);

  /** 用知识点提示词让 AI 搭 —— 直接进实验台（自由模式，不挂挑战） */
  const handleBuildKnowledge = useCallback(
    (knowledgeId: string, title: string, prompt: string) => {
      setPromptEntry(null);
      setChallenge(null);
      setPhase('explore');
      setBuildRequest({ knowledgeId, title, prompt });
      setView('lab');
      setTimeout(() => setBuildRequest(null), 100);
    },
    [],
  );

  const patchParams = useCallback((patch: Partial<LensParams>) => {
    setParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyAIAction = useCallback(
    (a: AIAction) => {
      if (a.type === 'mask') patchParams({ maskTop: a.value });
      else patchParams({ [a.type]: a.value } as Partial<LensParams>);
    },
    [patchParams],
  );

  const confirmPrediction = (chosen: number) => {
    if (!challenge) return;
    setPrediction(chosen);
    setLearner((s) => persistPrediction(s, challenge.id, chosen));
    setPhase('explore');
  };

  const confirmLock = () => {
    if (!challenge) return;
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
      challenge.misconceptionIds.forEach((id) => {
        next = hitMisconception(next, id);
      });
      return next;
    });
    // 锁定后直接进题库（不再弹「预测 vs 实际」对比）
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

  return (
    <>
      <div
        className={`app ${aiOpen ? 'with-dock' : ''}`}
        style={aiOpen ? ({ '--ai-w': `${aiWidth}px` } as React.CSSProperties) : undefined}
      >
        <div className="topbar">
          <div className="topbar-inner">
            <div className="brand" onClick={() => setView('map')}>
              <span className="logo">🔭</span>
              <div>
                <h1>探理实验室</h1>
                <small>PhysQuest</small>
              </div>
            </div>

            <div className="topnav">
              <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
                知识地图
              </button>
              <button
                className={view === 'hub' ? 'active' : ''}
                onClick={() => setView('hub')}
                disabled={!lab}
                title={!lab ? '先在知识地图里选一个模块' : undefined}
              >
                挑战导览
              </button>
              <button
                className={view === 'lab' ? 'active' : ''}
                onClick={() => {
                  // 直接进实验台：不挂挑战，从空白开始自己搭
                  setChallenge(null);
                  setPhase('explore');
                  setView('lab');
                }}
              >
                实验台
              </button>
              <button
                className={view === 'quiz-bank' ? 'active' : ''}
                onClick={() => setView('quiz-bank')}
              >
                题库
              </button>
              <button className={view === 'report' ? 'active' : ''} onClick={() => setView('report')}>
                我的报告
              </button>

              <button
                className="nav-icon"
                onClick={() => setShowHelp(true)}
                title="帮助（五分钟上手）"
                aria-label="帮助"
              >
                ?
              </button>

              <button
                className="nav-icon"
                onClick={() => setShowAISettings(true)}
                title="AI 设置（Key、端点、模型、用量）"
                aria-label="AI 设置"
              >
                ⚙
              </button>

              <button
                className="nav-icon"
                onClick={() => setShowReset(true)}
                title="重置"
                aria-label="重置"
              >
                ⟲
              </button>

              <div className="theme-toggle" style={{ marginLeft: 4 }}>
                {(
                  [
                    ['light', '☀'],
                    ['dark', '☾'],
                    ['auto', '◐'],
                  ] as Array<[Theme, string]>
                ).map(([t, icon]) => (
                  <button
                    key={t}
                    className={theme === t ? 'active' : ''}
                    onClick={() => {
                      setTheme(t);
                      saveTheme(t);
                    }}
                    title={t === 'auto' ? '跟随系统' : t === 'light' ? '日间' : '夜间'}
                  >
                    {icon}
                  </button>
                ))}
              </div>

            </div>
          </div>
        </div>

        {view === 'map' && (
          <>
            {firstVisit && (
              <div className="first-visit-hint">
                <span className="fv-icon">✦</span>
                <span className="fv-text">
                  <b>第一次来？</b> 先看三分钟怎么用，或者直接从下面挑一个模块开始也行。
                </span>
                <button
                  className="btn-primary btn-small"
                  onClick={() => {
                    setShowHelp(true);
                    setFirstVisit(false);
                    try {
                      localStorage.setItem('physquest.visited.v1', '1');
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  怎么看
                </button>
                <button
                  className="btn-ghost btn-small"
                  onClick={() => {
                    setFirstVisit(false);
                    try {
                      localStorage.setItem('physquest.visited.v1', '1');
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  直接开始
                </button>
              </div>
            )}
            <KnowledgeMap
              onOpenModule={openModule}
              onOpenKnowledge={openKnowledge}
              onBuild={handleBuildKnowledge}
            />
          </>
        )}

        {view === 'hub' && lab && (
          <Hub
            lab={lab}
            completed={learner.completed}
            weakMisconceptions={weak}
            onPick={beginChallenge}
            onPickAuto={(c) => {
              // 自动挑战 → 进自己模块的实验台，而不是直接跳 Fieldlab
              const targetLab = labById(c.labId);
              if (!targetLab) return;
              setLabId(targetLab.id);
              setChallenge({
                id: c.id,
                labId: c.labId,
                title: c.title,
                brief: c.brief,
                hint: c.hint,
                winCondition: { metric: 'm', op: '<', value: 0 },
                multiAnswer: true,
                knowledgeIds: c.knowledgeIds,
                misconceptionIds: c.misconceptionIds,
                demoScriptId: '',
                difficulty: 'beginner',
                prediction: c.prediction,
              });
              setPhase(c.prediction ? 'predict' : 'explore');
              setView('lab');
            }}
            onBackToMap={() => setView('map')}
          />
        )}

        {view === 'hub' && !lab && <EmptyPickLab onGoMap={() => setView('map')} />}

        {/* ===== 实验台：一个统一的全屏工作台 ===== */}
        {/* 有挑战 → 自动载入这个挑战的器具；没挑战 → 从空白开始自己搭 */}
        {view === 'lab' && (
          <ImmersiveLab
            key={challenge?.id ?? 'blank'}
            staticMode={import.meta.env.VITE_STATIC_WORKBENCH === '1'}
            loadExperiment={challenge?.id}
            challengeTitle={challenge?.title ?? '自由实验台'}
            challengeBrief={challenge?.brief ?? '不挂挑战，从空白开始自己搭；也可以让 AI 帮你搭'}
            phaseLabel={
              challenge ? (prediction === null ? '还没预测' : '探索中') : undefined
            }
            primaryAction={
              challenge
                ? prediction === null
                  ? { label: '先猜一下', onClick: () => setPhase('predict') }
                  : { label: '我满意了', onClick: () => setPhase('gate') }
                : null
            }
            buildRequest={buildRequest}
            onExit={() => {
              setPhase('explore');
              setView(challenge ? 'hub' : 'map');
            }}
            onCapture={(snap) => {
              handleCapture(snap);
              if (challenge) setPhase('gate');
            }}
            onMessage={setToast}
            aiConfig={aiConfig}
          />
        )}

        {view === 'quiz-bank' && quizStage === 'pick' && (
          <QuizPicker
            focusKnowledgeIds={challenge?.knowledgeIds}
            previous={quizCompleted}
            onBack={() => setView('map')}
            onStart={(ids) => {
              setQuizPicked(ids);
              setQuizStage('doing');
            }}
            onDone={(r) => {
              setQuizCompleted(r);
              setView('report');
            }}
          />
        )}

        {view === 'quiz-bank' && quizStage === 'doing' && (
          <QuizBank
            knowledgeIds={quizPicked}
            onBack={() => setQuizStage('pick')}
            onDone={(r) => {
              setQuizCompleted(r);
              setQuizStage('pick');
              setView('report');
            }}
          />
        )}

        {view === 'report' && learner.runs.length === 0 && (
          <>
            <div className="hub-head" style={{ paddingBottom: 18 }}>
              <span className="eyebrow">Learning Report</span>
              <h2>我的学习报告</h2>
              <p>报告是根据你的探索记录生成的。先去做一次实验。</p>
            </div>
            <EmptyReport onGoMap={() => setView('map')} />
          </>
        )}

        {view === 'report' && learner.runs.length > 0 && (
          <>
            <div className="hub-head" style={{ paddingBottom: 18 }}>
              <span className="eyebrow">Learning Report</span>
              <h2>我的学习报告</h2>
              <p>先写一句你自己的话，再生成报告。</p>
            </div>
            <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <ReportView
                learner={learner}
                reflectionText={reflection}
                challengeTitle={challenge?.title ?? '（未选择挑战）'}
                quizDone={quizCompleted !== null}
                quizResult={quizCompleted}
                onGoQuiz={() => {
                  setQuizStage('pick');
                  setView('quiz-bank');
                }}
                onReflection={(t) => {
                  setReflectionDraft(t);
                  if (challenge) setLearner((s) => persistReflection(s, challenge.id, t));
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

        {phase === 'predict' && challenge && (
          <PredictionPanel challenge={challenge} onLock={confirmPrediction} />
        )}

        {phase === 'gate' && challenge && (
          <SatisfactionGate
            challenge={challenge}
            metrics={metrics}
            onCancel={() => setPhase('explore')}
            onConfirm={confirmLock}
            onGoQuiz={() => {
              setQuizItems(quizForChallenge(challenge));
              setPhase('quiz');
            }}
          />
        )}

        {phase === 'quiz' && (
          <QuizModal items={quizItems} onSubmit={submitQuiz} onCancel={() => setPhase('explore')} />
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

      {promptEntry && (
        <PromptDialog
          entry={promptEntry}
          onClose={() => setPromptEntry(null)}
          onBuild={handleBuildKnowledge}
        />
      )}

      {toast && (
        <div className="pq-toast" role="status">
          {toast}
        </div>
      )}

      {showHelp && <HelpGuide onClose={() => setShowHelp(false)} />}

      {showAISettings && (
        <AISettings
          config={aiConfig}
          onSave={(c) => {
            setAiConfig(c);
            setShowAISettings(false);
          }}
          onClose={() => setShowAISettings(false)}
        />
      )}

      {showReset && (
        <ResetPanel
          stats={{
            runs: learner.runs.length,
            predictions: Object.keys(learner.predictions).length,
            completed: Object.keys(learner.completed).length,
            misconceptions: Object.keys(learner.misconceptions).length,
          }}
          onResetProgress={() => {
            setLearner(resetProgress());
            setChallenge(null);
            setPrediction(null);
            setLocked(null);
            setQuizItems([]);
            setQuizAnswers({});
            setReflectionDraft('');
            setFreeRuns([]);
            setBuildRequest(null);
            setPromptEntry(null);
            setPhase('explore');
            setView('map');
            setToast('学习进度已清除');
          }}
          onResetEverything={() => {
            setLearner(resetEverything());
            setLabId(null);
            setChallenge(null);
            setPrediction(null);
            setLocked(null);
            setQuizItems([]);
            setQuizAnswers({});
            setReflectionDraft('');
            setFreeRuns([]);
            setBuildRequest(null);
            setPromptEntry(null);
            setPhase('explore');
            setView('map');
            setAiConfig(loadAIConfig());
            setMechParams(DEFAULT_MECHANICS);
            setCircParams(DEFAULT_CIRCUIT);
            setSoundParams(DEFAULT_SOUND);
            setParams(DEFAULT_LENS_PARAMS);
            setToast('已全部清空');
          }}
          onClose={() => setShowReset(false)}
        />
      )}

      <AITutor
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        params={params}
        metrics={metrics}
        knowledgeTitle={
          challenge
            ? KNOWLEDGE.find((k) => challenge.knowledgeIds.includes(k.id))?.title
            : undefined
        }
        onApplyAction={applyAIAction}
        onConfigChange={setAiConfig}
        onWidthChange={setAiWidth}
        config={aiConfig}
      />

      {!aiOpen && (
        <button className="ai-fab" onClick={() => setAiOpen(true)} title="打开 AI 助教">
          ✦
        </button>
      )}
    </>
  );
}

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
