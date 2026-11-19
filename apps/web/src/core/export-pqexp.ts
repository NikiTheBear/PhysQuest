import type { LensParams } from './contracts';
import { solve } from '../labs/optics-lens/engine';
import { solveMechanics, type MechanicsParams } from '../labs/mechanics/engine';
import { solveCircuit, type CircuitParams } from '../labs/circuits/engine';
import { solveSound, type SoundParams } from '../labs/acoustics/engine';

/**
 * 把实验台状态导出成 Fieldlab 认的 .pqexp.json
 *
 * ★ 这个文件必须严格通过工作台的 validateExperiment()，
 *   否则导入会被拒，学生看到的就是「工作台里什么都没有」。
 *
 * 必须满足的硬条件（来自 platform/shared/workspace.js）：
 *   format === 'physquest.experiment' && version === 1
 *   experiment.mode ∈ ['2d','3d']
 *   experiment.environment: { gravity, damping, speed, collisions: boolean }
 *   experiment.control: { running: boolean, reset: number }
 *   component.refs 必须是对象
 *   component.fixed 必须是 boolean
 *   component.position 必须是三个 [-30,30] 内的数
 *   component.params 的键必须全部是 CATALOG[kind].params 里有的
 *   每个 param 的值必须在该参数的 [min,max] 之间
 */

interface PqexpComponent {
  id: string;
  kind: string;
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  params: Record<string, number>;
  refs: Record<string, string>;
  fixed: boolean;
}

function wrap(experiment: Record<string, unknown>) {
  return {
    format: 'physquest.experiment',
    version: 1,
    metadata: {
      title: experiment.title,
      description: experiment.goal,
      source: { project: 'PhysQuest', license: 'MIT' },
    },
    experiment,
  };
}

function makeExperiment(
  title: string,
  goal: string,
  observation: string,
  components: PqexpComponent[],
  env: { gravity: number; damping?: number; speed?: number; collisions?: boolean },
) {
  return {
    id: 'exp-' + Math.random().toString(36).slice(2, 10),
    title,
    goal,
    observation,
    mode: '2d' as const,
    environment: {
      gravity: clamp(env.gravity, 0, 25),
      damping: clamp(env.damping ?? 0, 0, 5),
      speed: clamp(env.speed ?? 1, 0.05, 4),
      collisions: env.collisions ?? false,
    },
    components,
    connections: [],
    control: { running: false, reset: 0 },
  };
}

const clamp = (v: number, lo: number, hi: number) =>
  !Number.isFinite(v) ? lo : Math.max(lo, Math.min(hi, v));

const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

/* ============================================================
 * 1. 凸透镜
 * ========================================================== */

export function buildLensPqexp(params: LensParams, title: string, goal: string) {
  const m = solve(params);

  const comp: PqexpComponent = {
    id: 'bench-1',
    kind: 'lens_bench',
    name: '凸透镜光具座',
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    params: {
      // CATALOG 里 lens_bench 的范围（见 platform/shared/catalog.js）
      u: clamp(params.u, 0.1, 100),
      f: clamp(params.f, 0.1, 40),
      h: clamp(params.h, 0.1, 10),
      screenX: clamp(params.screenX, 0, 150),
      lensDiameter: clamp(params.lensDiameter, 0.1, 20),
      maskTop: params.maskTop ? 1 : 0,
      objectShape: params.objectShape === 'arrow' ? 0 : params.objectShape === 'F' ? 1 : 2,
    },
    refs: {},
    fixed: true,
  };

  return wrap(
    makeExperiment(
      title,
      goal,
      `当前物距 ${params.u.toFixed(1)} cm、焦距 ${params.f.toFixed(1)} cm，像是${m.description}。试着改物距或换个透镜，看光屏上什么时候最清晰。`,
      [comp],
      { gravity: 0, collisions: false },
    ),
  );
}

