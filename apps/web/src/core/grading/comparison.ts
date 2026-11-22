/**
 * 读数对照表
 *
 * 两件事：
 *   1. 把 `CaptureSnapshot` / `LockedRun` 归一成 `RunFact`（D1/D3 的唯一证据形状）；
 *   2. 把 facts / changes / checks 排成三张 Markdown 表 —— 也就是
 *      文档 §3.3 里 AI 唯一能引用的那三张表（读数表 R、变化表 V、对照表 T）。
 *
 * **表里的数字全部来自引擎**，这里只做格式化和排版本，一个数都不算。
 */

import type { CaptureSnapshot } from '../../components/free-build/ImmersiveLab';
import type { LensParams, LockedRun } from '../contracts';
import { fmt } from './rules';
import type { ChangeRow, ChannelReading, CheckRow, RunFact } from './types';

/* ============================================================
 * 1. 快照的形状（运行时比类型里多几个字段）
 *
 * `experiment.source` / `readings.circuit` / `focus` 在工作台的真实快照里
 * 是有的（platform/web/app.js:401 / :454），只是 TS 类型没声明（§2.4 缺口 2）。
 * 这次不改 ImmersiveLab.tsx 的类型，在评分侧用结构化类型接住它们。
 * ========================================================== */

interface SnapshotExtras {
  experiment?: {
    components?: Array<{
      id?: string;
      name?: string;
      kind?: string;
      params?: Record<string, unknown>;
      fixed?: boolean;
    }>;
    source?: { challengeId?: string; openedChallenge?: string; [k: string]: unknown };
    /** 工作台的环境参数（重力 / 阻尼 / 播放速度）。`doc().environment` 里有 */
    environment?: Record<string, unknown>;
  };
  readings?: {
    channels?: Record<string, { label?: string; value?: unknown; unit?: string; valid?: boolean }>;
    circuit?: { warnings?: string[]; error?: string | null };
  };
  /** 平台增量方案 A 采集的「当前选中通道」；现在还没有，有就用（§2.4 缺口 3） */
  focus?: string[];
}

/** 挑战 id → 这条快照属于哪个挑战（取不到就是 null） */
export function snapshotChallengeId(snap: CaptureSnapshot): string | null {
  const s = (snap as unknown as SnapshotExtras).experiment?.source;
  if (!s) return null;
  const id = s.openedChallenge ?? s.challengeId;
  return typeof id === 'string' && id ? id : null;
}

/** 快照里学生当前盯着的通道（后缀）。没有这个字段就返回空数组 */
export function snapshotFocus(snap: CaptureSnapshot): string[] {
  const focus = (snap as unknown as SnapshotExtras).focus;
  if (!Array.isArray(focus)) return [];
  const out: string[] = [];
  for (const key of focus) {
    if (typeof key !== 'string') continue;
    out.push(suffixOf(key));
  }
  return [...new Set(out)];
}

/** `<id>:m` → `m`；裸键 `<id>` → `<id>`（调用方再决定要不要用） */
export function suffixOf(channelKey: string): string {
  const i = channelKey.lastIndexOf(':');
  return i === -1 ? channelKey : channelKey.slice(i + 1);
}

function isLensChannel(key: string): boolean {
  return key.includes(':');
}

/* ============================================================
 * 2. 归一成 RunFact
 * ========================================================== */

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return undefined;
}

/** 通道表 → 扁平指标。`valid === false` 的数一律当「无定义」（缺口 5） */
export function extractMetrics(channels: Record<string, ChannelReading>): RunFact['metrics'] {
  const pick = (suffix: string): ChannelReading | undefined => {
    for (const [key, ch] of Object.entries(channels)) {
      if (!isLensChannel(key)) continue;
      if (suffixOf(key) === suffix) return ch;
    }
    return undefined;
  };
  const numberOrNull = (suffix: string): number | null | undefined => {
    const ch = pick(suffix);
    if (!ch) return undefined;
    if (ch.valid === false) return null;
    return Number.isFinite(ch.value) ? ch.value : null;
  };

  const out: RunFact['metrics'] = {};
  const v = numberOrNull('v');
  if (v !== undefined) out.v = v ?? undefined;
  const m = numberOrNull('m');
  if (m !== undefined) out.m = m;
  const ih = numberOrNull('imageHeight');
  if (ih !== undefined) out.imageHeight = ih;
  const blur = numberOrNull('blurDiameter');
  if (blur !== undefined && blur !== null) out.blurDiameter = blur;
  const rel = numberOrNull('relativeIlluminance');
  if (rel !== undefined && rel !== null) out.relativeIlluminance = rel;
  const real = pick('real');
  if (real) out.real = bool(real.value);
  const has = pick('screenHasImage');
  if (has) out.screenHasImage = bool(has.value);
  return out;
}

