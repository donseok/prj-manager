export type AuditAction =
  | 'project.delete'
  | 'project.settings_change'
  | 'member.role_change'
  | 'member.add'
  | 'member.remove'
  | 'task.delete'
  | 'owner.transfer';

export interface AuditLogEntry {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  details: string;
  createdAt: string;
}
