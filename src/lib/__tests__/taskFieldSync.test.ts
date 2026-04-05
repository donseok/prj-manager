import { describe, it, expect } from 'vitest';
import { format, subDays, addDays } from 'date-fns';
import { syncTaskField, isSyncableField } from '../taskFieldSync';
import type { Task } from '../../types';

const TODAY = format(new Date(), 'yyyy-MM-dd');

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

describe('syncTaskField', () => {
  // ── Bug #19: planProgress independent of status ──────────────
  describe('Bug #19 — planProgress is independent of status', () => {
    it('should calculate planProgress from dates, not force 100 on COMPLETED task', () => {
      // A completed task with plan dates spanning far into the future.
      // planProgress should reflect elapsed time, NOT the task's status.
      const futureEnd = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      const pastStart = format(subDays(new Date(), 10), 'yyyy-MM-dd');

      const task = createTask({
        status: 'completed',
        actualProgress: 100,
        planStart: pastStart,
        planEnd: futureEnd,
      });

      const { updates } = syncTaskField(task, 'planStart', pastStart);

      // planProgress must be a time-based percentage, not 100
      expect(updates.planProgress).toBeDefined();
      expect(updates.planProgress).toBeGreaterThan(0);
      expect(updates.planProgress).toBeLessThan(100);
      // Specifically: ~25% (10 / 40 days)
      const expected = Math.round((10 / 40) * 100);
      expect(updates.planProgress).toBe(expected);
    });
  });

  // ── planProgress: no side effects ────────────────────────────
  describe('planProgress change has no side effects', () => {
    it('should return changed=false when field is planProgress', () => {
      const task = createTask({ planProgress: 50 });
      const { changed, updates } = syncTaskField(task, 'planProgress', 75);

      expect(changed).toBe(false);
      expect(Object.keys(updates)).toHaveLength(0);
    });
  });

  // ── planStart/planEnd sync → planProgress ────────────────────
  describe('planStart/planEnd sync to planProgress', () => {
    it('should calculate planProgress as time-based percentage when both dates are set', () => {
      const start = format(subDays(new Date(), 5), 'yyyy-MM-dd');
      const end = format(addDays(new Date(), 5), 'yyyy-MM-dd');

      const task = createTask({ planStart: start, planEnd: end });
      const { updates, changed } = syncTaskField(task, 'planStart', start);

      expect(changed).toBe(true);
      // 5 elapsed out of 10 total days → 50%
      expect(updates.planProgress).toBe(50);
    });

    it('should set planProgress to 0 when planStart is set but planEnd is missing', () => {
      const start = format(subDays(new Date(), 5), 'yyyy-MM-dd');
      const task = createTask({ planStart: start, planEnd: null });
      const { updates, changed } = syncTaskField(task, 'planStart', start);

      expect(changed).toBe(true);
      expect(updates.planProgress).toBe(0);
    });
  });

  // ── Status sync tests ────────────────────────────────────────
  describe('status sync', () => {
    it('status=completed → actualProgress=100, actualEnd=today', () => {
      const task = createTask({
        status: 'pending',
        actualProgress: 30,
        actualStart: '2026-03-01',
        actualEnd: null,
      });

      const { updates } = syncTaskField(task, 'status', 'completed');

      expect(updates.actualProgress).toBe(100);
      expect(updates.actualEnd).toBe(TODAY);
    });

    it('status=completed → actualStart auto-filled if missing', () => {
      const task = createTask({
        status: 'pending',
        actualProgress: 0,
        planStart: '2026-02-01',
      });

      const { updates } = syncTaskField(task, 'status', 'completed');

      expect(updates.actualStart).toBe('2026-02-01');
      expect(updates.actualProgress).toBe(100);
      expect(updates.actualEnd).toBe(TODAY);
    });

    it('status=in_progress → actualStart=today, actualProgress reduced from 100', () => {
      const task = createTask({
        status: 'completed',
        actualProgress: 100,
        actualStart: '2026-03-01',
        actualEnd: '2026-03-15',
      });

      const { updates } = syncTaskField(task, 'status', 'in_progress');

      expect(updates.actualProgress).toBe(50);
      expect(updates.actualEnd).toBeNull();
      // actualStart already set, so no update needed
      expect(updates.actualStart).toBeUndefined();
    });

    it('status=in_progress → actualStart auto-filled if missing', () => {
      const task = createTask({
        status: 'pending',
        actualProgress: 0,
        actualStart: null,
      });

      const { updates } = syncTaskField(task, 'status', 'in_progress');

      expect(updates.actualStart).toBe(TODAY);
    });

    it('status=pending → actualProgress=0, dates cleared', () => {
      const task = createTask({
        status: 'in_progress',
        actualProgress: 60,
        actualStart: '2026-03-01',
        actualEnd: '2026-03-20',
      });

      const { updates } = syncTaskField(task, 'status', 'pending');

      expect(updates.actualProgress).toBe(0);
      expect(updates.actualStart).toBeNull();
      expect(updates.actualEnd).toBeNull();
    });
  });
});

// ── isSyncableField ────────────────────────────────────────────
describe('isSyncableField', () => {
  const syncableFields = [
    'planProgress',
    'planStart',
    'planEnd',
    'status',
    'actualProgress',
    'actualStart',
    'actualEnd',
  ];

  it.each(syncableFields)('should return true for "%s"', (field) => {
    expect(isSyncableField(field)).toBe(true);
  });

  const nonSyncableFields = [
    'name',
    'description',
    'weight',
    'assigneeId',
    'parentId',
    'level',
    'id',
    'orderIndex',
  ];

  it.each(nonSyncableFields)('should return false for "%s"', (field) => {
    expect(isSyncableField(field)).toBe(false);
  });
});
