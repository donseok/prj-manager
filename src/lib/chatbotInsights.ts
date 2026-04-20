import { differenceInCalendarDays, parseISO, startOfWeek, endOfWeek, addWeeks, isWithinInterval } from 'date-fns';
import type { Task, ProjectMember } from '../types';
import { getLeafTasks } from './taskAnalytics';
import { calculateCriticalPath } from './criticalPath';

// ─── Types ───────────────────────────────────────────────────

export type RiskSeverity = 'high' | 'medium';

export interface RiskItem {
  task: Task;
  /** timeElapsedRatio - progressRatio (0~1, 클수록 위험) */
  riskScore: number;
  /** 가중치(크리티컬/후행작업 존재/담당자 여부)를 반영한 최종 점수 */
  weightedScore: number;
  /** 기간 대비 경과 비율 (0~1) */
  elapsedRatio: number;
  /** 진행률 (0~1) */
  progressRatio: number;
  /** 지연 일수 (planEnd이 지났을 때만 양수) */
  delayDays: number;
  /** 크리티컬 패스 포함 여부 */
  isCritical: boolean;
  /** 후행 작업이 존재하는지 */
  hasDependents: boolean;
  severity: RiskSeverity;
  assigneeName: string;
  /** 한국어 위험 사유 요약 */
  reason: string;
}

export interface TaskSuggestion {
  task: Task;
  /** 추천 점수 (높을수록 먼저 시작해야 함) */
  score: number;
  /** 시작 예정일까지 남은 일수 (음수면 이미 시작됐어야 함) */
  daysUntilStart: number;
  isCritical: boolean;
  assigneeName: string;
  /** 한국어 추천 사유 */
  reason: string;
}

export interface WeeklySummary {
  riskCount: number;
  highRiskCount: number;
  startingThisWeek: number;
  completedLastWeek: number;
  nextSuggestionCount: number;
  /** 전체 요약에 쓸 수 있는 1줄 hero 메시지 */
  headline: string;
}

// ─── Config ──────────────────────────────────────────────────

// "의미 있는" 위험만 잡기 위한 임계값 — 작은 편차는 노이즈 취급
const RISK_SCORE_THRESHOLD = 0.3;
const HIGH_RISK_SCORE_THRESHOLD = 0.45;
/** 다음 추천 작업 범위 — 오늘로부터 N일 이내 시작 예정 (이미 시작했어야 하는 것 포함) */
const SUGGESTION_WINDOW_DAYS = 14;

// ─── Internal helpers ────────────────────────────────────────

function parseDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  try {
    return parseISO(value);
  } catch {
    return null;
  }
}

function getAssigneeName(task: Task, members: ProjectMember[]): string {
  if (!task.assigneeId) return '미배정';
  return members.find((m) => m.id === task.assigneeId)?.name || '미배정';
}

/** 후행 작업이 존재하는지(다른 작업이 이 작업을 predecessor로 가지고 있는지) */
function buildDependentsMap(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    for (const pid of t.predecessorIds || []) {
      counts.set(pid, (counts.get(pid) || 0) + 1);
    }
  }
  return counts;
}

/** 해당 작업의 선행 작업이 모두 완료됐는지 */
function arePredecessorsComplete(task: Task, taskMap: Map<string, Task>): boolean {
  const preds = task.predecessorIds || [];
  if (preds.length === 0) return true;
  return preds.every((pid) => {
    const p = taskMap.get(pid);
    if (!p) return true; // 존재하지 않는 선행은 무시
    return p.status === 'completed' || p.actualProgress >= 100;
  });
}

// ─── 지연 위험 감지 ──────────────────────────────────────────

