import { create } from 'zustand';
import type { TaskComment } from '../types';
import { storage } from '../lib/utils';

const STORAGE_KEY_PREFIX = 'dk-flow-comments-';

interface CommentState {
  comments: TaskComment[];
  loadedProjectId: string | null;

  loadComments: (projectId: string) => void;
  addComment: (comment: TaskComment) => void;
  updateComment: (id: string, content: string) => void;
  deleteComment: (id: string) => void;
  getCommentsByTaskId: (taskId: string) => TaskComment[];
}

function persist(projectId: string, comments: TaskComment[]) {
  storage.set(`${STORAGE_KEY_PREFIX}${projectId}`, comments);
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  loadedProjectId: null,

  loadComments: (projectId) => {
    const comments = storage.get<TaskComment[]>(`${STORAGE_KEY_PREFIX}${projectId}`, []);
    set({ comments, loadedProjectId: projectId });
  },

  addComment: (comment) => {
    set((state) => {
      const updated = [comment, ...state.comments];
      if (state.loadedProjectId) persist(state.loadedProjectId, updated);
      return { comments: updated };
    });
  },

  updateComment: (id, content) => {
    set((state) => {
      const updated = state.comments.map((c) =>
        c.id === id ? { ...c, content, updatedAt: new Date().toISOString() } : c
      );
      if (state.loadedProjectId) persist(state.loadedProjectId, updated);
      return { comments: updated };
    });
  },

  deleteComment: (id) => {
    set((state) => {
      const updated = state.comments.filter((c) => c.id !== id);
      if (state.loadedProjectId) persist(state.loadedProjectId, updated);
      return { comments: updated };
    });
  },

  getCommentsByTaskId: (taskId) => {
    return get().comments.filter((c) => c.taskId === taskId);
  },
}));
