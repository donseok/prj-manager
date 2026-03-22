import type { Project, ProjectMember, Task, Attendance } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { storage } from './utils';

// ─── localStorage keys ──────────────────────────────────────
function lsProjectsKey() { return 'dk_projects'; }
function lsMembersKey(pid: string) { return `dk_members_${pid}`; }
function lsTasksKey(pid: string) { return `dk_tasks_${pid}`; }

// ─── Row interfaces (DB snake_case) ─────────────────────────

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  base_date: string | null;
  status: Project['status'];
  completed_at: string | null;
  settings: Project['settings'] | null;
  created_at: string;
  updated_at: string;
}

interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  role: ProjectMember['role'];
  created_at: string;
}

interface TaskRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  level: number;
  order_index: number;
  name: string;
  description: string | null;
  output: string | null;
  assignee_id: string | null;
  weight: number;
  duration_days?: number | null;
  predecessor_ids?: string[] | null;
  task_source?: Task['taskSource'] | null;
  plan_start: string | null;
  plan_end: string | null;
  plan_progress: number;
  actual_start: string | null;
  actual_end: string | null;
  actual_progress: number;
  status: Task['status'];
  created_at: string;
  updated_at: string;
}

// ─── Projects ────────────────────────────────────────────────

export async function loadInitialProjects(): Promise<Project[]> {
  return loadProjects();
}

export async function loadProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured) return storage.get<Project[]>(lsProjectsKey(), []);
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .neq('status', 'deleted')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to load projects:', error);
    return [];
  }

  return (data as ProjectRow[]).map(mapProjectRow);
}

export async function upsertProject(project: Project): Promise<Project> {
  if (!isSupabaseConfigured) {
    const projects = storage.get<Project[]>(lsProjectsKey(), []);
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) projects[idx] = project; else projects.unshift(project);
    storage.set(lsProjectsKey(), projects);
    return project;
  }
  const row = toProjectRow(project);

  // 기존 프로젝트면 UPDATE, 신규면 INSERT (upsert는 RLS INSERT 정책을 먼저 체크하므로 분리)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, owner_id: _oid, created_at: _cat, ...updateFields } = row;
  const { data: updatedRows, error: updateError } = await supabase
    .from('projects')
    .update(updateFields)
    .eq('id', project.id)
    .select();

  if (!updateError && updatedRows && updatedRows.length > 0) {
    return mapProjectRow(updatedRows[0] as ProjectRow);
  }

  // UPDATE 실패 시 (행이 없는 경우 등) INSERT 시도
  if (!updateError) {
    const { data: inserted, error: insertError } = await supabase
      .from('projects')
      .insert(row)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert project:', { code: insertError.code, message: insertError.message, details: insertError.details, hint: insertError.hint });
      throw new Error(`프로젝트 생성 실패 [${insertError.code}]: ${insertError.message}${insertError.hint ? ` (${insertError.hint})` : ''}`);
    }

    return mapProjectRow(inserted as ProjectRow);
  }

  console.error('Failed to update project:', { code: updateError?.code, message: updateError?.message, details: updateError?.details, hint: updateError?.hint });
  throw new Error(`프로젝트 저장 실패 [${updateError?.code}]: ${updateError?.message}${updateError?.hint ? ` (${updateError.hint})` : ''}`);
}

export async function deleteProjectById(projectId: string) {
  if (!isSupabaseConfigured) {
    const projects = storage.get<Project[]>(lsProjectsKey(), []);
    storage.set(lsProjectsKey(), projects.filter((p) => p.id !== projectId));
    return;
  }
  const { error, count } = await supabase
    .from('projects')
    .delete({ count: 'exact' })
    .eq('id', projectId);

  if (error) {
    console.error('Failed to delete project:', error);
    throw new Error(`프로젝트 삭제 실패: ${error.message}`);
  }

  if (count === 0) {
    throw new Error('프로젝트 삭제 권한이 없거나 프로젝트를 찾을 수 없습니다.');
  }
}

// ─── Project Members ─────────────────────────────────────────

export async function loadProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (!isSupabaseConfigured) return storage.get<ProjectMember[]>(lsMembersKey(projectId), []);
  const { data, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load members:', error);
    return [];
  }

  return (data as ProjectMemberRow[]).map(mapProjectMemberRow);
}

