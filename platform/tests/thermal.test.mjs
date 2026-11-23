import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, simulate, ambientOf, clampTemperature } from '../shared/physics.js';
import { blankExperiment, component, CATALOG } from '../shared/catalog.js';
import { validateExperiment } from '../shared/workspace.js';

/** 热学测试用空实验：无碰撞、无重力，环境温度默认 20 ℃ */
function thermalDoc(temperature = 20) {
  const doc = blankExperiment('热学测试');
  doc.environment = { gravity: 0, damping: 0, speed: 1, collisions: false, temperature };
  return doc;
}

/** 放一个恒温热源并返回它（方便取 id 与改参数） */
function addSource(doc, position, temperature, params = {}) {
  const source = component('heat_source', { position });
  source.params.temperature = temperature;
  Object.assign(source.params, params);
  doc.components.push(source);
  return source;
}

/** 放一个温度计并返回它 */
function addMeter(doc, position, params = {}) {
  const meter = component('thermometer', { position });
  Object.assign(meter.params, params);
  doc.components.push(meter);
  return meter;
}

/** 所有热学器具的当前温度，附带类型，出错时能看出是谁越界 */
const thermalTemperatures = (sim, doc) => doc.components
  .filter(c => ['thermometer', 'heat_source', 'conductor'].includes(c.kind))
  .map(c => ({ kind: c.kind, id: c.id, temperature: sim.temperatureOf(c.id) }));

const show = v => (Number.isFinite(v) ? v.toFixed(3) : String(v));

// ---------------------------------------------------------------- 温度计滞后

test('温度计一阶滞后：100 ℃ 环境中 2 s 后读数约 100 − 80/e ≈ 70.57 ℃', () => {
  const doc = thermalDoc(20);
  addSource(doc, [0, 1, 0], 100);
  const meter = addMeter(doc, [0, 1, 0], { responseTime: 2 });
  const sim = new Simulation(doc);
  assert.equal(sim.temperatureOf(meter.id), 20, '温度计初始温度应等于建模时的环境温度 20 ℃');
  assert.equal(sim.localTemperature(meter), 100, '热源就在温度计上，局部温度应为 100 ℃');
  sim.advance(2);
  const expected = 100 - 80 / Math.E;
  const reading = sim.measure().channels[meter.id].value;
  assert.ok(Math.abs(reading - expected) < .5,
    `2 s（1 个时间常数）后读数 ${show(reading)} ℃ 应接近 ${show(expected)} ℃ = 100 − 80/e`);
});

test('温度计跑满 5 个时间常数（10 s）后基本到达 100 ℃', () => {
  const doc = thermalDoc(20);
  addSource(doc, [0, 1, 0], 100);
  const meter = addMeter(doc, [0, 1, 0], { responseTime: 2 });
  const sim = new Simulation(doc);
  sim.advance(2);
  const at2 = sim.temperatureOf(meter.id);
  sim.advance(8);
  const at10 = sim.temperatureOf(meter.id);
  assert.ok(Math.abs(at10 - 100) < 1, `10 s 后读数 ${show(at10)} ℃ 应在 100 ℃ 的 ±1 内（还剩 80·e⁻⁵ ≈ 0.54 ℃）`);
  assert.ok(at10 > at2, `读数应继续升高：2 s 为 ${show(at2)} ℃，10 s 为 ${show(at10)} ℃`);
});

test('温度计读数单调上升且不超调', () => {
  const doc = thermalDoc(20);
  addSource(doc, [0, 1, 0], 100);
  const meter = addMeter(doc, [0, 1, 0], { responseTime: 2 });
  const sim = new Simulation(doc);
  let previous = sim.temperatureOf(meter.id);
  for (let i = 1; i <= 40; i++) {
    sim.advance(.25);
    const now = sim.temperatureOf(meter.id);
    assert.ok(now >= previous - 1e-9, `第 ${i} 次采样（${(i * .25).toFixed(2)} s）读数 ${show(now)} ℃ 不应低于上一步 ${show(previous)} ℃`);
    assert.ok(now <= 100 + 1e-9, `第 ${i} 次采样读数 ${show(now)} ℃ 不应超过热源温度 100 ℃`);
    previous = now;
  }
});