/* ============================================================
 * 2. 力学
 *
 * 不能直接搬参数——力学实验台的参数（质量、斜面、时间）在 Fieldlab 里
 * 对应的是一组器具（刚体球 + 地面 + 可选斜面/弹簧）。
 * 所以这里按 mode 搭出对应的装置。
 * ========================================================== */

export function buildMechanicsPqexp(params: MechanicsParams, title: string, goal: string) {
  const m = solveMechanics(params);
  const comps: PqexpComponent[] = [];

  // 地面（几乎每种力学实验都需要）
  comps.push({
    id: 'floor-1',
    kind: 'floor_slab',
    name: '地面',
    position: [0, 0, 0],
    params: {
      length: 10,
      width: 10,
      friction: clamp(params.friction, 0, 1),
      restitution: 0.2,
    },
    refs: {},
    fixed: true,
  });

  if (params.mode === 'incline') {
    comps.push({
      id: 'ramp-1',
      kind: 'ramp',
      name: '可调斜面',
      position: [-1.5, 0.2, 0],
      params: {
        length: clamp(3, 0.5, 10),
        width: 1,
        angle: clamp(params.angle, -75, 75),
        friction: clamp(params.friction, 0, 1),
      },
      refs: {},
      fixed: true,
    });
    comps.push({
      id: 'box-1',
      kind: 'box',
      name: '方块',
      position: [-2.4, 0.4, 0],
      params: {
        mass: clamp(params.mass, 0.01, 100),
        vx: 0,
        vy: 0,
        vz: 0,
        width: 0.4,
        height: 0.4,
        depth: 0.4,
        angle: 0,
        spin: 0,
        friction: clamp(params.friction, 0, 1),
        restitution: 0.2,
      },
      refs: {},
      fixed: false,
    });
  } else if (params.mode === 'spring' || params.mode === 'oscillation') {
    comps.push({
      id: 'anchor-1',
      kind: 'anchor',
      name: '固定支点',
      position: [0, 3, 0],
      params: {},
      refs: {},
      fixed: true,
    });
    comps.push({
      id: 'body-1',
      kind: 'body',
      name: '振子',
      position: [0, 2, 0],
      params: { mass: clamp(params.mass, 0.01, 100), radius: 0.2, restitution: 0.2 },
      refs: {},
      fixed: false,
    });
    comps.push({
      id: 'spring-1',
      kind: 'spring',
      name: '弹簧',
      position: [0, 2.5, 0],
      params: {
        stiffness: clamp(params.stiffness, 0.1, 200),
        restLength: 1,
        damping: clamp(params.damping, 0, 5),
      },
      refs: { a: 'anchor-1', b: 'body-1' },
      fixed: false,
    });
  } else {
    // 自由落体 / 平抛 / 碰撞：只要一个球
    comps.push({
      id: 'body-1',
      kind: 'body',
      name: params.mode === 'projectile' ? '抛体' : '小球',
      position: [0, 3, 0],
      params: {
        mass: clamp(params.mass, 0.01, 100),
        radius: 0.2,
        restitution: 0.6,
        vx: params.mode === 'projectile' ? clamp(params.velocity, -20, 20) : 0,
        vy: 0,
        vz: 0,
      },
      refs: {},
      fixed: false,
    });
  }

  return wrap(
    makeExperiment(
      title,
      goal,
      `当前设置下：${m.description}。点运行看它动，然后试着改质量或重力，比较结果。`,
      comps,
      { gravity: clamp(params.gravity, 0, 25), collisions: true },
    ),
  );
}

/* ============================================================
 * 3. 电路
 * ========================================================== */

