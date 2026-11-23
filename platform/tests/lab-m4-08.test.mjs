import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { challengeScene } from '../shared/challenge-scene.js';
import { Simulation } from '../shared/physics.js';

const folder = new URL('../experiments/', import.meta.url);
const ch = (sim, id) => (sim.readings.channels ?? {})[id]?.value;

async function open(seconds, tweak) {
  const doc = challengeScene(
    JSON.parse(await readFile(new URL('CH-K-M4-08.pqexp.json', folder), 'utf8')),
    'CH-K-M4-08',
  );
  if (tweak) tweak(doc);
  const sim = new Simulation(doc);
  sim.advance(seconds);
  sim.measure();
  return { doc, sim };
}

test('粘滞流体：速度按 v₀·e^(−ct/m) 衰减，且阻力系数越大衰减越快', async () => {
  // 1 kg、v0=10 m/s、c=2 kg/s → v(1)=10e⁻²≈1.353，v(2)=10e⁻⁴≈0.183
  const t1 = await open(1);
  assert.ok(Math.abs(ch(t1.sim, 'sensor') - 1.353) < 0.02, `1 s 后 ${ch(t1.sim, 'sensor')}`);
  const t2 = await open(2);
  assert.ok(Math.abs(ch(t2.sim, 'sensor') - 0.183) < 0.01, `2 s 后 ${ch(t2.sim, 'sensor')}`);

  // c=0.5 → v(1)=10e^−0.5≈6.065
  const slow = await open(1, (d) => (d.components.find((c) => c.kind === 'drag').params.linear = 0.5));
  assert.ok(Math.abs(ch(slow.sim, 'sensor') - 6.065) < 0.05, `c=0.5 时 1 s 后 ${ch(slow.sim, 'sensor')}`);

  // 速度应该单调下降（指数衰减，不是匀减速下直接归零）
  assert.ok(ch(t1.sim, 'sensor') > ch(t2.sim, 'sensor'));
});
