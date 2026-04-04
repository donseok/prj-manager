import type { Task, ProjectMember } from '../types';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { getLeafTasks } from './taskAnalytics';
import { getDelayDays } from './utils';

// ─── Types ──────────────────────────────────────────────────

export type OverloadLevel = 'normal' | 'warning' | 'critical';

export interface MemberWorkload {
  memberId: string;
  memberName: string;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  delayedTasks: number;
  totalWeight: number;
  weeklyTaskCount: number;
  overloadLevel: OverloadLevel;
  utilizationPct: number;
}

export interface RebalanceSuggestion {
  taskId: string;
  taskName: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  reason: string;
}

export interface ResourceSummary {
  members: MemberWorkload[];
  avgUtilization: number;
  overloadedCount: number;
  underloadedCount: number;
  rebalanceSuggestions: RebalanceSuggestion[];
}

// ─── Weekly heatmap types ───────────────────────────────────

export interface WeeklyHeatmapCell {
  memberId: string;
  memberName: string;
  weekLabel: string;
  weekStart: Date;
  taskCount: number;
}

// ─── Helpers ────────────────────────────────────────────────

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return parseISO(dateStr);
}

function isTaskInWeek(task: Task, weekStart: Date, weekEnd: Date): boolean {
  const planStart = parseDate(task.planStart);
  const planEnd = parseDate(task.planEnd);

  if (!planStart && !planEnd) return false;

  if (planStart && planEnd) {
    return (
      isWithinInterval(weekStart, { start: planStart, end: planEnd }) ||
      isWithinInterval(weekEnd, { start: planStart, end: planEnd }) ||
      isWithinInterval(planStart, { start: weekStart, end: weekEnd }) ||
      isWithinInterval(planEnd, { start: weekStart, end: weekEnd })
    );
  }

  const singleDate = planStart || planEnd;
  if (singleDate) {
    return isWithinInterval(singleDate, { start: weekStart, end: weekEnd });
  }

  return false;
}

function determineOverloadLevel(activeTasks: number, weeklyTaskCount: number): OverloadLevel {
  if (activeTasks > 8 || weeklyTaskCount > 5) return 'critical';
  if ((activeTasks >= 6 && activeTasks <= 8) || (weeklyTaskCount >= 4 && weeklyTaskCount <= 5)) return 'warning';
  return 'normal';
}

function calculateUtilization(activeTasks: number, weeklyTaskCount: number): number {
  // Utilization based on active tasks (max capacity ~10) and weekly load (max ~6)
  const activeRatio = Math.min(activeTasks / 10, 1) * 60;
  const weeklyRatio = Math.min(weeklyTaskCount / 6, 1) * 40;
  return Math.round(activeRatio + weeklyRatio);
}

// ─── Main analysis ──────────────────────────────────────────

export function analyzeWorkload(tasks: Task[], members: ProjectMember[]): ResourceSummary {
  const leafTasks = getLeafTasks(tasks);
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Build workload per member + unassigned bucket
  const memberIds = new Set(members.map((m) => m.id));
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

  // Collect tasks per assignee (including unassigned)
  const grouped = new Map<string, Task[]>();
  const UNASSIGNED_ID = '__unassigned__';

  for (const task of leafTasks) {
    const key = task.assigneeId && memberIds.has(task.assigneeId) ? task.assigneeId : UNASSIGNED_ID;
    const arr = grouped.get(key);
    if (arr) {
      arr.push(task);
    } else {
      grouped.set(key, [task]);
    }
  }

  // Include members with no tasks
  for (const m of members) {
    if (!grouped.has(m.id)) {
      grouped.set(m.id, []);
    }
  }

  const workloads: MemberWorkload[] = [];

  for (const [id, memberTasks] of grouped) {
    const isUnassigned = id === UNASSIGNED_ID;
    const memberName = isUnassigned ? '미지정' : (memberNameMap.get(id) || '알 수 없음');

    const activeTasks = memberTasks.filter(
      (t) => t.status === 'in_progress' || t.status === 'pending'
    ).length;
    const completedTasks = memberTasks.filter((t) => t.status === 'completed').length;
    const delayedTasks = memberTasks.filter((t) => getDelayDays(t, now) > 0).length;
    const totalWeight = memberTasks.reduce((sum, t) => sum + t.weight, 0);
    const weeklyTaskCount = memberTasks.filter(
      (t) => t.status !== 'completed' && isTaskInWeek(t, thisWeekStart, thisWeekEnd)
    ).length;

    const overloadLevel = isUnassigned ? 'normal' as OverloadLevel : determineOverloadLevel(activeTasks, weeklyTaskCount);
    const utilizationPct = isUnassigned ? 0 : calculateUtilization(activeTasks, weeklyTaskCount);

    workloads.push({
      memberId: id,
      memberName,
      totalTasks: memberTasks.length,
      activeTasks,
      completedTasks,
      delayedTasks,
      totalWeight,
      weeklyTaskCount,
      overloadLevel,
      utilizationPct,
    });
  }

  // Sort: critical first, then warning, then by activeTasks desc
  workloads.sort((a, b) => {
    const levelOrder: Record<OverloadLevel, number> = { critical: 0, warning: 1, normal: 2 };
    const diff = levelOrder[a.overloadLevel] - levelOrder[b.overloadLevel];
    if (diff !== 0) return diff;
    return b.activeTasks - a.activeTasks;
  });

  const realMembers = workloads.filter((w) => w.memberId !== UNASSIGNED_ID);
  const avgUtilization =
    realMembers.length > 0
      ? Math.round(realMembers.reduce((sum, w) => sum + w.utilizationPct, 0) / realMembers.length)
      : 0;
  const overloadedCount = realMembers.filter(
    (w) => w.overloadLevel === 'critical' || w.overloadLevel === 'warning'
  ).length;
  const underloadedCount = realMembers.filter((w) => w.utilizationPct < 20).length;

  // Generate rebalance suggestions
  const rebalanceSuggestions = generateRebalanceSuggestions(leafTasks, workloads);

  return {
    members: workloads,
    avgUtilization,
    overloadedCount,
    underloadedCount,
    rebalanceSuggestions,
  };
}