/**
 * 위험 점수 계산:
 *   riskScore = (elapsedDays / totalDays) - (actualProgress / 100)
 *
 * 가중치(weightedScore):
 *   - 이미 마감 초과(delayDays > 0): +0.2
 *   - 크리티컬 패스 포함: x1.3
 *   - 후행 작업이 있는 경우(blocker): x1.15
 *   - 담당자 미배정: +0.1 (진행이 붙지 않을 확률 ↑)
 *
 * 필터링:
 *   - 말단 작업만
 *   - completed 제외
 *   - 계획 시작/종료가 있어야 함 (없으면 시간 비율 계산 불가)
 *   - riskScore >= RISK_SCORE_THRESHOLD 만 채택
 */
export function detectDelayRisks(
  tasks: Task[],
  members: ProjectMember[],
  today: Date = new Date()
): RiskItem[] {
  const leafTasks = getLeafTasks(tasks);
  const dependentsMap = buildDependentsMap(tasks);

  let criticalSet = new Set<string>();
  try {
    const cp = calculateCriticalPath(tasks);
    criticalSet = new Set(cp.criticalTasks);
  } catch {
    // 순환 의존성 등 에러 시 크리티컬 정보 없이 진행
  }

  const items: RiskItem[] = [];

  for (const task of leafTasks) {
    if (task.status === 'completed' || task.actualProgress >= 100) continue;

    const planStart = parseDateOrNull(task.planStart);
    const planEnd = parseDateOrNull(task.planEnd);
    if (!planStart || !planEnd) continue;

    const totalDays = Math.max(1, differenceInCalendarDays(planEnd, planStart));
    const elapsedDays = differenceInCalendarDays(today, planStart);
    if (elapsedDays <= 0) continue; // 아직 시작 전

    const elapsedRatio = Math.min(1.5, elapsedDays / totalDays); // 초과분 일부 반영
    const progressRatio = Math.max(0, Math.min(1, task.actualProgress / 100));
    const rawRisk = elapsedRatio - progressRatio;

    if (rawRisk < RISK_SCORE_THRESHOLD) continue;

    const delayDays = differenceInCalendarDays(today, planEnd);
    const isCritical = criticalSet.has(task.id);
    const hasDependents = (dependentsMap.get(task.id) || 0) > 0;

    let weighted = rawRisk;
    if (delayDays > 0) weighted += 0.2;
    if (isCritical) weighted *= 1.3;
    if (hasDependents) weighted *= 1.15;
    if (!task.assigneeId) weighted += 0.1;

    const severity: RiskSeverity =
      weighted >= HIGH_RISK_SCORE_THRESHOLD || delayDays > 0 || isCritical ? 'high' : 'medium';

    const reasonParts: string[] = [];
    if (delayDays > 0) {
      reasonParts.push(`마감 ${delayDays}일 초과`);
    } else {
      reasonParts.push(
        `기간 ${Math.round(elapsedRatio * 100)}% 소진 / 진행 ${Math.round(progressRatio * 100)}%`
      );
    }
    if (isCritical) reasonParts.push('크리티컬 패스');
    if (hasDependents) reasonParts.push(`후행 ${dependentsMap.get(task.id)}건`);
    if (!task.assigneeId) reasonParts.push('담당자 미배정');

    items.push({
      task,
      riskScore: rawRisk,
      weightedScore: weighted,
      elapsedRatio,
      progressRatio,
      delayDays: Math.max(0, delayDays),
      isCritical,
      hasDependents,
      severity,
      assigneeName: getAssigneeName(task, members),
      reason: reasonParts.join(' · '),
    });
  }

  return items.sort((a, b) => b.weightedScore - a.weightedScore);
}

// ─── 다음 추천 작업 ──────────────────────────────────────────

/**
 * 대상:
 *   - 말단 작업
 *   - 상태 pending / status 미설정 (진행/완료 제외)
 *   - 선행 작업이 모두 완료됨
 *   - planStart 이 오늘로부터 SUGGESTION_WINDOW_DAYS 이내 (이미 지났으나 시작 안 한 것 포함)
 *
 * 점수:
 *   - base = 30 - |daysUntilStart| (가까울수록 높음; 0일 때 30점)
 *   - 이미 시작일이 지남: +10
 *   - 크리티컬 패스: +20
 *   - 후행 작업 존재: +10
 *   - 담당자 배정: +5
 *   - 담당자 부담(동일 담당자의 진행중 작업 수)에 따라 감점: -min(10, inProgressCount*3)
 *   - currentUserId 지정 시 본인 작업 +15
 */
