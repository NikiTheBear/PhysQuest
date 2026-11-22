import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/physics.js';
import { blankExperiment, component } from '../shared/catalog.js';

/** 一个无地面碰撞、从 y=5 自由释放的小球 */
function fallingBall(gravity, damping = 0) {
  const doc = blankExperiment('自由下落');
  doc.mode = '2d';
  doc.environment = { gravity, damping, speed: 1, collisions: false };
  doc.components.push(component('body', { position: [0, 5, 0] }));
  return doc;
}

test('重力 9.8：自由下落 1 秒位移约 4.9 m', () => {
  const doc = fallingBall(9.8);
  const sim = new Simulation(doc);
  sim.advance(1);
  const y = sim.bodies.get(doc.components[0].id).position[1];
  assert.ok(Math.abs(5 - y - 4.9) < 0.05, `位移 ${(5 - y).toFixed(3)} m 应接近 4.9 m`);
});

test('重力减半到 4.9：同样 1 秒位移约为一半', () => {
  const doc = fallingBall(4.9);
  const sim = new Simulation(doc);
  sim.advance(1);
  const y = sim.bodies.get(doc.components[0].id).position[1];
  assert.ok(Math.abs(5 - y - 2.45) < 0.05, `位移 ${(5 - y).toFixed(3)} m 应接近 2.45 m`);
});

test('阻尼 0 → 1：速度明显衰减（空气阻力生效）', () => {
  const doc = blankExperiment('阻尼');
  doc.mode = '2d';
  doc.environment = { gravity: 0, damping: 1, speed: 1, collisions: false };
  const ball = component('body', { position: [0, 5, 0] });
  ball.params.vx = 10;
  doc.components.push(ball);
  const sim = new Simulation(doc);
  sim.advance(1);
  const v = sim.bodies.get(ball.id).velocity[0];
  assert.ok(v < 9, `阻尼 1 时 1 秒后速度应衰减，实际 ${v.toFixed(2)} m/s`);
  assert.ok(v > 0, '速度不应反向');
});

test('运行中修改 environment.gravity 会立即作用到后续步（无需重建也能生效）', () => {
  const doc = fallingBall(9.8);
  const sim = new Simulation(doc);
  // 模拟 syncSimulation 的 else 分支：只替换 sim.doc，不重建世界
  sim.doc = structuredClone(doc);
  sim.doc.environment.gravity = 4.9;
  sim.advance(1);
  const y = sim.bodies.get(doc.components[0].id).position[1];
  assert.ok(Math.abs(5 - y - 2.45) < 0.05, `改重力后位移 ${(5 - y).toFixed(3)} m 应接近 2.45 m`);
});
