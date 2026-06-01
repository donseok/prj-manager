import { describe, it, expect } from 'vitest';
import { convertToTasks } from '../convertToTasks';
import type { Task, MeetingTask, ProjectMember } from '../../../types';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'proj-1',
    parentId: null,
    level: 1,
    orderIndex: 0,
    name: 'Existing',
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

function createMeetingTask(overrides: Partial<MeetingTask> = {}): MeetingTask {
  return {
    name: 'Imported task',
    level: 1,
    selected: true,
    ...overrides,
  };
}

function createMember(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: 'm-1',
    projectId: 'proj-1',
    name: '홍길동',
    role: 'member',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

describe('convertToTasks (H-5 + M-9)', () => {
  // ── H-5: imported tasks nest under the chosen parent ───────────
  describe('H-5 — parentId is respected', () => {
    it('nests imported tasks under the chosen parent with correct parentId', () => {
      const parent = createTask({ id: 'parent-1', level: 2 });
      const meetingTasks = [createMeetingTask({ name: 'A' }), createMeetingTask({ name: 'B' })];

      const result = convertToTasks(meetingTasks, 'proj-1', 'parent-1', [parent]);

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.parentId === 'parent-1')).toBe(true);
    });

    it('clamps child level to at least parentLevel + 1', () => {
      // Parent is L2; an extracted L1 task cannot legally be its child.
      const parent = createTask({ id: 'parent-1', level: 2 });
      const meetingTasks = [createMeetingTask({ name: 'A', level: 1 })];

      const result = convertToTasks(meetingTasks, 'proj-1', 'parent-1', [parent]);

      expect(result[0].level).toBe(3); // 2 + 1
    });

    it('assigns all direct children of the chosen parent the same level', () => {
      // All imported tasks share the chosen parentId, so they are siblings and
      // MUST share one level (parentLevel + 1) — consistent with how
      // normalizeTaskHierarchy derives level from parentId tree depth.
      const parent = createTask({ id: 'parent-1', level: 2 });
      const meetingTasks = [
        createMeetingTask({ name: 'A', level: 1 }),
        createMeetingTask({ name: 'B', level: 4 }),
      ];

      const result = convertToTasks(meetingTasks, 'proj-1', 'parent-1', [parent]);

      // Both become direct children of L2 parent → both L3, regardless of extracted level.
      expect(result.map((t) => t.level)).toEqual([3, 3]);
    });

    it('clamps the child level to a maximum of 4 even under a deep parent', () => {
      const parent = createTask({ id: 'parent-1', level: 4 });
      const meetingTasks = [createMeetingTask({ name: 'A', level: 2 })];

      const result = convertToTasks(meetingTasks, 'proj-1', 'parent-1', [parent]);

      expect(result[0].level).toBe(4);
    });

    it('keeps tasks at top level (no parent) using their own levels', () => {
      const meetingTasks = [createMeetingTask({ name: 'A', level: 1 })];

      const result = convertToTasks(meetingTasks, 'proj-1', null, []);

      expect(result[0].parentId).toBeUndefined();
      expect(result[0].level).toBe(1);
    });

    it('computes orderIndex after existing siblings of the same parent', () => {
      const parent = createTask({ id: 'parent-1', level: 1 });
      const existingChild = createTask({
        id: 'child-1',
        parentId: 'parent-1',
        level: 2,
        orderIndex: 5,
      });
      const meetingTasks = [createMeetingTask({ name: 'A' })];

      const result = convertToTasks(meetingTasks, 'proj-1', 'parent-1', [parent, existingChild]);

      expect(result[0].orderIndex).toBe(6);
    });
  });

  // ── M-9: assigneeName resolves to a member's assigneeId ─────────
  describe('M-9 — assigneeName resolves to member id', () => {
    it('resolves assigneeId from a matching member name', () => {
      const members = [createMember({ id: 'm-홍', name: '홍길동' })];
      const meetingTasks = [createMeetingTask({ assigneeName: '홍길동' })];

      const result = convertToTasks(meetingTasks, 'proj-1', null, [], members);

      expect(result[0].assigneeId).toBe('m-홍');
    });

    it('leaves assigneeId undefined when no member name matches', () => {
      const members = [createMember({ id: 'm-홍', name: '홍길동' })];
      const meetingTasks = [createMeetingTask({ assigneeName: '미등록자' })];

      const result = convertToTasks(meetingTasks, 'proj-1', null, [], members);

      expect(result[0].assigneeId).toBeUndefined();
    });

    it('leaves assigneeId undefined when assigneeName is absent', () => {
      const members = [createMember({ id: 'm-홍', name: '홍길동' })];
      const meetingTasks = [createMeetingTask({ assigneeName: undefined })];

      const result = convertToTasks(meetingTasks, 'proj-1', null, [], members);

      expect(result[0].assigneeId).toBeUndefined();
    });
  });

  it('only converts selected tasks', () => {
    const meetingTasks = [
      createMeetingTask({ name: 'keep', selected: true }),
      createMeetingTask({ name: 'drop', selected: false }),
    ];

    const result = convertToTasks(meetingTasks, 'proj-1', null, []);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('keep');
  });
});
