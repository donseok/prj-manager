import { differenceInCalendarDays, format } from 'date-fns';
import type { Project, ProjectStatus, Task } from '../types';
import { syncProjectTasks, upsertProject } from './dataRepository';
import { getLeafTasks } from './taskAnalytics';
import { parseDate } from './utils';

type InternalTask = Task & {
  _children?: InternalTask[];
  _sourceIndex: number;
};

function compareDateAsc(a: string | null | undefined, b: string | null | undefined) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}

function compareDateDesc(a: string | null | undefined, b: string | null | undefined) {
  return compareDateAsc(b, a);
}

function getEarliestDate(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort(compareDateAsc)[0] ?? null;
}

function getLatestDate(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort(compareDateDesc)[0] ?? null;
}

function formatDateOnly(value: string | null | undefined) {
  const parsed = parseDate(value);
  return parsed ? format(parsed, 'yyyy-MM-dd') : undefined;
}

/** 합리적 범위(2000~2099)를 벗어나는 극단값 날짜를 필터링 */
function filterReasonableDates(dates: Array<string | null | undefined>): Array<string | null | undefined> {
  return dates.filter((d) => {
    if (!d) return false;
    const year = parseInt(d.substring(0, 4), 10);
    return !isNaN(year) && year >= 2000 && year <= 2099;
  });
}

function calculateAggregateProgress(tasks: Task[], field: 'planProgress' | 'actualProgress') {
  if (tasks.length === 0) return 0;

  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  const value =
    totalWeight > 0
      ? tasks.reduce((sum, task) => sum + task.weight * task[field], 0) / totalWeight
      : tasks.reduce((sum, task) => sum + task[field], 0) / tasks.length;

  return Math.round(value);
}


/**
 * 리프 Task의 계획 공정율을 오늘 날짜 기준으로 자동 계산.
 * planned_progress = clamp(0, 100, (today - planStart) / (planEnd - planStart) * 100)
 */
function calculateLeafPlanProgress(task: Task, today: Date): number {
  const start = parseDate(task.planStart);
  const end = parseDate(task.planEnd);
  if (!start || !end) return 0;

  const totalDays = differenceInCalendarDays(end, start);
  if (totalDays <= 0) {
    return today >= start ? 100 : 0;
  }

  const elapsedDays = differenceInCalendarDays(today, start);
  const progress = (elapsedDays / totalDays) * 100;
  return Math.round(Math.min(100, Math.max(0, progress)));
}

function deriveParentStatus(children: Task[]): Task['status'] {
  if (children.length === 0) return 'pending';
  if (children.every((child) => child.status === 'completed' || child.actualProgress >= 100)) {
    return 'completed';
  }
  if (
    children.some(
      (child) =>
        child.status === 'in_progress' ||
        child.actualProgress > 0 ||
        Boolean(child.actualStart) ||
        Boolean(child.actualEnd)
    )
  ) {
    return 'in_progress';
  }
  if (children.every((child) => child.status === 'on_hold')) {
    return 'on_hold';
  }
  return 'pending';
}

function applyParentAggregation(task: InternalTask, children: InternalTask[]) {
  const allChildrenCompleted = children.every(
    (child) => child.status === 'completed' || child.actualProgress >= 100
  );

  task.planStart = getEarliestDate(filterReasonableDates(children.map((child) => child.planStart))) ?? task.planStart ?? null;
  task.planEnd = getLatestDate(filterReasonableDates(children.map((child) => child.planEnd))) ?? task.planEnd ?? null;
  task.actualStart = getEarliestDate(filterReasonableDates(children.map((child) => child.actualStart))) ?? task.actualStart ?? null;
  // 자식이 모두 완료되지 않으면 부모의 actualEnd를 null로 되돌린다.
  // 자식이 in_progress로 되돌아가면 부모도 미완료 상태여야 하므로 이는 의도된 동작이다.
  // 이전 actualEnd 값은 별도 보존하지 않는다 — 자식이 다시 모두 완료되면 재계산된다.
  task.actualEnd = allChildrenCompleted
    ? getLatestDate(filterReasonableDates(children.map((child) => child.actualEnd))) ?? task.actualEnd ?? null
    : null;
  task.planProgress = calculateAggregateProgress(children, 'planProgress');
  task.actualProgress = calculateAggregateProgress(children, 'actualProgress');
  task.status = deriveParentStatus(children);
  task.updatedAt = getLatestDate([task.updatedAt, ...children.map((child) => child.updatedAt)]) ?? task.updatedAt;
}