function generateRebalanceSuggestions(
  leafTasks: Task[],
  workloads: MemberWorkload[]
): RebalanceSuggestion[] {
  const suggestions: RebalanceSuggestion[] = [];
  const criticalMembers = workloads.filter((w) => w.overloadLevel === 'critical' && w.memberId !== '__unassigned__');
  const normalMembers = workloads.filter((w) => w.overloadLevel === 'normal' && w.memberId !== '__unassigned__');

  if (normalMembers.length === 0) return suggestions;

  for (const overloaded of criticalMembers) {
    // Find pending tasks from this member (candidate for reassignment)
    const pendingTasks = leafTasks.filter(
      (t) => t.assigneeId === overloaded.memberId && t.status === 'pending'
    );

    for (const task of pendingTasks) {
      // Find least utilized normal member
      const target = normalMembers.sort((a, b) => a.utilizationPct - b.utilizationPct)[0];
      if (!target) break;

      suggestions.push({
        taskId: task.id,
        taskName: task.name,
        fromMemberId: overloaded.memberId,
        fromMemberName: overloaded.memberName,
        toMemberId: target.memberId,
        toMemberName: target.memberName,
        reason: `${overloaded.memberName}의 과부하 해소 (활성 작업 ${overloaded.activeTasks}개)`,
      });

      // Only suggest up to 2 reassignments per overloaded member
      if (suggestions.filter((s) => s.fromMemberId === overloaded.memberId).length >= 2) break;
    }
  }

  return suggestions;
}

// ─── Heatmap data (4 weeks) ─────────────────────────────────

export function buildWeeklyHeatmap(
  tasks: Task[],
  members: ProjectMember[]
): { cells: WeeklyHeatmapCell[]; weeks: { label: string; start: Date }[] } {
  const leafTasks = getLeafTasks(tasks);
  const now = new Date();

  const weeks: { label: string; start: Date }[] = [];
  for (let i = -1; i <= 2; i++) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() + i * 7);
    const ws = startOfWeek(weekDate, { weekStartsOn: 1 });
    endOfWeek(weekDate, { weekStartsOn: 1 });
    const label =
      i === 0
        ? '이번 주'
        : i === -1
          ? '지난 주'
          : i === 1
            ? '다음 주'
            : `${i > 0 ? '+' : ''}${i}주`;
    weeks.push({ label, start: ws });
  }

  const cells: WeeklyHeatmapCell[] = [];

  // Include all members + unassigned
  const allEntries: { id: string; name: string }[] = [
    ...members.map((m) => ({ id: m.id, name: m.name })),
  ];

  // Check if there are unassigned tasks
  const memberIds = new Set(members.map((m) => m.id));
  const hasUnassigned = leafTasks.some((t) => !t.assigneeId || !memberIds.has(t.assigneeId));
  if (hasUnassigned) {
    allEntries.push({ id: '__unassigned__', name: '미지정' });
  }

  for (const entry of allEntries) {
    const memberTasks = leafTasks.filter((t) => {
      if (entry.id === '__unassigned__') {
        return !t.assigneeId || !memberIds.has(t.assigneeId);
      }
      return t.assigneeId === entry.id;
    });

    for (const week of weeks) {
      const we = endOfWeek(week.start, { weekStartsOn: 1 });
      const taskCount = memberTasks.filter(
        (t) => t.status !== 'completed' && isTaskInWeek(t, week.start, we)
      ).length;

      cells.push({
        memberId: entry.id,
        memberName: entry.name,
        weekLabel: week.label,
        weekStart: week.start,
        taskCount,
      });
    }
  }

  return { cells, weeks };
}