/** 从器具里认出光具座，把焦距物距一并带出来（评语直接引用） */
function lensOf(
  components: Array<{ kind?: string; params?: Record<string, unknown> }>,
): RunFact['lens'] | undefined {
  const bench = components.find((c) => c.kind === 'lens_bench');
  if (!bench?.params) return undefined;
  const p = bench.params;
  const u = num(p.u);
  const f = num(p.f);
  if (u === undefined || f === undefined) return undefined;
  const lens: NonNullable<RunFact['lens']> = { u, f };
  const h = num(p.h);
  if (h !== undefined) lens.h = h;
  const screenX = num(p.screenX);
  if (screenX !== undefined) lens.screenX = screenX;
  const lensDiameter = num(p.lensDiameter);
  if (lensDiameter !== undefined) lens.lensDiameter = lensDiameter;
  const maskTop = p.maskTop;
  if (maskTop !== undefined) lens.maskTop = Boolean(maskTop);
  return lens;
}

function toScalarParams(raw: Record<string, unknown> | undefined): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean' || typeof v === 'string') out[k] = v;
    // null / 对象 / 数组一律丢掉：D3 只比标量
  }
  return out;
}

export function factFromCapture(snap: CaptureSnapshot, index: number, id?: string): RunFact {
  const ex = (snap as unknown as SnapshotExtras).experiment;
  const components = ex?.components ?? [];
  const rawChannels = (snap as unknown as SnapshotExtras).readings?.channels ?? {};

  const channels: Record<string, ChannelReading> = {};
  for (const [key, ch] of Object.entries(rawChannels)) {
    const value = typeof ch?.value === 'number' && Number.isFinite(ch.value) ? ch.value : 0;
    channels[key] = {
      label: typeof ch?.label === 'string' ? ch.label : key,
      value,
      unit: typeof ch?.unit === 'string' ? ch.unit : '',
      valid: ch?.valid === false ? false : ch?.valid === true ? true : undefined,
    };
  }

  const params: Record<string, Record<string, number | boolean | string>> = {};
  for (const c of components) {
    const cid = c.id ?? `c${index}`;
    params[cid] = toScalarParams(c.params);
    if (c.fixed !== undefined) params[cid].fixed = Boolean(c.fixed);
  }

  const circuitError = circuitErrorOf(snap);

  // 环境参数：只有重力 / 阻尼算自变量，播放速度豁免（见 params.ts）
  const env: Record<string, number> = {};
  for (const [k, v] of Object.entries(ex?.environment ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) env[k] = v;
  }

  return {
    id: id ?? `R${index + 1}`,
    source: 'capture',
    at: typeof snap.time === 'number' && Number.isFinite(snap.time) ? snap.time : index,
    kinds: components.map((c) => c.kind ?? 'unknown'),
    componentCount: components.length,
    params,
    ...(Object.keys(env).length > 0 ? { env } : {}),
    channels,
    engineError: circuitError,
    lens: lensOf(components),
    metrics: extractMetrics(channels),
  };
}

/** 求解器报错：优先 `circuitError`，其次 `readings.circuit.error`（§1.2 的两个来源） */
export function circuitErrorOf(snap: CaptureSnapshot): string | null {
  const raw = snap as unknown as SnapshotExtras;
  const a = typeof snap.circuitError === 'string' && snap.circuitError.trim() ? snap.circuitError : null;
  if (a) return a;
  const b = raw.readings?.circuit?.error;
  return typeof b === 'string' && b.trim() ? b : null;
}

/**
 * `LockedRun` → RunFact
 *
 * 注意（§2.3 的坑）：`LockedRun.params` 是网页层的 `params`，**不是**学生在
 * iframe 里调到的位置。所以这条只用来兜底，D3 结论的可信度天然低一档。
 * 但 `metrics` 是锁定时用同一组 params 算的，内部自洽，可以放心用。
 */
