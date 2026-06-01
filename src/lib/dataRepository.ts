import type { Project, ProjectMember, Task, Attendance, WeeklyMemberReport, Contact } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { storage } from './utils';

// ─── Auth error detection ───────────────────────────────────
// Supabase API 호출 실패 시 인증 오류인지 판별하고, 맞으면 세션을 정리한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAuthError(error: any): boolean {
  const status = error?.status ?? error?.code;
  const msg = typeof error?.message === 'string' ? error.message : '';
  return status === 401 || status === 403 ||
    msg.includes('JWT') || msg.includes('token') ||
    msg.includes('Refresh Token') || msg.includes('Not authorized');
}

let _sessionExpiredHandled = false;

function handleSessionExpired() {
  if (_sessionExpiredHandled) return;
  _sessionExpiredHandled = true;
  // 순환 의존 방지를 위해 동적 import
  void import('../store/authStore').then(({ useAuthStore }) => {
    useAuthStore.getState().logout();
    _sessionExpiredHandled = false;
  });
}

// ─── localStorage keys ──────────────────────────────────────
function lsProjectsKey() { return 'dk_projects'; }
function lsMembersKey(pid: string) { return `dk_members_${pid}`; }
function lsTasksKey(pid: string) { return `dk_tasks_${pid}`; }
function lsAttendanceKey(pid: string) { return `dk_attendance_${pid}`; }
function lsContactsKey() { return 'dkflow:contacts'; }

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
  previous_role?: ProjectMember['role'] | null;
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
    if (isAuthError(error)) { handleSessionExpired(); return []; }
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

  // INSERT 먼저 시도 (신규 프로젝트인 경우가 더 빈번) → 충돌 시 UPDATE
  const { data: inserted, error: insertError } = await supabase
    .from('projects')
    .insert(row)
    .select()
    .single();

  if (!insertError && inserted) {
    return mapProjectRow(inserted as ProjectRow);
  }

  // PK 충돌(23505) 또는 RLS INSERT 정책 위반 → 기존 프로젝트 UPDATE
  if (insertError && (insertError.code === '23505' || insertError.code === '42501' || insertError.message?.includes('duplicate'))) {
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

    console.error('Failed to update project:', { code: updateError?.code, message: updateError?.message, details: updateError?.details, hint: updateError?.hint });
    throw new Error(`프로젝트 저장 실패 [${updateError?.code}]: ${updateError?.message}${updateError?.hint ? ` (${updateError.hint})` : ''}`);
  }

  console.error('Failed to insert project:', { code: insertError?.code, message: insertError?.message, details: insertError?.details, hint: insertError?.hint });
  throw new Error(`프로젝트 생성 실패 [${insertError?.code}]: ${insertError?.message}${insertError?.hint ? ` (${insertError.hint})` : ''}`);
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
    if (isAuthError(error)) { handleSessionExpired(); return []; }
    console.error('Failed to load members:', error);
    return [];
  }

  return (data as ProjectMemberRow[]).map(mapProjectMemberRow);
}

export async function syncProjectMembers(projectId: string, members: ProjectMember[], options?: { skipCleanup?: boolean }) {
  if (!isSupabaseConfigured) { storage.set(lsMembersKey(projectId), members); return; }
  const rows = members.map(toProjectMemberRow);
  const currentIds = new Set(rows.map((row) => row.id));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('project_members')
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) {
      // previous_role 마이그레이션 미적용 환경(PGRST204)이면 해당 컬럼을 제거 후 재시도.
      if (upsertError.code === 'PGRST204') {
        const strippedRows = rows.map((row) => {
          const clean = { ...row };
          delete (clean as Record<string, unknown>).previous_role;
          return clean;
        });
        const { error: retryError } = await supabase
          .from('project_members')
          .upsert(strippedRows, { onConflict: 'id' });
        if (retryError) {
          console.error('Failed to upsert members (retry):', retryError);
          throw new Error(`멤버 저장 실패: ${retryError.message}`);
        }
      } else {
        console.error('Failed to upsert members:', upsertError);
        throw new Error(`멤버 저장 실패: ${upsertError.message}`);
      }
    }

    // 신규 프로젝트 등 삭제 멤버가 없는 경우 정리 스킵 (불필요한 SELECT+DELETE 제거)
    if (options?.skipCleanup) return;

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
    if (isAuthError(error)) { handleSessionExpired(); return []; }
    console.error('Failed to load tasks:', error);
    return [];
  }

  return (data as TaskRow[]).map(mapTaskRow);
}

