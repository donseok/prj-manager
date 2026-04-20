import { generateId, storage } from './utils';

export interface TaskAssigneeHistoryEntry {
  id: string;
  projectId: string;
  taskId: string;
  actorId: string;
  actorName: string;
  /** null = 미배정 */
  oldAssigneeId: string | null;
  oldAssigneeName: string | null;
  newAssigneeId: string | null;
  newAssigneeName: string | null;
  createdAt: string;
}

const MAX_ENTRIES_PER_PROJECT = 500;

function lsKey(projectId: string): string {
  return `task_assignee_history_${projectId}`;
}

export function loadAssigneeHistory(projectId: string): TaskAssigneeHistoryEntry[] {
  return storage.get<TaskAssigneeHistoryEntry[]>(lsKey(projectId), []);
}

export function loadAssigneeHistoryForTask(projectId: string, taskId: string): TaskAssigneeHistoryEntry[] {
  return loadAssigneeHistory(projectId)
    .filter((entry) => entry.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function hasAssigneeHistory(projectId: string, taskId: string): boolean {
  return loadAssigneeHistory(projectId).some((entry) => entry.taskId === taskId);
}

export function appendAssigneeHistory(params: {
  projectId: string;
  taskId: string;
  actorId: string;
  actorName: string;
  oldAssigneeId: string | null;
  oldAssigneeName: string | null;
  newAssigneeId: string | null;
  newAssigneeName: string | null;
}): TaskAssigneeHistoryEntry {
  const entry: TaskAssigneeHistoryEntry = {
    id: generateId(),
    projectId: params.projectId,
    taskId: params.taskId,
    actorId: params.actorId,
    actorName: params.actorName,
    oldAssigneeId: params.oldAssigneeId,
    oldAssigneeName: params.oldAssigneeName,
    newAssigneeId: params.newAssigneeId,
    newAssigneeName: params.newAssigneeName,
    createdAt: new Date().toISOString(),
  };

  const existing = loadAssigneeHistory(params.projectId);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES_PER_PROJECT);
  storage.set(lsKey(params.projectId), next);
  return entry;
}
