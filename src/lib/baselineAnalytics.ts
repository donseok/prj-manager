/**
 * baselineAnalytics.ts
 *
 * 활성 기준선과 현재 작업을 비교해 편차/진도 S-curve를 계산한다.
 */

import type { Task, ProjectBaseline, ProjectBaselineTaskSnapshot } from '../types';
import { parseDate } from './utils';
import { getLeafTasks } from './taskAnalytics';
import { addWeeks, differenceInCalendarDays, differenceInCalendarWeeks, format, startOfWeek } from 'date-fns';

export interface BaselineDeviation {
  /** 기준선 완료일 vs 현재 계획 완료일 차이 (일). +면 지연, -면 선행 */
  endDateShiftDays: number | null;
  /** 기준선 시작일 vs 현재 계획 시작일 차이 */
  startDateShiftDays: number | null;
  /** 평균 공정율 편차 = 현재 actualProgress - 기준선 planProgress (가중평균) */
  progressDeltaPercent: number;
  /** 기준선 대비 일정이 밀린 Task 개수 (leaf 기준) */
  slippedTaskCount: number;
  /** 스냅샷에 있으나 현재 WBS에 없는 Task 개수 */
  missingTaskCount: number;
}

export interface BaselineSCurvePoint {
  weekIndex: number;
  weekLabel: string;
  baselinePlan: number;
  actual: number | null;
}

/** 두 스냅샷 맵의 차이를 계산 */
export function computeBaselineDeviation(
  baseline: ProjectBaseline,
  tasks: Task[],
  projectStart?: string | null,
  projectEnd?: string | null,
): BaselineDeviation {
  const snapshotById = new Map<string, ProjectBaselineTaskSnapshot>();
  for (const s of baseline.taskSnapshots) snapshotById.set(s.taskId, s);

  const currentById = new Map<string, Task>();
  for (const t of tasks) currentById.set(t.id, t);

  // 일정 편차 (프로젝트 단위)
  const bStart = parseDate(baseline.projectStart);
  const bEnd = parseDate(baseline.projectEnd);
  const cStart = parseDate(projectStart);
  const cEnd = parseDate(projectEnd);

  const startDateShiftDays = bStart && cStart ? differenceInCalendarDays(cStart, bStart) : null;
  const endDateShiftDays = bEnd && cEnd ? differenceInCalendarDays(cEnd, bEnd) : null;

  // 공정율 편차 (leaf, weight 가중평균)
  const leafs = getLeafTasks(tasks);
  const totalWeight = leafs.reduce((s, t) => s + (t.weight || 1), 0) || 1;
  let baselineWeighted = 0;
  let actualWeighted = 0;
  let slippedTaskCount = 0;

  for (const t of leafs) {
    const wt = (t.weight || 1) / totalWeight;
    const snap = snapshotById.get(t.id);
    const basePlan = snap ? snap.planProgress : t.planProgress;
    baselineWeighted += wt * basePlan;
    actualWeighted += wt * t.actualProgress;

    // 슬립 판정: 스냅샷 planEnd 이후에도 미완료
    const baseEnd = parseDate(snap?.planEnd ?? null);
    if (baseEnd && t.status !== 'completed') {
      if (new Date() > baseEnd) slippedTaskCount++;
    }
  }

  let missingTaskCount = 0;
  for (const snap of baseline.taskSnapshots) {
    if (!currentById.has(snap.taskId)) missingTaskCount++;
  }

  return {
    endDateShiftDays,
    startDateShiftDays,
    progressDeltaPercent: Math.round((actualWeighted - baselineWeighted) * 10) / 10,
    slippedTaskCount,
    missingTaskCount,
  };
}

/**
 * 기준선 계획선 vs 실제 누적 공정률 S-curve.
 * 기준선의 planStart/planEnd 기간을 이용해 각 주차 기대 진도율을 선형 보간으로 계산.
 */