export async function syncProjectTasks(
  projectId: string,
  tasks: Task[],
  options?: { allowFullClear?: boolean },
) {
  try {
    await _syncProjectTasksInner(projectId, tasks, options);
  } catch (err) {
    // Lock 충돌 에러인 경우 1회 재시도
    if (err instanceof Error && (err.message.includes('Lock') || err.message.includes('lock') || err.message.includes('steal'))) {
      console.warn('[tasks] Lock 충돌 감지, 500ms 후 재시도...');
      await new Promise(r => setTimeout(r, 500));
      await _syncProjectTasksInner(projectId, tasks, options);
      return;
    }
    throw err;
  }
}

async function _syncProjectTasksInner(
  projectId: string,
  tasks: Task[],
  options?: { allowFullClear?: boolean },
) {
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
  } else if (options?.allowFullClear) {
    // 빈 목록 = 프로젝트 전체 작업 삭제. 일시적 로드 실패/레이스로 인메모리
    // 목록이 비는 경우가 있어, 명시적 의도(allowFullClear)가 있을 때만 수행한다.
    // 그렇지 않으면 기존 작업을 보존해 데이터 유실을 막는다.
    const { error } = await supabase.from('tasks').delete().eq('project_id', projectId);
    if (error) {
      console.error('Failed to clear tasks:', error);
    }
  } else {
    // 데이터 유실 방지: 빈 목록 저장 요청은 기존 원격 작업을 지우지 않고 건너뛴다.
    // (의도적 전체 삭제는 allowFullClear:true 로 호출해야 한다.)
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (!countError && (count ?? 0) > 0) {
      console.warn(
        `[tasks] 빈 목록 저장 차단 — 프로젝트 ${projectId}의 기존 작업 ${count}건을 보존합니다. ` +
        '(일시적 로드 실패/레이스로 추정. 의도적 전체 삭제라면 allowFullClear 필요)',
      );
    }
  }
}

// ─── User-scoped Project Loading ────────────────────────────

/**
 * Load project IDs that a user is a member of.
 *
 * 1차: SECURITY DEFINER RPC(link_orphan_members_to_user) 가 본인 식별 정보와
 *      일치하는 orphan(user_id IS NULL) 멤버를 자동 백필한 뒤, 본인이 속한
 *      프로젝트 ID 목록을 반환한다. RLS를 우회해야 orphan 행이 보이므로 RPC가 필수.
 * 2차(폴백): RPC 미설치 환경에서는 user_id 직접 매칭만 수행한다. 표시 이름 기반
 *           클라이언트 백필은 동명이인 멤버십 탈취 위험이 있어 제거되었다. (M-5)
 *
 * `_userName`은 과거 시그니처 호환을 위해 유지하나 더 이상 사용하지 않는다.
 */
