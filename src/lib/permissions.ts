import type { ProjectMember, Task } from '../types';

export interface ProjectPermissions {
  role: ProjectMember['role'] | null;
  isSystemAdmin: boolean;
  canEditProject: boolean;      // owner, admin
  canDeleteProject: boolean;    // owner only
  canManageMembers: boolean;    // owner, admin
  canCreateTask: boolean;       // owner, admin, editor, member
  canEditTask: boolean;         // owner, admin, editor, member (scoped)
  canDeleteTask: boolean;       // owner, admin, editor
  canExport: boolean;           // all roles
  canViewAttendance: boolean;   // all roles
  canEditOwnAttendance: boolean;  // owner, admin, editor, member
  canEditAllAttendance: boolean;  // owner, admin
  canEditAllTasks: boolean;     // owner, admin, editor
  canEditOwnTasksOnly: boolean; // member, restricted_member
  canTransferOwnership: boolean; // owner only
  isReadOnly: boolean;          // viewer, system admin read-only
}

export function getProjectPermissions(role: ProjectMember['role'] | null): ProjectPermissions {
  if (!role) {
    return {
      role: null,
      isSystemAdmin: false,
      canEditProject: false,
      canDeleteProject: false,
      canManageMembers: false,
      canCreateTask: false,
      canEditTask: false,
      canDeleteTask: false,
      canExport: false,
      canViewAttendance: false,
      canEditOwnAttendance: false,
      canEditAllAttendance: false,
      canEditAllTasks: false,
      canEditOwnTasksOnly: false,
      canTransferOwnership: false,
      isReadOnly: true,
    };
  }

  switch (role) {
    case 'owner':
      return {
        role,
        isSystemAdmin: false,
        canEditProject: true,
        canDeleteProject: true,
        canManageMembers: true,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: true,
        canExport: true,
        canViewAttendance: true,
        canEditOwnAttendance: true,
        canEditAllAttendance: true,
        canEditAllTasks: true,
        canEditOwnTasksOnly: false,
        canTransferOwnership: true,
        isReadOnly: false,
      };
    case 'admin':
      return {
        role,
        isSystemAdmin: false,
        canEditProject: true,
        canDeleteProject: false,
        canManageMembers: true,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: true,
        canExport: true,
        canViewAttendance: true,
        canEditOwnAttendance: true,
        canEditAllAttendance: true,
        canEditAllTasks: true,
        canEditOwnTasksOnly: false,
        canTransferOwnership: false,
        isReadOnly: false,
      };
    case 'editor':
      return {
        role,
        isSystemAdmin: false,
        canEditProject: false,
        canDeleteProject: false,
        canManageMembers: false,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: true,
        canExport: true,
        canViewAttendance: true,
        canEditOwnAttendance: true,
        canEditAllAttendance: false,
        canEditAllTasks: true,
        canEditOwnTasksOnly: false,
        canTransferOwnership: false,
        isReadOnly: false,
      };
    case 'member':
      return {
        role,
        isSystemAdmin: false,
        canEditProject: false,
        canDeleteProject: false,
        canManageMembers: false,
        canCreateTask: true,
        canEditTask: true,
        canDeleteTask: false,
        canExport: true,
        canViewAttendance: true,
        canEditOwnAttendance: true,
        canEditAllAttendance: false,
        canEditAllTasks: false,
        canEditOwnTasksOnly: true,
        canTransferOwnership: false,
        isReadOnly: false,
      };
    case 'restricted_member':
      return {
        role,
        isSystemAdmin: false,
        canEditProject: false,
        canDeleteProject: false,
        canManageMembers: false,
        canCreateTask: false,
        canEditTask: true,
        canDeleteTask: false,
        canExport: true,
        canViewAttendance: true,
        canEditOwnAttendance: true,
        canEditAllAttendance: false,
        canEditAllTasks: false,
        canEditOwnTasksOnly: true,
        canTransferOwnership: false,
        isReadOnly: false,
      };
    case 'viewer':
      return {
        role,
        isSystemAdmin: false,
        canEditProject: false,
        canDeleteProject: false,
        canManageMembers: false,
        canCreateTask: false,
        canEditTask: false,
        canDeleteTask: false,
        canExport: true,
        canViewAttendance: true,
        canEditOwnAttendance: false,
        canEditAllAttendance: false,
        canEditAllTasks: false,
        canEditOwnTasksOnly: false,
        canTransferOwnership: false,
        isReadOnly: true,
      };
  }
}

export function getSystemAdminReadOnlyPermissions(): ProjectPermissions {
  return {
    role: null,
    isSystemAdmin: true,
    canEditProject: false,
    canDeleteProject: false,
    canManageMembers: false,
    canCreateTask: false,
    canEditTask: false,
    canDeleteTask: false,
    canExport: true,
    canViewAttendance: true,
    canEditOwnAttendance: false,
    canEditAllAttendance: false,
    canEditAllTasks: false,
    canEditOwnTasksOnly: false,
    canTransferOwnership: false,
    isReadOnly: true,
  };
}

/**
 * Check if a specific task can be edited by the current user.
 * - canEditAllTasks → always true
 * - canEditOwnTasksOnly && task.assigneeId === currentMemberId → true
 * - Unassigned tasks (no assigneeId) → only editable by users with canEditAllTasks
 */
export function canEditSpecificTask(
  permissions: ProjectPermissions,
  task: Task,
  currentMemberId: string | null,
): boolean {
  if (permissions.canEditAllTasks) return true;
  if (!permissions.canEditOwnTasksOnly) return false;
  if (!task.assigneeId || !currentMemberId) return false;
  return task.assigneeId === currentMemberId;
}
