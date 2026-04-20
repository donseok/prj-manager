import {
  LEVEL_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type Project,
  type ProjectMember,
  type Task,
} from '../../types';
import { calculateOverallProgress, formatDate } from '../utils';
import { getAssigneeName, getLeafTasks } from '../taskAnalytics';

export type RagSourceType = 'project' | 'task' | 'member';

export interface RagDocument {
  sourceType: RagSourceType;
  sourceId: string;
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
}

function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function contentHash(content: string): string {
  return fnv1aHash(content);
}

function joinLines(lines: Array<string | null | undefined>): string {
  return lines.filter((l): l is string => !!l && l.trim().length > 0).join('\n');
}

export function buildProjectDoc(
  project: Project,
  leafTaskCount: number,
  progressPercent: number,
  memberCount: number,
): RagDocument {
  const content = joinLines([
    `프로젝트: ${project.name}`,
    `상태: ${PROJECT_STATUS_LABELS[project.status]}`,
    project.description ? `설명: ${project.description}` : null,
    project.startDate || project.endDate
      ? `일정: ${formatDate(project.startDate) || '미정'} ~ ${formatDate(project.endDate) || '미정'}`
      : null,
    project.baseDate ? `진척기준일: ${formatDate(project.baseDate)}` : null,
    `작업 수: ${leafTaskCount}건`,
    `멤버 수: ${memberCount}명`,
    `공정률: ${Math.round(progressPercent)}%`,
  ]);

  return {
    sourceType: 'project',
    sourceId: project.id,
    content,
    contentHash: contentHash(content),
    metadata: {
      name: project.name,
      status: project.status,
    },
  };
}

export function buildTaskDoc(task: Task, project: Project, members: ProjectMember[]): RagDocument {
  const assigneeName = getAssigneeName(task, members);
  const levelLabel = LEVEL_LABELS[task.level] || '작업';

  const content = joinLines([
    `작업: ${task.name}`,
    `프로젝트: ${project.name}`,
    `구분: ${levelLabel}`,
    `상태: ${TASK_STATUS_LABELS[task.status]}`,
    `담당: ${assigneeName}`,
    task.planStart || task.planEnd
      ? `계획 일정: ${formatDate(task.planStart) || '미정'} ~ ${formatDate(task.planEnd) || '미정'}`
      : null,
    task.actualStart || task.actualEnd
      ? `실적 일정: ${formatDate(task.actualStart) || '미정'} ~ ${formatDate(task.actualEnd) || '미정'}`
      : null,
    `계획 공정률: ${Math.round(task.planProgress)}%`,
    `실적 공정률: ${Math.round(task.actualProgress)}%`,
    task.description ? `설명: ${task.description}` : null,
    task.output ? `산출물: ${task.output}` : null,
  ]);

  return {
    sourceType: 'task',
    sourceId: task.id,
    content,
    contentHash: contentHash(content),
    metadata: {
      name: task.name,
      level: task.level,
      status: task.status,
      assigneeId: task.assigneeId || null,
      parentId: task.parentId || null,
    },
  };
}

export function buildMemberDoc(member: ProjectMember, tasks: Task[], project: Project): RagDocument {
  const leaves = getLeafTasks(tasks);
  const myTasks = leaves.filter((t) => t.assigneeId === member.id);

  const byStatus = {
    in_progress: myTasks.filter((t) => t.status === 'in_progress'),
    pending: myTasks.filter((t) => t.status === 'pending'),
    completed: myTasks.filter((t) => t.status === 'completed'),
    on_hold: myTasks.filter((t) => t.status === 'on_hold'),
  };

  const taskPreview = myTasks.slice(0, 8).map((t) => `- ${t.name} (${TASK_STATUS_LABELS[t.status]}, ${Math.round(t.actualProgress)}%)`);

  const content = joinLines([
    `멤버: ${member.name}`,
    `프로젝트: ${project.name}`,
    `역할: ${member.role}`,
    `담당 작업: ${myTasks.length}건`,
    `진행 ${byStatus.in_progress.length} / 대기 ${byStatus.pending.length} / 완료 ${byStatus.completed.length} / 보류 ${byStatus.on_hold.length}`,
    taskPreview.length > 0 ? '담당 작업 목록:' : null,
    ...taskPreview,
  ]);

  return {
    sourceType: 'member',
    sourceId: member.id,
    content,
    contentHash: contentHash(content),
    metadata: {
      name: member.name,
      role: member.role,
      taskCount: myTasks.length,
    },
  };
}

export function buildAllProjectDocs(
  project: Project,
  tasks: Task[],
  members: ProjectMember[],
): RagDocument[] {
  const leafTasks = getLeafTasks(tasks);
  const progress = calculateOverallProgress(tasks);
  const docs: RagDocument[] = [buildProjectDoc(project, leafTasks.length, progress, members.length)];

  for (const task of tasks) {
    docs.push(buildTaskDoc(task, project, members));
  }
  for (const member of members) {
    docs.push(buildMemberDoc(member, tasks, project));
  }

  return docs;
}