export function normalizeTaskHierarchy(tasks: Task[]) {
  const taskMap = new Map<string, InternalTask>();
  const childrenByParent = new Map<string | null, InternalTask[]>();

  tasks.forEach((task, index) => {
    taskMap.set(task.id, {
      ...task,
      _children: [],
      _sourceIndex: index,
    });
  });

  taskMap.forEach((task) => {
    if (task.parentId && !taskMap.has(task.parentId)) {
      console.warn('[normalizeTaskHierarchy] Task orphaned (parent not found):', task.id, 'parentId:', task.parentId);
    }
    const parentId = task.parentId && taskMap.has(task.parentId) ? task.parentId : null;
    task.parentId = parentId;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(task);
    childrenByParent.set(parentId, siblings);
  });

  // 역전 날짜 자동 정정: 기존 데이터에 planStart > planEnd인 경우 스왑
  taskMap.forEach((task) => {
    if (task.planStart && task.planEnd && task.planStart > task.planEnd) {
      [task.planStart, task.planEnd] = [task.planEnd, task.planStart];
    }
    if (task.actualStart && task.actualEnd && task.actualStart > task.actualEnd) {
      [task.actualStart, task.actualEnd] = [task.actualEnd, task.actualStart];
    }
  });

  childrenByParent.forEach((siblings) => {
    siblings.sort((left, right) => left.orderIndex - right.orderIndex || left._sourceIndex - right._sourceIndex);
  });

  // 리프 Task의 계획 공정율 자동 계산 (오늘 기준)
  const today = new Date();
  const parentIds = new Set(childrenByParent.keys());
  taskMap.forEach((task) => {
    if (!parentIds.has(task.id)) {
      task.planProgress = calculateLeafPlanProgress(task, today);
    }
  });

  const visited = new Set<string>();
  const buildBranch = (parentId: string | null, level: number): InternalTask[] => {
    if (parentId && visited.has(parentId)) return [];
    if (parentId) visited.add(parentId);
    const siblings = childrenByParent.get(parentId) ?? [];
    return siblings.map((task, index) => {
      task.level = level;
      task.orderIndex = index;
      const children = buildBranch(task.id, level + 1);
      task._children = children;
      if (children.length > 0) {
        applyParentAggregation(task, children);
      }
      return task;
    });
  };

  const roots = buildBranch(null, 1);
  const normalized: Task[] = [];

  const flatten = (nodes: InternalTask[]) => {
    nodes.forEach((node) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _children, _sourceIndex, ...task } = node;
      normalized.push({ ...task });
      if (_children && _children.length > 0) {
        flatten(_children);
      }
    });
  };

  flatten(roots);
  return normalized;
}

function deriveProjectStatus(project: Project, tasks: Task[]): ProjectStatus {
  if (project.status === 'deleted') return 'deleted';
  if (project.settings?.statusMode === 'manual' && project.settings.manualStatus) {
    return project.settings.manualStatus;
  }

  const leafTasks = getLeafTasks(tasks);
  if (leafTasks.length === 0) return 'preparing';
  if (leafTasks.every((task) => task.status === 'completed' || task.actualProgress >= 100)) {
    return 'completed';
  }
  if (
    leafTasks.some(
      (task) =>
        task.status === 'in_progress' ||
        task.actualProgress > 0 ||
        Boolean(task.actualStart) ||
        Boolean(task.actualEnd)
    )
  ) {
    return 'active';
  }
  return 'preparing';
}

function buildDerivedProject(project: Project, tasks: Task[]) {
  const now = new Date().toISOString();
  const derivedStatus = deriveProjectStatus(project, tasks);
  // WBS 작업 기반 일정 산출
  const taskStartDate = getEarliestDate(filterReasonableDates(tasks.flatMap((task) => [task.planStart, task.actualStart])));
  const taskEndDate = getLatestDate(filterReasonableDates(tasks.flatMap((task) => [task.planEnd, task.actualEnd])));
  // 프로젝트 설정 일정과 WBS 일정 중 더 넓은 범위를 사용
  const startDate = getEarliestDate([taskStartDate, project.startDate]) ?? taskStartDate;
  const endDate = getLatestDate([taskEndDate, project.endDate]) ?? taskEndDate;
  const completedAt =
    derivedStatus === 'completed'
      ? getLatestDate(tasks.map((task) => task.actualEnd)) ?? project.completedAt ?? now
      : undefined;

  return {
    ...project,
    settings:
      project.settings?.statusMode === 'manual'
        ? {
            ...project.settings,
            manualStatus: derivedStatus,
          }
        : project.settings,
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
    status: derivedStatus,
    completedAt,
    updatedAt: now,
  };
}

export async function syncProjectWorkspace(project: Project, tasks: Task[], options?: { skipNormalize?: boolean }) {
  const normalizedTasks = options?.skipNormalize ? tasks : normalizeTaskHierarchy(tasks);
  await syncProjectTasks(project.id, normalizedTasks);
  const savedProject = await upsertProject(buildDerivedProject(project, normalizedTasks));
  return {
    project: savedProject,
    tasks: normalizedTasks,
  };
}
