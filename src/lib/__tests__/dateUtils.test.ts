import { describe, it, expect } from 'vitest';
import { format, subDays, addDays, startOfWeek } from 'date-fns';
import { getDelayedTasks, getDelayDays, getWeeklyTasks } from '../utils';
import type { Task } from '../../types';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'proj-1',
    parentId: null,
    level: 4,
    orderIndex: 0,
    name: 'Test Task',
    weight: 1,
    planStart: null,
    planEnd: null,
    planProgress: 0,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    status: 'pending',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

describe('M-8 — getDelayedTasks / getDelayDays date-only comparison', () => {
  it('should NOT count a task due TODAY as delayed (planEnd = today midnight vs now)', () => {
    // baseDate is the current time (with hours); planEnd parses to local midnight.
    // A task due today must NOT be delayed.
    const now = new Date();
    const todayTask = createTask({
      planEnd: fmt(now),
      actualProgress: 50,
      status: 'in_progress',
    });

    const delayed = getDelayedTasks([todayTask], now);
    expect(delayed).toHaveLength(0);
  });

  it('should return 0 delay days for a task due TODAY', () => {
    const now = new Date();
    const todayTask = createTask({
      planEnd: fmt(now),
      actualProgress: 50,
      status: 'in_progress',
    });

    expect(getDelayDays(todayTask, now)).toBe(0);
  });

  it('should count a genuinely overdue task (planEnd in the past) as delayed', () => {
    const now = new Date();
    const overdueTask = createTask({
      planEnd: fmt(subDays(now, 3)),
      actualProgress: 50,
      status: 'in_progress',
    });

    const delayed = getDelayedTasks([overdueTask], now);
    expect(delayed).toHaveLength(1);
  });

  it('should compute correct delay days for a genuinely overdue task', () => {
    const now = new Date();
    const overdueTask = createTask({
      planEnd: fmt(subDays(now, 3)),
      actualProgress: 50,
      status: 'in_progress',
    });

    // 3 whole days between today-midnight and (today-3)-midnight.
    expect(getDelayDays(overdueTask, now)).toBe(3);
  });

  it('should never count a completed task as delayed', () => {
    const now = new Date();
    const completedTask = createTask({
      planEnd: fmt(subDays(now, 5)),
      actualProgress: 100,
      status: 'completed',
    });

    expect(getDelayedTasks([completedTask], now)).toHaveLength(0);
    expect(getDelayDays(completedTask, now)).toBe(0);
  });
});

describe('L-7 — getWeeklyTasks planEnd-only branch', () => {
  it('should include a planEnd-only task whose planEnd falls in this week', () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    // A date guaranteed to sit inside this week (Tuesday).
    const inThisWeek = addDays(weekStart, 1);

    const task = createTask({
      planStart: null,
      planEnd: fmt(inThisWeek),
    });

    const result = getWeeklyTasks([task], 'this');
    expect(result).toHaveLength(1);
  });

  it('should include a planEnd-only task whose planEnd falls in next week', () => {
    const now = new Date();
    const nextWeekStart = startOfWeek(addDays(now, 7), { weekStartsOn: 1 });
    const inNextWeek = addDays(nextWeekStart, 1);

    const task = createTask({
      planStart: null,
      planEnd: fmt(inNextWeek),
    });

    const result = getWeeklyTasks([task], 'next');
    expect(result).toHaveLength(1);
  });

  it('should still respect planStart-only tasks (no regression)', () => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const inThisWeek = addDays(weekStart, 2);

    const task = createTask({
      planStart: fmt(inThisWeek),
      planEnd: null,
    });

    expect(getWeeklyTasks([task], 'this')).toHaveLength(1);
  });

  it('should exclude a planEnd-only task outside the target week', () => {
    const now = new Date();
    const farFuture = addDays(now, 60);

    const task = createTask({
      planStart: null,
      planEnd: fmt(farFuture),
    });

    expect(getWeeklyTasks([task], 'this')).toHaveLength(0);
  });
});