test('运行中把环境温度从 100 ℃ 改到 20 ℃，温度计按同一时间常数回落', () => {
  const doc = thermalDoc(100);
  const meter = addMeter(doc, [0, 1, 0], { responseTime: 2 });
  const sim = new Simulation(doc);
  assert.equal(sim.temperatureOf(meter.id), 100, '建模时环境 100 ℃，温度计初温就应是 100 ℃');
  // 与 environment.test.mjs 相同：只替换 sim.doc，不重建世界
  sim.doc = structuredClone(doc);
  sim.doc.environment.temperature = 20;
  sim.advance(2);
  const expected = 20 + 80 / Math.E;
  const reading = sim.temperatureOf(meter.id);
  assert.ok(Math.abs(reading - expected) < .5, `改环境 2 s 后读数 ${show(reading)} ℃ 应接近 ${show(expected)} ℃ = 20 + 80/e`);
});

test('温度计不受远离的热源影响：热源半径 0.5、温度计在 5 m 外，读数回落到环境温度', () => {
  const doc = thermalDoc(100);
  const source = addSource(doc, [0, 0, 0], 100, { radius: .5 });
  const far = addMeter(doc, [5, 0, 0], { responseTime: 2 });
  const near = addMeter(doc, [.4, 0, 0], { responseTime: 2 });
  const sim = new Simulation(doc);
  sim.doc.environment.temperature = 20;
  sim.advance(30);
  const farReading = sim.temperatureOf(far.id);
  assert.ok(Math.abs(farReading - 20) < .01, `5 m 外的温度计读数 ${show(farReading)} ℃ 应等于环境温度 20 ℃，而不是热源 ${source.params.temperature} ℃`);
  assert.equal(sim.localTemperature(near), 100, '半径内的温度计局部温度仍应是 100 ℃');
  assert.ok(sim.temperatureOf(near.id) > 99, `半径内的温度计读数 ${show(sim.temperatureOf(near.id))} ℃ 应接近 100 ℃`);
});

test('热源作用半径边界：恰好 0.5 m 仍受热，0.51 m 已回到环境温度', () => {
  const reading = distance => {
    const doc = thermalDoc(20);
    addSource(doc, [0, 0, 0], 100, { radius: .5 });
    const meter = addMeter(doc, [distance, 0, 0]);
    return new Simulation(doc).localTemperature(meter);
  };
  assert.equal(reading(.5), 100, '距离 = 半径时仍属于作用区，局部温度应为 100 ℃');
  assert.equal(reading(.51), 20, '距离略大于半径时局部温度应退回环境温度 20 ℃');
});

// ---------------------------------------------------------------- 热源

test('热源恒温：100 ℃ 热源跑 10 s 读数恒等于 100 ℃', () => {
  const doc = thermalDoc(20);
  const source = addSource(doc, [0, 1, 0], 100);
  const sim = new Simulation(doc);
  for (let i = 1; i <= 10; i++) {
    sim.advance(1);
    const value = sim.measure().channels[source.id].value;
    assert.ok(Math.abs(value - 100) < .01, `第 ${i} 秒热源读数 ${show(value)} ℃ 应恒为 100 ℃（无限热库，不会被环境拉走）`);
  }
});

test('热源温度被钳制在 [-273, 1000] ℃，环境温度越界同样被钳制', () => {
  const hot = thermalDoc(20);
  const over = addSource(hot, [0, 1, 0], 1500);
  const hotSim = new Simulation(hot);
  hotSim.advance(1);
  assert.equal(hotSim.readings.channels[over.id].value, 1000, '热源 1500 ℃ 应被钳制到模型上限 1000 ℃');

  const cold = thermalDoc(20);
  const under = addSource(cold, [0, 1, 0], -400);
  const coldSim = new Simulation(cold);
  coldSim.advance(1);
  assert.equal(coldSim.readings.channels[under.id].value, -273, '热源 -400 ℃ 应被钳制到绝对零度 -273 ℃');

  assert.equal(clampTemperature(NaN), 20, 'NaN 温度应回落到默认 20 ℃');
  assert.equal(clampTemperature(1e9), 1000, '超大温度应钳制到 1000 ℃');
  assert.equal(clampTemperature(-1e9), -273, '超小温度应钳制到 -273 ℃');
  assert.equal(ambientOf({}), 20, '没有环境温度时取默认 20 ℃');
  assert.equal(ambientOf({ environment: { temperature: 35 } }), 35, '环境温度应被读取');
  assert.equal(ambientOf({ environment: { temperature: NaN } }), 20, '环境温度非法时取默认 20 ℃');
});

