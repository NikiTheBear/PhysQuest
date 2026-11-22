import test from 'node:test';
import assert from 'node:assert/strict';
import { benchGraphics } from '../web/lens-bench.js';

const base = { h: 2.5, lensDiameter: 6, maskTop: 0, objectShape: 0 };
const imageLine = (g) => g.lines.find((l) => l.color === '#518a74' || l.color === '#b0b8bf');

test('不在光屏上的像画成虚线灰箭头，并提示要挪到像的位置', () => {
  // 文档复现例：u=11.3 cm、f=10 cm → v=86.92 cm，光屏在 15 cm 接不到像
  const g = benchGraphics({ ...base, u: 11.3, f: 10, screenX: 15 });
  assert.equal(g.metrics.screenHasImage, false);
  assert.equal(imageLine(g).dashed, true);
  assert.equal(imageLine(g).color, '#b0b8bf');
  assert.match(g.screenNote, /87 cm/);
  assert.match(g.screenNote, /15 cm/);
  assert.equal(g.squeezed, true);
});

test('像正好落在光屏上时画实线，并说明屏位置正确', () => {
  const g = benchGraphics({ ...base, u: 30, f: 10, screenX: 15 });
  assert.equal(g.metrics.screenHasImage, true);
  assert.equal(imageLine(g).dashed, false);
  assert.equal(imageLine(g).color, '#518a74');
  assert.match(g.screenNote, /位置正确/);
  assert.equal(g.squeezed, false);
});

test('虚像和不成像也有诚实的说明', () => {
  const virtual = benchGraphics({ ...base, u: 5, f: 10, screenX: 15 });
  assert.equal(virtual.metrics.real, false);
  assert.match(virtual.screenNote, /虚像/);
  const parallel = benchGraphics({ ...base, u: 10, f: 10, screenX: 15 });
  assert.equal(parallel.metrics.isParallel, true);
  assert.equal(imageLine(parallel), undefined);
  assert.match(parallel.screenNote, /不成像/);
});
