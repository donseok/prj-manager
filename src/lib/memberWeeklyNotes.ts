/**
 * memberWeeklyNotes.ts
 * 담당자별 주간보고 메모 (금주실적 / 차주계획) 저장·로드
 */

import type { MemberWeeklyNote } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { storage } from './utils';

// ─── Row interface (DB snake_case) ──────────────────────────
interface MemberWeeklyNoteRow {
  id: string;
  project_id: string;
  member_id: string;
  member_name: string;
  week_start: string;
  this_week_achievements: string;
  next_week_plans: string;
  updated_at: string;
}

function lsKey(projectId: string, weekStart: string): string {
  return `dk_weekly_notes_${projectId}_${weekStart}`;
}

function mapRow(row: MemberWeeklyNoteRow): MemberWeeklyNote {
  return {
    memberId: row.member_id,
    memberName: row.member_name,
    thisWeekAchievements: row.this_week_achievements,
    nextWeekPlans: row.next_week_plans,
    updatedAt: row.updated_at,
  };
}

function toRow(projectId: string, weekStart: string, note: MemberWeeklyNote): MemberWeeklyNoteRow {
  return {
    id: `${projectId}_${note.memberId}_${weekStart}`,
    project_id: projectId,
    member_id: note.memberId,
    member_name: note.memberName,
    week_start: weekStart,
    this_week_achievements: note.thisWeekAchievements,
    next_week_plans: note.nextWeekPlans,
    updated_at: note.updatedAt || new Date().toISOString(),
  };
}

export async function loadMemberWeeklyNotes(
  projectId: string,
  weekStart: string,
): Promise<MemberWeeklyNote[]> {
  if (!isSupabaseConfigured) {
    return storage.get<MemberWeeklyNote[]>(lsKey(projectId, weekStart), []);
  }

  const { data, error } = await supabase
    .from('member_weekly_notes')
    .select('*')
    .eq('project_id', projectId)
    .eq('week_start', weekStart)
    .order('member_name', { ascending: true });

  if (error) {
    console.error('Failed to load member weekly notes:', error);
    return [];
  }

  return (data as MemberWeeklyNoteRow[]).map(mapRow);
}

export async function saveMemberWeeklyNotes(
  projectId: string,
  weekStart: string,
  notes: MemberWeeklyNote[],
): Promise<void> {
  if (!isSupabaseConfigured) {
    storage.set(lsKey(projectId, weekStart), notes);
    return;
  }

  const rows = notes
    .filter((n) => n.thisWeekAchievements.trim() || n.nextWeekPlans.trim())
    .map((n) => toRow(projectId, weekStart, n));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('member_weekly_notes')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save member weekly notes:', error);
    throw new Error(`주간보고 메모 저장 실패: ${error.message}`);
  }
}
