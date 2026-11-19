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
import PredictionCompare from './components/prediction/PredictionCompare';
import KnowledgeCards from './components/knowledge-cards/KnowledgeCards';
import { QuizModal, QuizResult } from './components/knowledge-cards/Quiz';
import ReportView from './components/report/ReportView';
import AITutor from './components/ai-tutor/AITutor';
import AISettings from './components/ai-tutor/AISettings';
import HelpGuide from './components/common/HelpGuide';
import MechanicsLab from './labs/mechanics/MechanicsLab';
import CircuitsLab from './labs/circuits/CircuitsLab';
import AcousticsLab from './labs/acoustics/AcousticsLab';
import { DEFAULT_MECHANICS, solveMechanics, type MechanicsParams } from './labs/mechanics/engine';
import { DEFAULT_CIRCUIT, solveCircuit, type CircuitParams } from './labs/circuits/engine';
import { DEFAULT_SOUND, type SoundParams } from './labs/acoustics/engine';
import { LabWorkHead, LabGateFooter } from './components/lab-workspace/LabChrome';
import FreeBuildLab, {
  type CaptureSnapshot,
} from './components/free-build/FreeBuildLab';
import {
  buildLensPqexp,
  buildMechanicsPqexp,
  buildCircuitPqexp,
  buildSoundPqexp,
} from './core/export-pqexp';
import type { KnowledgePrompt } from './data/knowledge-prompts';
import PromptDialog from './components/knowledge-prompts/PromptDialog';
import { loadAIConfig, type AIConfig } from './ai/client';
import type { AIAction } from './ai/prompts';
import { AUTO_CHALLENGES, CHALLENGES, KNOWLEDGE, quizForChallenge } from './data/content';
import { LABS, labById, type LabId } from './labs/registry';
import { EmptyPickLab, EmptyPickChallenge } from './components/common/EmptyStates';
import ResetPanel from './components/common/ResetPanel';

type View = 'map' | 'hub' | 'lab' | 'free' | 'cards' | 'report';
type Phase = 'predict' | 'explore' | 'gate' | 'compare' | 'quiz' | 'quizResult' | 'done';

const LAB_KEY = 'physquest.currentLab.v1';

/** 从 URL 读深链接参数，例如 ?lab=optics-lens&challenge=CH-O2-04&view=lab */
function readDeepLink() {
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      lab: q.get('lab'),
      challenge: q.get('challenge'),
      view: q.get('view') as 'map' | 'hub' | 'lab' | 'cards' | 'report' | null,
      clean: q.get('clean') === '1',
    };
  } catch {
    return { lab: null, challenge: null, view: null, clean: false };
  }
}

