import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { challengeScene } from '../shared/challenge-scene.js';
import { Simulation } from '../shared/physics.js';
import { HANDWRITTEN_LABS } from '../../scripts/handwritten-labs.mjs';

const folder = new URL('../experiments/', import.meta.url);
const ch = (sim, id) => (sim.readings.channels ?? {})[id]?.value;

async function open(id, seconds = 1, tweak) {
  const file = JSON.parse(await readFile(new URL(id + '.pqexp.json', folder), 'utf8'));
  const doc = challengeScene(file, id);
  if (tweak) tweak(doc);
  const sim = new Simulation(doc);
  sim.advance(seconds);
  sim.measure();
  return { doc, sim };
}

test('每条手写实验都能载入、步进，并写清观察指引', async () => {
  const files = new Set((await readdir(folder)).filter((n) => n.endsWith('.pqexp.json')));
  for (const lab of HANDWRITTEN_LABS) {
    assert.ok(files.has(lab.id + '.pqexp.json'), `${lab.id} 缺少实验文件`);
    const { doc } = await open(lab.id, 0.5);
    assert.ok(doc.observation && doc.observation.length > 20, `${lab.id} 缺少观察指引`);
    assert.ok(lab.observation && lab.observation.length > 20);
    // 部件名必须是人话，不能是英文 key
    for (const c of doc.components) assert.notEqual(c.name, c.kind, `${lab.id} 的 ${c.kind} 没写中文名`);
    // 概念示意必须在标题里说清楚，不能冒充真实验
    if (lab.tier === 'concept') assert.match(doc.goal, /概念示意/);
    else assert.doesNotMatch(doc.goal, /概念示意/);
  }
});

test('轮子省力：2 N 推不动滑块，滚轮会滚走；12 N 滑块才动', async () => {
  const { sim } = await open('CH-K-M1-07', 1.5);
  assert.ok(Math.abs(sim.bodies.get('slider').position[0] + 3) < 0.01, '滑块应该被摩擦锁住');
  assert.ok(sim.bodies.get('wheel').position[0] - 0.5 > 0.5, '滚轮应该滚出去');
  assert.ok(Math.abs(sim.bodies.get('wheel').angularVelocity[2]) > 1, '滚轮应该在转');

  const hard = await open('CH-K-M1-07', 1.5, (d) => {
    d.components.filter((c) => c.kind === 'force').forEach((f) => (f.params.fx = 12));
  });
  assert.ok(hard.sim.bodies.get('slider').position[0] + 3 > 1, '12 N 时滑块应该开始滑动');
});

test('力的三要素：只推 fx 只平动，只给 tz 只转动', async () => {
  const a = await open('CH-K-M2-03', 1);
  assert.ok(a.sim.bodies.get('crate').position[0] > 0.4, 'fx 应该推动质心');
  assert.ok(Math.abs(a.sim.bodies.get('crate').angularVelocity[2]) < 1e-6, '正对质心不应该转');

  const b = await open('CH-K-M2-03', 1, (d) => {
    const f = d.components.find((c) => c.kind === 'force');
    f.params.fx = 0;
    f.params.tz = 2;
  });
  assert.ok(Math.abs(b.sim.bodies.get('crate').position[0]) < 1e-3, '只给力矩不应该平动');
  assert.ok(Math.abs(b.sim.bodies.get('crate').angularVelocity[2]) > 5, '力矩应该让它转起来');
});

test('重力与支持力：测力计读数等于 mg', async () => {
  const one = await open('CH-K-M2-05', 6);
  assert.ok(Math.abs(ch(one.sim, 'scale') - 9.8) < 0.2, `1 kg 应读约 9.8 N，实际 ${ch(one.sim, 'scale')}`);
  const two = await open('CH-K-M2-05', 6, (d) => (d.components.find((c) => c.id === 'ball').params.mass = 2));
  assert.ok(Math.abs(ch(two.sim, 'scale') - 19.6) < 0.4, `2 kg 应读约 19.6 N，实际 ${ch(two.sim, 'scale')}`);
  // 箱子被地面托着，不往下掉
  assert.ok(Math.abs(one.sim.bodies.get('crate').position[1] - 0.25) < 0.01);
});

test('导体与绝缘体：换大电阻电流掉到微安级', async () => {
  const conductor = await open('CH-K-E1-02', 0.2);
  assert.ok(Math.abs(conductor.sim.circuit.readings.material.current - 2.4) < 0.05);
  const insulator = await open('CH-K-E1-02', 0.2, (d) => (d.components.find((c) => c.id === 'material').params.resistance = 1e7));
  assert.ok(Math.abs(insulator.sim.circuit.readings.material.current) < 1e-5);
});