export async function syncProjectMembers(projectId: string, members: ProjectMember[]) {
  if (!isSupabaseConfigured) { storage.set(lsMembersKey(projectId), members); return; }
  const rows = members.map(toProjectMemberRow);
  const currentIds = new Set(rows.map((row) => row.id));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('project_members')
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) {
      console.error('Failed to upsert members:', upsertError);
      throw new Error(`멤버 저장 실패: ${upsertError.message}`);
    }

    // 삭제된 멤버 정리
    const { data: existingRows, error: selectError } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId);

    if (selectError) {
      console.error('Failed to load remote members for cleanup:', selectError);
      return;
    }

    const idsToDelete = (existingRows || [])
      .map((row) => String((row as { id: string }).id))
      .filter((id) => !currentIds.has(id));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('project_members').delete().in('id', idsToDelete);
      if (deleteError) {
        console.error('Failed to delete removed members:', deleteError);
      }
    }
  } else {
    const { error } = await supabase.from('project_members').delete().eq('project_id', projectId);
    if (error) {
      console.error('Failed to clear members:', error);
    }
  }
}

// ─── Tasks ───────────────────────────────────────────────────

export async function loadProjectTasks(projectId: string): Promise<Task[]> {
  if (!isSupabaseConfigured) return storage.get<Task[]>(lsTasksKey(projectId), []);
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('level', { ascending: true })
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Failed to load tasks:', error);
    return [];
  }

  return (data as TaskRow[]).map(mapTaskRow);
}

export async function syncProjectTasks(projectId: string, tasks: Task[]) {
  if (!isSupabaseConfigured) { storage.set(lsTasksKey(projectId), tasks); return; }
  const rows = tasks
    .map(toTaskRow)
    .sort((a, b) => a.level - b.level || a.order_index - b.order_index);
  const currentIds = new Set(rows.map((row) => row.id));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('tasks')
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) {
      // 마이그레이션 미적용 컬럼이 원인이면 해당 컬럼 제거 후 재시도
      if (upsertError.code === 'PGRST204') {
        const extraCols = ['duration_days', 'predecessor_ids', 'task_source'];
        const strippedRows = rows.map((row) => {
          const clean = { ...row };
          for (const col of extraCols) delete (clean as Record<string, unknown>)[col];
          return clean;
        });
        const { error: retryError } = await supabase
          .from('tasks')
          .upsert(strippedRows, { onConflict: 'id' });

        if (retryError) {
          console.error('Failed to upsert tasks (retry):', { code: retryError.code, message: retryError.message, details: retryError.details, hint: retryError.hint });
          throw new Error(`작업 저장 실패 [${retryError.code}]: ${retryError.message}`);
        }
      } else {
        console.error('Failed to upsert tasks:', { code: upsertError.code, message: upsertError.message, details: upsertError.details, hint: upsertError.hint });
        throw new Error(`작업 저장 실패 [${upsertError.code}]: ${upsertError.message}`);
      }
    }

    // 삭제된 작업 정리
    const { data: existingRows, error: selectError } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', projectId);

    if (selectError) {
      console.error('Failed to load remote tasks for cleanup:', selectError);
      return;
    }

    const idsToDelete = (existingRows || [])
      .map((row) => String((row as { id: string }).id))
      .filter((id) => !currentIds.has(id));

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('tasks').delete().in('id', idsToDelete);
      if (deleteError) {
        console.error('Failed to delete removed tasks:', deleteError);
      }
    }
  } else {
    const { error } = await supabase.from('tasks').delete().eq('project_id', projectId);
    if (error) {
      console.error('Failed to clear tasks:', error);
    }
  }
}

// ─── User-scoped Project Loading ────────────────────────────

/** Load project IDs that a user is a member of */
export async function loadProjectIdsForUser(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to load project IDs for user:', error);
    return new Set();
  }

  return new Set((data || []).map((row) => String((row as { project_id: string }).project_id)));
}

/** Load projects filtered by membership. System admins see all projects. */
export async function loadProjectsForUser(userId: string, isSystemAdmin: boolean): Promise<Project[]> {
  if (isSystemAdmin) {
    return loadProjects();
  }

  const memberProjectIds = await loadProjectIdsForUser(userId);
  const allProjects = await loadProjects();
  return allProjects.filter((p) => memberProjectIds.has(p.id));
}