// ---------------------------------------------------------------- 导热棒
//
// 已知限制（报告用，不在测试里断言错误值）：thermalStep 先用前半段把杆身拉向 A、再用后半段拉向 B，
// 两步共用同一个刚更新过的杆身温度，属于算子分裂。两端都是无限热库时，杆身稳态落在 B 端温度一侧，
// 偏移量随 G·dt/C（G = 2λA/L）增大而增大：默认参数只差 0.002 K，但 λ=1000、A=1、L=0.1、C=100
// 这样的滑块可达组合在 60 s 后稳定在 39.73 ℃（对称两端 100/0 ℃ 应为 50 ℃）。下面的测试只在
// 默认参数（误差 < 0.5 K）这一档断言中点值。

test('导热棒热流：λ=200、A=0.01、L=1、ΔT=100 → 200 W', () => {
  const doc = thermalDoc(20);
  const a = addSource(doc, [-1, 1, 0], 100);
  const b = addSource(doc, [1, 1, 0], 0);
  const rod = component('conductor', { position: [0, 1, 0] });
  rod.refs = { a: a.id, b: b.id };
  doc.components.push(rod);
  const sim = new Simulation(doc);
  const flow = sim.heatFlowOf(rod);
  assert.ok(Math.abs(flow - 200) < 1, `热流 ${show(flow)} W 应等于 λA·ΔT/L = 200×0.01×100/1 = 200 W`);
  assert.equal(sim.readings.channels[rod.id].value, flow, '导热棒读数通道应等于 heatFlowOf()');
  assert.equal(sim.readings.channels[rod.id + ':heatFlow'].value, flow, '热流通道应等于 heatFlowOf()');
  sim.advance(1);
  assert.ok(Math.abs(sim.heatFlowOf(rod) - 200) < 1, '热源是无限热库，跑 1 s 后热流仍应是 200 W');
});

test('导热棒热流随导热系数与截面积成正比、随长度反比', () => {
  const flowOf = params => {
    const doc = thermalDoc(20);
    const a = addSource(doc, [-5, 1, 0], 100);
    const b = addSource(doc, [5, 1, 0], 0);
    const rod = component('conductor');
    Object.assign(rod.params, params);
    rod.refs = { a: a.id, b: b.id };
    doc.components.push(rod);
    return new Simulation(doc).heatFlowOf(rod);
  };
  const base = flowOf({});
  assert.ok(Math.abs(base - 200) < 1, `默认参数热流 ${show(base)} W 应为 200 W`);
  assert.ok(Math.abs(flowOf({ conductivity: 400 }) - 400) < 1, `导热系数翻倍后热流应变成 400 W，实际 ${show(flowOf({ conductivity: 400 }))} W`);
  assert.ok(Math.abs(flowOf({ area: .02 }) - 400) < 1, `截面积翻倍后热流应变成 400 W，实际 ${show(flowOf({ area: .02 }))} W`);
  assert.ok(Math.abs(flowOf({ length: 2 }) - 100) < .5, `长度翻倍后热流应变成 100 W，实际 ${show(flowOf({ length: 2 }))} W`);
});

test('导热棒热流有向：交换 A/B 后热流反号', () => {
  const build = swap => {
    const doc = thermalDoc(20);
    const a = addSource(doc, [-1, 1, 0], 100);
    const b = addSource(doc, [1, 1, 0], 0);
    const rod = component('conductor');
    rod.refs = swap ? { a: b.id, b: a.id } : { a: a.id, b: b.id };
    doc.components.push(rod);
    return { sim: new Simulation(doc), rod };
  };
  const forward = build(false);
  const backward = build(true);
  assert.ok(Math.abs(forward.sim.heatFlowOf(forward.rod) - 200) < 1, `A=100 ℃ → B=0 ℃ 时热流应为 +200 W，实际 ${show(forward.sim.heatFlowOf(forward.rod))} W`);
  assert.ok(Math.abs(backward.sim.heatFlowOf(backward.rod) + 200) < 1, `A=0 ℃ → B=100 ℃ 时热流应为 −200 W，实际 ${show(backward.sim.heatFlowOf(backward.rod))} W`);
});

