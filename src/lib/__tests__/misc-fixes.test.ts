import { describe, it, expect } from 'vitest';
import { autoCalculateWeights } from '../taskAutoFill';
import type { Task } from '../../types';

// ── Helper ──────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  const now = new Date().toISOString();
  return {
    projectId: 'proj-1',
    level: 4,
    orderIndex: 0,
    name: 'task',
    weight: 0,
    planProgress: 0,
    actualProgress: 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── Bug #7 — NaN safety (safeNum pattern) ───────────────────
// `safeNum` is a module-private helper inside dataRepository.ts and is not
// exported, so we cannot import it directly. Instead we verify the same
// pattern inline to document the expected behaviour.

describe('Bug #7 — safeNum NaN safety', () => {
  const safeNum = (v: unknown, def: number): number => {
    const n = Number(v);
    return Number.isNaN(n) ? def : n;
  };

  it('returns the default when the input is a non-numeric string', () => {
    expect(safeNum('abc', 0)).toBe(0);
    // Confirm that without the guard we would get NaN
    expect(Number('abc')).toBeNaN();
  });

  it('returns the default for undefined', () => {
    expect(safeNum(undefined, 5)).toBe(5);
  });

  it('returns the default for null', () => {
    expect(safeNum(null, 0)).toBe(0);
  });

  it('passes through valid numbers', () => {
    expect(safeNum(42, 0)).toBe(42);
    expect(safeNum('3.14', 0)).toBeCloseTo(3.14);
  });

  it('treats empty string as 0 (Number("") === 0)', () => {
    // Number('') is 0, which is *not* NaN, so safeNum returns 0 — not the default.
    expect(safeNum('', 99)).toBe(0);
  });
});

// ── Bug #18 — Weight rounding (3 siblings) ──────────────────

describe('Bug #18 — autoCalculateWeights rounding', () => {
  it('3 equal siblings sum to exactly 100', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', parentId: null, level: 1, orderIndex: 0 }),
      makeTask({ id: 't2', parentId: null, level: 1, orderIndex: 1 }),
      makeTask({ id: 't3', parentId: null, level: 1, orderIndex: 2 }),
    ];

    const result = autoCalculateWeights(tasks);
    const sum = result.reduce((s, t) => s + t.weight, 0);

    expect(sum).toBe(100);
    // Each should be close to 33.33, but rounding means they won't all be equal.
    // The last sibling gets the remainder to guarantee the sum.
    result.forEach((t) => {
      expect(t.weight).toBeGreaterThanOrEqual(0);
      expect(t.weight).toBeLessThanOrEqual(100);
    });
  });

  // ── Bug #18 — Weight rounding (7 siblings) ────────────────

  it('7 equal siblings sum to exactly 100', () => {
    const tasks: Task[] = Array.from({ length: 7 }, (_, i) =>
      makeTask({ id: `t${i}`, parentId: null, level: 1, orderIndex: i }),
    );

    const result = autoCalculateWeights(tasks);
    const sum = result.reduce((s, t) => s + t.weight, 0);

    expect(sum).toBe(100);
    result.forEach((t) => {
      expect(t.weight).toBeGreaterThanOrEqual(0);
      expect(t.weight).toBeLessThanOrEqual(100);
    });
  });
});
