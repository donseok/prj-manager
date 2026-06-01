import { describe, it, expect } from 'vitest';
import { endOfMonth, getDate } from 'date-fns';
import { generateRecurringTasks, generateImmediateTask } from '../recurringTasks';
import type { RecurringRule, Task } from '../../types';

function createRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    projectId: 'proj-1',
    templateTaskName: '월간보고',
    level: 4,
    frequency: 'monthly',
    isActive: true,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

describe('recurringTasks', () => {
  // ── L-6: monthly rule with dayOfMonth 29/30/31 must clamp to month end ──
  describe('L-6 — monthly day clamps to month end in short months', () => {
    it('a day-31 rule fires on the last day of February (28th in 2026)', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 31 });
      // 2026 is not a leap year → Feb has 28 days.
      const febLast = endOfMonth(new Date(2026, 1, 1)); // Feb 28, 2026
      expect(getDate(febLast)).toBe(28);

      const { tasks } = generateRecurringTasks([rule], [], febLast);
      expect(tasks).toHaveLength(1);
    });

    it('a day-31 rule does NOT fire on Feb 27 (one day before month end)', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 31 });
      const feb27 = new Date(2026, 1, 27);
      const { tasks } = generateRecurringTasks([rule], [], feb27);
      expect(tasks).toHaveLength(0);
    });

    it('a day-31 rule fires on day 31 in a 31-day month (Jan)', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 31 });
      const jan31 = new Date(2026, 0, 31);
      const { tasks } = generateRecurringTasks([rule], [], jan31);
      expect(tasks).toHaveLength(1);
    });

    it('a day-31 rule does NOT fire on day 30 in a 31-day month (no double-fire)', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 31 });
      const jan30 = new Date(2026, 0, 30);
      const { tasks } = generateRecurringTasks([rule], [], jan30);
      expect(tasks).toHaveLength(0);
    });

    it('a day-30 rule fires on Feb last day (28th) but not on Feb 27', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 30 });
      const febLast = endOfMonth(new Date(2026, 1, 1)); // Feb 28
      const feb27 = new Date(2026, 1, 27);
      expect(generateRecurringTasks([rule], [], febLast).tasks).toHaveLength(1);
      expect(generateRecurringTasks([rule], [], feb27).tasks).toHaveLength(0);
    });

    it('a normal day-15 rule still fires exactly on the 15th', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 15 });
      const feb15 = new Date(2026, 1, 15);
      const feb14 = new Date(2026, 1, 14);
      expect(generateRecurringTasks([rule], [], feb15).tasks).toHaveLength(1);
      expect(generateRecurringTasks([rule], [], feb14).tasks).toHaveLength(0);
    });
  });

  // ── L-8: dedup key must include the year ──
  describe('L-8 — same M/d across two different years are distinct', () => {
    it('a task generated last year does NOT suppress this year same M/d', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 15 });
      // Generate for 2025-02-15 first.
      const y2025 = new Date(2025, 1, 15);
      const gen2025 = generateRecurringTasks([rule], [], y2025);
      expect(gen2025.tasks).toHaveLength(1);

      // Feed the 2025 task back as existing, then generate for 2026-02-15.
      const existing: Task[] = [...gen2025.tasks];
      const y2026 = new Date(2026, 1, 15);
      const gen2026 = generateRecurringTasks([rule], existing, y2026);
      // Different year → must still generate.
      expect(gen2026.tasks).toHaveLength(1);
      // And the two generated names must differ (year is encoded).
      expect(gen2026.tasks[0].name).not.toBe(gen2025.tasks[0].name);
    });

    it('the generated name encodes the year (yyyy/M/d)', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 15 });
      const { tasks } = generateRecurringTasks([rule], [], new Date(2026, 1, 15));
      expect(tasks[0].name).toContain('2026');
      expect(tasks[0].name).toBe('월간보고 (2026/2/15)');
    });
  });

  // ── Idempotency: re-running on the same date must not duplicate ──
  describe('idempotency across runs', () => {
    it('re-running generateRecurringTasks with prior output produces no new task', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 15 });
      const date = new Date(2026, 1, 15);
      const first = generateRecurringTasks([rule], [], date);
      expect(first.tasks).toHaveLength(1);

      const second = generateRecurringTasks([rule], first.tasks, date);
      expect(second.tasks).toHaveLength(0);
    });

    it('generateImmediateTask output is recognized by the dedup check (no duplicate)', () => {
      const rule = createRule({ frequency: 'monthly', dayOfMonth: 15 });
      const date = new Date(2026, 1, 15);
      const immediate = generateImmediateTask(rule, [], date);
      // The immediate task name must match what generateRecurringTasks would dedup on.
      const followup = generateRecurringTasks([rule], [immediate], date);
      expect(followup.tasks).toHaveLength(0);
    });

    it('parentId-scoped dedup still distinguishes different parents', () => {
      const ruleA = createRule({ id: 'rA', dayOfMonth: 15, parentId: 'p-a' });
      const ruleB = createRule({ id: 'rB', dayOfMonth: 15, parentId: 'p-b' });
      const date = new Date(2026, 1, 15);
      const a = generateRecurringTasks([ruleA], [], date);
      // ruleB shares M/d+year but a different parent → should still generate.
      const b = generateRecurringTasks([ruleB], a.tasks, date);
      expect(b.tasks).toHaveLength(1);
    });
  });
});
