import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Task } from '../types';

export interface CriticalPathResult {
  criticalTasks: string[]; // 크리티컬 패스에 포함된 task ID 배열
  totalDuration: number; // 전체 프로젝트 기간 (일)
  slack: Map<string, number>; // 각 작업의 여유 시간 (일)
}

interface TaskNode {
  id: string;
  duration: number; // 일 단위
  predecessors: string[];
  successors: string[];
  es: number; // Earliest Start
  ef: number; // Earliest Finish
  ls: number; // Latest Start
  lf: number; // Latest Finish
  slack: number;
}

/**
 * 순환 의존성을 감지합니다.
 * @returns 순환이 있으면 true
 */
function detectCycle(nodes: Map<string, TaskNode>): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(id: string): boolean {
    visited.add(id);
    recStack.add(id);

    const node = nodes.get(id);
    if (node) {
      for (const succId of node.successors) {
        if (!visited.has(succId)) {
          if (dfs(succId)) return true;
        } else if (recStack.has(succId)) {
          return true;
        }
      }
    }

    recStack.delete(id);
    return false;
  }

  for (const id of nodes.keys()) {
    if (!visited.has(id) && dfs(id)) {
      return true;
    }
  }

  return false;
}

/**
 * 위상 정렬 (Kahn's algorithm)
 */
function topologicalSort(nodes: Map<string, TaskNode>): string[] {
  const inDegree = new Map<string, number>();
  for (const [id, node] of nodes) {
    if (!inDegree.has(id)) inDegree.set(id, 0);
    for (const succId of node.successors) {
      inDegree.set(succId, (inDegree.get(succId) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    const node = nodes.get(id);
    if (node) {
      for (const succId of node.successors) {
        const newDeg = (inDegree.get(succId) || 1) - 1;
        inDegree.set(succId, newDeg);
        if (newDeg === 0) queue.push(succId);
      }
    }
  }

  return sorted;
}

/**
 * 작업 목록에서 크리티컬 패스를 계산합니다.
 * leaf task(자식이 없는 작업)만 대상으로 합니다.
 */
export function calculateCriticalPath(tasks: Task[]): CriticalPathResult {
  const emptyResult: CriticalPathResult = {
    criticalTasks: [],
    totalDuration: 0,
    slack: new Map(),
  };

  // 자식이 있는 작업의 ID 집합
  const parentIds = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!));
  // leaf tasks만 대상
  const leafTasks = tasks.filter((t) => !parentIds.has(t.id));

  if (leafTasks.length === 0) return emptyResult;

  const taskMap = new Map(leafTasks.map((t) => [t.id, t]));

  // 노드 생성
  const nodes = new Map<string, TaskNode>();

  for (const task of leafTasks) {
    let duration = 1;
    if (task.planStart && task.planEnd) {
      duration = Math.max(1, differenceInCalendarDays(parseISO(task.planEnd), parseISO(task.planStart)) + 1);
    } else if (task.durationDays && task.durationDays > 0) {
      duration = task.durationDays;
    }

    // 유효한 선행 작업만 포함 (leaf task 범위 내)
    const predecessors = (task.predecessorIds || []).filter((id) => taskMap.has(id));

    nodes.set(task.id, {
      id: task.id,
      duration,
      predecessors,
      successors: [],
      es: 0,
      ef: 0,
      ls: 0,
      lf: 0,
      slack: 0,
    });
  }

  // 후행 관계 빌드
  for (const [id, node] of nodes) {
    for (const predId of node.predecessors) {
      const predNode = nodes.get(predId);
      if (predNode) {
        predNode.successors.push(id);
      }
    }
  }

  // 순환 의존성 감지
  if (detectCycle(nodes)) {
    console.warn('[CriticalPath] 순환 의존성이 감지되었습니다. 크리티컬 패스를 계산할 수 없습니다.');
    return {
      ...emptyResult,
      slack: new Map(leafTasks.map((t) => [t.id, 0])),
    };
  }

  // 위상 정렬
  const sorted = topologicalSort(nodes);

  // Forward pass: ES, EF 계산
  for (const id of sorted) {
    const node = nodes.get(id)!;
    let maxPredEf = 0;
    for (const predId of node.predecessors) {
      const pred = nodes.get(predId);
      if (pred) {
        maxPredEf = Math.max(maxPredEf, pred.ef);
      }
    }
    node.es = maxPredEf;
    node.ef = node.es + node.duration;
  }

  // 전체 프로젝트 기간
  let projectDuration = 0;
  for (const node of nodes.values()) {
    projectDuration = Math.max(projectDuration, node.ef);
  }

  // Backward pass: LS, LF 계산
  // 먼저 모든 LF를 프로젝트 기간으로 초기화
  for (const node of nodes.values()) {
    node.lf = projectDuration;
    node.ls = node.lf - node.duration;
  }

  // 역순으로
  const reverseSorted = [...sorted].reverse();
  for (const id of reverseSorted) {
    const node = nodes.get(id)!;

    // 후행 작업의 LS 중 최솟값이 이 작업의 LF
    if (node.successors.length > 0) {
      let minSuccLs = Infinity;
      for (const succId of node.successors) {
        const succ = nodes.get(succId);
        if (succ) {
          minSuccLs = Math.min(minSuccLs, succ.ls);
        }
      }
      node.lf = minSuccLs;
    } else {
      node.lf = projectDuration;
    }
    node.ls = node.lf - node.duration;
  }

  // Slack 계산 및 크리티컬 작업 판별
  const slack = new Map<string, number>();
  const criticalTasks: string[] = [];

  for (const node of nodes.values()) {
    node.slack = node.ls - node.es;
    slack.set(node.id, node.slack);
    if (node.slack === 0) {
      criticalTasks.push(node.id);
    }
  }

  return {
    criticalTasks,
    totalDuration: projectDuration,
    slack,
  };
}
