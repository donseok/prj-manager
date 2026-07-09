import { parseISO, differenceInCalendarDays } from 'date-fns';
import type { Task } from '../types';

/**
 * 공정율 계산의 단일 기준(single source of truth).
 *
 * 이 모듈이 도입되기 전에는 대시보드/주간보고/포트폴리오가 각자 공정율을 계산해서
 * 같은 프로젝트가 화면마다 다른 %로 보였다 (예: 계획 공정율 57% vs 51%).
 * 모든 화면·리포트는 여기 있는 함수만 사용한다.
 */

/** DB 컬럼(plan_progress/actual_progress)이 numeric(5,2) → 저장 정밀도는 소수점 2자리 */
export const PROGRESS_STORAGE_DECIMALS = 2;

/** 화면·리포트 표시 정밀도 */
export const PROGRESS_DISPLAY_DECIMALS = 1;

export type ProgressField = 'planProgress' | 'actualProgress';

export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** decimals;
  const scaled = value * factor;
  // 8.575 * 100 === 857.4999999999999 처럼 스케일링이 만들어내는 표현 오차를 보정한다.
  // 절대 EPSILON 은 크기가 큰 값에서 1 ulp 보다 작아 무의미하므로 크기에 비례시킨다.
  const corrected = scaled + Math.sign(scaled) * Math.abs(scaled) * Number.EPSILON;
  return Math.round(corrected) / factor;
}

/** 저장·집계용 반올림 (소수점 2자리). 롤업 단계마다 정수로 깎으면 오차가 누적된다. */
export function roundProgress(value: number): number {
  return roundTo(value, PROGRESS_STORAGE_DECIMALS);
}

/**
 * 가중 평균. 반올림하지 않는다 — 호출자가 마지막에 한 번만 반올림한다.
 * 가중치 합이 0이면 단순 평균으로 fallback.
 */
export function weightedProgress(tasks: Task[], field: ProgressField): number {
  if (tasks.length === 0) return 0;

  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
  return totalWeight > 0
    ? tasks.reduce((sum, t) => sum + t.weight * t[field], 0) / totalWeight
    : tasks.reduce((sum, t) => sum + t[field], 0) / tasks.length;
}

/**
 * 프로젝트 전체 공정율의 집계 기준이 되는 루트 작업(Level-1 Phase).
 * 하위 레벨은 normalizeTaskHierarchy()가 이미 Phase로 롤업해 두었다.
 */
export function getRootTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.parentId || t.level === 1);
}

/**
 * 리프 Task의 계획 공정율을 "오늘" 기준으로 계산.
 * planned_progress = clamp(0, 100, (today - planStart) / (planEnd - planStart) * 100)
 *
 * normalizeTaskHierarchy()가 저장 시점에 적용하는 것과 동일한 공식이다.
 * (원본은 projectTaskSync.ts에 있었으나, 저장 시점뿐 아니라 조회 시점에도
 * 같은 공식을 재사용해야 해서 단일 기준 모듈인 이 파일로 옮겼다.)
 */
export function calculateLeafPlanProgress(task: Task, today: Date): number {
  const start = task.planStart ? parseISO(task.planStart) : null;
  const end = task.planEnd ? parseISO(task.planEnd) : null;
  if (!start || !end) return 0;

  const totalDays = differenceInCalendarDays(end, start);
  if (totalDays <= 0) {
    return today >= start ? 100 : 0;
  }

  const elapsedDays = differenceInCalendarDays(today, start);
  const progress = (elapsedDays / totalDays) * 100;
  return roundProgress(Math.min(100, Math.max(0, progress)));
}

/**
 * 계획 공정율은 "오늘"까지의 경과 비율로 정의되므로, 저장된 값을 그대로 쓰면
 * 화면을 오래 열어둔 세션과 예전에 내보낸 파일이 서로 다른 값을 보여준다
 * (예: 며칠 전 내보낸 주간보고 엑셀 52% vs 방금 연 대시보드 57%).
 *
 * 조회 시점마다 트리 전체의 계획 공정율을 "지금"으로 다시 계산해서, 대시보드·
 * 주간보고·현황 보고서(PDF/PPT)가 언제 열어봐도 항상 같은 값을 내도록 한다.
 * (actualProgress는 시간에 따라 자동으로 변하는 값이 아니므로 대상이 아니다.)
 */
export function refreshPlanProgress(tasks: Task[], today: Date = new Date()): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const childrenByParent = new Map<string, Task[]>();
  tasks.forEach((t) => {
    const parentId = t.parentId && byId.has(t.parentId) ? t.parentId : null;
    if (parentId) {
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(t);
      childrenByParent.set(parentId, siblings);
    }
  });

  const resolved = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (task: Task): number => {
    const cached = resolved.get(task.id);
    if (cached !== undefined) return cached;
    if (visiting.has(task.id)) return task.planProgress; // 순환 참조 방지
    visiting.add(task.id);

    const children = childrenByParent.get(task.id);
    const value =
      !children || children.length === 0
        ? calculateLeafPlanProgress(task, today)
        : roundProgress(
            weightedProgress(
              children.map((c) => ({ ...c, planProgress: resolve(c) })),
              'planProgress'
            )
          );

    resolved.set(task.id, value);
    return value;
  };

  return tasks.map((t) => ({ ...t, planProgress: resolve(t) }));
}

/**
 * 프로젝트 전체 공정율 — 대시보드/주간보고/포트폴리오 공통 기준.
 *
 * Phase 가중치를 존중하는 계층적 롤업을 사용한다. 리프 작업을 전역 가중 평균하면
 * 사용자가 지정한 Phase 가중치가 무시되고, 작업 개수가 많은 Phase가 과대 반영된다.
 */
export function calculateProjectProgress(tasks: Task[], field: ProgressField): number {
  const effectiveTasks = field === 'planProgress' ? refreshPlanProgress(tasks) : tasks;
  return roundProgress(weightedProgress(getRootTasks(effectiveTasks), field));
}

/** 공정율 표시 문자열 (기본 소수점 1자리) */
export function formatProgress(value: number, decimals: number = PROGRESS_DISPLAY_DECIMALS): string {
  return `${roundTo(value, decimals).toFixed(decimals)}%`;
}
