import { create } from 'zustand';
import type { Task } from '../types';
import { buildTaskTree, flattenTaskTree, calculateParentProgress } from '../lib/utils';

interface TaskState {
  tasks: Task[];
  taskTree: Task[];
  flatTasks: Task[];
  selectedTaskId: string | null;
  expandedIds: Set<string>;
  isLoading: boolean;
  editingCell: { taskId: string; columnId: string } | null;

  // History for undo/redo
  history: Task[][];
  historyIndex: number;

  // Actions
  setTasks: (tasks: Task[]) => void;
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
  selectedTaskId: null,
  expandedIds: new Set<string>(),
  isLoading: false,
  editingCell: null,
  history: [],
  historyIndex: -1,

  setTasks: (tasks) => {
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

    // 같은 부모 내에서 이동하는 경우
    const siblings = tasks.filter((t) => t.parentId === newParentId && t.id !== taskId);
    siblings.sort((a, b) => a.orderIndex - b.orderIndex);

    // orderIndex 재계산
    const newTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          parentId: newParentId,
          orderIndex: newIndex,
          level: newParentId ? (tasks.find((p) => p.id === newParentId)?.level || 0) + 1 : 1,
        };
      }

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

    // 트리 재구성
    const tasksWithExpanded = tasks.map((t) => ({
      ...t,
      isExpanded: newExpanded.has(t.id),
    }));
    const tree = buildTaskTree(tasksWithExpanded);
    const flat = flattenTaskTree(tree);
    set({ tasks: tasksWithExpanded, taskTree: tree, flatTasks: flat });
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