test('焦耳定律：电压翻倍，功率变四倍', async () => {
  const six = await open('CH-K-E2-08', 0.2);
  const twelve = await open('CH-K-E2-08', 0.2, (d) => (d.components.find((c) => c.id === 'cell').params.voltage = 12));
  const ratio = twelve.sim.circuit.readings.load.power / six.sim.circuit.readings.load.power;
  assert.ok(Math.abs(ratio - 4) < 0.05, `功率应约 4 倍，实际 ${ratio}`);
});

test('家庭电路：断开一路，另一路电流不变', async () => {
  const both = await open('CH-K-E2-09', 0.2);
  const single = await open('CH-K-E2-09', 0.2, (d) => (d.components.find((c) => c.id === 'sw-b').params.closed = 0));
  const a1 = both.sim.circuit.readings['lamp-a'].current;
  const a2 = single.sim.circuit.readings['lamp-a'].current;
  assert.ok(Math.abs(a1 - a2) / a1 < 0.05, '并联支路应互不影响');
  assert.ok(Math.abs(single.sim.circuit.readings['lamp-b'].current) < 1e-9, '断开的支路应该没有电流');
});

test('电势差：探针读到场强，测距仪给出距离', async () => {
  const { sim } = await open('CH-K-E3-02', 0.2);
  assert.ok(Math.abs(ch(sim, 'probe') - 1000) < 1);
  assert.ok(Math.abs(ch(sim, 'ruler') - 1) < 0.01);
});

test('安培力：线圈被推开，电流反向则位移反向', async () => {
  const pos = await open('CH-K-E3-08', 4);
  const x1 = ch(pos.sim, 'coil');
  assert.ok(x1 > 0.1, `位移应明显大于零，实际 ${x1}`);
  const neg = await open('CH-K-E3-08', 4, (d) => (d.components.find((c) => c.id === 'cell').params.voltage = -6));
  assert.ok(Math.abs(ch(neg.sim, 'coil') + x1) < 0.01, '反向电流应给出相反位移');
});

test('光学：光阑缩孔让探测器变暗，凸透镜把离轴光收拢到焦点', async () => {
  const wide = await open('CH-K-O1-02', 0.2);
  const narrow = await open('CH-K-O1-02', 0.2, (d) => (d.components.find((c) => c.id === 'hole').params.opening = 0.05));
  assert.ok(ch(narrow.sim, 'screen') < ch(wide.sim, 'screen'), '孔变小应该更暗');

  const convex = await open('CH-K-O1-04', 0.2);
  assert.ok(ch(convex.sim, 'spot') > 0.5, '凸透镜应该把光收拢到焦点');
  const concave = await open('CH-K-O1-04', 0.2, (d) => {
    const l = d.components.find((c) => c.id === 'lens');
    l.kind = 'diverging_lens';
    l.params.focal = -1.5;
  });
  assert.ok(ch(concave.sim, 'spot') < 0.01, '凹透镜应该让光散开、打不到焦点');
});

test('折射规律：焦距越小，偏离光轴越快', async () => {
  const normal = await open('CH-K-O2-01', 0.2);
  assert.ok(ch(normal.sim, 'spot') > 0.3, 'f=1.5 时应打中探测器');
  const short = await open('CH-K-O2-01', 0.2, (d) => (d.components.find((c) => c.id === 'lens').params.focal = 0.8));
  assert.ok(ch(short.sim, 'spot') < 0.01, 'f=0.8 时偏折更大，应打不中');
});

test('光具座：遮挡只改变亮度，不改变像的位置；焦距不对焦就落到屏外', async () => {
  const clear = await open('CH-K-O2-12', 0.2);
  const masked = await open('CH-K-O2-12', 0.2, (d) => (d.components[0].params.maskTop = 1));
  assert.equal(ch(clear.sim, 'bench'), ch(masked.sim, 'bench'), '遮一半不改变像距');
  assert.ok(ch(masked.sim, 'bench'.replace('bench', 'bench')) !== undefined);
  assert.ok(
    (masked.sim.readings.channels['bench:relativeIlluminance'].value) <
      (clear.sim.readings.channels['bench:relativeIlluminance'].value) * 0.6,
    '遮挡后应变暗',
  );

  const focused = await open('CH-K-O2-14', 0.2);
  assert.equal(focused.sim.readings.channels['bench:screenHasImage'].value, 1, 'f=10 时应落在屏上');
  const off = await open('CH-K-O2-14', 0.2, (d) => (d.components[0].params.f = 15));
  assert.equal(off.sim.readings.channels['bench:screenHasImage'].value, 0, 'f=15 时应该对不上焦');
});