export function buildCircuitPqexp(params: CircuitParams, title: string, goal: string) {
  const m = solveCircuit(params);
  const comps: PqexpComponent[] = [];

  // 电源
  comps.push({
    id: 'battery-1',
    kind: 'battery',
    name: '直流电源',
    position: [-2, 1, 0],
    params: { voltage: clamp(params.emf, 0.1, 36), resistance: clamp(params.internal, 0, 10) },
    refs: {},
    fixed: true,
  });

  // 电阻 1
  comps.push({
    id: 'resistor-1',
    kind: 'resistor',
    name: 'R₁',
    position: [0, 2.2, 0],
    params: { resistance: clamp(params.r1, 0.01, 1000) },
    refs: {},
    fixed: false,
  });

  // 串联/并联时才有 R2
  if (params.mode !== 'closed') {
    comps.push({
      id: 'resistor-2',
      kind: 'resistor',
      name: 'R₂',
      position: [2, 2.2, 0],
      params: { resistance: clamp(params.r2, 0.01, 1000) },
      refs: {},
      fixed: false,
    });
  }

  // 电流表 / 电压表
  comps.push({
    id: 'ammeter-1',
    kind: 'ammeter',
    name: '电流表',
    position: [-2, -0.6, 0],
    params: {},
    refs: {},
    fixed: false,
  });
  comps.push({
    id: 'voltmeter-1',
    kind: 'voltmeter',
    name: '电压表',
    position: [0, -0.6, 0],
    params: {},
    refs: {},
    fixed: false,
  });
  comps.push({
    id: 'ground-1',
    kind: 'ground',
    name: '参考地',
    position: [2, -0.6, 0],
    params: {},
    refs: {},
    fixed: true,
  });

  return wrap(
    makeExperiment(
      title,
      goal,
      `当前：${m.description}。运行后读电流表和电压表，再改外阻，比较功率和效率怎么变。`,
      comps,
      { gravity: 0, collisions: false },
    ),
  );
}

/* ============================================================
 * 4. 声学
 * ========================================================== */

export function buildSoundPqexp(params: SoundParams, title: string, goal: string) {
  const m = solveSound(params);
  const comps: PqexpComponent[] = [];

  const isInterference = params.mode === 'interference';
  const isDirective = params.mode === 'directivity';

  // 声源
  comps.push({
    id: 'speaker-1',
    kind: isDirective ? 'directional_speaker' : 'speaker',
    name: isDirective ? '指向性声源' : '点声源',
    position: [-1.5, 1, 0],
    params: isDirective
      ? {
          frequency: clamp(params.frequency, 20, 2000),
          amplitude: clamp(params.amplitude, 0, 2),
          phase: 0,
          speed: clamp(params.speed, 50, 1500),
          angle: 0,
          directivity: 4,
        }
      : {
          frequency: clamp(params.frequency, 20, 2000),
          amplitude: clamp(params.amplitude, 0, 2),
          phase: 0,
          speed: clamp(params.speed, 50, 1500),
        },
    refs: {},
    fixed: true,
  });

  // 干涉模式：第二个源
  if (isInterference) {
    comps.push({
      id: 'speaker-2',
      kind: 'speaker',
      name: '点声源 2',
      position: [-1.5, 1 + clamp(params.sourceGap, 0.2, 3), 0],
      params: {
        frequency: clamp(params.frequency, 20, 2000),
        amplitude: clamp(params.amplitude, 0, 2),
        phase: 0,
        speed: clamp(params.speed, 50, 1500),
      },
      refs: {},
      fixed: true,
    });
  }

  // 麦克风
  comps.push({
    id: 'mic-1',
    kind: 'microphone',
    name: '测量麦克风',
    position: [
      clamp(-1.5 + params.micDistance, -29, 29),
      clamp(1 + params.micOffset, -29, 29),
      0,
    ],
    params: {},
    refs: {},
    fixed: false,
  });

  return wrap(
    makeExperiment(
      title,
      goal,
      `当前：${m.description}。点运行听声音，然后移动麦克风或改频率，看声压怎么变。`,
      comps,
      { gravity: 0, collisions: false },
    ),
  );
}

/* ============================================================
 * 兼容旧调用
 * ========================================================== */

export const buildPqexp = buildLensPqexp;

/** 触发下载（调试用，UI 走 postMessage 不下载） */
export function downloadPqexp(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[\\/:*?"<>|]/g, '_')}.pqexp.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