const DEEP = readDeepLink();

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  useTheme(theme);

  const [learner, setLearner] = useState(() => loadLearner());
  const [view, setView] = useState<View>(() => {
    if (DEEP.view) return DEEP.view;
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
  const [showHelp, setShowHelp] = useState(false);
  /** 第一次进入时是否显示提示条 */
  const [firstVisit, setFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem('physquest.visited.v1');
    } catch {
      return false;
    }
  });
  /** 实验台 → 自由搭建：一键搬过去的实验数据 */
  const [importedExp, setImportedExp] = useState<unknown | null>(null);
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
    // 自由搭建模式没有挑战，直接进工作台
    setView(meta.mode === 'free' ? 'free' : 'hub');
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

  /** 统一入口：把当前实验台的参数转成 .pqexp 并跳过去 */
  const sendToFreeBuild = useCallback(
    (which: 'lens' | 'mechanics' | 'circuits' | 'acoustics') => {
      const title = challenge?.title ?? '自由实验';
      const goal = challenge?.brief ?? '';
      let data: unknown;

      if (which === 'lens') data = buildLensPqexp(params, title, goal);
      else if (which === 'mechanics') data = buildMechanicsPqexp(mechParams, title, goal);
      else if (which === 'circuits') data = buildCircuitPqexp(circParams, title, goal);
      else data = buildSoundPqexp(soundParams, title, goal);

      setLabId('fieldlab');
      setView('free');
      setImportedExp(data);
      // 让 FreeBuildLab 的 effect 只读一次
      setTimeout(() => setImportedExp(null), 300);
    },
    [challenge, params, mechParams, circParams, soundParams],
  );

  /** 自由搭建：把「记录此刻」的快照存下来 */
  const handleCapture = useCallback((snap: CaptureSnapshot) => {
    setFreeRuns((prev) => [snap, ...prev].slice(0, 40));
    setToast(`已记录：「${snap.experiment.title}」   t = ${snap.time.toFixed(3)} s`);
  }, []);

  /** 自由搭建：用知识点提示词搭建 */
  const handleBuildKnowledge = useCallback(
    (knowledgeId: string, title: string, prompt: string) => {
      setPromptEntry(null);
      setLabId('fieldlab');
      setView('free');
      setBuildRequest({ knowledgeId, title, prompt });
      // 让 FreeBuildLab 的 effect 只在下次渲染读到一次
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
    setPhase(prediction !== null ? 'compare' : 'quiz');
    if (prediction === null) {
      setQuizItems(quizForChallenge(challenge));
      setPhase('quiz');
    }
  };

  const afterCompare = () => {
    if (!challenge) return;
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
                className={
                  view === 'lab' || view === 'cards' || view === 'report' ? 'active' : ''
                }
                onClick={() => setView('lab')}
                disabled={!lab || !challenge}
                title={!lab ? '先在知识地图里选一个模块' : !challenge ? '先选一个挑战' : undefined}
              >
                实验台
              </button>
              <button
                className={view === 'free' ? 'active' : ''}
                onClick={() => {
                  setLabId('fieldlab');
                  setView('free');
                }}
              >
                自由搭建
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
            <KnowledgeMap onOpenModule={openModule} onOpenKnowledge={openKnowledge} />
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
              setPhase('explore');
              setView('lab');
            }}
            onBackToMap={() => setView('map')}
          />
        )}

        {view === 'hub' && !lab && <EmptyPickLab onGoMap={() => setView('map')} />}

        {view === 'lab' && !challenge && (
          <EmptyPickChallenge lab={lab} onGoMap={() => setView('map')} onGoHub={() => setView('hub')} />
        )}

        {/* ===== 力学 / 电路 / 声学：走各自的通用实验台 ===== */}
        {view === 'lab' && challenge && currentLab?.id === 'mechanics' && (
          <>
            <LabWorkHead challenge={challenge} onCards={() => setView('cards')} onGate={() => setPhase('gate')} labTitle="力与运动" />
            <MechanicsLab params={mechParams} onChange={(p) => setMechParams((prev) => ({ ...prev, ...p }))} />
            <LabGateFooter
              onGate={() => setPhase('gate')}
              onToFree={() => sendToFreeBuild('mechanics')}
            />
          </>
        )}

        {view === 'lab' && challenge && currentLab?.id === 'circuits' && (
          <>
            <LabWorkHead challenge={challenge} onCards={() => setView('cards')} onGate={() => setPhase('gate')} labTitle="电路与电流" />
            <CircuitsLab params={circParams} onChange={(p) => setCircParams((prev) => ({ ...prev, ...p }))} />
            <LabGateFooter onGate={() => setPhase('gate')} onToFree={() => sendToFreeBuild('circuits')} />
          </>
        )}

        {view === 'lab' && challenge && currentLab?.id === 'acoustics' && (
          <>
            <LabWorkHead challenge={challenge} onCards={() => setView('cards')} onGate={() => setPhase('gate')} labTitle="声与波" />
            <AcousticsLab params={soundParams} onChange={(p) => setSoundParams((prev) => ({ ...prev, ...p }))} />
            <LabGateFooter onGate={() => setPhase('gate')} onToFree={() => sendToFreeBuild('acoustics')} />
          </>
        )}

        {view === 'lab' && challenge && (!currentLab || currentLab.id === 'optics-lens') && (
          <>
            <div className="work-head">
              <div>
                <span className="eyebrow">
                  {challenge.id} · 凸透镜成像
                </span>
                <h2>{challenge.title}</h2>
                <div className="brief">{challenge.brief}</div>
              </div>
              <div className="work-actions">
                <button className="btn-ghost btn-small" onClick={() => setView('cards')}>
                  看知识卡
                </button>
                {prediction === null && (
                  <button className="btn-ghost btn-small" onClick={() => setPhase('predict')}>
                    还没有预测
                  </button>
                )}
                <button className="btn-primary" onClick={() => setPhase('gate')}>
                  我满意了
                </button>
              </div>
            </div>

            <div className="split">
              <div>
                <CurveChart
                  params={params}
                  metrics={metrics}
                  highlight={activeSlider === 'u' ? 'u' : activeSlider === 'f' ? 'f' : null}
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

              <div className="lab-column">
                <LabStage
                  params={params}
                  stage="junior"
                  metrics={metrics}
                  showRays={showRays}
                  showVirtualExtensions={showVirtual}
                  onParamChange={patchParams}
                  fullscreenExtra={
                    <>
                      <CurveChart params={params} metrics={metrics} highlight={null} />
                      <ObservationPanel params={params} metrics={metrics} />
                    </>
                  }
                />
                <div style={{ marginTop: 18 }}>
                  <ObservationPanel params={params} metrics={metrics} />
                </div>

                <div className="panel" style={{ marginTop: 18 }}>
                  <div className="toggle-row" style={{ padding: 0 }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={showRays}
                        onChange={(e) => setShowRays(e.target.checked)}
                      />
                      三条特殊光线
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={showVirtual}
                        onChange={(e) => setShowVirtual(e.target.checked)}
                      />
                      虚像延长线
                    </label>
                    <span style={{ marginLeft: 'auto', color: 'var(--label-3)' }}>
                      黄 平行→焦点 · 蓝 过光心 · 粉 过焦点→平行
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'free' && (
          <FreeBuildLab
            staticMode={import.meta.env.VITE_STATIC_WORKBENCH === '1'}
            onCapture={handleCapture}
            buildRequest={buildRequest}
            onMessage={setToast}
            importExperiment={importedExp}
            aiConfig={aiConfig}
          />
        )}

        {view === 'cards' && (
          <>
            <div className="hub-head" style={{ paddingBottom: 16 }}>
              <span className="eyebrow">Knowledge Cards · 166 张</span>
              <h2>知识卡</h2>
              <p>
                每张卡两面：<b>正面</b>是给你读的知识点，<b>背面</b>是「怎么把它搭出来」。
                背面可以一键交给自由搭建工作台，让 AI 帮你搭好再去改。
              </p>
            </div>
            <KnowledgeCards
              onBuild={(prompt, title, knowledgeId) => {
                setLabId('fieldlab');
                setView('free');
                setBuildRequest({ knowledgeId, title, prompt });
                setTimeout(() => setBuildRequest(null), 100);
              }}
            />
          </>
        )}

        {view === 'report' && (
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
            onSendToLab={() => sendToFreeBuild('lens')}
          />
        )}

        {phase === 'compare' && locked && challenge && learner.predictions[challenge.id] && (
          <PredictionCompare
            challenge={challenge}
            prediction={learner.predictions[challenge.id]}
            metrics={metrics}
            onNext={afterCompare}
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
            setImportedExp(null);
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
            setImportedExp(null);
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
