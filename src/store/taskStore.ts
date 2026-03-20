import { create } from 'zustand';
import type { Task } from '../types';
import { buildTaskTree, flattenTaskTree, calculateParentProgress } from '../lib/utils';
import { normalizeTaskHierarchy } from '../lib/projectTaskSync';

interface TaskState {
  tasks: Task[];
  taskTree: Task[];
  flatTasks: Task[];
  loadedProjectId: string | null;
  selectedTaskId: string | null;
  expandedIds: Set<string>;
  isLoading: boolean;
  editingCell: { taskId: string; columnId: string } | null;

  // History for undo/redo
  history: Task[][];
  historyIndex: number;

  // Actions
  setTasks: (
    tasks: Task[],
    projectId?: string | null,
    options?: { recordHistory?: boolean; resetHistory?: boolean }
  ) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>, options?: { recordHistory?: boolean }) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newParentId: string | null, newIndex: number) => void;

  // Selection
  selectTask: (id: string | null) => void;

  // Expand/Collapse
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Editing
  setEditingCell: (cell: { taskId: string; columnId: string } | null) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  // Computed
  getTaskById: (id: string) => Task | undefined;
  getChildTasks: (parentId: string) => Task[];
  calculateProgress: (taskId: string) => number;

  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  taskTree: [],
  flatTasks: [],
  loadedProjectId: null,
  selectedTaskId: null,
  expandedIds: new Set<string>(),
  isLoading: false,
  editingCell: null,
  history: [],
  historyIndex: -1,

  setTasks: (tasks, projectId, options) => {
    const currentState = get();
    const expandedIds = get().expandedIds;
    const tasksWithExpanded = normalizeTaskHierarchy(tasks).map((t) => ({
      ...t,
      isExpanded: expandedIds.has(t.id),
    }));
    const tree = buildTaskTree(tasksWithExpanded);
    const flat = flattenTaskTree(tree);
    const nextState: Partial<TaskState> = {
      tasks: tasksWithExpanded,
      taskTree: tree,
      flatTasks: flat,
      loadedProjectId: projectId ?? get().loadedProjectId,
      selectedTaskId:
        currentState.selectedTaskId && tasksWithExpanded.some((task) => task.id === currentState.selectedTaskId)
          ? currentState.selectedTaskId
          : null,
    };

    const shouldResetHistory = options?.resetHistory ?? projectId !== undefined;

    if (shouldResetHistory) {
      nextState.history = [tasksWithExpanded.map((task) => ({ ...task }))];
      nextState.historyIndex = 0;
    } else if (options?.recordHistory) {
      const nextHistory = currentState.history
        .slice(0, currentState.historyIndex + 1)
        .concat([tasksWithExpanded.map((task) => ({ ...task }))])
        .slice(-50);
      nextState.history = nextHistory;
      nextState.historyIndex = nextHistory.length - 1;
    }

    set(nextState as TaskState);
  },

  addTask: (task) => {
    const { tasks, expandedIds } = get();
    const newTasks = [...tasks, { ...task, isExpanded: true }];
    // 부모가 접힌 상태면 펼쳐서 새 자식이 보이도록 보장
    if (task.parentId && !expandedIds.has(task.parentId)) {
      const newExpanded = new Set(expandedIds);
      newExpanded.add(task.parentId);
      set({ expandedIds: newExpanded });
    }
    get().setTasks(newTasks, undefined, { recordHistory: true });
  },

  updateTask: (id, updates, options) => {
    const { tasks } = get();
    const newTasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    get().setTasks(newTasks, undefined, { recordHistory: options?.recordHistory ?? true });
  },

  deleteTask: (id) => {
    const { tasks } = get();
    // 자식 작업도 함께 삭제
    const idsToDelete = new Set<string>();
    const findChildren = (parentId: string) => {
      idsToDelete.add(parentId);
      tasks.filter((t) => t.parentId === parentId).forEach((t) => findChildren(t.id));
    };
    findChildren(id);
    const newTasks = tasks.filter((t) => !idsToDelete.has(t.id));
    get().setTasks(newTasks, undefined, { recordHistory: true });
  },

  moveTask: (taskId, newParentId, newIndex) => {
    const { tasks } = get();

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newParentLevel = newParentId
      ? (tasks.find((p) => p.id === newParentId)?.level || 0)
      : 0;
    const newLevel = newParentLevel + 1;
    const levelDiff = newLevel - task.level;

    // 자식 작업들의 레벨도 재귀적으로 조정
    const descendantIds = new Set<string>();
    const findDescendants = (pid: string) => {
      tasks.filter((t) => t.parentId === pid).forEach((t) => {
        descendantIds.add(t.id);
        findDescendants(t.id);
      });
    };
    findDescendants(taskId);

    // 같은 부모 내 형제 (이동 대상 제외) 정렬 → 새 위치에 삽입 → 연속 orderIndex 부여
    const siblings = tasks
      .filter((t) => t.parentId === newParentId && t.id !== taskId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const clampedIndex = Math.max(0, Math.min(newIndex, siblings.length));
    const orderedSiblings = [
      ...siblings.slice(0, clampedIndex),
      { id: taskId },
      ...siblings.slice(clampedIndex),
    ];
    const orderMap = new Map(orderedSiblings.map((s, i) => [s.id, i]));

    const now = new Date().toISOString();
    const newTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          parentId: newParentId,
          orderIndex: orderMap.get(taskId)!,
          level: newLevel,
          updatedAt: now,
        };
      }

      // 자식 작업 레벨 조정
      if (descendantIds.has(t.id)) {
        return { ...t, level: t.level + levelDiff, updatedAt: now };
      }

      // 형제 작업의 orderIndex를 연속적으로 재배열
      if (orderMap.has(t.id)) {
        const newOrder = orderMap.get(t.id)!;
        if (t.orderIndex !== newOrder) {
          return { ...t, orderIndex: newOrder };
        }
      }

      return t;
    });

    get().setTasks(newTasks, undefined, { recordHistory: true });
  },

  selectTask: (id) => set({ selectedTaskId: id }),

  toggleExpand: (id) => {
    const { expandedIds, tasks } = get();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    set({ expandedIds: newExpanded });
    get().setTasks(tasks);
  },

  expandAll: () => {
    const { tasks } = get();
    const allIds = new Set(tasks.map((t) => t.id));
    set({ expandedIds: allIds });
    get().setTasks(tasks);
  },

  collapseAll: () => {
    const { tasks } = get();
    set({ expandedIds: new Set() });
    get().setTasks(tasks);
  },

  setEditingCell: (cell) => set({ editingCell: cell }),

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevTasks = history[historyIndex - 1];
      set({ historyIndex: historyIndex - 1 });
      get().setTasks(prevTasks);
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextTasks = history[historyIndex + 1];
      set({ historyIndex: historyIndex + 1 });
      get().setTasks(nextTasks);
    }
  },

  getTaskById: (id) => get().tasks.find((t) => t.id === id),

  getChildTasks: (parentId) =>
    get()
      .tasks.filter((t) => t.parentId === parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex),

  calculateProgress: (taskId) => calculateParentProgress(get().tasks, taskId),

  setLoading: (isLoading) => set({ isLoading }),
}));
