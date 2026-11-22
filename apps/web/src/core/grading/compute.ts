/**
 * D1 / D2 / D3 的本地计算
 *
 * 三个维度全部由这一层算死，AI 碰不到（铁律 1）。
 *
 *   computeLocalScores(...)   一次算齐 D1/D2/D3 + 变化表 V + 对照表 T
 *   assemblyComment(...) 等   AI 不可用时就靠这些模板（§4.1）
 *   *Band(score)              分数 → 显示档位（§1.2 / §1.3 / §1.4 各自的阈值）
 *
 * 评语模板对应文档 §1.2 / §1.3 / §1.4 的三张「分档与评语」表。
 */

import type { Band, ChangeRow, DimensionKey, RunFact, Rubric } from './types';
import {
  buildChanges,
  buildChecks,
  scoreAssembly,
  scoreObservation,
  scoreVariables,
  fmt,
} from './rules';
import { observationLabel } from './rubric';
import type { GradingInput } from './types';

/* ============================================================
 * 1. 三张分数的本地计算
 * ========================================================== */

export interface LocalScores {
  assembly: { score: number; facts: string[]; fromFactId: string | null };
  observation: { score: number | null; hits: string[]; bonus: string[]; reason?: 'insufficient' };
  variables: { score: number | null; clean: number; dirty: number; reason?: 'insufficient' };
}