export function factFromLocked(run: LockedRun, index: number, id?: string): RunFact {
  const cid = 'lens-bench';
  const p = run.params as LensParams;
  const params: Record<string, Record<string, number | boolean | string>> = {
    [cid]: toScalarParams(p as unknown as Record<string, unknown>),
  };
  const channels: Record<string, ChannelReading> = {
    [`${cid}:v`]: { label: '凸透镜光具座 · 像距', value: run.metrics.v, unit: 'cm' },
    [`${cid}:m`]: {
      label: '凸透镜光具座 · 放大率',
      value: run.metrics.m,
      unit: '倍',
      valid: Number.isFinite(run.metrics.m),
    },
    [`${cid}:imageHeight`]: {
      label: '凸透镜光具座 · 像高',
      value: run.metrics.imageHeight,
      unit: 'cm',
      valid: Number.isFinite(run.metrics.imageHeight),
    },
    [`${cid}:blurDiameter`]: { label: '凸透镜光具座 · 弥散圆', value: run.metrics.blurDiameter, unit: 'cm' },
    [`${cid}:screenHasImage`]: {
      label: '凸透镜光具座 · 光屏可见像',
      value: run.metrics.screenHasImage ? 1 : 0,
      unit: '0/1',
    },
    [`${cid}:real`]: { label: '凸透镜光具座 · 实像', value: run.metrics.real ? 1 : 0, unit: '0/1' },
  };

  return {
    id: id ?? `R${index + 1}`,
    source: 'locked',
    at: run.lockedAt,
    kinds: ['lens_bench'],
    componentCount: 1,
    params,
    channels,
    engineError: null,
    lens: {
      u: p.u,
      f: p.f,
      h: p.h,
      screenX: p.screenX,
      maskTop: p.maskTop,
      lensDiameter: p.lensDiameter,
    },
    metrics: {
      v: run.metrics.v,
      // Infinity 存进 localStorage 会变成 null（缺口 5）
      m: Number.isFinite(run.metrics.m) ? run.metrics.m : null,
      real: run.metrics.real,
      imageHeight: Number.isFinite(run.metrics.imageHeight) ? run.metrics.imageHeight : null,
      blurDiameter: run.metrics.blurDiameter,
      screenHasImage: run.metrics.screenHasImage,
      description: run.metrics.description,
    },
  };
}

/* ============================================================
 * 3. 三张表（Markdown）
 *
 * 排版照抄文档 §3.3，数字格式化规则写死在那里：
 *   v / imageHeight / blurDiameter / m 保留 4 位小数
 *   relativeIlluminance 保留 3 位
 *   布尔写「是 / 否」，null 写「无定义」
 * ========================================================== */

const yesNo = (v: boolean | undefined): string => (v === true ? '是' : v === false ? '否' : '—');

function timeCell(f: RunFact): string {
  if (f.source === 'capture') return `t=${fmt(f.at, 2)}s`;
  const d = new Date(f.at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function readingTableMarkdown(facts: RunFact[]): string[] {
  const lines: string[] = [];
  lines.push('| 编号 | 时间 | 物距u | 焦距f | 光屏位置 | 像距v | 放大率m | 像高 | 弥散圆 | 光屏有像 | 相对照度 | 实像 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const f of facts) {
    lines.push(
      `| ${[
        f.id,
        timeCell(f),
        f.lens ? fmt(f.lens.u, 1) : '—',
        f.lens ? fmt(f.lens.f, 1) : '—',
        f.lens?.screenX !== undefined ? fmt(f.lens.screenX, 1) : '—',
        f.metrics.v !== undefined ? fmt(f.metrics.v) : '—',
        f.metrics.m !== undefined ? fmt(f.metrics.m) : '—',
        f.metrics.imageHeight !== undefined ? fmt(f.metrics.imageHeight) : '—',
        f.metrics.blurDiameter !== undefined ? fmt(f.metrics.blurDiameter) : '—',
        yesNo(f.metrics.screenHasImage),
        f.metrics.relativeIlluminance !== undefined ? fmt(f.metrics.relativeIlluminance, 3) : '—',
        yesNo(f.metrics.real),
      ].join(' | ')} |`,
    );
  }
  return lines;
}

export function changeTableMarkdown(changes: ChangeRow[]): string[] {
  const lines: string[] = [];
  lines.push('| 编号 | 从 | 到 | 改了什么 | 独立变量改动数 |');
  lines.push('|---|---|---|---|---|');
  if (changes.length === 0) {
    lines.push('| — | — | — | 只有一条记录，没有可比较的两次 | — |');
    return lines;
  }
  for (const c of changes) {
    lines.push(
      `| ${c.id} | ${c.from} | ${c.to} | ${c.summary?.trim() ? c.summary : '没有改动任何自变量'} | ${c.changed.length} |`,
    );
  }
  return lines;
}

export function checkTableMarkdown(checks: CheckRow[]): string[] {
  const lines: string[] = [];
  lines.push('| 编号 | 命题 | 引擎判定 |');
  lines.push('|---|---|---|');
  for (const t of checks) {
    // 命题里有 `|m|` / `|v|`，竖线会把表格列冲散。转义成 \| 才是合法 Markdown，
    // 文档 §3.4 的例子就是这么写的。
    lines.push(`| ${t.id} | ${t.claim.replace(/\|/g, '\\|')} | ${t.verdict} |`);
  }
  return lines;
}