test('导热棒只接一端时不传热，杆身停在环境温度', () => {
  const doc = thermalDoc(20);
  const hot = addSource(doc, [-3, 1, 0], 100, { power: 0 });
  const rod = component('conductor', { position: [0, 1, 0] });
  rod.refs = { a: hot.id };
  doc.components.push(rod);
  const sim = new Simulation(doc);
  sim.advance(10);
  assert.equal(sim.heatFlowOf(rod), 0, '只有一端时没有温差回路，热流应为 0');
  assert.ok(Math.abs(sim.temperatureOf(rod.id) - 20) < 1e-9, `杆身温度 ${show(sim.temperatureOf(rod.id))} ℃ 应保持环境温度 20 ℃`);
});

test('导热棒接上第二端后杆身温度按指数趋近两端中点 50 ℃，热源温度不变', () => {
  const doc = thermalDoc(20);
  const hot = addSource(doc, [-3, 1, 0], 100);
  const cold = addSource(doc, [3, 1, 0], 0);
  const rod = component('conductor', { position: [0, 1, 0] });
  rod.refs = { a: hot.id };
  doc.components.push(rod);
  const sim = new Simulation(doc);
  sim.advance(5);
  // 运行中接上 B 端：Simulation 内部持有 doc 的副本，两端都要改
  rod.refs.b = cold.id;
  const liveRod = sim.doc.components.find(c => c.id === rod.id);
  liveRod.refs.b = cold.id;
  sim.advance(12.5); // 1 个时间常数：G = 2λA/L = 4 W/K，C = 100 J/K，τ = C/(2G) = 12.5 s
  const atTau = sim.temperatureOf(rod.id);
  const expectedTau = 50 - 30 / Math.E;
  assert.ok(Math.abs(atTau - expectedTau) < .5, `接通 12.5 s（1 个时间常数）后杆身 ${show(atTau)} ℃ 应接近 ${show(expectedTau)} ℃ = 50 − 30/e`);
  sim.advance(87.5);
  const settled = sim.temperatureOf(rod.id);
  assert.ok(Math.abs(settled - 50) < .5, `100 s 后杆身 ${show(settled)} ℃ 应趋近两端中点 50 ℃`);
  assert.equal(sim.temperatureOf(hot.id), 100, '热源是无限热库，A 端应保持 100 ℃');
  assert.equal(sim.temperatureOf(cold.id), 0, '热源是无限热库，B 端应保持 0 ℃');
  assert.ok(Math.abs(sim.heatFlowOf(liveRod) - 200) < 1, `稳定后热流仍应为 200 W，实际 ${show(sim.heatFlowOf(liveRod))} W`);
});

test('导热棒一端指向不存在的 id：热流为 0，100 s 后温度仍是有限值', () => {
  const doc = thermalDoc(20);
  const source = addSource(doc, [1, 1, 0], 100, { power: 0 });
  const rod = component('conductor', { position: [0, 1, 0] });
  Object.assign(rod.params, { conductivity: 1000, area: 10, length: .05, heatCapacity: .1 });
  rod.refs = { a: 'missing-id', b: source.id };
  doc.components.push(rod);
  // 工作区校验会拒绝这种文档，但已经打开的仿真必须自己扛住悬空引用
  assert.throws(() => validateExperiment(structuredClone(doc)), /引用的器具不存在/, '工作区校验应拒绝指向不存在器具的导热棒');
  const sim = new Simulation(doc);
  assert.equal(sim.heatFlowOf(rod), 0, 'A 端不存在时热流应返回 0 而不是 NaN');
  sim.advance(100);
  const temperature = sim.temperatureOf(rod.id);
  assert.equal(sim.heatFlowOf(rod), 0, '跑 100 s 后热流仍应是 0');
  assert.ok(Number.isFinite(temperature), `悬空端点的杆身温度应是有限数，实际 ${show(temperature)}`);
  assert.ok(temperature >= -273 && temperature <= 1000, `悬空端点的杆身温度 ${show(temperature)} ℃ 应留在 [-273, 1000] 内`);
  assert.equal(sim.measure().channels[rod.id + ':heatFlow'].valid, false, '端点为不存在时应把热流通道标记为无效');
});