export async function loadProjectIdsForUser(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userName?: string,
): Promise<Set<string>> {
  // 1차: RPC 호출 (RLS 우회하여 orphan 매칭/백필 후 멤버 프로젝트 ID 반환)
  const { data: rpcData, error: rpcError } = await supabase.rpc('link_orphan_members_to_user');
  if (!rpcError && Array.isArray(rpcData)) {
    return new Set(rpcData.map((row) => {
      if (typeof row === 'string') return row;
      if (row && typeof row === 'object' && 'project_id' in row) return String((row as { project_id: unknown }).project_id);
      if (row && typeof row === 'object' && 'link_orphan_members_to_user' in row) return String((row as { link_orphan_members_to_user: unknown }).link_orphan_members_to_user);
      return String(row);
    }));
  }
  if (rpcError) {
    if (isAuthError(rpcError)) { handleSessionExpired(); return new Set(); }
    // RPC 미설치(함수 없음) 외 오류만 에러로 기록
    const notInstalled = rpcError.message?.includes('link_orphan_members_to_user')
      || rpcError.message?.includes('function') && rpcError.message?.includes('does not exist');
    if (notInstalled) {
      console.warn(
        '[member-link] link_orphan_members_to_user RPC가 설치되어 있지 않습니다. ' +
        'Supabase SQL Editor에서 supabase/migrations/20260513100000_link_orphan_members_rpc.sql 을 실행하세요. ' +
        '폴백 매칭은 RLS 정책상 orphan 행을 보지 못해 효과가 제한됩니다.'
      );
    } else {
      console.error('Failed to call link_orphan_members_to_user RPC:', rpcError);
    }
  }

  // 폴백: user_id 직접 매칭 + name 기반 클라이언트 백필 (제한적)
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId);

  if (error) {
    if (isAuthError(error)) { handleSessionExpired(); return new Set(); }
    console.error('Failed to load project IDs for user:', error);
    return new Set();
  }

  const ids = new Set((data || []).map((row) => String((row as { project_id: string }).project_id)));

  // 주: 과거에는 표시 이름(name)만으로 orphan 행을 매칭해 클라이언트에서 user_id를
  // 백필하던 폴백이 있었으나, (1) 프로젝트 단위로 스코프되지 않아 동명이인의
  // 멤버십을 가로챌 수 있고 (2) RLS 정책상 orphan 행이 클라이언트에 보이지 않아
  // 사실상 무력했다. orphan 연결은 본인 식별 정보로만 매칭하는 SECURITY DEFINER
  // RPC(link_orphan_members_to_user)에 일임한다. (M-5)

  return ids;
}