// ─── Row Mappers (snake_case → camelCase) ────────────────────

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description || undefined,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    baseDate: row.base_date || undefined,
    status: row.status,
    completedAt: row.completed_at || undefined,
    settings: row.settings || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProjectRow(project: Project) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    id: project.id,
    owner_id: project.ownerId,
    name: project.name,
    description: project.description || null,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
    base_date: project.baseDate || null,
    status: project.status,
    settings: project.settings ?? {},
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
  // completed_at은 값이 있을 때만 전송 (마이그레이션 미적용 환경 호환)
  if (project.completedAt) {
    row.completed_at = project.completedAt;
  }
  return row;
}

function mapProjectMemberRow(row: ProjectMemberRow): ProjectMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id || undefined,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function toProjectMemberRow(member: ProjectMember): ProjectMemberRow {
  return {
    id: member.id,
    project_id: member.projectId,
    user_id: member.userId || null,
    name: member.name,
    role: member.role,
    created_at: member.createdAt,
  };
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    level: Number(row.level),
    orderIndex: Number(row.order_index),
    name: row.name,
    description: row.description || undefined,
    output: row.output || undefined,
    assigneeId: row.assignee_id,
    weight: Number(row.weight),
    durationDays: row.duration_days ?? undefined,
    predecessorIds: row.predecessor_ids ?? undefined,
    taskSource: row.task_source ?? undefined,
    planStart: row.plan_start,
    planEnd: row.plan_end,
    planProgress: Number(row.plan_progress),
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    actualProgress: Number(row.actual_progress),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTaskRow(task: Task) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    id: task.id,
    project_id: task.projectId,
    parent_id: task.parentId || null,
    level: task.level,
    order_index: task.orderIndex,
    name: task.name,
    description: task.description || null,
    output: task.output || null,
    assignee_id: task.assigneeId || null,
    weight: task.weight,
    plan_start: task.planStart || null,
    plan_end: task.planEnd || null,
    plan_progress: task.planProgress,
    actual_start: task.actualStart || null,
    actual_end: task.actualEnd || null,
    actual_progress: task.actualProgress,
    status: task.status,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
  // 마이그레이션 4 추가 필드 — 값이 있을 때만 전송
  if (task.durationDays != null) row.duration_days = task.durationDays;
  if (task.predecessorIds != null) row.predecessor_ids = task.predecessorIds;
  if (task.taskSource != null) row.task_source = task.taskSource;
  return row;
}

// ─── Attendance ─────────────────────────────────────────────

interface AttendanceRow {
  id: string;
  project_id: string;
  member_id: string;
  date: string;
  type: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function mapAttendanceRow(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    projectId: row.project_id,
    memberId: row.member_id,
    date: row.date,
    type: row.type as Attendance['type'],
    note: row.note || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAttendanceRow(a: Attendance): AttendanceRow {
  return {
    id: a.id,
    project_id: a.projectId,
    member_id: a.memberId,
    date: a.date,
    type: a.type,
    note: a.note || null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

export async function loadAttendances(projectId: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Failed to load attendance:', error);
    return [];
  }

  return (data as AttendanceRow[]).map(mapAttendanceRow);
}

export async function upsertAttendance(attendance: Attendance): Promise<Attendance> {
  const row = toAttendanceRow(attendance);
  console.log('[attendance] upsert 요청:', row);

  const { data, error } = await supabase
    .from('attendance')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[attendance] upsert 실패:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    throw new Error(`근태 저장 실패 [${error.code}]: ${error.message}${error.hint ? ` (${error.hint})` : ''}`);
  }

  console.log('[attendance] upsert 성공:', data);
  return mapAttendanceRow(data as AttendanceRow);
}

export async function deleteAttendanceById(_projectId: string, id: string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete attendance:', error);
    throw new Error(`근태 삭제 실패: ${error.message}`);
  }
}

// ─── Account Deletion ───────────────────────────────────────

/** 사용자가 소유한 프로젝트 ID 목록 조회 */
export async function loadOwnedProjectIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('owner_id', userId)
    .neq('status', 'deleted');

  if (error) {
    console.error('Failed to load owned projects:', error);
    return [];
  }

  return (data || []).map((row) => row.id);
}

/** 사용자가 소유한 모든 프로젝트 일괄 삭제 */
export async function deleteAllOwnedProjects(userId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('owner_id', userId);

  if (error) {
    console.error('Failed to delete owned projects:', error);
    throw new Error(`소유 프로젝트 삭제 실패: ${error.message}`);
  }
}

/** 사용자가 멤버로 참여 중인 프로젝트에서 자신을 제거 */
export async function removeUserFromAllProjects(userId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to remove user from projects:', error);
    throw new Error(`프로젝트 멤버 제거 실패: ${error.message}`);
  }
}