export function suggestNextTasks(
  tasks: Task[],
  members: ProjectMember[],
  today: Date = new Date(),
  currentUserId?: string
): TaskSuggestion[] {
  const leafTasks = getLeafTasks(tasks);
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const dependentsMap = buildDependentsMap(tasks);

  let criticalSet = new Set<string>();
  try {
    const cp = calculateCriticalPath(tasks);
    criticalSet = new Set(cp.criticalTasks);
  } catch {
    // noop
  }

  // 담당자별 현재 진행중 작업 수 (워크로드 감점용)
  const workloadByAssignee = new Map<string, number>();
  for (const t of leafTasks) {
    if (t.status === 'in_progress' && t.assigneeId) {
      workloadByAssignee.set(t.assigneeId, (workloadByAssignee.get(t.assigneeId) || 0) + 1);
    }
  }

  // 현재 사용자에 해당하는 멤버 id (userId 매핑)
  const currentMemberId = currentUserId
    ? members.find((m) => m.userId === currentUserId)?.id
    : undefined;

  const suggestions: TaskSuggestion[] = [];

  for (const task of leafTasks) {
    if (task.status !== 'pending') continue;
    if (task.actualProgress > 0) continue;
    if (!arePredecessorsComplete(task, taskMap)) continue;

    const planStart = parseDateOrNull(task.planStart);
    if (!planStart) continue;

    const daysUntilStart = differenceInCalendarDays(planStart, today);
    if (daysUntilStart > SUGGESTION_WINDOW_DAYS) continue;
    // 너무 오래전에 시작했어야 한 작업은 "다음 추천"이 아니라 "지연 위험"의 영역이므로 제외
    if (daysUntilStart < -SUGGESTION_WINDOW_DAYS) continue;

    const isCritical = criticalSet.has(task.id);
    const hasDependents = (dependentsMap.get(task.id) || 0) > 0;
    const workload = task.assigneeId ? workloadByAssignee.get(task.assigneeId) || 0 : 0;

    let score = 30 - Math.abs(daysUntilStart);
    if (daysUntilStart < 0) score += 10;
    if (isCritical) score += 20;
    if (hasDependents) score += 10;
    if (task.assigneeId) score += 5;
    score -= Math.min(10, workload * 3);
    if (currentMemberId && task.assigneeId === currentMemberId) score += 15;

    const reasonParts: string[] = [];
    if (daysUntilStart <= 0) {
      reasonParts.push(daysUntilStart === 0 ? '오늘 시작' : `${Math.abs(daysUntilStart)}일 전 시작 예정`);
    } else {
      reasonParts.push(`${daysUntilStart}일 후 시작`);
    }
    if (isCritical) reasonParts.push('크리티컬 패스');
    if (hasDependents) reasonParts.push(`후행 ${dependentsMap.get(task.id)}건`);
    if (!task.assigneeId) reasonParts.push('담당자 미배정');

    suggestions.push({
      task,
      score,
      daysUntilStart,
      isCritical,
      assigneeName: getAssigneeName(task, members),
      reason: reasonParts.join(' · '),
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

// ─── 주간 요약 ────────────────────────────────────────────────

export function generateWeeklySummary(
  tasks: Task[],
  members: ProjectMember[],
  today: Date = new Date()
): WeeklySummary {
  const leafTasks = getLeafTasks(tasks);

  const risks = detectDelayRisks(tasks, members, today);
  const highRisks = risks.filter((r) => r.severity === 'high');
  const suggestions = suggestNextTasks(tasks, members, today);

  const thisWeekRange = {
    start: startOfWeek(today, { weekStartsOn: 1 }),
    end: endOfWeek(today, { weekStartsOn: 1 }),
  };
  const lastWeekRange = {
    start: startOfWeek(addWeeks(today, -1), { weekStartsOn: 1 }),
    end: endOfWeek(addWeeks(today, -1), { weekStartsOn: 1 }),
  };

  const startingThisWeek = leafTasks.filter((t) => {
    const planStart = parseDateOrNull(t.planStart);
    if (!planStart) return false;
    return isWithinInterval(planStart, thisWeekRange);
  }).length;

  const completedLastWeek = leafTasks.filter((t) => {
    if (t.status !== 'completed') return false;
    const actualEnd = parseDateOrNull(t.actualEnd);
    if (!actualEnd) return false;
    return isWithinInterval(actualEnd, lastWeekRange);
  }).length;

  let headline: string;
  if (highRisks.length > 0) {
    headline = `지연 위험 ${highRisks.length}건을 먼저 점검해 보세요.`;
  } else if (risks.length > 0) {
    headline = `주의가 필요한 작업 ${risks.length}건이 있습니다.`;
  } else if (startingThisWeek > 0) {
    headline = `이번 주 시작 예정 작업 ${startingThisWeek}건을 확인해 보세요.`;
  } else if (completedLastWeek > 0) {
    headline = `지난 주 ${completedLastWeek}건을 완료했습니다. 수고하셨어요.`;
  } else {
    headline = '눈에 띄는 이슈 없이 프로젝트가 진행 중입니다.';
  }

  return {
    riskCount: risks.length,
    highRiskCount: highRisks.length,
    startingThisWeek,
    completedLastWeek,
    nextSuggestionCount: suggestions.length,
    headline,
  };
}

// ─── 답변 포매터 (챗봇 inline 출력용) ─────────────────────────

export function formatRiskAnswer(risks: RiskItem[], projectName: string): string {
  if (risks.length === 0) {
    return `"${projectName}"에 지연 위험으로 판단되는 작업이 없습니다. 모두 정상 진행 중이에요.`;
  }
  const lines = [
    `"${projectName}" 지연 위험 ${risks.length}건 (고위험 ${risks.filter((r) => r.severity === 'high').length}건)`,
    ...risks.slice(0, 7).map((r, i) => {
      const badge = r.severity === 'high' ? '🚨' : '⚠️';
      return `${i + 1}. ${badge} ${r.task.name} | ${r.assigneeName} | ${r.reason}`;
    }),
  ];
  if (risks.length > 7) lines.push(`외 ${risks.length - 7}건`);
  return lines.join('\n');
}

export function formatSuggestionAnswer(
  suggestions: TaskSuggestion[],
  projectName: string
): string {
  if (suggestions.length === 0) {
    return `"${projectName}"에 지금 바로 시작할 만한 추천 작업이 없습니다.`;
  }
  const lines = [
    `"${projectName}" 추천 작업 ${suggestions.length}건 (점수 순)`,
    ...suggestions.slice(0, 7).map((s, i) => {
      const badge = s.isCritical ? '⭐' : '▶';
      return `${i + 1}. ${badge} ${s.task.name} | ${s.assigneeName} | ${s.reason}`;
    }),
  ];
  if (suggestions.length > 7) lines.push(`외 ${suggestions.length - 7}건`);
  return lines.join('\n');
}

export function formatWeeklySummaryAnswer(summary: WeeklySummary, projectName: string): string {
  const lines = [
    `"${projectName}" 주간 요약`,
    summary.headline,
    '',
    `🚨 지연 위험: ${summary.riskCount}건 (고위험 ${summary.highRiskCount}건)`,
    `📋 이번 주 시작 예정: ${summary.startingThisWeek}건`,
    `✅ 지난 주 완료: ${summary.completedLastWeek}건`,
    `💡 추천 작업: ${summary.nextSuggestionCount}건`,
  ];
  return lines.join('\n');
}
