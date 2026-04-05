/**
 * taskFieldSync.ts
 * 상태 ↔ 진행률 ↔ 날짜 자동 연동
 *
 * leaf task 필드 변경 시 관련 필드를 자동으로 동기화한다.
 * 부모 task는 normalizeTaskHierarchy에서 자식 기반으로 재계산되므로 여기서는 leaf만 처리.
 */

import { differenceInCalendarDays, format } from 'date-fns';
import type { Task, TaskStatus } from '../types';
import { parseDate } from './utils';

const today = () => format(new Date(), 'yyyy-MM-dd');

/** 변경된 필드 이름 */
type SyncField = 'status' | 'actualProgress' | 'actualStart' | 'actualEnd' | 'planProgress' | 'planStart' | 'planEnd';

interface SyncResult {
  updates: Partial<Task>;
  changed: boolean;
}

/**
 * leaf task의 특정 필드가 변경되었을 때 연관 필드를 동기화한다.
 * 반환값의 updates에는 변경이 필요한 필드만 포함된다.
 */
export function syncTaskField(task: Task, field: SyncField, newValue: unknown): SyncResult {
  const updates: Partial<Task> = {};

  switch (field) {
    case 'status':
      applySyncFromStatus(task, newValue as TaskStatus, updates);
      break;
    case 'actualProgress':
      applySyncFromProgress(task, newValue as number, updates);
      break;
    case 'actualStart':
      applySyncFromActualStart(task, newValue as string | null, updates);
      break;
    case 'actualEnd':
      applySyncFromActualEnd(task, newValue as string | null, updates);
      break;
    case 'planProgress':
      // planProgress 변경은 다른 필드에 영향 없음
      break;
    case 'planStart':
    case 'planEnd':
      applySyncFromPlanDates(task, updates);
      break;
  }

  const changed = Object.keys(updates).length > 0;
  return { updates, changed };
}

/**
 * 여러 필드가 동시에 변경된 경우의 일괄 동기화.
 * 변경 필드를 모두 적용한 뒤 최종 결과를 반환한다.
 */
export function syncTaskFields(
  task: Task,
  changes: Partial<Pick<Task, 'status' | 'actualProgress' | 'actualStart' | 'actualEnd' | 'planProgress' | 'planStart' | 'planEnd'>>
): SyncResult {
  let merged: Partial<Task> = {};
  const workingTask = { ...task, ...changes };

  for (const [field, value] of Object.entries(changes) as [SyncField, unknown][]) {
    const { updates } = syncTaskField(workingTask, field as SyncField, value);
    merged = { ...merged, ...updates };
    Object.assign(workingTask, updates);
  }

  const changed = Object.keys(merged).length > 0;
  return { updates: merged, changed };
}

// ── 상태 → 진행률/날짜 ──────────────────────────────────────

function applySyncFromStatus(task: Task, status: TaskStatus, updates: Partial<Task>) {
  switch (status) {
    case 'completed':
      // 완료로 변경 → 실적 100%, 실적종료 자동채움
      if (task.actualProgress < 100) {
        updates.actualProgress = 100;
      }
      if (!task.actualEnd) {
        updates.actualEnd = today();
      }
      if (!task.actualStart) {
        updates.actualStart = task.planStart || today();
      }
      break;

    case 'in_progress':
      // 진행중으로 변경 → 실적시작 자동채움, 실적종료 제거
      if (!task.actualStart) {
        updates.actualStart = today();
      }
      // 100%에서 진행중으로 돌아오면 진행률 낮춤
      if (task.actualProgress >= 100) {
        updates.actualProgress = 50;
      }
      // 실적종료 제거 (아직 진행중)
      if (task.actualEnd) {
        updates.actualEnd = null;
      }
      break;

    case 'pending':
      // 대기로 변경 → 진행률 0, 실적 날짜 초기화
      if (task.actualProgress > 0) {
        updates.actualProgress = 0;
      }
      if (task.actualStart) {
        updates.actualStart = null;
      }
      if (task.actualEnd) {
        updates.actualEnd = null;
      }
      break;

    case 'on_hold':
      // 보류 → 별도 처리 없음 (진행 중 상태 유지)
      break;
  }
}

// ── 실적공정율 → 상태/날짜 ──────────────────────────────────

function applySyncFromProgress(task: Task, progress: number, updates: Partial<Task>) {
  if (progress >= 100) {
    // 100% → 완료
    if (task.status !== 'completed') {
      updates.status = 'completed';
    }
    if (!task.actualEnd) {
      updates.actualEnd = today();
    }
    if (!task.actualStart) {
      updates.actualStart = task.planStart || today();
    }
  } else if (progress > 0) {
    // 1~99% → 진행중
    if (task.status !== 'in_progress' && task.status !== 'on_hold') {
      updates.status = 'in_progress';
    }
    if (!task.actualStart) {
      updates.actualStart = today();
    }
    // 진행중인데 실적종료가 있으면 제거
    if (task.actualEnd && task.status !== 'on_hold') {
      updates.actualEnd = null;
    }
  } else {
    // 0% → 대기 (보류 상태라면 유지), 실적 날짜 초기화
    if (task.status === 'in_progress') {
      updates.status = 'pending';
    }
    if (task.actualStart) {
      updates.actualStart = null;
    }
    if (task.actualEnd) {
      updates.actualEnd = null;
    }
  }
}

// ── 실적시작 → 상태 ─────────────────────────────────────────

function applySyncFromActualStart(task: Task, actualStart: string | null, updates: Partial<Task>) {
  if (actualStart && task.status === 'pending') {
    // 실적시작이 채워지면 진행중으로 전환
    updates.status = 'in_progress';
    if (task.actualProgress === 0) {
      updates.actualProgress = 5;
    }
  } else if (!actualStart && task.status === 'in_progress') {
    // 실적시작이 지워지면 대기로 전환, 실적 초기화
    updates.status = 'pending';
    if (task.actualProgress > 0) {
      updates.actualProgress = 0;
    }
    if (task.actualEnd) {
      updates.actualEnd = null;
    }
  }
}

// ── 실적종료 → 상태/진행률 ──────────────────────────────────

function applySyncFromActualEnd(task: Task, actualEnd: string | null, updates: Partial<Task>) {
  if (actualEnd) {
    // 실적종료가 채워지면 완료
    if (task.status !== 'completed') {
      updates.status = 'completed';
    }
    if (task.actualProgress < 100) {
      updates.actualProgress = 100;
    }
    if (!task.actualStart) {
      updates.actualStart = task.planStart || actualEnd;
    }
  } else if (!actualEnd && task.status === 'completed') {
    // 실적종료가 지워지면 진행중으로 되돌림
    updates.status = 'in_progress';
    if (task.actualProgress >= 100) {
      updates.actualProgress = 50;
    }
  }
}

// ── 계획시작/종료 → 계획공정율 ─────────────────────────────────

function applySyncFromPlanDates(task: Task, updates: Partial<Task>) {
  const start = parseDate(task.planStart);
  const end = parseDate(task.planEnd);
  if (!start || !end) {
    updates.planProgress = 0;
    return;
  }

  const totalDays = differenceInCalendarDays(end, start);
  const now = new Date();
  if (totalDays <= 0) {
    updates.planProgress = now >= start ? 100 : 0;
    return;
  }

  const elapsedDays = differenceInCalendarDays(now, start);
  updates.planProgress = Math.round(Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)));
}

/** 동기화 대상 필드인지 확인 */
export function isSyncableField(field: string): field is SyncField {
  return ['status', 'actualProgress', 'actualStart', 'actualEnd', 'planProgress', 'planStart', 'planEnd'].includes(field);
}
