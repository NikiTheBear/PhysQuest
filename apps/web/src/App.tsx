import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Challenge,
  LearnerState,
  LensMetrics,
  LensParams,
  LockedRun,
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
import Hub from './components/hub/Hub';
import KnowledgeMap from './components/knowledge-map/KnowledgeMap';
import ControlPanel from './components/lab-workspace/ControlPanel';
import CurveChart from './components/lab-workspace/CurveChart';
import ObservationPanel from './components/lab-workspace/ObservationPanel';
import SatisfactionGate from './components/lab-workspace/SatisfactionGate';
import PredictionPanel from './components/prediction/PredictionPanel';
import ReportView, { LearnerBackupPanel } from './components/report/ReportView';
import { TeacherSummaryPanel } from './components/report/TeacherSummaryPanel';
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
import { AUTO_CHALLENGES, CHALLENGES, KNOWLEDGE, hasExperiment } from './data/content';
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

/** 参数键 → 中文名。用于「探索记录」里把 u / f / screenX 这种键翻成人话 */
const PARAM_LABEL: Record<string, string> = {
  // 光学
  u: '物距', f: '焦距', h: '物高', screenX: '光屏位置',
  lensDiameter: '透镜口径', maskTop: '遮住上半部', objectShape: '物体形状',
  // 力学
  mass: '质量', radius: '半径', stiffness: '劲度系数', restLength: '原长',
  damping: '阻尼', gravity: '重力加速度', friction: '摩擦系数', angle: '角度',
  // 电路
  voltage: '电动势', resistance: '电阻', current: '电流', power: '功率',
  // 声学
  frequency: '频率', amplitude: '声压幅值', phase: '相位', speed: '传播速度',
  // 热学
  temperature: '温度', responseTime: '响应时间', conductivity: '导热系数',
  length: '长度', area: '截面积', heatCapacity: '热容',
};

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
    // 自动挑战（编号由知识点派生，例如 CH-K-M2-05 / CH-AC-02）也能通过 URL 直接打开
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
  const [phase, setPhase] = useState<Phase>(() =>
    DEEP.challenge && !loadLearner().predictions[DEEP.challenge] ? 'predict' : 'explore',
  );
  const [params, setParams] = useState<LensParams>(DEFAULT_LENS_PARAMS);
  const [activeSlider, setActiveSlider] = useState<keyof LensParams | null>(null);
  const [showRays, setShowRays] = useState(true);
  const [showVirtual, setShowVirtual] = useState(true);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [locked, setLocked] = useState<LockedRun | null>(null);
  /** 锁定后给一条非阻断提示：建议去题库，但不强制 */
  const [lockedNotice, setLockedNotice] = useState(false);

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
  /**
   * 这一关有没有实验文件。
   *
   * 热学那 17 条「做不出来」的挑战（相变 / 气体 / 统计 / 辐射）故意没有 .pqexp.json。
   * 直接把它们塞进 iframe 会报「打开挑战失败：找不到实验文件」。
   * 用 useMemo 从 challenge 派生（不是 state），这样深链接、点卡片、任何路径都对。
   */
  const noExperiment = useMemo(
    () => Boolean(challenge && !hasExperiment(challenge.id)),
    [challenge],
  );

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

  /**
   * 清空实验台（含服务端）。
   *
   * 实验台的数据有两份：
   *   ① 工作台自己的 localStorage（key 是 `fieldlab-workspace`，不带 physquest. 前缀）
   *   ② 本地启动器的服务端（`platform/.local/workspaces%2Flocal-user.json`）
   * 顶栏「重置」只清 physquest.* 前缀的 key，所以这两份都清不到——
   * 这就是「重置后实验台还是老样子」的原因。
   *
   * 做法：
   *   ① 直接删 localStorage 里那个 key（工作台下次打开会重新拉服务端）
   *   ② 调启动器的 `/api/reset`（如果没有这个接口就退化成清空当前空间的器具）
   */
  const clearWorkbench = useCallback(async () => {
    try {
      localStorage.removeItem('fieldlab-workspace');
    } catch {
      /* 存不下就算了 */
    }
    try {
      // 启动器在 8787，会把这个请求转到 4317
      await fetch('/api/reset-workspace', { method: 'POST' });
    } catch {
      /* 启动器没起就算了，至少本地那份清了 */
    }
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

  /**
   * 导入学习记录之后：换上合并后的记录，并把当前挑战的反思草稿对齐。
   * localStorage 已由 importLearner 写好，这里只管界面状态。
   */
  const handleImported = useCallback(
    (next: LearnerState) => {
      setLearner(next);
      if (challenge) setReflectionDraft(next.reflections[challenge.id]?.text ?? '');
    },
    [challenge],
  );

  const confirmPrediction = (chosen: number) => {
    if (!challenge) return;
    setPrediction(chosen);
    setLearner((s) => persistPrediction(s, challenge.id, chosen));
    setPhase('explore');
  };

  /**
   * 锁定一次探索。
   *
   * ★ 关键修复：原来无论哪一关（电学、热学、声学…）都塞 `solve(params)` 的透镜度量，
   *   于是「电学实验」最后的结论写的是「倒立、缩小的实像」。
   *   现在按 challenge.labId 分开：
   *     - 光学关：记透镜度量（metrics）
   *     - 其它关：记最近一次「记录此刻」拿到的引擎读数（readings + summary）
   */
  const confirmLock = () => {
    if (!challenge) return;
    const isOptics = challenge.labId === 'optics-lens';
    const lastSnap = freeRuns[0];
    const snapChannels = lastSnap?.readings?.channels ?? {};
    const readings = Object.entries(snapChannels)
      .filter(([, v]) => v && typeof v.value === 'number' && v.valid !== false)
      .slice(0, 12)
      .map(([, v]) => ({ label: v.label, value: v.value, unit: v.unit }));

    const run: LockedRun = {
      challengeId: challenge.id,
      labId: challenge.labId,
      params: isOptics ? params : { ...(snapChannels ? {} : {}) },
      prediction: learner.predictions[challenge.id] ?? null,
      lockedAt: Date.now(),
    };

    if (isOptics) {
      run.metrics = {
        v: metrics.v,
        m: metrics.m,
        real: metrics.real,
        imageHeight: metrics.imageHeight,
        screenHasImage: metrics.screenHasImage,
        blurDiameter: metrics.blurDiameter,
        description: metrics.description,
      };
      run.summary = metrics.description;
    } else {
      // 非光学：参数和结论都来自实验台的真实读数，不掺透镜公式
      if (lastSnap) {
        const comps = lastSnap.experiment?.components ?? [];
        const p: Record<string, unknown> = {};
        for (const c of comps) {
          for (const [k, v] of Object.entries(c.params ?? {})) {
            if (typeof v === 'number' && Number.isFinite(v)) p[k] = v;
          }
        }
        run.params = p;
      }
      run.readings = readings;
      run.summary = readings.length
        ? readings.map((r) => `${r.label} ${Number(r.value.toFixed(3))} ${r.unit}`).join('，')
        : '这次锁定没有采到读数——回实验台点「记录此刻」再锁定。';
    }
    setLocked(run);
    setLearner((s) => {
      let next = pushRun(s, run);
      challenge.misconceptionIds.forEach((id) => {
        next = hitMisconception(next, id);
      });
      return next;
    });
    // ★ 锁定后不再强制做题。
    //   原来这里直接 setPhase('quiz') 弹题，学生刚做完实验就被推进题库，
    //   而且做的还是「这一关」的题，不是他自己挑的。
    //   现在只记一条锁定的记录，然后回实验台；要去做题由学生自己从顶栏进。
    setPhase('explore');
    setLockedNotice(true);
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
            challengeTitle={challenge?.title ?? '自由实验台'}
            challengeBrief={
              noExperiment && challenge
                ? challenge.brief
                : (challenge?.brief ?? '不挂挑战，从空白开始自己搭；也可以让 AI 帮你搭')
            }
            /* 没有实验文件的关（热学那 17 条做不出来的）：不传 loadExperiment，
               让工作台开一个空场景，而不是去请求一个不存在的文件报错 */
            loadExperiment={noExperiment ? undefined : challenge?.id}
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
            <div style={{ marginTop: 18, display: 'grid', gap: 16 }}>
              <LearnerBackupPanel
                learner={learner}
                onImported={handleImported}
                onToast={setToast}
              />
              <TeacherSummaryPanel onToast={setToast} />
            </div>
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
                onImported={handleImported}
                onToast={setToast}
              />
              <div className="panel">
                <h4>探索记录</h4>
                {learner.runs.length === 0 ? (
                  <div className="empty">还没有锁定任何参数</div>
                ) : (
                  <div className="run-list">
                    {learner.runs
                      .slice(-12)
                      .reverse()
                      .map((r, i) => {
                        // 手写关在 CHALLENGES，其余在 AUTO_CHALLENGES —— 两处都要查，
                        // 否则热学/电路那些关只显示一个 CH-K-T1-02 这样的编号
                        const ch =
                          CHALLENGES.find((c) => c.id === r.challengeId) ??
                          AUTO_CHALLENGES.find((c) => c.id === r.challengeId);
                        // 参数摘要：只挑数值型的键，翻成中文
                        const nums = Object.entries(r.params ?? {}).filter(
                          ([, v]) => typeof v === 'number' && Number.isFinite(v),
                        ) as Array<[string, number]>;
                        return (
                          <div className="run-item" key={`${r.challengeId}-${r.lockedAt}`}>
                            <div className="run-head">
                              <span className="run-no">#{learner.runs.length - i}</span>
                              <span className="run-title">{ch?.title ?? r.challengeId}</span>
                              <span className="run-time">
                                {new Date(r.lockedAt).toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {nums.length > 0 && (
                              <div className="run-params">
                                {nums.map(([k, v]) => (
                                  <span className="run-chip" key={k}>
                                    {PARAM_LABEL[k] ?? k} {Number(v.toFixed(2))}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="run-result">
                              {r.summary ?? r.metrics?.description ?? '（这条记录没有结论）'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
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

      {/* 锁定后的建议条：不阻断、不强制，学生想去才去 */}
      {lockedNotice && (
        <div className="lock-notice" role="status">
          <span className="ln-icon">✓</span>
          <span className="ln-text">
            参数已记录。建议去题库做几道这一关的题检验一下——不强制，你也可以继续调。
          </span>
          <button
            className="btn-primary btn-small"
            onClick={() => {
              setLockedNotice(false);
              // 只把这一关涉及的知识点带进选题页，不直接开做
              setQuizPicked(challenge?.knowledgeIds ?? []);
              setQuizStage('doing');
              setView('quiz-bank');
            }}
          >
            去做这几道题
          </button>
          <button
            className="btn-ghost btn-small"
            onClick={() => setLockedNotice(false)}
          >
            继续调
          </button>
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
            setReflectionDraft('');
            setFreeRuns([]);
            setBuildRequest(null);
            setPromptEntry(null);
            setPhase('explore');
            setView('map');
            // ★ 实验台的数据存在本地启动器（4317 服务端的 .local），
            //   只清 localStorage 是清不掉的。这里发一条消息让工作台自己清空。
            clearWorkbench();
            setToast('学习进度已清除（实验台也一并清空了）');
          }}
          onResetEverything={() => {
            setLearner(resetEverything());
            setLabId(null);
            setChallenge(null);
            setPrediction(null);
            setLocked(null);
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
            clearWorkbench();
            setToast('已全部清空（含实验台）');
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
