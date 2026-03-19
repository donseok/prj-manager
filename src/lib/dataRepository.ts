import type { Project, ProjectMember, Task } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { sampleWorkspaces } from '../data/sampleData';

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

// ─── localStorage fallback ──────────────────────────────────

const LS_PROJECTS = 'dkflow-projects';
const LS_MEMBERS = 'dkflow-members-';
const LS_TASKS = 'dkflow-tasks-';

function ensureLocalSeed() {
  if (localStorage.getItem(LS_PROJECTS)) return;
  const projects = sampleWorkspaces.map((w) => w.project);
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
  for (const ws of sampleWorkspaces) {
    localStorage.setItem(LS_MEMBERS + ws.project.id, JSON.stringify(ws.members));
    localStorage.setItem(LS_TASKS + ws.project.id, JSON.stringify(ws.tasks));
  }
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Projects ────────────────────────────────────────────────

export async function loadInitialProjects(): Promise<Project[]> {
  return loadProjects();
}

export async function loadProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    ensureLocalSeed();
    const projects = lsGet<Project[]>(LS_PROJECTS, []);
    return projects.filter((p) => p.status !== 'deleted').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

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
    ensureLocalSeed();
    const projects = lsGet<Project[]>(LS_PROJECTS, []);
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.unshift(project);
    }
    lsSet(LS_PROJECTS, projects);
    return project;
  }

  const row = toProjectRow(project);

  const { data, error } = await supabase
    .from('projects')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to save project:', error);
    throw new Error(`프로젝트 저장 실패: ${error.message}`);
  }

  return mapProjectRow(data as ProjectRow);
}

export async function deleteProjectById(projectId: string) {
  if (!isSupabaseConfigured) {
    ensureLocalSeed();
    const projects = lsGet<Project[]>(LS_PROJECTS, []);
    lsSet(LS_PROJECTS, projects.filter((p) => p.id !== projectId));
    localStorage.removeItem(LS_MEMBERS + projectId);
    localStorage.removeItem(LS_TASKS + projectId);
    return;
  }

  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    console.error('Failed to delete project:', error);
    throw new Error(`프로젝트 삭제 실패: ${error.message}`);
  }
}

// ─── Project Members ─────────────────────────────────────────

export async function loadProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (!isSupabaseConfigured) {
    ensureLocalSeed();
    const members = lsGet<ProjectMember[]>(LS_MEMBERS + projectId, []);
    return members.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

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
  if (!isSupabaseConfigured) {
    lsSet(LS_MEMBERS + projectId, members);
    return;
  }

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
  if (!isSupabaseConfigured) {
    ensureLocalSeed();
    const tasks = lsGet<Task[]>(LS_TASKS + projectId, []);
    return tasks.sort((a, b) => a.level - b.level || a.orderIndex - b.orderIndex);
  }

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
  if (!isSupabaseConfigured) {
    lsSet(LS_TASKS + projectId, tasks);
    return;
  }

  const rows = tasks
    .map(toTaskRow)
    .sort((a, b) => a.level - b.level || a.order_index - b.order_index);
  const currentIds = new Set(rows.map((row) => row.id));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('tasks')
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) {
      console.error('Failed to upsert tasks:', upsertError);
      throw new Error(`작업 저장 실패: ${upsertError.message}`);
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

function toProjectRow(project: Project): ProjectRow {
  return {
    id: project.id,
    owner_id: project.ownerId,
    name: project.name,
    description: project.description || null,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
    base_date: project.baseDate || null,
    status: project.status,
    completed_at: project.completedAt || null,
    settings: project.settings ?? {},
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
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

function toTaskRow(task: Task): TaskRow {
  return {
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
    duration_days: task.durationDays ?? null,
    predecessor_ids: task.predecessorIds ?? null,
    task_source: task.taskSource ?? null,
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
}
