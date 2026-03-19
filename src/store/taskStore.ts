import { create } from 'zustand';
import type { Task } from '../types';
import { buildTaskTree, flattenTaskTree, calculateParentProgress } from '../lib/utils';

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
  setTasks: (tasks: Task[], projectId?: string | null) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
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
  saveToHistory: () => void;

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

  setTasks: (tasks, projectId) => {
    const expandedIds = get().expandedIds;
    const tasksWithExpanded = tasks.map((t) => ({
      ...t,
      isExpanded: expandedIds.has(t.id),
    }));
    const tree = buildTaskTree(tasksWithExpanded);
    const flat = flattenTaskTree(tree);
    set({
      tasks: tasksWithExpanded,
      taskTree: tree,
      flatTasks: flat,
      loadedProjectId: projectId ?? get().loadedProjectId,
    });
  },

  addTask: (task) => {
    const { tasks, saveToHistory } = get();
    saveToHistory();
    const newTasks = [...tasks, { ...task, isExpanded: true }];
    get().setTasks(newTasks);
  },

  updateTask: (id, updates) => {
    const { tasks, saveToHistory } = get();
    saveToHistory();
    const newTasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    get().setTasks(newTasks);
  },

  deleteTask: (id) => {
    const { tasks, saveToHistory } = get();
    saveToHistory();
    // 자식 작업도 함께 삭제
    const idsToDelete = new Set<string>();
    const findChildren = (parentId: string) => {
      idsToDelete.add(parentId);
      tasks.filter((t) => t.parentId === parentId).forEach((t) => findChildren(t.id));
    };
    findChildren(id);
    const newTasks = tasks.filter((t) => !idsToDelete.has(t.id));
    get().setTasks(newTasks);
  },

  moveTask: (taskId, newParentId, newIndex) => {
    const { tasks, saveToHistory } = get();
    saveToHistory();

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

    // 같은 부모 내 형제 (이동 대상 제외) 정렬
    const siblings = tasks
      .filter((t) => t.parentId === newParentId && t.id !== taskId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const newTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          parentId: newParentId,
          orderIndex: newIndex,
          level: newLevel,
          updatedAt: new Date().toISOString(),
        };
      }

      // 자식 작업 레벨 조정
      if (descendantIds.has(t.id)) {
        return {
          ...t,
          level: t.level + levelDiff,
          updatedAt: new Date().toISOString(),
        };
      }

      // 형제 작업의 orderIndex 재배열
      if (t.parentId === newParentId) {
        const currentIndex = siblings.findIndex((s) => s.id === t.id);
        if (currentIndex >= newIndex) {
          return { ...t, orderIndex: currentIndex + 1 };
        }
      }

      return t;
    });

    get().setTasks(newTasks);
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

  saveToHistory: () => {
    const { tasks, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...tasks]);
    set({
      history: newHistory.slice(-50), // 최대 50개 저장
      historyIndex: newHistory.length - 1,
    });
  },

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
