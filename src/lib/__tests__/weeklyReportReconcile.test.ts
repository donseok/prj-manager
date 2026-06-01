import { describe, it, expect } from 'vitest';
import { reconcileProgressCategories } from '../weeklyReportTemplate';
import type { Task, WeeklyReportTemplate } from '../../types';

function createPhase(overrides: Partial<Task> = {}): Task {
  return {
    id: 'phase-1',
    projectId: 'proj-1',
    parentId: null,
    level: 1,
    orderIndex: 0,
    name: 'Phase',
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

type FrozenCategories = WeeklyReportTemplate['progressCategories'];

describe('reconcileProgressCategories — H-3 phase-id join', () => {
  it('maps frozen category (by name) to the live phase id, so a breakdown keyed by id is found', () => {
    const frozen: FrozenCategories = [
      { section: '설계', item: '설계', weight: 40 },
      { section: '개발', item: '개발', weight: 60 },
    ];
    const phases = [
      createPhase({ id: 'p-design', name: '설계', orderIndex: 0 }),
      createPhase({ id: 'p-dev', name: '개발', orderIndex: 1 }),
    ];

    const resolved = reconcileProgressCategories(frozen, phases);

    // Every resolved category must carry the LIVE phase id so phaseMap.get(phaseId) hits.
    expect(resolved.map((c) => c.phaseId)).toEqual(['p-design', 'p-dev']);
    // Frozen weights are preserved when the name still matches.
    expect(resolved.find((c) => c.phaseId === 'p-design')?.weight).toBe(40);
    expect(resolved.find((c) => c.phaseId === 'p-dev')?.weight).toBe(60);
  });

  it('a RENAMED phase still resolves to its real phase id (so its % is not lost)', () => {
    // Template was frozen when the phase was called "설계".
    const frozen: FrozenCategories = [
      { section: '설계', item: '설계', weight: 40 },
      { section: '개발', item: '개발', weight: 60 },
    ];
    // The phase has since been renamed to "기본설계" but keeps the same id.
    const phases = [
      createPhase({ id: 'p-design', name: '기본설계', orderIndex: 0 }),
      createPhase({ id: 'p-dev', name: '개발', orderIndex: 1 }),
    ];

    const resolved = reconcileProgressCategories(frozen, phases);

    const renamed = resolved.find((c) => c.phaseId === 'p-design');
    expect(renamed).toBeDefined();
    // The visible item label reflects the live (renamed) phase name.
    expect(renamed?.item).toBe('기본설계');
    // Critically, the resolved category carries the live id so the breakdown is found.
    expect(renamed?.phaseId).toBe('p-design');
    // Exactly one resolved category per live phase (no orphan from the old name).
    expect(resolved).toHaveLength(2);
  });

  it('a phase RENAMED but with a persisted phaseId keeps its frozen weight across the rename', () => {
    // A future-created template that stored phaseId can survive a rename without losing weight.
    const frozen = [
      { section: '설계', item: '설계', weight: 40, phaseId: 'p-design' },
      { section: '개발', item: '개발', weight: 60, phaseId: 'p-dev' },
    ] as unknown as FrozenCategories;
    const phases = [
      createPhase({ id: 'p-design', name: '기본설계', orderIndex: 0 }),
      createPhase({ id: 'p-dev', name: '개발', orderIndex: 1 }),
    ];

    const resolved = reconcileProgressCategories(frozen, phases);

    const renamed = resolved.find((c) => c.phaseId === 'p-design');
    expect(renamed?.item).toBe('기본설계');
    // Matched by stored id → frozen weight survives the rename.
    expect(renamed?.weight).toBe(40);
  });

  it('a NEWLY-ADDED phase appears as a resolved category (with its id), not dropped', () => {
    const frozen: FrozenCategories = [
      { section: '설계', item: '설계', weight: 100 },
    ];
    const phases = [
      createPhase({ id: 'p-design', name: '설계', orderIndex: 0 }),
      createPhase({ id: 'p-new', name: '검증', orderIndex: 1 }),
    ];

    const resolved = reconcileProgressCategories(frozen, phases);

    expect(resolved).toHaveLength(2);
    const added = resolved.find((c) => c.phaseId === 'p-new');
    expect(added).toBeDefined();
    expect(added?.item).toBe('검증');
  });

  it('a REMOVED phase is dropped (we iterate live phases only)', () => {
    const frozen: FrozenCategories = [
      { section: '설계', item: '설계', weight: 40 },
      { section: '폐기', item: '폐기', weight: 60 },
    ];
    const phases = [createPhase({ id: 'p-design', name: '설계', orderIndex: 0 })];

    const resolved = reconcileProgressCategories(frozen, phases);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].phaseId).toBe('p-design');
    expect(resolved.some((c) => c.item === '폐기')).toBe(false);
  });

  it('respects live phase order (orderIndex), not frozen order', () => {
    const frozen: FrozenCategories = [
      { section: '설계', item: '설계', weight: 40 },
      { section: '개발', item: '개발', weight: 60 },
    ];
    // Phases reordered: 개발 now comes first.
    const phases = [
      createPhase({ id: 'p-dev', name: '개발', orderIndex: 0 }),
      createPhase({ id: 'p-design', name: '설계', orderIndex: 1 }),
    ];

    const resolved = reconcileProgressCategories(frozen, phases);

    expect(resolved.map((c) => c.phaseId)).toEqual(['p-dev', 'p-design']);
  });

  it('falls back to frozen categories when there are no live phases', () => {
    const frozen: FrozenCategories = [
      { section: '전체', item: '프로젝트 진행', weight: 100 },
    ];

    const resolved = reconcileProgressCategories(frozen, []);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].item).toBe('프로젝트 진행');
    expect(resolved[0].phaseId).toBeNull();
  });
});
