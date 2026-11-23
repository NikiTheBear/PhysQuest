import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { challengeScene } from '../shared/challenge-scene.js';
import { Simulation } from '../shared/physics.js';

const folder = new URL('../experiments/', import.meta.url);
const ch = (sim, id) => (sim.readings.channels ?? {})[id]?.value;

async function open(id, seconds, tweak) {
  const doc = challengeScene(
    JSON.parse(await readFile(new URL(id + '.pqexp.json', folder), 'utf8')),
    id,
  );
  if (tweak) tweak(doc);
  const sim = new Simulation(doc);
  sim.advance(seconds);
  sim.measure();
  return { doc, sim };
}

test('磁铁两极：轴线比侧面强一个量级以上，距离越远越弱（E1-05）', async () => {
  const { sim } = await open('CH-K-E1-05', 0.05);
  const axis = ch(sim, 'pAxis:B');
  const side = ch(sim, 'pSide:B');
  const far = ch(sim, 'pFar:B');
  assert.ok(axis > 0.001, `轴线 0.4 m 应有可读磁场，实际 ${axis}`);
  assert.ok(axis > side * 10, '轴线应明显强于侧面');
  assert.ok(axis > far, '距离更远应更弱');
  assert.ok(far > 0, '远处仍有非零磁场');
});

test('自感：电感越大，电流爬得越慢（E3-13）', async () => {
  const small = await open('CH-K-E3-13', 0.02);
  const big = await open('CH-K-E3-13', 0.02, (d) => (d.components.find((c) => c.kind === 'inductor').params.inductance = 1000));
  const iSmall = ch(small.sim, 'load:I');
  const iBig = ch(big.sim, 'load:I');
  // τ=L/R：100 mH/10 Ω≈9.9 ms，20 ms 后约 0.515 A；1000 mH 时 τ≈99 ms，只有约 0.109 A
  assert.ok(iSmall > 0.4 && iSmall < 0.6, `L=100 mH 时 20 ms 后约 0.51 A，实际 ${iSmall}`);
  assert.ok(iBig < iSmall * 0.4, `L=1000 mH 时应慢得多，实际 ${iBig}`);
});

test('安培力：位移随电流反向而反向、随导线变长而变大（E2-14）', async () => {
  const base = await open('CH-K-E2-14', 4);
  const x = ch(base.sim, 'coil');
  assert.ok(x > 0.15, `音圈应被明显推开，实际 ${x}`);

  const reversed = await open('CH-K-E2-14', 4, (d) => (d.components.find((c) => c.kind === 'battery').params.voltage = -6));
  assert.ok(Math.abs(ch(reversed.sim, 'coil') + x) < 0.01, '电流反向位移应反向');

  const longer = await open('CH-K-E2-14', 4, (d) => (d.components.find((c) => c.kind === 'coil').params.length = 4));
  assert.ok(ch(longer.sim, 'coil') > x * 1.8, '导线加倍位移应约加倍');
});
