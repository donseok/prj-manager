import type { ProjectMember } from '../types';

export interface ProjectPermissions {
  role: ProjectMember['role'] | null;
  canEditProject: boolean;      // owner, admin
  canDeleteProject: boolean;    // owner only
  canManageMembers: boolean;    // owner, admin
  canCreateTask: boolean;       // owner, admin, member
  canEditTask: boolean;         // owner, admin, member
  canDeleteTask: boolean;       // owner, admin
  canExport: boolean;           // all roles
  isReadOnly: boolean;          // viewer only
}

export function getProjectPermissions(role: ProjectMember['role'] | null): ProjectPermissions {
  if (!role) {
    return {
      role: null,
      canEditProject: false,
      canDeleteProject: false,
      canManageMembers: false,
      canCreateTask: false,
      canEditTask: false,
      canDeleteTask: false,
      canExport: false,
      isReadOnly: true,
    };
  }

  switch (role) {
    case 'owner':
      return {
        role,
        canEditProject: true,
        canDeleteProject: true,
        canManageMembers: true,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: true,
        canExport: true,
        isReadOnly: false,
      };
    case 'admin':
      return {
        role,
        canEditProject: true,
        canDeleteProject: false,
        canManageMembers: true,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: true,
        canExport: true,
        isReadOnly: false,
      };
    case 'member':
      return {
        role,
        canEditProject: false,
        canDeleteProject: false,
        canManageMembers: false,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: false,
        canExport: true,
        isReadOnly: false,
      };
    case 'viewer':
      return {
        role,
        canEditProject: false,
        canDeleteProject: false,
        canManageMembers: false,
        canCreateTask: false,
        canEditTask: false,
        canDeleteTask: false,
        canExport: true,
        isReadOnly: true,
      };
  }
}
