/**
 * D3（变量控制）用的「自变量 / 豁免项」表
 *
 * 内容照抄 local/AI-GRADING-SPEC.md §1.4 的表。
 *
 * 为什么要单独一个文件：`platform` 的 `CATALOG` 只有 min/max/step，
 * **没有**「这个参数是不是自变量」的信息，猜不出来，只能手写。
 *
 * 三条口径：
 *  1. `COUNTED` 里的参数改了 → 算「改了自变量」；
 *  2. `EXEMPT` 里的参数改了 → 记一笔，但不计入「改了几个自变量」；
 *  3. 两边都没有的参数 → **既不计数也不提**（例如光具座的 `objectShape`，
 *     它只换物体形状，引擎里根本不参与计算；见 engine.ts solve()）。
 */

/** 按实验台分组 */
export type LabParamsTable = {
  /** 改了就算改了自变量 */
  counted: string[];
  /** 改了但豁免（承接面、器材固有属性、初始条件、播放速度） */
  exempt: string[];
};

const OPTICS_COUNTED = ['u', 'f', 'h', 'lensDiameter', 'maskTop'];
const OPTICS_EXEMPT = [
  // 光屏是承接面，学生为了让像对上必须跟着挪它
  'screenX',
  // 摆器材不是改条件
  'position',
  'fixed',
  // 注意：`objectShape` 刻意两个表都不进 —— 它只换物体形状、不参与任何计算
  // （见 labs/optics-lens/engine.ts solve()），既不该算自变量，也不值得提醒学生。
];

const MECH_COUNTED = [
  'mass',
  'vx',
  'vy',
  'vz',
  'stiffness',
  'restLength',
  'damping',
  'angle',
  'friction',
];
const MECH_EXEMPT = ['position', 'fixed', 'restitution', 'length', 'width', 'height', 'depth', 'radius', 'spin'];

const CIRCUIT_COUNTED = ['voltage', 'resistance', 'capacitance', 'inductance', 'current', 'frequency'];
const CIRCUIT_EXEMPT = [
  // 内阻是器材固有属性
  'internal',
  // 初值是初始条件，通常一次设好后不动
  'initialVoltage',
  'initialCurrent',
  // 通电时间是「观察多久」，不是电路条件
  'time',
  'mode',
];

const ACOUSTICS_COUNTED = ['frequency', 'amplitude', 'phase', 'speed'];
const ACOUSTICS_EXEMPT = ['position', 'gain', 'radius'];

export const LAB_PARAMS: Record<string, LabParamsTable> = {
  'optics-lens': { counted: OPTICS_COUNTED, exempt: OPTICS_EXEMPT },
  mechanics: { counted: MECH_COUNTED, exempt: MECH_EXEMPT },
  circuits: { counted: CIRCUIT_COUNTED, exempt: CIRCUIT_EXEMPT },
  acoustics: { counted: ACOUSTICS_COUNTED, exempt: ACOUSTICS_EXEMPT },
};

/**
 * 环境参数也算自变量，但只有这两个。
 *
 * `environment.speed` 是**播放速度倍率**，不影响物理（physics.js 里按 DT×speed 推进时间），
 * 所以豁免 —— 注意它和声学器具参数里的 `speed`（声速 343 m/s）**同名不同物**：
 * 环境参数在 `RunFact.env` 里单独存，不会混。
 */
export const ENV_COUNTED = ['gravity', 'damping'];
export const ENV_EXEMPT = ['speed', 'collisions'];

/** 取某个实验台的规则。不认识的实验台 → 不计数（宁可少判，不要误判） */
export function paramsTableFor(labId: string): LabParamsTable {
  return LAB_PARAMS[labId] ?? { counted: [], exempt: [] };
}

export function isCounted(labId: string, name: string): boolean {
  return paramsTableFor(labId).counted.includes(name);
}

export function isExempt(labId: string, name: string): boolean {
  return paramsTableFor(labId).exempt.includes(name);
}