/** Load projects filtered by membership. System admins see all projects. */
export async function loadProjectsForUser(
  userId: string,
  isSystemAdmin: boolean,
  userName?: string,
): Promise<Project[]> {
  if (isSystemAdmin) {
    const all = await loadProjects();
    return all;
  }

  const memberProjectIds = await loadProjectIdsForUser(userId, userName);
  const allProjects = await loadProjects();
  const visible = allProjects.filter((p) => memberProjectIds.has(p.id));
  return visible;
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

export function toProjectRow(project: Project) {
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
    // 완료 해제 시 stale 값을 반드시 비워야 하므로 항상 명시적으로 전송한다.
    // 값이 없으면 null을 보내 컬럼을 초기화한다 (M-2). UPDATE 경로에서 키가
    // 빠지면 Supabase가 기존 completed_at을 그대로 유지하기 때문이다.
    completed_at: project.completedAt ?? null,
    settings: project.settings ?? {},
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
  return row;
}

function mapProjectMemberRow(row: ProjectMemberRow): ProjectMember {
  const member: ProjectMember = {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id || undefined,
    name: row.name,
    role: row.role,
    avatarUrl: undefined,
    createdAt: row.created_at,
  };
  // previousRole 키는 실제 값이 있을 때만 둔다. 키가 없으면 toProjectMemberRow가
  // previous_role을 아예 전송하지 않아 마이그레이션 미적용 환경에서 기존 멤버
  // 저장이 PGRST204 재시도 없이 그대로 동작한다. (M-6)
  if (row.previous_role) member.previousRole = row.previous_role;
  return member;
}

function toProjectMemberRow(member: ProjectMember): ProjectMemberRow {
  const row: ProjectMemberRow = {
    id: member.id,
    project_id: member.projectId,
    user_id: member.userId || null,
    name: member.name,
    role: member.role,
    created_at: member.createdAt,
  };
  // previous_role 컬럼은 값이 있을 때만 전송 (마이그레이션 미적용 환경 호환).
  // 복원 시 stale 값을 비워야 하므로 명시적으로 undefined가 들어온 경우
  // null을 보내 컬럼을 초기화한다 (M-6).
  if ('previousRole' in member) {
    row.previous_role = member.previousRole ?? null;
  }
  return row;
}

const safeNum = (v: unknown, def: number): number => { const n = Number(v); return Number.isNaN(n) ? def : n; };

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    level: safeNum(row.level, 1),
    orderIndex: safeNum(row.order_index, 0),
    name: row.name,
    description: row.description || undefined,
    output: row.output || undefined,
    assigneeId: row.assignee_id,
    weight: safeNum(row.weight, 0),
    durationDays: row.duration_days ?? undefined,
    predecessorIds: row.predecessor_ids ?? undefined,
    taskSource: row.task_source ?? undefined,
    planStart: row.plan_start,
    planEnd: row.plan_end,
    planProgress: safeNum(row.plan_progress, 0),
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    actualProgress: safeNum(row.actual_progress, 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** UUID v4 형식 검증 (assignee_id FK 보호) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toTaskRow(task: Task) {
  // assignee_id는 반드시 유효한 UUID여야 한다 (FK → auth.users)
  const safeAssigneeId = task.assigneeId && UUID_RE.test(task.assigneeId) ? task.assigneeId : null;

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
    assignee_id: safeAssigneeId,
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
  if (!isSupabaseConfigured) return storage.get<Attendance[]>(lsAttendanceKey(projectId), []);
  console.log('[attendance] load 요청:', projectId);

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: false });

  if (error) {
    if (isAuthError(error)) { handleSessionExpired(); return []; }
    console.error('[attendance] load 실패:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return [];
  }

  console.log('[attendance] load 성공:', data?.length ?? 0, '건');
  return (data as AttendanceRow[]).map(mapAttendanceRow);
}

export async function upsertAttendance(attendance: Attendance): Promise<Attendance> {
  if (!isSupabaseConfigured) {
    const list = storage.get<Attendance[]>(lsAttendanceKey(attendance.projectId), []);
    const idx = list.findIndex((a) => a.id === attendance.id);
    if (idx >= 0) list[idx] = attendance; else list.unshift(attendance);
    storage.set(lsAttendanceKey(attendance.projectId), list);
    return attendance;
  }
  const row = toAttendanceRow(attendance);
  console.log('[attendance] upsert 요청:', row);

  const { data, error } = await supabase
    .from('attendance')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    if (isAuthError(error)) { handleSessionExpired(); throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.'); }
    console.error('[attendance] upsert 실패:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    throw new Error(`근태 저장 실패 [${error.code}]: ${error.message}${error.hint ? ` (${error.hint})` : ''}`);
  }

  if (!data) {
    console.error('[attendance] upsert 결과 없음 (RLS 차단 가능성)');
    throw new Error('근태 저장 실패: 권한이 없거나 데이터가 반환되지 않았습니다.');
  }

  console.log('[attendance] upsert 성공:', data);
  return mapAttendanceRow(data as AttendanceRow);
}

export async function deleteAttendanceById(projectId: string, id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const list = storage.get<Attendance[]>(lsAttendanceKey(projectId), []);
    storage.set(lsAttendanceKey(projectId), list.filter((a) => a.id !== id));
    return;
  }
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete attendance:', error);
    throw new Error(`근태 삭제 실패: ${error.message}`);
  }
}

// ─── Contacts (명함) ─────────────────────────────────────────

