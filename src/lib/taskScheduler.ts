import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Task } from '../types';
import { buildTaskTree } from './utils';
import { normalizeTaskHierarchy } from './projectTaskSync';

function getTaskDurationDays(task: Task) {
  if (typeof task.durationDays === 'number' && task.durationDays > 0) {
    return task.durationDays;
  }

  if (task.planStart && task.planEnd) {
    return Math.max(differenceInCalendarDays(parseISO(task.planEnd), parseISO(task.planStart)) + 1, 1);
  }

  return 2;
}

function flattenTree(nodes: Task[], result: Task[] = []) {
  nodes.forEach((node) => {
    const { children, ...task } = node;
    result.push(task);
    if (children && children.length > 0) {
      flattenTree(children, result);
    }
  });
  return result;
}

export function autoScheduleTasks(tasks: Task[], projectStartDate?: string) {
  if (tasks.length === 0) return tasks;

  const startCursor = projectStartDate ? parseISO(projectStartDate) : new Date();
  const taskTree = buildTaskTree(tasks.map((task) => ({ ...task })));
  const taskMap = new Map<string, Task>();
  const completionMap = new Map<string, Date>();

  flattenTree(taskTree).forEach((task) => {
    taskMap.set(task.id, task);
  });

  const scheduleLeaf = (task: Task, fallbackCursor: Date) => {
    const predecessorDates = (task.predecessorIds || [])
      .map((predecessorId) => completionMap.get(predecessorId))
      .filter((value): value is Date => Boolean(value));

    const taskStart =
      predecessorDates.length > 0
        ? addDays(
            predecessorDates.reduce((latest, current) => (current > latest ? current : latest)),
            1
          )
        : fallbackCursor;

    const durationDays = getTaskDurationDays(task);
    const taskEnd = addDays(taskStart, durationDays - 1);
    task.planStart = format(taskStart, 'yyyy-MM-dd');
    task.planEnd = format(taskEnd, 'yyyy-MM-dd');
    task.durationDays = durationDays;
    task.updatedAt = new Date().toISOString();
    completionMap.set(task.id, taskEnd);
    return addDays(taskEnd, 1);
  };

  const visit = (nodes: Task[], cursor: Date): Date => {
    let localCursor = cursor;
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        localCursor = visit(node.children, localCursor);
        return;
      }

      localCursor = scheduleLeaf(node, localCursor);
    });
    return localCursor;
  };

  visit(taskTree, startCursor);
  return normalizeTaskHierarchy(flattenTree(taskTree));
}

export function buildSequentialDependencies(tasks: Task[]) {
  const taskTree = buildTaskTree(tasks.map((task) => ({ ...task })));

  const visit = (nodes: Task[]) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        visit(node.children);
        return;
      }
    });

    nodes.forEach((node, index) => {
      if (node.children && node.children.length > 0) return;
      node.predecessorIds = index > 0 ? [nodes[index - 1].id] : [];
    });
  };

  visit(taskTree);
  return normalizeTaskHierarchy(flattenTree(taskTree));
}
