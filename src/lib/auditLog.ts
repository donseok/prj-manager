import { generateId } from './utils';
import { supabase } from './supabase';
import type { AuditAction, AuditLogEntry } from '../types/audit';

const MAX_ENTRIES_PER_PROJECT = 500;

export async function logAuditEvent(params: {
  projectId: string;
  userId: string;
  userName: string;
  action: AuditAction;
  details: string;
}): Promise<void> {
  const entry: AuditLogEntry = {
    id: generateId(),
    projectId: params.projectId,
    userId: params.userId,
    userName: params.userName,
    action: params.action,
    details: params.details,
    createdAt: new Date().toISOString(),
  };

  const { error } = await supabase.from('audit_log').insert({
    id: entry.id,
    project_id: entry.projectId,
    user_id: entry.userId,
    user_name: entry.userName,
    action: entry.action,
    details: entry.details,
    created_at: entry.createdAt,
  });

  if (error) {
    console.error('[audit] Failed to log audit event:', error.message);
  }
}

export async function loadAuditLog(projectId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(MAX_ENTRIES_PER_PROJECT);

  if (error) {
    console.error('[audit] Failed to load audit log:', error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    action: row.action as AuditAction,
    details: row.details as string,
    createdAt: row.created_at as string,
  }));
}