interface ContactRow {
  id: string;
  name: string;
  company: string | null;
  department: string | null;
  title: string | null;
  mobile: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  tags: string[] | null;
  memo: string | null;
  card_image: string | null;
  linked_project_ids: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    company: row.company || undefined,
    department: row.department || undefined,
    title: row.title || undefined,
    mobile: row.mobile || undefined,
    phone: row.phone || undefined,
    fax: row.fax || undefined,
    email: row.email || undefined,
    address: row.address || undefined,
    website: row.website || undefined,
    tags: row.tags ?? [],
    memo: row.memo || undefined,
    cardImage: row.card_image || undefined,
    linkedProjectIds: row.linked_project_ids ?? [],
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toContactRow(c: Contact): ContactRow {
  return {
    id: c.id,
    name: c.name,
    company: c.company || null,
    department: c.department || null,
    title: c.title || null,
    mobile: c.mobile || null,
    phone: c.phone || null,
    fax: c.fax || null,
    email: c.email || null,
    address: c.address || null,
    website: c.website || null,
    tags: c.tags ?? [],
    memo: c.memo || null,
    card_image: c.cardImage || null,
    linked_project_ids: c.linkedProjectIds ?? [],
    created_by: c.createdBy || null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export async function loadContacts(): Promise<Contact[]> {
  if (!isSupabaseConfigured) return storage.get<Contact[]>(lsContactsKey(), []);

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    if (isAuthError(error)) { handleSessionExpired(); return []; }
    console.error('[contacts] load 실패:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return [];
  }

  return (data as ContactRow[]).map(mapContactRow);
}

export async function upsertContact(contact: Contact): Promise<Contact> {
  if (!isSupabaseConfigured) {
    const list = storage.get<Contact[]>(lsContactsKey(), []);
    const idx = list.findIndex((c) => c.id === contact.id);
    if (idx >= 0) list[idx] = contact; else list.unshift(contact);
    storage.set(lsContactsKey(), list);
    return contact;
  }

  const row = toContactRow(contact);
  const { data, error } = await supabase
    .from('contacts')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    if (isAuthError(error)) { handleSessionExpired(); throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.'); }
    console.error('[contacts] upsert 실패:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
    throw new Error(`명함 저장 실패 [${error.code}]: ${error.message}${error.hint ? ` (${error.hint})` : ''}`);
  }

  if (!data) {
    console.error('[contacts] upsert 결과 없음 (RLS 차단 가능성)');
    throw new Error('명함 저장 실패: 권한이 없거나 데이터가 반환되지 않았습니다.');
  }

  return mapContactRow(data as ContactRow);
}

export async function deleteContactById(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const list = storage.get<Contact[]>(lsContactsKey(), []);
    storage.set(lsContactsKey(), list.filter((c) => c.id !== id));
    return;
  }
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete contact:', error);
    throw new Error(`명함 삭제 실패: ${error.message}`);
  }
}

// ─── Account Deletion ───────────────────────────────────────

/** 사용자가 소유한 프로젝트 ID 목록 조회 */
export async function loadOwnedProjectIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured) {
    return storage
      .get<Project[]>(lsProjectsKey(), [])
      .filter((p) => p.ownerId === userId && p.status !== 'deleted')
      .map((p) => p.id);
  }
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

// ─── Weekly Member Reports ──────────────────────────────────

interface WeeklyMemberReportRow {
  id: string;
  project_id: string;
  member_id: string;
  week_start: string;
  this_week_result: string;
  next_week_plan: string;
  created_at: string;
  updated_at: string;
}

function mapWmrRow(row: WeeklyMemberReportRow): WeeklyMemberReport {
  return {
    id: row.id,
    projectId: row.project_id,
    memberId: row.member_id,
    weekStart: row.week_start,
    thisWeekResult: row.this_week_result,
    nextWeekPlan: row.next_week_plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWmrRow(r: WeeklyMemberReport): WeeklyMemberReportRow {
  return {
    id: r.id,
    project_id: r.projectId,
    member_id: r.memberId,
    week_start: r.weekStart,
    this_week_result: r.thisWeekResult,
    next_week_plan: r.nextWeekPlan,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function loadWeeklyMemberReports(
  projectId: string,
  weekStart: string,
): Promise<WeeklyMemberReport[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('weekly_member_reports')
      .select('*')
      .eq('project_id', projectId)
      .eq('week_start', weekStart);

    if (error) {
      console.error('Failed to load weekly member reports:', error);
      return [];
    }
    if (!data) return [];
    return (data as WeeklyMemberReportRow[]).map(mapWmrRow);
  } catch (err) {
    console.error('Unexpected error loading weekly member reports:', err);
    return [];
  }
}

export async function upsertWeeklyMemberReport(
  report: WeeklyMemberReport,
): Promise<WeeklyMemberReport> {
  if (!isSupabaseConfigured) {
    throw new Error('주간보고 담당자 작성은 데이터베이스 연결이 필요합니다.');
  }
  const row = toWmrRow(report);
  const { data, error } = await supabase
    .from('weekly_member_reports')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert weekly member report:', error);
    throw new Error(`담당자 주간보고 저장 실패: ${error.message}`);
  }
  return mapWmrRow(data as WeeklyMemberReportRow);
}
