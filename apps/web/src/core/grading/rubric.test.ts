import { describe, expect, it } from 'vitest';
import { coveredChallengeIds, loadRubric, observationLabel } from './rubric';
import { channelsOf, P } from './test-fixtures';
import { suffixOf } from './comparison';

/** 文档 §1.3 的那 13 关 */
const LENS_BENCH_CHALLENGES = [
  'CH-O2-01',
  'CH-O2-02',
  'CH-O2-03',
  'CH-O2-04',
  'CH-O2-05',
  'CH-K-O1-05',
  'CH-K-O2-05',
  'CH-K-O3-01',
  'CH-K-O3-02',
  'CH-K-O3-03',
  'CH-K-O3-04',
  'CH-K-O2-12',
  'CH-K-O2-14',
];

describe('rubric 覆盖与通道名真实性', () => {
  it('13 个光具座关及全平台合并关都有评分规则', () => {
    const covered = new Set(coveredChallengeIds());
    for (const id of LENS_BENCH_CHALLENGES) {
      expect(loadRubric(id), id).not.toBeNull();
      expect(covered.has(id), id).toBe(true);
    }
    expect(covered.size).toBeGreaterThanOrEqual(LENS_BENCH_CHALLENGES.length);
  });

  it('rubric 里写的通道后缀，引擎里真有这个通道', () => {
    // 用默认参数跑一次，把通道键拿齐（通道集合和参数无关，只和器具种类有关）
    const keys = Object.keys(channelsOf(P({ u: 30, f: 10, screenX: 15 })));
    const suffixes = keys.filter((k) => k.includes(':')).map(suffixOf);

    for (const id of LENS_BENCH_CHALLENGES) {
      const r = loadRubric(id)!;
      for (const k of [...r.requiredObservations, ...r.optionalObservations]) {
        expect(suffixes, `${id} 的 ${k}`).toContain(k);
      }
    }
  });

  it('每一关的 requiredKinds 都是真实存在的器具 kind', () => {
    for (const id of LENS_BENCH_CHALLENGES) {
      expect(loadRubric(id)!.requiredKinds).toEqual(['lens_bench']);
    }
  });

  it('没有评分标准的挑战返回 null（NO_RUBRIC 那条路）', () => {
    expect(loadRubric('CH-NO-RUBRIC-YET')).toBeNull();
    expect(loadRubric('')).toBeNull();
  });

  it('CH-K-O3-04 的 required 为空 → D2 只能 insufficient', () => {
    const r = loadRubric('CH-K-O3-04')!;
    expect(r.requiredObservations).toHaveLength(0);
    expect(r.unmappableObservations.length).toBeGreaterThan(0);
  });

  it('CH-O2-04 保留了那三条无法映射的光线原话', () => {
    const r = loadRubric('CH-O2-04')!;
    expect(r.requiredObservations).toEqual(['relativeIlluminance', 'blurDiameter']);
    expect(r.unmappableObservations).toHaveLength(3);
  });

  it('通道后缀有人看得懂的中文名', () => {
    expect(observationLabel('m')).toBe('放大率 m');
    expect(observationLabel('screenHasImage')).toBe('光屏上有像');
    expect(observationLabel('不认识')).toBe('不认识');
  });

  it('loadRubric 带缓存，同一关返回同一个对象', () => {
    expect(loadRubric('CH-O2-01')).toBe(loadRubric('CH-O2-01'));
  });
});
