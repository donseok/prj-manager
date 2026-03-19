import type { Project, ProjectMember, Task } from '../types';
import { sampleWorkspaces } from '../data/sampleData';
import { storage } from './utils';
import { isSupabaseConfigured, supabase } from './supabase';

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

export async function loadInitialProjects() {
  if (canUseSupabase()) {
    // RLS가 admin/user 권한에 따라 자동으로 필터링
    return loadProjects();
  }

  return ensureLocalSampleWorkspace();
}

export async function loadProjects(): Promise<Project[]> {
  if (canUseSupabase() && supabase) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error) {
      return (data as ProjectRow[]).map(mapProjectRow);
    }

    console.error('Failed to load projects from Supabase:', error);
  }

  return storage.get<Project[]>('projects', []);
}

export async function upsertProject(project: Project): Promise<Project> {
  if (canUseSupabase() && supabase) {
    const row = toProjectRow(project);

    const { data, error } = await supabase
      .from('projects')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (!error) {
      return mapProjectRow(data as ProjectRow);
    }

    console.error('Failed to save project to Supabase:', error);
  }

  const projects = storage.get<Project[]>('projects', []);
  const nextProjects = upsertById(projects, project);
  storage.set('projects', nextProjects);
  return project;
}

export async function deleteProjectById(projectId: string) {
  if (canUseSupabase() && supabase) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (!error) return;

    console.error('Failed to delete project from Supabase:', error);
  }

  const projects = storage.get<Project[]>('projects', []);
  storage.set(
    'projects',
    projects.filter((project) => project.id !== projectId)
  );
  storage.remove(`members-${projectId}`);
  storage.remove(`tasks-${projectId}`);
}

export async function loadProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (canUseSupabase() && supabase) {
    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (!error) {
      return (data as ProjectMemberRow[]).map(mapProjectMemberRow);
    }

    console.error('Failed to load members from Supabase:', error);
  }

  return storage.get<ProjectMember[]>(`members-${projectId}`, []);
}

export async function syncProjectMembers(projectId: string, members: ProjectMember[]) {
  if (canUseSupabase() && supabase) {
    const rows = members.map(toProjectMemberRow);
    const currentIds = new Set(rows.map((row) => row.id));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('project_members')
        .upsert(rows, { onConflict: 'id' });

      if (upsertError) {
        console.error('Failed to upsert members into Supabase:', upsertError);
      } else {
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
            console.error('Failed to delete removed members from Supabase:', deleteError);
          }
        }
        return;
      }
    } else {
      const { error } = await supabase.from('project_members').delete().eq('project_id', projectId);
      if (!error) return;
      console.error('Failed to clear members from Supabase:', error);
    }
  }

  storage.set(`members-${projectId}`, members);
}

export async function loadProjectTasks(projectId: string): Promise<Task[]> {
  if (canUseSupabase() && supabase) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('level', { ascending: true })
      .order('order_index', { ascending: true });

    if (!error) {
      return (data as TaskRow[]).map(mapTaskRow);
    }

    console.error('Failed to load tasks from Supabase:', error);
  }

  return storage.get<Task[]>(`tasks-${projectId}`, []);
}

export async function syncProjectTasks(projectId: string, tasks: Task[]) {
  if (canUseSupabase() && supabase) {
    const rows = tasks
      .map(toTaskRow)
      .sort((a, b) => a.level - b.level || a.order_index - b.order_index);
    const currentIds = new Set(rows.map((row) => row.id));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('tasks')
        .upsert(rows, { onConflict: 'id' });

      if (upsertError) {
        console.error('Failed to upsert tasks into Supabase:', upsertError);
      } else {
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
            console.error('Failed to delete removed tasks from Supabase:', deleteError);
          }
        }
        return;
      }
    } else {
      const { error } = await supabase.from('tasks').delete().eq('project_id', projectId);
      if (!error) return;
      console.error('Failed to clear tasks from Supabase:', error);
    }
  }

  storage.set(`tasks-${projectId}`, tasks);
}

function canUseSupabase() {
  return isSupabaseConfigured && !!supabase;
}

function ensureLocalSampleWorkspace() {
  const storedProjects = storage.get<Project[]>('projects', []);
  const sampleProjectIds = new Set(sampleWorkspaces.map((ws) => ws.project.id));
  const userProjects = storedProjects.filter((project) => !sampleProjectIds.has(project.id));
  const mergedProjects = [...sampleWorkspaces.map((ws) => ws.project), ...userProjects];

  storage.set('projects', mergedProjects);
  for (const ws of sampleWorkspaces) {
    storage.set(`members-${ws.project.id}`, ws.members);
    storage.set(`tasks-${ws.project.id}`, ws.tasks);
  }

  return mergedProjects;
}

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
    settings: project.settings || null,
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

function upsertById<T extends { id: string }>(items: T[], nextItem: T) {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id);
  if (existingIndex < 0) {
    return [nextItem, ...items];
  }

  const nextItems = [...items];
  nextItems[existingIndex] = nextItem;
  return nextItems;
}
