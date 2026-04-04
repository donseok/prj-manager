/**
 * weeklyReport.ts
 * 주간보고 데이터 생성
 *
 * 특정 기준주를 기준으로 금주 실적, 차주 계획, 지연 작업, 이슈 요약 등
 * 주간보고에 필요한 구조화된 데이터를 생성한다.
 */

import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  isWithinInterval,
  format,
  differenceInCalendarDays,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task, ProjectMember, Attendance, AttendanceType } from '../types';
import { TASK_STATUS_LABELS, LEVEL_LABELS, ATTENDANCE_TYPE_LABELS } from '../types';
import { getLeafTasks } from './taskAnalytics';
import { parseDate } from './utils';
import { generateDefaultAttendance } from './attendanceDefaults';

// ── Types ────────────────────────────────────────────────────

export interface WeeklyReportTask {
  id: string;
  name: string;
  level: number;
  levelLabel: string;
  assigneeName: string;
  status: string;
  statusLabel: string;
  planStart: string | null;
  planEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  actualProgress: number;
  planProgress: number;
  weight: number;
  output: string;
  delayDays: number;
  parentName: string;
}

export interface WeeklyReportSection {
  title: string;
  tasks: WeeklyReportTask[];
}

export interface WeeklyReportData {
  /** 보고 제목 */
  title: string;
  /** 프로젝트 이름 */
  projectName: string;
  /** 기준 주 시작 (yyyy-MM-dd) */
  weekStart: string;
  /** 기준 주 종료 (yyyy-MM-dd) */
  weekEnd: string;
  /** 기준 주 라벨 (예: "2026년 12주차") */
  weekLabel: string;
  /** 생성 일시 */
  generatedAt: string;

  /** 전체 요약 */
  summary: {
    totalLeafTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    delayedTasks: number;
    overallActualProgress: number;
    overallPlanProgress: number;
  };

  /** 금주 실적 (이번 주에 actualStart/actualEnd가 겹치거나 진행 중인 작업) */
  thisWeekActual: WeeklyReportSection;
  /** 차주 계획 (다음 주에 planStart/planEnd가 겹치는 작업) */
  nextWeekPlan: WeeklyReportSection;
  /** 지연 작업 (planEnd < 기준일이고 미완료) */
  delayed: WeeklyReportSection;
  /** 완료 작업 (이번 주에 완료된 작업) */
  completedThisWeek: WeeklyReportSection;
  /** 이슈/리스크 요약 */
  issues: string[];
  /** 금주 근태현황 (선택적) */
  attendanceSummary?: WeeklyAttendanceSummary[];
  /** 차주 근태현황 (선택적) */
  nextWeekAttendanceSummary?: WeeklyAttendanceSummary[];
  /** 담당자별 수기 작성 보고 */
  memberReports?: WeeklyMemberReportEntry[];
}

export interface WeeklyMemberReportEntry {
  memberName: string;
  thisWeekResult: string;
  nextWeekPlan: string;
}

export interface WeeklyAttendanceRecord {
  date: string;
  type: AttendanceType;
  typeLabel: string;
  note?: string;
}

export interface WeeklyAttendanceSummary {
  memberName: string;
  records: WeeklyAttendanceRecord[];
  stats: Record<string, number>;
}

// ── Generator ────────────────────────────────────────────────

export interface GenerateWeeklyReportOptions {
  projectName: string;
  tasks: Task[];
  members: ProjectMember[];
  /** 기준 날짜 (기본: 오늘) */
  baseDate?: Date;
  /** 근태 데이터 (선택적) */
  attendances?: Attendance[];
}

