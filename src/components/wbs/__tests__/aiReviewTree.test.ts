import { describe, it, expect } from 'vitest';
import { buildTree, collectSelected, countNodes } from '../aiReviewTree';
import type { Task } from '../../../types';

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

// AI WBS generation (flattenAINodes) emits a DFS pre-order list:
// every parent precedes its children. This mirrors that exact shape.
// Phase(1) > Activity(2) > Task(3) > Todo(4)
function aiGeneratedWbs(): Task[] {
  return [
    createTask({ id: 'p1', parentId: null, level: 1, name: 'Phase 1' }),
    createTask({ id: 'a1', parentId: 'p1', level: 2, name: 'Activity 1.1' }),
    createTask({ id: 't1', parentId: 'a1', level: 3, name: 'Task 1.1.1' }),
    createTask({ id: 'd1', parentId: 't1', level: 4, name: 'Todo 1.1.1.1' }),
    createTask({ id: 'a2', parentId: 'p1', level: 2, name: 'Activity 1.2' }),
    createTask({ id: 't2', parentId: 'a2', level: 3, name: 'Task 1.2.1' }),
    createTask({ id: 'p2', parentId: null, level: 1, name: 'Phase 2' }),
    createTask({ id: 'a3', parentId: 'p2', level: 2, name: 'Activity 2.1' }),
  ];
}

describe('aiReviewTree.buildTree', () => {
  it('keeps the full multi-level hierarchy connected (each parent retains its children)', () => {
    const tasks = aiGeneratedWbs();
    const tree = buildTree(tasks);

    expect(tree).toHaveLength(2); // two root phases

    const phase1 = tree.find((n) => n.task.id === 'p1')!;
    expect(phase1.children.map((c) => c.task.id)).toEqual(['a1', 'a2']);

    const activity1 = phase1.children.find((c) => c.task.id === 'a1')!;
    expect(activity1.children.map((c) => c.task.id)).toEqual(['t1']);

    const task1 = activity1.children[0];
    expect(task1.children.map((c) => c.task.id)).toEqual(['d1']);

    const phase2 = tree.find((n) => n.task.id === 'p2')!;
    expect(phase2.children.map((c) => c.task.id)).toEqual(['a3']);
  });

  it('collectSelected returns every task when all are selected (no silent drop on apply)', () => {
    const tasks = aiGeneratedWbs();
    const tree = buildTree(tasks);

    const selected = collectSelected(tree);
    expect(selected).toHaveLength(tasks.length); // 8, not just the 2 phases
    expect(new Set(selected.map((t) => t.id))).toEqual(
      new Set(['p1', 'a1', 't1', 'd1', 'a2', 't2', 'p2', 'a3'])
    );
  });

  it('countNodes counts the whole tree', () => {
    const tree = buildTree(aiGeneratedWbs());
    expect(countNodes(tree)).toEqual({ total: 8, selected: 8 });
  });
});
