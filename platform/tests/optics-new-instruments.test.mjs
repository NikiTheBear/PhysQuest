import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { challengeScene } from '../shared/challenge-scene.js';
import { Simulation } from '../shared/physics.js';

const folder = new URL('../experiments/', import.meta.url);
const ch = (sim, id) => (sim.readings.channels ?? {})[id]?.value;

async function open(id, seconds = 0.05, tweak) {
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

/* 这一批用上 2026-11-23 新增的三种光学器具：针孔、折射界面、眼球。
   每条都断言「读数会随参数变化」，不是只有 0。 */

test('针孔成像：像高按相似三角形，孔径只改模糊斑与亮度（O1-02）', async () => {
  const base = await open('CH-K-O1-02');
  assert.ok(Math.abs(ch(base.sim, 'pin:imageHeight') - 0.1333) < 0.001, `像高 ${ch(base.sim, 'pin:imageHeight')}`);
  assert.ok(ch(base.sim, 'pin:sharpness') > 0.9);

  const wide = await open('CH-K-O1-02', 0.05, (d) => (d.components[0].params.holeDiameter = 0.02));
  assert.ok(Math.abs(ch(wide.sim, 'pin:imageHeight') - 0.1333) < 0.001, '孔径不改变像高');
  assert.ok(ch(wide.sim, 'pin:blur') > ch(base.sim, 'pin:blur') * 5, '孔径变大模糊斑应变大');
  assert.ok(ch(wide.sim, 'pin:sharpness') < ch(base.sim, 'pin:sharpness'), '清晰度应下降');
  assert.ok(ch(wide.sim, 'pin:brightness') > ch(base.sim, 'pin:brightness') * 10, '孔径变大应变亮');

  const far = await open('CH-K-O1-02', 0.05, (d) => (d.components[0].params.objectDistance = 1.2));
  assert.ok(Math.abs(ch(far.sim, 'pin:imageHeight') - 0.0667) < 0.001, '物距翻倍像高减半');
});

test('光会拐弯：凸透镜把离轴光收拢到焦点，凹透镜散开（O1-04）', async () => {
  const convex = await open('CH-K-O1-04');
  assert.ok(ch(convex.sim, 'spot') > 0.5, '凸透镜应让探测器读到光');

  const noLens = await open('CH-K-O1-04', 0.05, (d) => {
    d.components = d.components.filter((c) => c.id !== 'lens');
  });
  assert.ok(ch(noLens.sim, 'spot') < 0.01, '没有透镜时光打不到轴上探测器');

  const concave = await open('CH-K-O1-04', 0.05, (d) => {
    const l = d.components.find((c) => c.id === 'lens');
    l.kind = 'diverging_lens';
    l.params.focal = -1.5;
  });
  assert.ok(ch(concave.sim, 'spot') < 0.01, '凹透镜应让光散开');
});

test('折射规律：n₂ 改变出射方向，探测器功率随之变化（O2-01）', async () => {
  const glass = await open('CH-K-O2-01');
  assert.ok(ch(glass.sim, 'spot') > 0.5, 'n₂=1.5 时应打在探测器上');

  const none = await open('CH-K-O2-01', 0.05, (d) => (d.components.find((c) => c.id === 'glass').params.n2 = 1));
  assert.ok(ch(none.sim, 'spot') < 1e-6, 'n₂=1（不折射）时光越过探测器');

  const denser = await open('CH-K-O2-01', 0.05, (d) => (d.components.find((c) => c.id === 'glass').params.n2 = 2));
  assert.ok(ch(denser.sim, 'spot') < ch(glass.sim, 'spot'), 'n₂ 更大偏折更多，只截到部分光');
});

test('三心同高：遮挡只改照度，不改像距与放大率（O2-12）', async () => {
  const clear = await open('CH-K-O2-12');
  const masked = await open('CH-K-O2-12', 0.05, (d) => (d.components[0].params.maskTop = 1));
  assert.equal(ch(clear.sim, 'bench:v'), ch(masked.sim, 'bench:v'), '像距不应变化');
  assert.equal(ch(clear.sim, 'bench:m'), ch(masked.sim, 'bench:m'), '放大率不应变化');
  assert.ok(
    ch(masked.sim, 'bench:relativeIlluminance') < ch(clear.sim, 'bench:relativeIlluminance') * 0.6,
    '应明显变暗',
  );
});

test('眼球模型：眼轴偏长是近视，配凹透镜能矫正（O2-14）', async () => {
  const normal = await open('CH-K-O2-14');
  assert.equal(ch(normal.sim, 'eye:inFocus'), 1, '正常眼应看得清');

  const myopic = await open('CH-K-O2-14', 0.05, (d) => (d.components[0].params.axialLength = 0.024));
  assert.equal(ch(myopic.sim, 'eye:inFocus'), 0, '眼轴偏长应看不清');
  assert.ok(ch(myopic.sim, 'eye:focusError') < -0.002, '近视焦点应落在视网膜前');
  assert.ok(ch(myopic.sim, 'eye:retinaBlur') > 0.0001, '视网膜上应有模糊斑');

  const corrected = await open('CH-K-O2-14', 0.05, (d) => {
    d.components[0].params.axialLength = 0.024;
    d.components[0].params.correction = -6.33;
  });
  assert.equal(ch(corrected.sim, 'eye:inFocus'), 1, '配 −6.33 D 应重新看清');

  const hyperopic = await open('CH-K-O2-14', 0.05, (d) => (d.components[0].params.axialLength = 0.018));
  assert.ok(ch(hyperopic.sim, 'eye:focusError') > 0.002, '远视焦点应落在视网膜后');
});