test('导热棒没有任何端点时同样不发散', () => {
  const doc = thermalDoc(20);
  const rod = component('conductor');
  doc.components.push(rod);
  const sim = new Simulation(doc);
  sim.advance(50);
  assert.equal(sim.heatFlowOf(rod), 0, '没有端点时热流应为 0');
  assert.ok(Number.isFinite(sim.temperatureOf(rod.id)), '没有端点时杆身温度应仍是有限数');
  assert.equal(sim.measure().channels[rod.id].value, 0, '没有端点时导热棒读数应为 0 W');
});

test('温度计接在导热棒的 B 端时读到杆身温度（不直接读热源）', () => {
  const doc = thermalDoc(20);
  const hot = addSource(doc, [-1, 1, 0], 100, { radius: .1 });
  const rod = component('conductor', { position: [0, 1, 0] });
  const meter = addMeter(doc, [3, 1, 0]);
  rod.refs = { a: hot.id, b: meter.id };
  doc.components.push(rod);
  const sim = new Simulation(doc);
  const target = sim.localTemperature(meter);
  assert.ok(Math.abs(target - sim.temperatureOf(rod.id)) < 1e-9, `接在棒上的温度计目标温度 ${show(target)} ℃ 应等于杆身温度 ${show(sim.temperatureOf(rod.id))} ℃`);
  sim.advance(120);
  assert.ok(Math.abs(sim.temperatureOf(rod.id) - 100) < 1, `120 s 后杆身 ${show(sim.temperatureOf(rod.id))} ℃ 应接近热源 100 ℃`);
  assert.ok(Math.abs(sim.temperatureOf(meter.id) - sim.temperatureOf(rod.id)) < .5, `温度计 ${show(sim.temperatureOf(meter.id))} ℃ 应跟上杆身 ${show(sim.temperatureOf(rod.id))} ℃`);
});

test('热源按功率加热半径内的导热棒，指数趋近热源温度', () => {
  const doc = thermalDoc(20);
  const source = addSource(doc, [0, 1, 0], 100, { power: 50, radius: 1 });
  const rod = component('conductor', { position: [.3, 1, 0], refs: {} });
  rod.params.heatCapacity = 100;
  doc.components.push(rod);
  const sim = new Simulation(doc);
  sim.advance(1);
  // h = 功率 / max(距离, 0.1) = 50/0.3 W/K，τ = C/h = 0.6 s
  const expected = 100 - 80 * Math.exp(-50 / .3 / 100);
  const actual = sim.temperatureOf(rod.id);
  assert.ok(Math.abs(actual - expected) < .5, `功率 50 W、距离 0.3 m 加热 1 s 后杆身 ${show(actual)} ℃ 应接近 ${show(expected)} ℃`);
  assert.ok(actual > 20 && actual < 100, `杆身 ${show(actual)} ℃ 应被加热但不超过热源温度`);

  const idle = thermalDoc(20);
  const off = addSource(idle, [0, 1, 0], 100, { power: 0, radius: 1 });
  const idleRod = component('conductor', { position: [.3, 1, 0], refs: {} });
  idle.components.push(off, idleRod);
  const idleSim = new Simulation(idle);
  idleSim.advance(10);
  assert.ok(Math.abs(idleSim.temperatureOf(idleRod.id) - 20) < 1e-9, `功率 0 时杆身 ${show(idleSim.temperatureOf(idleRod.id))} ℃ 不应被加热`);

  // 功率只在作用半径内生效：半径外的导热棒即使功率拉满也保持环境温度
  const outside = thermalDoc(20);
  const strong = addSource(outside, [0, 1, 0], 100, { power: 10000, radius: .5 });
  const farRod = component('conductor', { position: [5, 1, 0], refs: {} });
  const nearRod = component('conductor', { position: [.4, 1, 0], refs: {} });
  outside.components.push(strong, farRod, nearRod);
  const outsideSim = new Simulation(outside);
  outsideSim.advance(10);
  assert.ok(Math.abs(outsideSim.temperatureOf(farRod.id) - 20) < 1e-6, `半径 0.5 m 外（5 m）的导热棒 ${show(outsideSim.temperatureOf(farRod.id))} ℃ 不应被功率加热`);
  assert.ok(outsideSim.temperatureOf(nearRod.id) > 99, `半径内的导热棒 ${show(outsideSim.temperatureOf(nearRod.id))} ℃ 应被加热到接近 100 ℃`);
});

// ---------------------------------------------------------------- 稳定性与默认值

