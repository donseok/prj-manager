import { create } from 'zustand';
import type { Project, ProjectMember } from '../types';
import { broadcastProjectUpdate, onProjectUpdated } from '../lib/broadcastSync';

function sortProjectsByUpdatedAt(projects: Project[]) {
  return [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  members: ProjectMember[];
  membersLoadedProjectId: string | null;
  isLoading: boolean;
  projectsInitialized: boolean;

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>, options?: { _fromRemote?: boolean }) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;

  // Members
  setMembers: (members: ProjectMember[], projectId?: string | null) => void;
  addMember: (member: ProjectMember) => void;
  updateMember: (id: string, updates: Partial<ProjectMember>) => void;
  removeMember: (id: string) => void;

  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  members: [],
  membersLoadedProjectId: null,
  isLoading: false,
  projectsInitialized: false,

  setProjects: (projects) => set({ projects: sortProjectsByUpdatedAt(projects), projectsInitialized: true }),

  addProject: (project) =>
    set((state) => ({
      projects: sortProjectsByUpdatedAt([...state.projects, project]),
    })),

  updateProject: (id, updates, options) => {
    set((state) => ({
      projects: sortProjectsByUpdatedAt(
        state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p))
      ),
      currentProject:
        state.currentProject?.id === id
          ? { ...state.currentProject, ...updates }
          : state.currentProject,
    }));
    if (!options?._fromRemote) {
      broadcastProjectUpdate(id, updates);
    }
  },

  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    })),

  setCurrentProject: (project) => set({ currentProject: project }),

  setMembers: (members, projectId) =>
    set((state) => ({
      members,
      membersLoadedProjectId: projectId ?? state.membersLoadedProjectId,
    })),

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

// Subscribe to cross-window project updates
onProjectUpdated((projectId, updates) => {
  useProjectStore.getState().updateProject(projectId, updates, { _fromRemote: true });
});
