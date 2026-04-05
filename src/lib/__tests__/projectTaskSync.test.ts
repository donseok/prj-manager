import { describe, it, expect, vi } from 'vitest';
import { normalizeTaskHierarchy } from '../projectTaskSync';
import type { Task } from '../../types';

const now = new Date().toISOString();

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: 'proj-1',
    name: `Task ${overrides.id}`,
    level: 1,
    orderIndex: 0,
    parentId: null,
    status: 'pending',
    planStart: null,
    planEnd: null,
    planProgress: 0,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    weight: 1,
    assigneeId: null,
    output: '',
    durationDays: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('normalizeTaskHierarchy', () => {
  // ── Bug #4: Orphaned tasks ──────────────────────────────────────
  describe('Bug #4 - Orphaned tasks', () => {
    it('promotes a task with non-existent parentId to root level', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const tasks: Task[] = [
        makeTask({ id: 'child-1', parentId: 'non-existent-parent', level: 2 }),
      ];

      const result = normalizeTaskHierarchy(tasks);

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('orphaned'),
        'child-1',
        expect.stringContaining('parentId'),
        'non-existent-parent',
      );

      warnSpy.mockRestore();
    });

    it('promotes orphaned task while keeping valid siblings intact', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const tasks: Task[] = [
        makeTask({ id: 'parent-1', parentId: null, level: 1 }),
        makeTask({ id: 'child-ok', parentId: 'parent-1', level: 2 }),
        makeTask({ id: 'child-orphan', parentId: 'deleted-parent', level: 2 }),
      ];

      const result = normalizeTaskHierarchy(tasks);

      const okChild = result.find((t) => t.id === 'child-ok');
      const orphanChild = result.find((t) => t.id === 'child-orphan');

      expect(okChild?.parentId).toBe('parent-1');
      expect(orphanChild?.parentId).toBeNull();
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  // ── Bug #9: Parent actualEnd cleared when child reverts ─────────
  describe('Bug #9 - Parent actualEnd cleared when child reverts', () => {
    it('clears parent actualEnd when one child reverts to in_progress', () => {
      const tasks: Task[] = [
        makeTask({ id: 'parent', parentId: null, level: 1 }),
        makeTask({
          id: 'child-1',
          parentId: 'parent',
          level: 2,
          status: 'completed',
          actualStart: '2026-01-01',
          actualEnd: '2026-03-01',
          actualProgress: 100,
          planStart: '2026-01-01',
          planEnd: '2026-03-01',
        }),
        makeTask({
          id: 'child-2',
          parentId: 'parent',
          level: 2,
          status: 'in_progress',
          actualStart: '2026-02-01',
          actualEnd: null,
          actualProgress: 50,
          planStart: '2026-02-01',
          planEnd: '2026-04-01',
        }),
      ];

      const result = normalizeTaskHierarchy(tasks);
      const parent = result.find((t) => t.id === 'parent');

      expect(parent?.actualEnd).toBeNull();
      expect(parent?.status).toBe('in_progress');
    });

    it('sets parent actualEnd when all children are completed', () => {
      const tasks: Task[] = [
        makeTask({ id: 'parent', parentId: null, level: 1 }),
        makeTask({
          id: 'child-1',
          parentId: 'parent',
          level: 2,
          status: 'completed',
          actualStart: '2026-01-01',
          actualEnd: '2026-03-01',
          actualProgress: 100,
          planStart: '2026-01-01',
          planEnd: '2026-03-01',
        }),
        makeTask({
          id: 'child-2',
          parentId: 'parent',
          level: 2,
          status: 'completed',
          actualStart: '2026-02-01',
          actualEnd: '2026-04-01',
          actualProgress: 100,
          planStart: '2026-02-01',
          planEnd: '2026-04-01',
        }),
      ];

      const result = normalizeTaskHierarchy(tasks);
      const parent = result.find((t) => t.id === 'parent');

      expect(parent?.actualEnd).toBe('2026-04-01');
      expect(parent?.status).toBe('completed');
    });
  });

  // ── Bug #19: planProgress independent of status ─────────────────
  describe('Bug #19 - planProgress independent of status', () => {
    it('calculates planProgress purely from time elapsed, not from status', () => {
      // Use a date range where today (2026-04-06) falls in the middle
      const planStart = '2026-01-01';
      const planEnd = '2026-12-31';

      const completedTask = makeTask({
        id: 'completed-leaf',
        parentId: null,
        level: 1,
        status: 'completed',
        actualProgress: 100,
        planStart,
        planEnd,
      });

      const inProgressTask = makeTask({
        id: 'in-progress-leaf',
        parentId: null,
        level: 1,
        status: 'in_progress',
        actualProgress: 50,
        planStart,
        planEnd,
      });

      const result = normalizeTaskHierarchy([completedTask, inProgressTask]);
      const completedResult = result.find((t) => t.id === 'completed-leaf');
      const inProgressResult = result.find((t) => t.id === 'in-progress-leaf');

      // Both should have the same planProgress since it's time-based only
      expect(completedResult?.planProgress).toBe(inProgressResult?.planProgress);

      // planProgress should NOT be forced to 100 for completed tasks
      // With planEnd='2026-12-31' and today around 2026-04-06, it should be well below 100
      expect(completedResult?.planProgress).toBeLessThan(100);
      expect(completedResult?.planProgress).toBeGreaterThan(0);
    });
  });

  // ── Parent aggregation ──────────────────────────────────────────
  describe('Parent aggregation', () => {
    it('aggregates planStart, planEnd, and weighted planProgress from children', () => {
      const tasks: Task[] = [
        makeTask({ id: 'parent', parentId: null, level: 1 }),
        makeTask({
          id: 'child-a',
          parentId: 'parent',
          level: 2,
          planStart: '2026-01-01',
          planEnd: '2026-06-30',
          weight: 3,
        }),
        makeTask({
          id: 'child-b',
          parentId: 'parent',
          level: 2,
          planStart: '2026-03-01',
          planEnd: '2026-12-31',
          weight: 1,
        }),
      ];

      const result = normalizeTaskHierarchy(tasks);
      const parent = result.find((t) => t.id === 'parent');

      // Parent gets earliest planStart
      expect(parent?.planStart).toBe('2026-01-01');
      // Parent gets latest planEnd
      expect(parent?.planEnd).toBe('2026-12-31');

      // Parent planProgress is weighted average of children's planProgress
      const childA = result.find((t) => t.id === 'child-a');
      const childB = result.find((t) => t.id === 'child-b');
      const expectedProgress = Math.round(
        (childA!.planProgress * 3 + childB!.planProgress * 1) / 4,
      );
      expect(parent?.planProgress).toBe(expectedProgress);
    });
  });

  // ── Date swap ───────────────────────────────────────────────────
  describe('Date swap', () => {
    it('swaps planStart and planEnd when start > end', () => {
      const tasks: Task[] = [
        makeTask({
          id: 'swapped',
          parentId: null,
          level: 1,
          planStart: '2026-12-31',
          planEnd: '2026-01-01',
        }),
      ];

      const result = normalizeTaskHierarchy(tasks);
      const task = result.find((t) => t.id === 'swapped');

      expect(task?.planStart).toBe('2026-01-01');
      expect(task?.planEnd).toBe('2026-12-31');
    });

    it('swaps actualStart and actualEnd when start > end', () => {
      const tasks: Task[] = [
        makeTask({
          id: 'swapped-actual',
          parentId: null,
          level: 1,
          actualStart: '2026-06-30',
          actualEnd: '2026-01-15',
        }),
      ];

      const result = normalizeTaskHierarchy(tasks);
      const task = result.find((t) => t.id === 'swapped-actual');

      expect(task?.actualStart).toBe('2026-01-15');
      expect(task?.actualEnd).toBe('2026-06-30');
    });
  });
});
