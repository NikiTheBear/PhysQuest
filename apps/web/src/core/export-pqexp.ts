import type { LensParams } from './contracts';
import { solve } from '../labs/optics-lens/engine';

/**
 * 把当前实验台状态导出成 Fieldlab 的 .pqexp.json 文件
 *
 * 用途：学生在我们的实验台上调出一组满意的参数，点「搬到自由搭建」
 * 就能带着这组参数进 Fieldlab，继续加器具、连光路、跑仿真。
 *
 * 格式跟 platform/experiments/*.pqexp.json 一致，工作台的「导入」按钮直接认。
 */
export function buildPqexp(params: LensParams, title: string, goal: string) {
  const m = solve(params);
  const id = 'exp-' + Math.random().toString(36).slice(2, 10);
  const benchId = 'bench-' + Math.random().toString(36).slice(2, 8);

  return {
    format: 'physquest.experiment',
    version: 1,
    id,
    title,
    goal,
    observation: [
      `当前物距 ${params.u} cm、焦距 ${params.f} cm，像是${m.description}。`,
      '试着改物距或换个透镜，看光屏上什么时候最清晰。',
    ].join(''),
    mode: '2d',
    environment: {
      gravity: 0,
      damping: 0,
      speed: 1,
      collisions: false,
    },
    components: [
      {
        id: benchId,
        kind: 'lens_bench',
        name: '凸透镜光具座',
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        params: {
          u: params.u,
          f: params.f,
          h: params.h,
          screenX: params.screenX,
          lensDiameter: params.lensDiameter,
          maskTop: params.maskTop ? 1 : 0,
          objectShape:
            params.objectShape === 'arrow' ? 0 : params.objectShape === 'F' ? 1 : 2,
        },
      },
    ],
    connections: [],
    control: { running: false },
  };
}

/** 触发下载 */
export function downloadPqexp(params: LensParams, title: string, goal: string) {
  const data = buildPqexp(params, title, goal);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/[\\/:*?"<>|]/g, '_')}.pqexp.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return data;
}
