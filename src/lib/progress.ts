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
 * 프로젝트 전체 공정율 — 대시보드/주간보고/포트폴리오 공통 기준.
 *
 * Phase 가중치를 존중하는 계층적 롤업을 사용한다. 리프 작업을 전역 가중 평균하면
 * 사용자가 지정한 Phase 가중치가 무시되고, 작업 개수가 많은 Phase가 과대 반영된다.
 */
export function calculateProjectProgress(tasks: Task[], field: ProgressField): number {
  return roundProgress(weightedProgress(getRootTasks(tasks), field));
}

/** 공정율 표시 문자열 (기본 소수점 1자리) */
export function formatProgress(value: number, decimals: number = PROGRESS_DISPLAY_DECIMALS): string {
  return `${roundTo(value, decimals).toFixed(decimals)}%`;
}
