import { create } from 'zustand';
import type { Project, ProjectMember } from '../types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  members: ProjectMember[];
  isLoading: boolean;

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;

  // Members
  setMembers: (members: ProjectMember[]) => void;
  addMember: (member: ProjectMember) => void;
  updateMember: (id: string, updates: Partial<ProjectMember>) => void;
  removeMember: (id: string) => void;

  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  members: [],
  isLoading: false,

  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({
      projects: [...state.projects, project],
    })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      currentProject:
        state.currentProject?.id === id
          ? { ...state.currentProject, ...updates }
          : state.currentProject,
    })),

  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    })),

  setCurrentProject: (project) => set({ currentProject: project }),

  setMembers: (members) => set({ members }),

  addMember: (member) =>
    set((state) => ({
      members: [...state.members, member],
    })),

  updateMember: (id, updates) =>
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  removeMember: (id) =>
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
}));
