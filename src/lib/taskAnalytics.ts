import type { Task, ProjectMember, TaskStatus } from '../types';
import { getDelayedTasks, getDelayDays, calculateOverallProgress } from './utils';

// ─── Leaf task filtering ─────────────────────────────────────
// 자식이 없는 말단 작업만 추출 (통계/차트 계산에 공통 사용)

export function getLeafTasks(tasks: Task[]): Task[] {
  const parentIds = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId));
  return tasks.filter((t) => !parentIds.has(t.id));
}

// ─── Assignee helpers ────────────────────────────────────────

export function getAssigneeName(task: Task, members: ProjectMember[]): string {
  return members.find((m) => m.id === task.assigneeId)?.name || '미지정';
}

export function buildAssigneeMap(members: ProjectMember[]): Record<string, string> {
  return Object.fromEntries(members.map((m) => [m.id, m.name]));
}

// ─── Dashboard stats ─────────────────────────────────────────

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  overallProgress: number;
  planProgress: number;
}

export function calculateProjectStats(tasks: Task[], baseDate?: Date): ProjectStats {
  const leafTasks = getLeafTasks(tasks);
  const completedTasks = leafTasks.filter((t) => t.status === 'completed');
  const inProgressTasks = leafTasks.filter((t) => t.status === 'in_progress');
  const delayedTasks = getDelayedTasks(leafTasks, baseDate);
  const overallProgress = calculateOverallProgress(tasks);

  const phases = tasks.filter((t) => t.level === 1);
  const totalPlanWeight = phases.reduce((sum, t) => sum + t.weight, 0);
  const planProgress =
    totalPlanWeight > 0
      ? phases.reduce((sum, t) => sum + t.weight * t.planProgress, 0) / totalPlanWeight
      : phases.length > 0
        ? phases.reduce((sum, t) => sum + t.planProgress, 0) / phases.length
        : 0;

  return {
    totalTasks: leafTasks.length,
    completedTasks: completedTasks.length,
    inProgressTasks: inProgressTasks.length,
    delayedTasks: delayedTasks.length,
    overallProgress,
    planProgress,
  };
}

// ─── Status distribution ─────────────────────────────────────

export interface StatusDataItem {
  name: string;
  value: number;
  color: string;
}

const STATUS_CHART_CONFIG: Array<{ status: TaskStatus; name: string; color: string }> = [
  { status: 'pending', name: '대기', color: '#8B95A5' },
  { status: 'in_progress', name: '진행중', color: '#2BAAA0' },
  { status: 'completed', name: '완료', color: '#34C997' },
  { status: 'on_hold', name: '보류', color: '#F0A167' },
];

export function calculateStatusDistribution(tasks: Task[]): StatusDataItem[] {
  const leafTasks = getLeafTasks(tasks);
  return STATUS_CHART_CONFIG
    .map(({ status, name, color }) => ({
      name,
      value: leafTasks.filter((t) => t.status === status).length,
      color,
    }))
    .filter((item) => item.value > 0);
}

// ─── Assignee workload ───────────────────────────────────────

export interface AssigneeWorkload {
  name: string;
  total: number;
  completed: number;
  remaining: number;
  inProgress: number;
  delayed: number;
}

export function calculateAssigneeWorkloads(
  tasks: Task[],
  members: ProjectMember[],
  baseDate?: Date
): AssigneeWorkload[] {
  const leafTasks = getLeafTasks(tasks).filter((t) => t.assigneeId);

  const grouped = leafTasks.reduce(
    (acc, task) => {
      const assignee = members.find((m) => m.id === task.assigneeId);
      const name = assignee?.name || '미지정';
      if (!acc[name]) {
        acc[name] = { total: 0, completed: 0, inProgress: 0, delayed: 0 };
      }
      acc[name].total++;
      if (task.status === 'completed') acc[name].completed++;
      if (task.status === 'in_progress') acc[name].inProgress++;
      if (getDelayDays(task, baseDate) > 0) acc[name].delayed++;
      return acc;
    },
    {} as Record<string, { total: number; completed: number; inProgress: number; delayed: number }>
  );

  return Object.entries(grouped)
    .map(([name, data]) => ({
      name,
      total: data.total,
      completed: data.completed,
      remaining: data.total - data.completed,
      inProgress: data.inProgress,
      delayed: data.delayed,
    }))
    .sort((a, b) => b.delayed - a.delayed || b.total - a.total);
}

// ─── Phase data ──────────────────────────────────────────────

export interface PhaseProgressData {
  name: string;
  계획: number;
  실적: number;
}

export function calculatePhaseProgress(tasks: Task[]): PhaseProgressData[] {
  return tasks
    .filter((t) => t.level === 1)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((phase) => ({
      name: phase.name.length > 8 ? phase.name.slice(0, 8) + '\u2026' : phase.name,
      계획: Math.round(phase.planProgress),
      실적: Math.round(phase.actualProgress),
    }));
}

// ─── Weight distribution ─────────────────────────────────────

export interface WeightDataItem {
  name: string;
  value: number;
  percent: number;
}

export function calculateWeightDistribution(tasks: Task[]): WeightDataItem[] {
  const phases = tasks.filter((t) => t.level === 1).sort((a, b) => a.orderIndex - b.orderIndex);
  const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return [];
  return phases.map((phase) => ({
    name: phase.name,
    value: phase.weight,
    percent: Math.round((phase.weight / totalWeight) * 100),
  }));
}

// ─── Timeline ────────────────────────────────────────────────

export interface TimelineData {
  start: Date;
  end: Date;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  elapsedPercent: number;
}

export function calculateTimeline(startDate: string, endDate: string): TimelineData {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const clampedElapsed = Math.max(0, elapsedDays);
  const remainingDays = totalDays - clampedElapsed;
  const elapsedPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  return { start, end, totalDays, elapsedDays, remainingDays, elapsedPercent };
}

// ─── Recently completed ─────────────────────────────────────

export function getRecentlyCompleted(tasks: Task[], limit: number = 5): Task[] {
  return getLeafTasks(tasks)
    .filter((t) => t.status === 'completed' && t.actualEnd)
    .sort((a, b) => (b.actualEnd! > a.actualEnd! ? 1 : -1))
    .slice(0, limit);
}
