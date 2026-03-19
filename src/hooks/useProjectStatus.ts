import { useProjectStore } from '../store/projectStore';
import { upsertProject } from '../lib/dataRepository';
import { PROJECT_STATUS_LABELS } from '../types';
import type { Project, ProjectStatus } from '../types';

/**
 * 프로젝트 상태 변경 로직 훅.
 * ProjectList와 Settings에서 공통 사용.
 */
export function useProjectStatus() {
  const { updateProject } = useProjectStore();

  const changeStatus = async (project: Project, newStatus: ProjectStatus) => {
    const now = new Date().toISOString();
    const nextSettings = {
      ...project.settings,
      statusMode: 'manual' as const,
      manualStatus: newStatus,
    };
    const updates: Partial<Project> = {
      status: newStatus,
      settings: nextSettings,
      updatedAt: now,
    };

    if (newStatus === 'completed') {
      updates.completedAt = now;
    } else {
      updates.completedAt = undefined;
    }

    const savedProject = await upsertProject({ ...project, ...updates } as Project);
    updateProject(project.id, {
      status: savedProject.status,
      settings: savedProject.settings,
      completedAt: savedProject.completedAt,
      updatedAt: savedProject.updatedAt,
    });

    return savedProject;
  };

  return { changeStatus, statusLabels: PROJECT_STATUS_LABELS };
}