/** 器具 kind → 人看得懂的名字。评语里不能出现 `lens_bench` 这种 id */
const KIND_LABEL: Record<string, string> = {
  lens_bench: '凸透镜光具座',
  laser: '激光光源',
  detector: '光电探测器',
  aperture: '光阑',
  optical_filter: '滤光片',
  mirror: '反射镜',
  lens: '透镜',
  screen: '光屏',
  battery: '电源',
  resistor: '电阻',
  ammeter: '电流表',
  voltmeter: '电压表',
  capacitor: '电容',
  ground: '接地',
  body: '小球',
  box: '木块',
  floor_slab: '地面',
  anchor: '固定点',
  spring: '弹簧',
  rope: '绳',
  dynamometer: '测力计',
  motion_sensor: '运动传感器',
  distance_sensor: '距离传感器',
  speaker: '声源',
  directional_speaker: '指向性声源',
  microphone: '麦克风',
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

/** 参数名 → 评语里的中文短名 */
const PARAM_LABEL: Record<string, string> = {
  u: '物距 u',
  f: '焦距 f',
  h: '物高 h',
  screenX: '光屏位置',
  lensDiameter: '透镜口径',
  maskTop: '遮挡开关',
  mass: '质量',
  stiffness: '劲度系数',
  restLength: '原长',
  damping: '阻尼',
  angle: '倾角',
  friction: '摩擦系数',
  voltage: '电压',
  resistance: '电阻',
  capacitance: '电容',
  inductance: '电感',
  current: '电流',
  frequency: '频率',
  amplitude: '振幅',
  phase: '相位',
  gravity: '重力加速度',
};

export function paramLabel(name: string): string {
  return PARAM_LABEL[name] ?? name;
}

function invalidChannelCount(f: RunFact): number {
  return Object.values(f.channels).filter((c) => c.valid === false).length;
}

/**
 * D1：逐条记录都评一遍，取**最高**的那条。
 *
 * 理由：这一维问的是「实验搭得起来吗」。学生先摆空台拍了照、后来搭齐了，
 * 取最高才是对的；取最后一条会让「清空实验台再看读数」被误判成没搭。
 * 文档 §1.2 给的是单条记录的算法，这里是它在多条记录上的展开，公式本身没改。
 */
export function computeAssembly(
  facts: RunFact[],
  requiredKinds: string[],
): LocalScores['assembly'] {
  if (facts.length === 0) {
    return {
      score: 0,
      facts: ['实验台上没有任何器具'],
      fromFactId: null,
    };
  }
  let best: LocalScores['assembly'] = { score: -1, facts: [], fromFactId: null };
  for (const f of facts) {
    const r = scoreAssembly({
      componentCount: f.componentCount,
      kinds: f.kinds,
      requiredKinds,
      engineError: f.engineError,
      invalidChannels: invalidChannelCount(f),
    });
    if (r.score > best.score) best = { ...r, fromFactId: f.id };
  }
  return best;
}

export function computeObservation(
  rubric: Rubric | null,
  seen: string[],
): LocalScores['observation'] {
  if (!rubric) return { score: null, hits: [], bonus: [], reason: 'insufficient' };
  return scoreObservation(rubric.requiredObservations, rubric.optionalObservations, seen);
}

export function computeVariables(facts: RunFact[], labId: string): LocalScores['variables'] {
  return scoreVariables(buildChanges(facts, labId));
}

/** 一次算齐三张（外加对照表、变化表） */
export function computeLocalScores(args: {
  facts: RunFact[];
  rubric: Rubric | null;
  seen: string[];
  labId: string;
}): { scores: LocalScores; changes: ChangeRow[]; checks: ReturnType<typeof buildChecks> } {
  const changes = buildChanges(args.facts, args.labId);
  const checks = buildChecks(args.facts);
  const scores: LocalScores = {
    assembly: computeAssembly(args.facts, args.rubric?.requiredKinds ?? []),
    observation: computeObservation(args.rubric, args.seen),
    variables: scoreVariables(changes),
  };
  return { scores, changes, checks };
}

/* ============================================================
 * 2. 档位（每维一套阈值，见 §1.2 / §1.3 / §1.4）
 * ========================================================== */

export function assemblyBand(score: number | null): Band {
  if (score === null) return 'insufficient';
  if (score >= 100) return 'top';
  if (score >= 80) return 'ok';
  if (score > 20) return 'weak';
  return 'zero';
}

export function observationBand(score: number | null): Band {
  if (score === null) return 'insufficient';
  if (score >= 100) return 'top';
  if (score >= 67) return 'ok';
  if (score > 0) return 'weak';
  return 'zero';
}

export function variablesBand(score: number | null): Band {
  if (score === null) return 'insufficient';
  if (score >= 100) return 'top';
  if (score >= 60) return 'ok';
  if (score > 0) return 'weak';
  return 'zero';
}

/* ============================================================
 * 3. 本地评语模板（§4.1）
 *
 * 规矩（§5.3）：一句话、30–60 字、带至少一个 R/V/T 编号、
 * 不夸、不训、不用感叹号、**绝不**生成形似「帮你写好了」的句子。
 * ========================================================== */

function refsOf(...ids: Array<string | null | undefined>): string[] {
  return ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/** 找一条能代表「像距 / 弥散圆」的记录，评语里引用它 */
function sampleFact(facts: RunFact[]): RunFact | null {
  return facts[facts.length - 1] ?? null;
}

export function assemblyComment(
  input: GradingInput,
  scores: LocalScores,
  refs: string[],
): string {
  const a = scores.assembly;
  const fact = input.facts.find((f) => f.id === a.fromFactId) ?? sampleFact(input.facts);
  const evidence = a.facts[0] ?? '';
  if (a.score === 0) return '实验台上没有任何器具，这一关还没开始。先把器具放到台上再记录一次。';
  if (a.score <= 20) {
    return `引擎拒绝计算：${evidence.replace(/^引擎报错：/, '')}。先把连接和参数理清楚再看读数。`;
  }
  if (a.score < 80) {
    return `${evidence}。缺了它，这一关要读的量根本没有通道可读，后面的分数只能参考。`;
  }
  if (a.score < 100) {
    return `${evidence}。这一条不是做错了，是物理本身在那里没有定义。`;
  }
  const v = fact?.metrics.v;
  const blur = fact?.metrics.blurDiameter;
  const tail =
    v !== undefined && blur !== undefined
      ? `：${fact!.id} 的像距 ${fmt(v)} cm，弥散圆 ${fmt(blur)} cm`
      : '';
  return `器具齐全，引擎这套参数算得出结果${tail}。这一项是后面三项的前提。`;
}

export function observationComment(input: GradingInput, scores: LocalScores): string {
  const o = scores.observation;
  const req = input.challenge.requiredObservations;
  const reqText = req.map(observationLabel).join('、');
  if (o.score === null) {
    return req.length === 0
      ? '这一关要看的量都画在光线上，不在读数表里，本次不评观测项。'
      : `没有记录你这次盯了哪几个读数，这一项本次不评。勾一下「你实际看的是哪几个」就能评。`;
  }
  const miss = req.filter((k) => !o.hits.includes(k));
  if (o.score >= 100) {
    const f = sampleFact(input.facts);
    const bits = o.hits
      .map((k) => {
        const val = valueOf(f, k);
        return val ? `${observationLabel(k)} ${val}` : observationLabel(k);
      })
      .join('、');
    const bonus = o.bonus.length
      ? `另外还看了${o.bonus.map(observationLabel).join('、')}，这些是判定的旁证。`
      : '';
    const where = f ? `${f.id} 记到的` : '';
    return `你盯的是${where}${bits}，这几个正是这一关的直接依据。${bonus}`;
  }
  if (o.score === 0) {
    return `这一关要读的是${reqText}，目前一条都没有记录。先在实验台上把这几行读数找出来，再记录一次。`;
  }
  return `这一关要读的是${reqText}，还差${miss.map(observationLabel).join('、')}。漏了它，得出来的结论会少一半依据。`;
}

export function variablesComment(input: GradingInput, scores: LocalScores): string {
  const s = scores.variables;
  const changes = input.changes;
  if (s.score === null) return '只有一条记录，没法判断两次之间改了几个量，这一项本次不评。';
  if (s.score >= 100) {
    const c = changes[0];
    if (!c) return '每一对相邻记录都只动了一个量，读数变化能归因。';
    const what = c.changed.length > 0 ? c.changed.map(paramLabel).join('、') : '没有自变量';
    const exempt = c.exempt.length > 0 ? `，${c.exempt.map(paramLabel).join('、')}跟挪是承接需要` : '';
    return `${c.id}（${c.from}→${c.to}）只动了${what}${exempt}。所以这两条记录之间的差别只能归因于它。`;
  }
  if (s.score === 0) {
    const c = changes.find((x) => x.dirty);
    if (c) {
      return `${c.id}（${c.from}→${c.to}）同时改了 ${c.changed.length} 个量（${c.changed
        .map(paramLabel)
        .join('、')}），两次记录的差说不清是谁造成的。下一轮一次只改一个。`;
    }
    return '相邻两次记录之间参数完全一样，等于做了一次重复实验。重复实验有意义，但回答不了「改了什么会怎样」。';
  }
  const dirtyIds = changes.filter((x) => x.dirty).map((x) => x.id);
  const cleanIds = changes.filter((x) => !x.dirty).map((x) => x.id);
  return `${cleanIds.length ? `${cleanIds.join('、')} 是干净的` : '有几对'}${
    dirtyIds.length ? `；${dirtyIds.join('、')} 同时改了两个以上的量，这两条记录不能再用来说是谁让它变的` : ''
  }。下一轮固定一个量，只推另一个。`;
}

/* ============================================================
 * 4. 小工具：把某个后缀对应读数抄成「0.0000 cm」给人看
 * ========================================================== */

export function valueOf(f: RunFact | null, suffix: string): string {
  if (!f) return '';
  const metricMap: Record<string, { v?: number | null; unit: string; digits?: number; bool?: boolean }> =
    {
      v: { v: f.metrics.v, unit: 'cm' },
      m: { v: f.metrics.m, unit: '', digits: 4 },
      imageHeight: { v: f.metrics.imageHeight, unit: 'cm' },
      blurDiameter: { v: f.metrics.blurDiameter, unit: 'cm' },
      relativeIlluminance: { v: f.metrics.relativeIlluminance, unit: '', digits: 3 },
      screenHasImage: { v: null, unit: '', bool: f.metrics.screenHasImage },
      real: { v: null, unit: '', bool: f.metrics.real },
    };
  const hit = metricMap[suffix];
  if (!hit) return '';
  if (hit.bool !== undefined) return hit.bool ? '有' : '没有';
  if (hit.v === undefined) return '';
  const text = fmt(hit.v ?? null, hit.digits ?? 4);
  return hit.unit ? `${text} ${hit.unit}` : text;
}

/** 本地兜底 refs：AI 漏了编号时补上（§5.3 第 2 条） */
export function fallbackRefs(key: DimensionKey, input: GradingInput, scores: LocalScores): string[] {
  if (key === 'assembly') return refsOf(scores.assembly.fromFactId);
  if (key === 'observation') return refsOf(sampleFact(input.facts)?.id);
  if (key === 'variables') return refsOf(input.changes[0]?.id);
  // 结论：挑第一条 verdict = yes 的行
  return refsOf(input.checks.find((c) => c.verdict === 'yes')?.id);
}