export function generateWeeklyReport({
  projectName,
  tasks,
  members,
  baseDate = new Date(),
  attendances,
}: GenerateWeeklyReportOptions): WeeklyReportData {
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const nextWeekStart = addWeeks(weekStart, 1);
  const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const leafTasks = getLeafTasks(tasks);

  const toReportTask = (t: Task): WeeklyReportTask => {
    const planEnd = parseDate(t.planEnd);
    const delayDays =
      planEnd && t.status !== 'completed' && t.actualProgress < 100 && planEnd < baseDate
        ? differenceInCalendarDays(baseDate, planEnd)
        : 0;

    const parent = t.parentId ? taskMap.get(t.parentId) : null;

    return {
      id: t.id,
      name: t.name,
      level: t.level,
      levelLabel: LEVEL_LABELS[t.level] || `L${t.level}`,
      assigneeName: t.assigneeId ? memberMap.get(t.assigneeId) || '미지정' : '미지정',
      status: t.status,
      statusLabel: TASK_STATUS_LABELS[t.status],
      planStart: t.planStart || null,
      planEnd: t.planEnd || null,
      actualStart: t.actualStart || null,
      actualEnd: t.actualEnd || null,
      actualProgress: t.actualProgress,
      planProgress: t.planProgress,
      weight: t.weight,
      output: t.output || '',
      delayDays,
      parentName: parent?.name || '',
    };
  };

  // 금주 실적: 이번 주에 활동이 있는 작업
  const thisWeekActualTasks = leafTasks.filter((t) => {
    // 진행 중이거나 이번 주에 완료된 작업
    if (t.status === 'in_progress') return true;
    const actualEnd = parseDate(t.actualEnd);
    if (actualEnd && isWithinInterval(actualEnd, { start: weekStart, end: weekEnd })) return true;
    const actualStart = parseDate(t.actualStart);
    if (actualStart && isWithinInterval(actualStart, { start: weekStart, end: weekEnd })) return true;
    // 기간이 이번 주에 겹치는지
    if (actualStart && actualEnd) {
      return actualStart <= weekEnd && actualEnd >= weekStart;
    }
    return false;
  });

  // 차주 계획: 다음 주에 계획이 겹치는 미완료 작업
  const nextWeekPlanTasks = leafTasks.filter((t) => {
    if (t.status === 'completed') return false;
    return isOverlapping(t.planStart, t.planEnd, nextWeekStart, nextWeekEnd);
  });

  // 지연 작업
  const delayedTasks = leafTasks.filter((t) => {
    if (t.status === 'completed') return false;
    const planEnd = parseDate(t.planEnd);
    return planEnd && planEnd < baseDate && t.actualProgress < 100;
  });

  // 이번 주 완료 작업
  const completedThisWeekTasks = leafTasks.filter((t) => {
    const actualEnd = parseDate(t.actualEnd);
    return t.status === 'completed' && actualEnd && isWithinInterval(actualEnd, { start: weekStart, end: weekEnd });
  });

  // 요약 통계
  const completedAll = leafTasks.filter((t) => t.status === 'completed');
  const inProgressAll = leafTasks.filter((t) => t.status === 'in_progress');
  const totalWeight = leafTasks.reduce((s, t) => s + t.weight, 0);
  const overallActualProgress =
    totalWeight > 0
      ? Math.round(leafTasks.reduce((s, t) => s + t.weight * t.actualProgress, 0) / totalWeight)
      : leafTasks.length > 0
        ? Math.round(leafTasks.reduce((s, t) => s + t.actualProgress, 0) / leafTasks.length)
        : 0;
  const overallPlanProgress =
    totalWeight > 0
      ? Math.round(leafTasks.reduce((s, t) => s + t.weight * t.planProgress, 0) / totalWeight)
      : leafTasks.length > 0
        ? Math.round(leafTasks.reduce((s, t) => s + t.planProgress, 0) / leafTasks.length)
        : 0;

  // 이슈 자동생성
  const issues: string[] = [];
  if (delayedTasks.length > 0) {
    issues.push(`지연 작업 ${delayedTasks.length}건 발생 — 조속한 조치 필요`);
    const maxDelay = Math.max(...delayedTasks.map((t) => toReportTask(t).delayDays));
    if (maxDelay >= 7) {
      issues.push(`최대 지연일수 ${maxDelay}일 — 일정 재조정 검토 필요`);
    }
  }
  if (overallActualProgress < overallPlanProgress - 10) {
    issues.push(`계획 대비 실적 ${Math.round(overallPlanProgress - overallActualProgress)}%p 미달`);
  }
  const unassigned = leafTasks.filter((t) => !t.assigneeId && t.status !== 'completed');
  if (unassigned.length > 0) {
    issues.push(`담당자 미지정 작업 ${unassigned.length}건`);
  }

  // 근태 요약 생성 (금주 + 차주) — 기본 출근 포함
  let attendanceSummary: WeeklyAttendanceSummary[] | undefined;
  let nextWeekAttendanceSummary: WeeklyAttendanceSummary[] | undefined;
  if (members.length > 0) {
    const buildAttendanceSummary = (rangeStart: Date, rangeEnd: Date): WeeklyAttendanceSummary[] => {
      const startStr = format(rangeStart, 'yyyy-MM-dd');
      const endStr = format(rangeEnd, 'yyyy-MM-dd');
      const existingInRange = (attendances || []).filter(
        (a) => a.date >= startStr && a.date <= endStr
      );

      // 기본 출근 가상 레코드 생성 후 합침
      const defaults = generateDefaultAttendance(members, existingInRange, startStr, endStr);
      const allRecords = [...existingInRange, ...defaults];

      const byMember = new Map<string, Attendance[]>();
      for (const a of allRecords) {
        const list = byMember.get(a.memberId) || [];
        list.push(a);
        byMember.set(a.memberId, list);
      }

      return members.map((m) => {
        const records = (byMember.get(m.id) || [])
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((a) => ({
            date: a.date,
            type: a.type,
            typeLabel: ATTENDANCE_TYPE_LABELS[a.type],
            note: a.note,
          }));

        const stats: Record<string, number> = {};
        for (const r of records) {
          stats[r.typeLabel] = (stats[r.typeLabel] || 0) + 1;
        }

        return { memberName: m.name, records, stats };
      }).filter((s) => s.records.length > 0);
    };

    attendanceSummary = buildAttendanceSummary(weekStart, weekEnd);
    nextWeekAttendanceSummary = buildAttendanceSummary(nextWeekStart, nextWeekEnd);
  }

  const weekNum = getWeekNumber(baseDate);
  const year = baseDate.getFullYear();

  return {
    title: `${projectName} 주간보고`,
    projectName,
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    weekEnd: format(weekEnd, 'yyyy-MM-dd'),
    weekLabel: `${year}년 ${weekNum}주차 (${format(weekStart, 'M/d', { locale: ko })}~${format(weekEnd, 'M/d', { locale: ko })})`,
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm', { locale: ko }),
    summary: {
      totalLeafTasks: leafTasks.length,
      completedTasks: completedAll.length,
      inProgressTasks: inProgressAll.length,
      delayedTasks: delayedTasks.length,
      overallActualProgress,
      overallPlanProgress,
    },
    thisWeekActual: {
      title: '금주 실적',
      tasks: thisWeekActualTasks.map(toReportTask),
    },
    nextWeekPlan: {
      title: '차주 계획',
      tasks: nextWeekPlanTasks.map(toReportTask),
    },
    delayed: {
      title: '지연 작업',
      tasks: delayedTasks.map(toReportTask),
    },
    completedThisWeek: {
      title: '금주 완료',
      tasks: completedThisWeekTasks.map(toReportTask),
    },
    issues,
    attendanceSummary,
    nextWeekAttendanceSummary,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function isOverlapping(
  start: string | null | undefined,
  end: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const s = parseDate(start);
  const e = parseDate(end);
  if (s && e) return s <= rangeEnd && e >= rangeStart;
  if (s) return isWithinInterval(s, { start: rangeStart, end: rangeEnd });
  if (e) return isWithinInterval(e, { start: rangeStart, end: rangeEnd });
  return false;
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
}
