/**
 * baselineRepository.ts
 *
 * 프로젝트 기준선(Baseline) CRUD.
 * localStorage 우선 저장. Supabase 스키마 예시 — 아래 주석 참조.
 *
 * 예상 Supabase 테이블 (마이그레이션 미적용):
 *   create table if not exists public.project_baselines (
 *     id text primary key,
 *     project_id text not null references public.projects (id) on delete cascade,
 *     name text not null,
 *     captured_at timestamptz not null default timezone('utc', now()),
 *     captured_by text not null,
 *     captured_by_name text,
 *     note text,
 *     is_active boolean not null default false,
 *     task_snapshots jsonb not null default '[]'::jsonb,
 *     project_start date,
 *     project_end date
 *   );
 */

import type { ProjectBaseline, ProjectBaselineTaskSnapshot, Project, Task } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';
import { storage } from './utils';

function lsKey(projectId: string): string {
  return `baselines-${projectId}`;
}

// ─── localStorage implementation ────────────────────────────

function lsLoad(projectId: string): ProjectBaseline[] {
  return storage.get<ProjectBaseline[]>(lsKey(projectId), []);
}

function lsSaveAll(projectId: string, baselines: ProjectBaseline[]) {
  storage.set(lsKey(projectId), baselines);
}

// ─── Supabase row shape ──────────────────────────────────────

interface BaselineRow {
  id: string;
  project_id: string;
  name: string;
  captured_at: string;
  captured_by: string;
  captured_by_name: string | null;
  note: string | null;
  is_active: boolean;
  task_snapshots: ProjectBaselineTaskSnapshot[];
  project_start: string | null;
  project_end: string | null;
}

function mapRow(row: BaselineRow): ProjectBaseline {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    capturedAt: row.captured_at,
    capturedBy: row.captured_by,
    capturedByName: row.captured_by_name || undefined,
    note: row.note || undefined,
    isActive: !!row.is_active,
    taskSnapshots: Array.isArray(row.task_snapshots) ? row.task_snapshots : [],
    projectStart: row.project_start,
    projectEnd: row.project_end,
  };
}

function toRow(b: ProjectBaseline): BaselineRow {
  return {
    id: b.id,
    project_id: b.projectId,
    name: b.name,
    captured_at: b.capturedAt,
    captured_by: b.capturedBy,
    captured_by_name: b.capturedByName || null,
    note: b.note || null,
    is_active: !!b.isActive,
    task_snapshots: b.taskSnapshots,
    project_start: b.projectStart || null,
    project_end: b.projectEnd || null,
  };
}

// ─── Public API ──────────────────────────────────────────────

export async function loadBaselines(projectId: string): Promise<ProjectBaseline[]> {
  if (!isSupabaseConfigured) {
    return lsLoad(projectId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }
  try {
    const { data, error } = await supabase
      .from('project_baselines')
      .select('*')
      .eq('project_id', projectId)
      .order('captured_at', { ascending: false });

    if (error) {
      // 테이블 미생성 시 localStorage 폴백
      return lsLoad(projectId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    }
    return (data as BaselineRow[]).map(mapRow);
  } catch {
    return lsLoad(projectId).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }
}

export async function saveBaseline(baseline: ProjectBaseline): Promise<ProjectBaseline> {
  if (!isSupabaseConfigured) {
    const list = lsLoad(baseline.projectId);
    const idx = list.findIndex((b) => b.id === baseline.id);
    let next = [...list];
    if (idx >= 0) next[idx] = baseline;
    else next.unshift(baseline);

    // 활성 기준선은 프로젝트당 하나만 유지
    if (baseline.isActive) {
      next = next.map((b) => (b.id === baseline.id ? b : { ...b, isActive: false }));
    }
    lsSaveAll(baseline.projectId, next);
    return baseline;
  }

  try {
    const { error } = await supabase
      .from('project_baselines')
      .upsert(toRow(baseline), { onConflict: 'id' });

    if (error) {
      // 테이블 미생성 시 localStorage 폴백
      const list = lsLoad(baseline.projectId);
      const idx = list.findIndex((b) => b.id === baseline.id);
      let next = [...list];
      if (idx >= 0) next[idx] = baseline;
      else next.unshift(baseline);
      if (baseline.isActive) {
        next = next.map((b) => (b.id === baseline.id ? b : { ...b, isActive: false }));
      }
      lsSaveAll(baseline.projectId, next);
      return baseline;
    }

    if (baseline.isActive) {
      // 다른 활성 기준선 해제
      await supabase
        .from('project_baselines')
        .update({ is_active: false })
        .eq('project_id', baseline.projectId)
        .neq('id', baseline.id);
    }
    return baseline;
  } catch {
    const list = lsLoad(baseline.projectId);
    const idx = list.findIndex((b) => b.id === baseline.id);
    let next = [...list];
    if (idx >= 0) next[idx] = baseline;
    else next.unshift(baseline);
    if (baseline.isActive) {
      next = next.map((b) => (b.id === baseline.id ? b : { ...b, isActive: false }));
    }
    lsSaveAll(baseline.projectId, next);
    return baseline;
  }
}

export async function deleteBaseline(projectId: string, id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const next = lsLoad(projectId).filter((b) => b.id !== id);
    lsSaveAll(projectId, next);
    return;
  }
  try {
    const { error } = await supabase.from('project_baselines').delete().eq('id', id);
    if (error) {
      const next = lsLoad(projectId).filter((b) => b.id !== id);
      lsSaveAll(projectId, next);
    }
  } catch {
    const next = lsLoad(projectId).filter((b) => b.id !== id);
    lsSaveAll(projectId, next);
  }
}

export async function setActiveBaseline(projectId: string, id: string): Promise<void> {
  const all = await loadBaselines(projectId);
  for (const b of all) {
    const shouldBeActive = b.id === id;
    if (!!b.isActive === shouldBeActive) continue;
    await saveBaseline({ ...b, isActive: shouldBeActive });
  }
}

export async function getActiveBaseline(projectId: string): Promise<ProjectBaseline | null> {
  const all = await loadBaselines(projectId);
  return all.find((b) => b.isActive) ?? null;
}

// ─── Snapshot helpers ────────────────────────────────────────

/** 현재 프로젝트/작업 상태로 기준선 스냅샷 페이로드를 만든다. */
export function buildBaselineFromCurrent(params: {
  project: Project;
  tasks: Task[];
  name: string;
  note?: string;
  capturedBy: string;
  capturedByName?: string;
  isActive?: boolean;
}): ProjectBaseline {
  const taskSnapshots: ProjectBaselineTaskSnapshot[] = params.tasks.map((t) => ({
    taskId: t.id,
    name: t.name,
    level: t.level,
    weight: t.weight || 0,
    planStart: t.planStart ?? null,
    planEnd: t.planEnd ?? null,
    planProgress: t.planProgress ?? 0,
  }));

  return {
    id: crypto.randomUUID(),
    projectId: params.project.id,
    name: params.name,
    capturedAt: new Date().toISOString(),
    capturedBy: params.capturedBy,
    capturedByName: params.capturedByName,
    note: params.note,
    isActive: params.isActive ?? false,
    taskSnapshots,
    projectStart: params.project.startDate || null,
    projectEnd: params.project.endDate || null,
  };
}