export function computeBaselineSCurve(
  baseline: ProjectBaseline,
  currentTasks: Task[],
  options?: { currentDate?: Date }
): BaselineSCurvePoint[] {
  const now = options?.currentDate ?? new Date();
  const snapshots = baseline.taskSnapshots;
  if (snapshots.length === 0) return [];

  // 리프(자식 없는) 스냅샷만 사용 — 부모는 자식 합계
  const parentIds = new Set(
    currentTasks.filter((t) => t.parentId).map((t) => t.parentId as string)
  );
  const leafSnapshots = snapshots.filter((s) => !parentIds.has(s.taskId));
  const effectiveSnapshots = leafSnapshots.length > 0 ? leafSnapshots : snapshots;

  // 기준선 기간 — projectStart/End가 있으면 우선
  const bStart =
    parseDate(baseline.projectStart) ||
    earliestDate(effectiveSnapshots.map((s) => s.planStart));
  const bEnd =
    parseDate(baseline.projectEnd) ||
    latestDate(effectiveSnapshots.map((s) => s.planEnd));
  if (!bStart || !bEnd || bEnd < bStart) return [];

  const startWeek = startOfWeek(bStart, { weekStartsOn: 1 });
  const endWeek = startOfWeek(bEnd, { weekStartsOn: 1 });
  const weekCount =
    Math.max(1, differenceInCalendarWeeks(endWeek, startWeek, { weekStartsOn: 1 })) + 1;

  const totalWeight = effectiveSnapshots.reduce((s, t) => s + (t.weight || 1), 0) || 1;
  const currentWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // 현재 전체 actual 가중 평균 (leaf 기준)
  const currentLeafs = getLeafTasks(currentTasks);
  const curTotalWeight = currentLeafs.reduce((s, t) => s + (t.weight || 1), 0) || 1;
  const currentActual =
    currentLeafs.reduce((s, t) => s + (t.weight || 1) * t.actualProgress, 0) / curTotalWeight;

  const points: BaselineSCurvePoint[] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekDate = addWeeks(startWeek, w);
    const weekEndDate = addWeeks(weekDate, 1);
    const weekKey = format(weekDate, 'yyyy-MM-dd');

    let planAccum = 0;
    for (const s of effectiveSnapshots) {
      const ps = parseDate(s.planStart);
      const pe = parseDate(s.planEnd);
      if (!ps || !pe || pe <= ps) continue;
      const wt = (s.weight || 1) / totalWeight;

      if (weekEndDate <= ps) {
        // not started
      } else if (weekDate >= pe) {
        planAccum += wt * 100;
      } else {
        const elapsedMs = Math.min(weekEndDate.getTime(), pe.getTime()) - ps.getTime();
        const totalMs = pe.getTime() - ps.getTime();
        planAccum += wt * Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
      }
    }

    let actual: number | null = null;
    if (weekKey === currentWeekStart) {
      actual = Math.round(currentActual * 10) / 10;
    } else if (weekKey < currentWeekStart) {
      // 과거는 linear ramp (0 → 현재값)을 보여줌
      actual = null;
    }

    points.push({
      weekIndex: w + 1,
      weekLabel: format(weekDate, 'M/d'),
      baselinePlan: Math.round(planAccum * 10) / 10,
      actual,
    });
  }

  // 과거 구간 actual 보간: 0부터 현재값까지 선형 채움
  const currentIdx = points.findIndex((p) => {
    const weekDate = addWeeks(startWeek, p.weekIndex - 1);
    return format(weekDate, 'yyyy-MM-dd') === currentWeekStart;
  });
  if (currentIdx >= 0) {
    const cur = points[currentIdx].actual ?? 0;
    for (let i = 0; i < currentIdx; i++) {
      points[i].actual = Math.round((cur * ((i + 1) / (currentIdx + 1))) * 10) / 10;
    }
  }

  return points;
}

function earliestDate(dates: (string | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    const parsed = parseDate(d);
    if (parsed && (!best || parsed < best)) best = parsed;
  }
  return best;
}

function latestDate(dates: (string | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    const parsed = parseDate(d);
    if (parsed && (!best || parsed > best)) best = parsed;
  }
  return best;
}