test('极端参数跑 100 s 不发散：热容 0.1、导热系数 1000、截面积 10、长度 0.05', () => {
  const doc = thermalDoc(1000);
  const hot = addSource(doc, [-.2, 1, 0], 1000);
  const cold = addSource(doc, [.2, 1, 0], -273);
  const rod = component('conductor', { position: [0, 1, 0] });
  Object.assign(rod.params, { conductivity: 1000, area: 10, length: .05, heatCapacity: .1 });
  rod.refs = { a: hot.id, b: cold.id };
  doc.components.push(rod);
  addMeter(doc, [0, 1, 0], { heatCapacity: .1, responseTime: .1 });
  addMeter(doc, [-.2, 1, 0], { heatCapacity: .1, responseTime: .1 });

  const sim = new Simulation(doc);
  for (let second = 1; second <= 100; second++) {
    sim.advance(1);
    for (const { kind, temperature } of thermalTemperatures(sim, doc)) {
      assert.ok(Number.isFinite(temperature), `第 ${second} 秒 ${kind} 温度不是有限数：${show(temperature)}`);
      assert.ok(temperature >= -273 && temperature <= 1000, `第 ${second} 秒 ${kind} 温度 ${show(temperature)} ℃ 越出 [-273, 1000]`);
    }
  }
  const readings = sim.measure();
  assert.ok(Math.abs(readings.channels[rod.id].value - sim.heatFlowOf(rod)) < 1e-6, '极端参数下导热棒读数仍应等于傅里叶热流');
  for (const [key, channel] of Object.entries(readings.channels)) {
    assert.ok(Number.isFinite(channel.value), `通道 ${key}（${channel.label}）的值 ${show(channel.value)} 不是有限数`);
  }
  assert.ok(Math.abs(sim.heatFlowOf(rod) - 1000 * 10 * 1273 / .05) < 1, `极端参数下热流应仍是 λA·ΔT/L = ${show(1000 * 10 * 1273 / .05)} W，实际 ${show(sim.heatFlowOf(rod))} W`);
});

test('headless simulate() 的热学通道也是有限数并与解析解一致', () => {
  const doc = thermalDoc(20);
  addSource(doc, [0, 1, 0], 100);
  const meter = addMeter(doc, [0, 1, 0], { responseTime: 2 });
  const result = simulate(doc, 10, 60);
  assert.ok(result.series.length > 0, 'simulate() 应产出采样序列');
  const last = result.series.at(-1);
  const reading = last.channels[meter.id].value;
  assert.ok(Number.isFinite(reading), `序列末点温度计读数 ${show(reading)} 应是有限数`);
  assert.ok(reading > 99 && reading < 100, `约 10 s 后序列读数 ${show(reading)} ℃ 应已接近 100 ℃ 但仍低于它`);
  for (const channel of Object.values(result.readings.channels)) {
    assert.ok(Number.isFinite(channel.value), `通道「${channel.label}」的终值 ${show(channel.value)} 应是有限数`);
  }
});

test('三种热学器具的默认值合法，创建后读数都是有限数', () => {
  const kinds = ['thermometer', 'heat_source', 'conductor'];
  for (const kind of kinds) {
    const made = component(kind);
    assert.equal(made.kind, kind, `${kind} 应能用 component() 创建`);
    assert.equal(made.name, CATALOG[kind].name, `${kind} 应带上目录里的中文名 ${CATALOG[kind].name}`);
    for (const [key, spec] of Object.entries(CATALOG[kind].params)) {
      const value = made.params[key];
      assert.ok(Number.isFinite(value), `${kind}.params.${key} 默认值应是有限数，实际 ${show(value)}`);
      assert.ok(value >= spec.min && value <= spec.max, `${kind}.params.${key} 默认值 ${show(value)} 应落在 [${spec.min}, ${spec.max}]`);
    }
  }

  const doc = thermalDoc(20);
  doc.components.push(component('thermometer'), component('heat_source'), component('conductor'));
  validateExperiment(structuredClone(doc)); // 默认参数必须能通过工作区校验
  const sim = new Simulation(doc);
  sim.advance(5);
  const readings = sim.measure();
  for (const c of doc.components) {
    const channel = readings.channels[c.id];
    assert.ok(channel, `${CATALOG[c.kind].name} 应有读数通道`);
    assert.ok(Number.isFinite(channel.value), `${CATALOG[c.kind].name} 读数 ${show(channel.value)} 应是有限数`);
  }
});
