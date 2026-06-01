import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore, resolveDropTarget } from '../taskStore';
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** 한 부모 아래 형제들을 orderIndex 순으로 만든다. */
function siblings(parentId: string | null, ids: string[], level = 1): Task[] {
  return ids.map((id, i) => makeTask({ id, parentId, orderIndex: i, level }));
}

/** 현재 store에서 주어진 부모의 자식 id를 orderIndex 순으로 반환. */
function orderOf(parentId: string | null): string[] {
  return useTaskStore
    .getState()
    .tasks.filter((t) => t.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((t) => t.id);
}

/** 드래그-드롭을 WBS.tsx handleDrop과 동일하게 재현: 위치 해석 + moveTask. */
function drop(draggedId: string, targetId: string, position: 'before' | 'after' | 'child') {
  const { tasks, moveTask } = useTaskStore.getState();
  const target = tasks.find((t) => t.id === targetId)!;
  const { newParentId, newIndex } = resolveDropTarget(tasks, draggedId, target, position);
  moveTask(draggedId, newParentId, newIndex);
}

describe('WBS 드래그-드롭 재정렬 (H-2 off-by-one)', () => {
  beforeEach(() => {
    // 초기 시드 — projectId 미지정으로 알림/브로드캐스트 부작용 회피
    useTaskStore.getState().setTasks(
      siblings(null, ['A', 'B', 'C', 'D', 'E', 'F']),
      null,
      { resetHistory: true }
    );
  });

  it('같은 부모 하향 이동: B를 E 뒤에 드롭하면 [A,C,D,E,B,F]', () => {
    // 사용자 의도: B를 끌어다 E "바로 뒤"에 놓는다 (하향).
    drop('B', 'E', 'after');
    // B는 E 바로 뒤, F 앞에 와야 한다. (버그 시: [A,C,D,E,F,B] 로 한 칸 초과)
    expect(orderOf(null)).toEqual(['A', 'C', 'D', 'E', 'B', 'F']);
  });

  it('같은 부모 하향 이동(before): C를 E 앞에 드롭하면 [A,B,D,C,E,F]', () => {
    // C를 끌어다 E "바로 앞"에 놓는다 (하향). C는 E 직전에 와야 한다.
    drop('C', 'E', 'before');
    expect(orderOf(null)).toEqual(['A', 'B', 'D', 'C', 'E', 'F']);
  });

  it('같은 부모 상향 이동: E를 B 뒤에 드롭하면 [A,B,E,C,D,F]', () => {
    drop('E', 'B', 'after');
    expect(orderOf(null)).toEqual(['A', 'B', 'E', 'C', 'D', 'F']);
  });

  it('같은 부모 상향 이동(before): E를 B 앞에 드롭하면 [A,E,B,C,D,F]', () => {
    drop('E', 'B', 'before');
    expect(orderOf(null)).toEqual(['A', 'E', 'B', 'C', 'D', 'F']);
  });

  it('맨 끝으로 하향 이동: B를 F 뒤에 드롭하면 [A,C,D,E,F,B]', () => {
    drop('B', 'F', 'after');
    expect(orderOf(null)).toEqual(['A', 'C', 'D', 'E', 'F', 'B']);
  });

  it('교차 부모 이동: 다른 부모의 자식 사이에 정확히 삽입된다', () => {
    // 부모 P 아래 자식 [X, Y, Z], 그리고 루트에 형제 [G]
    const tasks: Task[] = [
      makeTask({ id: 'P', parentId: null, orderIndex: 0, level: 1 }),
      makeTask({ id: 'G', parentId: null, orderIndex: 1, level: 1 }),
      makeTask({ id: 'X', parentId: 'P', orderIndex: 0, level: 2 }),
      makeTask({ id: 'Y', parentId: 'P', orderIndex: 1, level: 2 }),
      makeTask({ id: 'Z', parentId: 'P', orderIndex: 2, level: 2 }),
    ];
    useTaskStore.getState().setTasks(tasks, null, { resetHistory: true });

    // G를 P의 자식 X와 Y 사이(=Y 앞)에 드롭
    drop('G', 'Y', 'before');

    expect(orderOf('P')).toEqual(['X', 'G', 'Y', 'Z']);
    // G는 더 이상 루트의 자식이 아니며 레벨이 2로 조정된다
    expect(orderOf(null)).toEqual(['P']);
    const g = useTaskStore.getState().tasks.find((t) => t.id === 'G')!;
    expect(g.parentId).toBe('P');
    expect(g.level).toBe(2);
  });
});
