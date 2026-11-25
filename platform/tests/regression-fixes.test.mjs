import test from 'node:test';
import assert from 'node:assert/strict';
import { component, blankExperiment } from '../shared/catalog.js';
import { Simulation } from '../shared/physics.js';
import { Circuit } from '../shared/circuit.js';

const part = (kind, over = {}) =>
  component(kind, { ...over, params: { ...component(kind).params, ...over.params } });

test('refract_plane 双向折射：反向入射时自动反转折射率比 n2/n1', () => {
  // 激光从右侧 (+2, 1, 0) 射向左侧 (-X)，界面法线角 45°（指向 +X/+Y），
  // 此时 facing = dot(dir, n) < 0，应按 n2 → n1（1.5 → 1.0）折射并远离法线。
  const source = part('laser', { position: [2, 1, 0], params: { angle: 180 } });
  const plane = part('refract_plane', { position: [0, 1, 0], params: { angle: 30, n1: 1, n2: 1.5 } });
  const doc = { ...blankExperiment(), components: [source, plane], environment: { gravity: 0, damping: 0, speed: 1, collisions: false } };
  const rays = new Simulation(doc).rays();
  const hit = rays.findIndex((r) => r.hit === plane.id);
  const next = rays[hit + 1];
  assert.ok(hit >= 0 && next, '反向激光应击中折射界面');
  const d = [next.to[0] - next.from[0], next.to[1] - next.from[1]];
  const len = Math.hypot(...d);
  const dir = [d[0] / len, d[1] / len];
  const n = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
  const outTilt = Math.acos(Math.min(1, Math.abs(dir[0] * n[0] + dir[1] * n[1])));
  const expected = Math.asin(1.5 * Math.sin(Math.PI / 6)); // sin(r) = 1.5 * 0.5 = 0.75
  assert.ok(Math.abs(outTilt - expected) < 1e-6, `反向折射角应为 ${expected} rad，实际 ${outTilt} rad`);
});

test('声学近场 1/r 衰减：0.4 m 处的声压幅值应为 0.8 m 处的 2 倍', () => {
  const spk = part('speaker', { position: [0, 0, 0], params: { frequency: 100, amplitude: 1, phase: 0, speed: 343 } });
  const doc = { ...blankExperiment(), components: [spk], environment: { gravity: 0, damping: 0, speed: 1, collisions: false } };
  const sim = new Simulation(doc);
  // 取相位正好在峰值处的时间点：sin(2π f (t - d/c)) = 1
  const t1 = 0.4 / 343 + 1 / (4 * 100);
  const t2 = 0.8 / 343 + 1 / (4 * 100);
  const p1 = Math.abs(sim.pressure([0.4, 0, 0], t1));
  const p2 = Math.abs(sim.pressure([0.8, 0, 0], t2));
  assert.ok(Math.abs(p1 / p2 - 2) < 1e-6, `近场 0.4 m / 0.8 m 声压比应为 2，实际 ${p1 / p2}`);
});

test('电路求解器容错：非法导线端口不崩溃且变阻器 ratio=0 不产生 NaN', () => {
  const bat = part('battery', { params: { voltage: 12, resistance: 1 } });
  const rheo = part('rheostat', { params: { resistance: 100, ratio: 0 } });
  const gnd = part('ground');
  const doc = {
    ...blankExperiment(),
    components: [bat, rheo, gnd],
    connections: [
      { id: 'w1', kind: 'wire', source: bat.id, sourcePort: 'a', target: rheo.id, targetPort: 'a' },
      { id: 'w2', kind: 'wire', source: rheo.id, sourcePort: 'b', target: bat.id, targetPort: 'b' },
      { id: 'w3', kind: 'wire', source: bat.id, sourcePort: 'b', target: gnd.id, targetPort: 'a' },
      // 故意加入一条指向不存在组件的悬空导线
      { id: 'w-bad', kind: 'wire', source: 'non-existent', sourcePort: 'a', target: bat.id, targetPort: 'a' },
    ],
  };
  const circuit = new Circuit(doc);
  assert.equal(circuit.error, null, '非法导线与 ratio=0 不应导致求解失败');
  assert.ok(Number.isFinite(circuit.readings[rheo.id].current), '电流应为有限数');
});
