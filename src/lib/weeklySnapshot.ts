/**
 * weeklySnapshot.ts
 * 주간보고 스냅샷 저장/조회
 *
 * localStorage에 프로젝트별 주간보고 스냅샷을 저장하여
 * 이전 주차 보고서와 비교할 수 있게 한다.
 */

import { storage } from './utils';
import type { WeeklyReportData } from './weeklyReport';

const STORAGE_KEY_PREFIX = 'weekly_snapshots_';

export interface WeeklySnapshot {
  id: string;
  projectId: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  createdAt: string;
  data: WeeklyReportData;
}

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

/** 프로젝트의 모든 스냅샷을 조회 (최신순) */
export function getSnapshots(projectId: string): WeeklySnapshot[] {
  return storage.get<WeeklySnapshot[]>(getStorageKey(projectId), [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 특정 주차의 스냅샷 조회 */
export function getSnapshotByWeek(projectId: string, weekStart: string): WeeklySnapshot | null {
  const snapshots = getSnapshots(projectId);
  return snapshots.find((s) => s.weekStart === weekStart) ?? null;
}

/** 스냅샷 저장 (같은 주차면 덮어쓰기) */
export function saveSnapshot(projectId: string, report: WeeklyReportData): WeeklySnapshot {
  const snapshots = getSnapshots(projectId);
  const existing = snapshots.findIndex((s) => s.weekStart === report.weekStart);

  const snapshot: WeeklySnapshot = {
    id: existing >= 0 ? snapshots[existing].id : crypto.randomUUID(),
    projectId,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    weekLabel: report.weekLabel,
    createdAt: new Date().toISOString(),
    data: report,
  };

  if (existing >= 0) {
    snapshots[existing] = snapshot;
  } else {
    snapshots.push(snapshot);
  }

  // 최대 12주분 보관
  const trimmed = snapshots
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, 12);

  storage.set(getStorageKey(projectId), trimmed);
  return snapshot;
}

/** 스냅샷 삭제 */
export function deleteSnapshot(projectId: string, snapshotId: string): void {
  const snapshots = getSnapshots(projectId).filter((s) => s.id !== snapshotId);
  storage.set(getStorageKey(projectId), snapshots);
}

/** 두 주차 보고서의 진행률 변화를 계산 */
export function compareSnapshots(
  current: WeeklyReportData,
  previous: WeeklyReportData | null
): {
  progressDelta: number;
  completedDelta: number;
  delayedDelta: number;
} {
  if (!previous) {
    return {
      progressDelta: current.summary.overallActualProgress,
      completedDelta: current.summary.completedTasks,
      delayedDelta: current.summary.delayedTasks,
    };
  }

  return {
    progressDelta: Math.round(
      (current.summary.overallActualProgress - previous.summary.overallActualProgress) * 100
    ) / 100,
    completedDelta: current.summary.completedTasks - previous.summary.completedTasks,
    delayedDelta: current.summary.delayedTasks - previous.summary.delayedTasks,
  };
}
