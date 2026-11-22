/**
 * 读「学生真正做过的事」—— freeRuns
 *
 * App.tsx 把每次「记录此刻」的快照存在 `physquest.freebuild.v1`（App.tsx:200），
 * 这里只读不写。**评分不能读 LockedRun.params 当实验证据**（§2.3 的坑），
 * 所以这一层是 D1/D3 的唯一可信来源。
 */

import type { CaptureSnapshot } from '../../components/free-build/ImmersiveLab';
import { snapshotChallengeId, snapshotFocus } from './comparison';

export const FREEBUILD_KEY = 'physquest.freebuild.v1';

/** 全部快照（按存储顺序，最新的在前 —— App.tsx 是 [snap, ...prev]） */
export function loadCaptures(): CaptureSnapshot[] {
  try {
    const raw = localStorage.getItem(FREEBUILD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is CaptureSnapshot =>
        Boolean(s) && typeof s === 'object' && Boolean((s as CaptureSnapshot).experiment),
    );
  } catch {
    return [];
  }
}

/** 某一关的快照（不排序，排序在 buildGradingInput 里做） */
export function capturesFor(challengeId: string, all = loadCaptures()): CaptureSnapshot[] {
  return all.filter((s) => snapshotChallengeId(s) === challengeId);
}

/**
 * 工作台采集到的「当前选中通道」（缺口 3 增量方案 A）。
 * 平台还没加这个字段，所以现在基本是空数组；有就用，没有就退回学生自报。
 */
export function focusOf(captures: CaptureSnapshot[]): string[] {
  const out = new Set<string>();
  for (const c of captures) for (const f of snapshotFocus(c)) out.add(f);
  return [...out];
}
