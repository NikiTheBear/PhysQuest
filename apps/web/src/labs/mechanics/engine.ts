/**
 * 力学引擎
 *
 * 一个参数驱动的模型，覆盖 27 个力学知识点里能真算的那批：
 *   自由落体 / 斜面 / 弹簧 / 平抛 / 碰撞 / 简谐振动
 *
 * 纯函数，无状态。网页层调它算指标，实验台调它画图。
 */

export type MechanicsMode =
  | 'free-fall'
  | 'incline'
  | 'spring'
  | 'projectile'
  | 'collision'
  | 'oscillation';

export interface MechanicsParams {
  mode: MechanicsMode;
  /** 质量 kg */
  mass: number;
  /** 重力加速度 m/s² */
  gravity: number;
  /** 水平推力 / 拉力 N */
  force: number;
  /** 动摩擦因数 */
  friction: number;
  /** 斜面倾角 度 */
  angle: number;
  /** 弹簧劲度系数 N/m */
  stiffness: number;
  /** 初速度 m/s */
  velocity: number;
  /** 阻尼系数 N·s/m */
  damping: number;
  /** 经过的时间 s */
  time: number;
}

export interface MechanicsMetrics {
  /** 加速度 m/s² */
  acceleration: number;
  /** t 时刻速度 m/s */
  speed: number;
  /** t 时刻位移 m */
  displacement: number;
  /** 动能 J */
  kinetic: number;
  /** 重力势能 J（相对起点） */
  potential: number;
  /** 摩擦生热 J */
  frictionHeat: number;
  /** 总机械能 J */
  mechanical: number;
  /** 动量 kg·m/s */
  momentum: number;
  /** 做的功 J */
  work: number;
  /** 功率 W */
  power: number;
  /** 合外力 N */
  netForce: number;
  /** 是否已经停下 */
  stopped: boolean;
  /** 一句话描述 */
  description: string;
}

export const DEFAULT_MECHANICS: MechanicsParams = {
  mode: 'free-fall',
  mass: 1,
  gravity: 9.8,
  force: 0,
  friction: 0,
  angle: 30,
  stiffness: 15,
  velocity: 0,
  damping: 0.2,
  time: 1,
};

const RAD = Math.PI / 180;
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/* ============================================================
 * 各模式的加速度模型
 * ========================================================== */

/** 沿运动方向的合外力 */
function netForceOf(p: MechanicsParams, speed: number): number {
  const { mode, mass, gravity, force, friction, angle, stiffness, damping } = p;

  switch (mode) {
    // 自由落体：只有重力，忽略空气阻力
    case 'free-fall':
      return mass * gravity;

    // 斜面：沿斜面下滑分量 − 摩擦力
    case 'incline': {
      const g = mass * gravity;
      const along = g * Math.sin(angle * RAD);
      const normal = g * Math.cos(angle * RAD);
      const fric = friction * normal;
      return speed > 0 ? along - fric : Math.max(0, along - fric);
    }

    // 弹簧：F = −kx，用位移表示（这里把位移当作已拉伸量）
    case 'spring': {
      const x = p.velocity * p.time; // 粗略位移
      return -stiffness * x - damping * p.velocity + force;
    }

    // 平抛：水平方向只有推力，竖直方向单独算重力
    case 'projectile':
      return force;

    // 碰撞：这里只算水平方向的摩擦减速
    case 'collision': {
      const fric = friction * mass * gravity;
      return speed > 0 ? -fric : 0;
    }

    // 简谐振动：F = −kx − cv
    case 'oscillation': {
      const x = p.velocity * p.time;
      return -stiffness * x - damping * p.velocity + force;
    }

    default:
      return force;
  }
}

/* ============================================================
 * 主求解
 * ========================================================== */

