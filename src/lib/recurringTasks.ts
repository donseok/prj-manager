import { format, getDay, getDate, startOfDay, differenceInWeeks } from 'date-fns';
import type { Task, RecurringRule } from '../types';
import { generateId } from './utils';

/**
 * Check if a recurring rule should generate a task on a given date.
 */
function shouldGenerate(rule: RecurringRule, date: Date): boolean {
  if (!rule.isActive) return false;

  const day = getDay(date);     // 0=Sun, 6=Sat
  const dayOfMonth = getDate(date);

  switch (rule.frequency) {
    case 'daily':
      return true;

    case 'weekly':
      return day === (rule.dayOfWeek ?? 1);

    case 'biweekly': {
      if (day !== (rule.dayOfWeek ?? 1)) return false;
      // Even week from epoch → generate
      const refDate = new Date(2024, 0, 1); // reference Monday
      const weeksDiff = differenceInWeeks(startOfDay(date), refDate);
      return weeksDiff % 2 === 0;
    }

    case 'monthly':
      return dayOfMonth === (rule.dayOfMonth ?? 1);

    default:
      return false;
  }
}

/**
 * Check if a task was already generated for this rule on the given date.
 * We check by matching the task name pattern: "templateName (M/D)"
 */
function alreadyGenerated(rule: RecurringRule, existingTasks: Task[], date: Date): boolean {
  const dateSuffix = `(${format(date, 'M/d')})`;
  const expectedName = `${rule.templateTaskName} ${dateSuffix}`;
  return existingTasks.some(
    (t) =>
      t.name === expectedName &&
      (rule.parentId ? t.parentId === rule.parentId : true)
  );
}

/**
 * Generate recurring tasks for all active rules on a given date.
 * Returns new tasks to add (not yet added to store).
 */
export function generateRecurringTasks(
  rules: RecurringRule[],
  existingTasks: Task[],
  baseDate: Date = new Date()
): { tasks: Task[]; updatedRules: RecurringRule[] } {
  const today = startOfDay(baseDate);
  const newTasks: Task[] = [];
  const updatedRules: RecurringRule[] = [];

  for (const rule of rules) {
    if (!shouldGenerate(rule, today)) continue;
    if (alreadyGenerated(rule, existingTasks, today)) continue;

    const now = new Date().toISOString();
    const dateSuffix = `(${format(today, 'M/d')})`;
    const todayStr = format(today, 'yyyy-MM-dd');

    const task: Task = {
      id: generateId(),
      projectId: rule.projectId,
      parentId: rule.parentId ?? null,
      level: rule.level,
      orderIndex: existingTasks.filter(
        (t) => (t.parentId ?? null) === (rule.parentId ?? null)
      ).length + newTasks.filter(
        (t) => (t.parentId ?? null) === (rule.parentId ?? null)
      ).length,
      name: `${rule.templateTaskName} ${dateSuffix}`,
      output: rule.output,
      assigneeId: rule.assigneeId ?? null,
      weight: 1,
      durationDays: 1,
      predecessorIds: [],
      taskSource: 'template',
      planStart: todayStr,
      planEnd: todayStr,
      planProgress: 0,
      actualStart: null,
      actualEnd: null,
      actualProgress: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      isExpanded: true,
    };

    newTasks.push(task);
    updatedRules.push({ ...rule, lastGeneratedAt: now });
  }

  return { tasks: newTasks, updatedRules };
}

/**
 * Generate the next scheduled task from a rule immediately (for "지금 생성" button).
 */
export function generateImmediateTask(
  rule: RecurringRule,
  existingTasks: Task[],
  baseDate: Date = new Date()
): Task {
  const now = new Date().toISOString();
  const dateSuffix = `(${format(baseDate, 'M/d')})`;
  const todayStr = format(baseDate, 'yyyy-MM-dd');

  return {
    id: generateId(),
    projectId: rule.projectId,
    parentId: rule.parentId ?? null,
    level: rule.level,
    orderIndex: existingTasks.filter(
      (t) => (t.parentId ?? null) === (rule.parentId ?? null)
    ).length,
    name: `${rule.templateTaskName} ${dateSuffix}`,
    output: rule.output,
    assigneeId: rule.assigneeId ?? null,
    weight: 1,
    durationDays: 1,
    predecessorIds: [],
    taskSource: 'template',
    planStart: todayStr,
    planEnd: todayStr,
    planProgress: 0,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    isExpanded: true,
  };
}
