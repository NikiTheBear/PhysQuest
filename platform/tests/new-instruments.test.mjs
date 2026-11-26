import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, component, blankExperiment } from '../shared/catalog.js';
import { validateExperiment } from '../shared/workspace.js';
import { Simulation } from '../shared/physics.js';

const part = (kind, over = {}) =>
  component(kind, { ...over, params: { ...component(kind).params, ...over.params } });
const scene = (...components) => ({
  ...blankExperiment(),
  components,
  environment: { gravity: 0, damping: 0, speed: 1, collisions: false },
});

test('gas_piston 遵循理想气体状态方程 PV = nRT 与玻意耳/查理定律', () => {
  const g1 = part('gas_piston', { params: { moles: 1, volume: 0.024, temperature: 300, gamma: 1.4 } });
  const g2 = part('gas_piston', { params: { moles: 1, volume: 0.012, temperature: 300, gamma: 1.4 } });
  const g3 = part('gas_piston', { params: { moles: 1, volume: 0.024, temperature: 600, gamma: 1.4 } });
  const doc = validateExperiment(scene(g1, g2, g3));
  const ch = new Simulation(doc).readings.channels;

  const expectedP1 = (1 * 8.314462618 * 300) / 0.024 / 1000; // ≈ 103.93 kPa
  assert.ok(Math.abs(ch[g1.id + ':pressure'].value - expectedP1) < 1e-6);
  // 玻意耳定律：等温体积减半，压强翻倍
  assert.ok(Math.abs(ch[g2.id + ':pressure'].value / ch[g1.id + ':pressure'].value - 2) < 1e-6);
  // 查理定律：等容温度翻倍，压强翻倍
  assert.ok(Math.abs(ch[g3.id + ':pressure'].value / ch[g1.id + ':pressure'].value - 2) < 1e-6);
  // 内能 U = nRT/(γ-1)
  const expectedU1 = (1 * 8.314462618 * 300) / 0.4;
  assert.ok(Math.abs(ch[g1.id + ':internalEnergy'].value - expectedU1) < 1e-4);
});

test('pulley 遵循滑轮组拉力公式 F = mg / (n·η)', () => {
  const fixed = part('pulley', { params: { loadMass: 10, strands: 1, efficiency: 1, gravity: 10 } });
  const block = part('pulley', { params: { loadMass: 10, strands: 4, efficiency: 0.8, gravity: 10 } });
  const doc = validateExperiment(scene(fixed, block));
  const ch = new Simulation(doc).readings.channels;

  // 定滑轮（n=1, η=1）：不省力，拉力 = 100 N
  assert.ok(Math.abs(ch[fixed.id + ':effort'].value - 100) < 1e-6);
  // 4 股绳滑轮组（η=0.8）：理想拉力 25 N，实际拉力 25 / 0.8 = 31.25 N，实际省力倍数 3.2
  assert.ok(Math.abs(ch[block.id + ':idealEffort'].value - 25) < 1e-6);
  assert.ok(Math.abs(ch[block.id + ':effort'].value - 31.25) < 1e-6);
  assert.ok(Math.abs(ch[block.id + ':mechanicalAdvantage'].value - 3.2) < 1e-6);
  assert.equal(CATALOG.gas_piston.domain, 'thermodynamics');
  assert.equal(CATALOG.pulley.domain, 'mechanics');
});