export function solveMechanics(p: MechanicsParams): MechanicsMetrics {
  const { mass, gravity, velocity, time, mode, angle, stiffness } = p;
  const m = Math.max(mass, 1e-6);

  const netForce = netForceOf(p, velocity);
  const acceleration = netForce / m;

  // 匀加速近似（对简谐振动只是瞬时值，但足够做教学演示）
  let speed = velocity + acceleration * time;
  let displacement = velocity * time + 0.5 * acceleration * time * time;

  // 弹簧 / 振动模式：位移用拉伸量
  if (mode === 'spring' || mode === 'oscillation') {
    const omega = Math.sqrt(Math.max(stiffness, 1e-6) / m);
    displacement = (velocity / Math.max(omega, 1e-6)) * Math.sin(omega * time);
    speed = velocity * Math.cos(omega * time);
  }

  // 斜面：位移要投影到水平方向
  let horizontal = displacement;
  if (mode === 'incline') horizontal = displacement * Math.cos(angle * RAD);

  // 平抛：竖直方向是自由落体
  let verticalSpeed = 0;
  let height = 0;
  if (mode === 'projectile') {
    verticalSpeed = gravity * time;
    height = 0.5 * gravity * time * time;
    horizontal = velocity * time;
    speed = Math.hypot(velocity, verticalSpeed);
  }

  const kinetic = 0.5 * m * speed * speed;
  const potential = mode === 'projectile' ? m * gravity * height : 0;
  const frictionWork = Math.max(0, p.friction * m * gravity * Math.abs(horizontal));
  const work = Math.abs(netForce * horizontal);
  const power = time > 0 ? work / time : 0;

  const stopped = Math.abs(speed) < 1e-3 && Math.abs(acceleration) < 1e-3;

  return {
    acceleration: round(acceleration),
    speed: round(speed),
    displacement: round(horizontal),
    kinetic: round(kinetic),
    potential: round(potential),
    frictionHeat: round(frictionWork),
    mechanical: round(kinetic + potential),
    momentum: round(m * speed),
    work: round(work),
    power: round(power),
    netForce: round(netForce),
    stopped,
    description: describe(p, acceleration, speed, horizontal),
  };
}

function describe(p: MechanicsParams, a: number, v: number, x: number): string {
  switch (p.mode) {
    case 'free-fall':
      return `自由落体：${p.time.toFixed(1)} 秒下落 ${Math.abs(x).toFixed(1)} m，速度 ${Math.abs(v).toFixed(1)} m/s`;
    case 'incline': {
      const moving = a > 0.01;
      return moving
        ? `沿 ${p.angle}° 斜面下滑，加速度 ${a.toFixed(1)} m/s²`
        : `摩擦力足够大，物体静止在 ${p.angle}° 斜面上`;
    }
    case 'spring':
      return `弹簧拉伸 ${Math.abs(x).toFixed(2)} m，弹力 ${Math.abs(a * p.mass).toFixed(1)} N`;
    case 'projectile':
      return `平抛：水平飞 ${Math.abs(x).toFixed(1)} m，竖直落下 ${(0.5 * p.gravity * p.time ** 2).toFixed(1)} m`;
    case 'collision':
      return Math.abs(v) > 0.01
        ? `碰撞后以 ${Math.abs(v).toFixed(1)} m/s 继续滑行`
        : '碰撞后摩擦把速度吃光，停下了';
    case 'oscillation':
      return `简谐振动：周期 ${(2 * Math.PI * Math.sqrt(p.mass / Math.max(p.stiffness, 1e-6))).toFixed(2)} s`;
    default:
      return '';
  }
}

/* ============================================================
 * 给图表用的采样
 * ========================================================== */

export interface SamplePoint {
  t: number;
  v: number;
  x: number;
}

export function sampleMechanics(p: MechanicsParams, points = 80): SamplePoint[] {
  const out: SamplePoint[] = [];
  for (let i = 0; i <= points; i++) {
    const t = (p.time * i) / points;
    const r = solveMechanics({ ...p, time: t });
    out.push({ t: round(t, 3), v: r.speed, x: r.displacement });
  }
  return out;
}
