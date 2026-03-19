import type { ProjectMember, Task } from '../types';
import { generateId } from './utils';

export function cloneProjectMembers(params: {
  sourceMembers: ProjectMember[];
  targetProjectId: string;
  ownerUserId?: string;
  ownerName?: string;
}) {
  const idMap = new Map<string, string>();
  const now = new Date().toISOString();

  const members = params.sourceMembers.map((member) => {
    const nextId = generateId();
    idMap.set(member.id, nextId);
    return {
      ...member,
      id: nextId,
      projectId: params.targetProjectId,
      createdAt: now,
      role: params.ownerUserId
        ? member.userId === params.ownerUserId
          ? 'owner'
          : member.role === 'owner'
            ? 'admin'
            : member.role
        : member.role,
      name:
        params.ownerUserId && member.userId === params.ownerUserId && params.ownerName
          ? params.ownerName
          : member.name,
    };
  });

  return { members, memberIdMap: idMap };
}

export function cloneProjectTasks(params: {
  sourceTasks: Task[];
  targetProjectId: string;
  memberIdMap: Map<string, string>;
}) {
  const taskIdMap = new Map<string, string>();
  const now = new Date().toISOString();

  params.sourceTasks.forEach((task) => {
    taskIdMap.set(task.id, generateId());
  });

  const tasks = params.sourceTasks.map((task) => ({
    ...task,
    id: taskIdMap.get(task.id)!,
    projectId: params.targetProjectId,
    parentId: task.parentId ? taskIdMap.get(task.parentId) ?? null : null,
    assigneeId: task.assigneeId ? params.memberIdMap.get(task.assigneeId) ?? null : null,
    predecessorIds: (task.predecessorIds || []).map((id) => taskIdMap.get(id) ?? id),
    taskSource: 'cloned' as const,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    status: 'pending' as const,
    createdAt: now,
    updatedAt: now,
    isExpanded: true,
  }));

  return tasks;
}
