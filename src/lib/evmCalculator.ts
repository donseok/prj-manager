import { differenceInDays, parseISO, addWeeks, startOfWeek, isBefore, isAfter } from 'date-fns';
import type { Task } from '../types';
import { getLeafTasks } from './taskAnalytics';

// ─── EVM 인터페이스 ─────────────────────────────────────────

export interface EVMMetrics {
  bac: number;   // Budget at Completion (총 계획 가치)
  pv: number;    // Planned Value (기준일 기준)
  ev: number;    // Earned Value
  ac: number;    // Actual Cost (투입 일수)
  sv: number;    // Schedule Variance (EV - PV)
  cv: number;    // Cost Variance (EV - AC)
  spi: number;   // Schedule Performance Index
  cpi: number;   // Cost Performance Index
  eac: number;   // Estimate at Completion
  etc: number;   // Estimate to Complete
  vac: number;   // Variance at Completion
  tcpi: number;  // To Complete Performance Index
}

export interface EVMTimeSeriesPoint {
  date: string;
  pv: number;
  ev: number;
  ac: number;
}

// ─── 헬퍼 ──────────────────────────────────────────────────

function safeWeight(w: number | undefined | null): number {
  return w && w > 0 ? w : 1;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  return parseISO(s);
}

/**
 * 특정 기준일에 대해 한 작업의 계획 진행률을 비례 계산.
 * planStart~planEnd 구간에서 baseDate가 어디에 있는지에 따라 0~1 반환.
 */
function getPlannedFractionAtDate(task: Task, baseDate: Date): number {
  const ps = toDate(task.planStart);
  const pe = toDate(task.planEnd);
  if (!ps || !pe) return 0;

  if (!isBefore(ps, pe)) {
    // planStart >= planEnd: 기준일이 planEnd 이후면 1, 아니면 0
    return isAfter(baseDate, pe) || baseDate.getTime() === pe.getTime() ? 1 : 0;
  }

  if (!isAfter(baseDate, ps) && baseDate.getTime() !== ps.getTime()) return 0; // before start
  if (!isBefore(baseDate, pe)) return 1; // after or equal to end

  const total = differenceInDays(pe, ps);
  if (total <= 0) return 1;
  const elapsed = differenceInDays(baseDate, ps);
  return Math.min(1, Math.max(0, elapsed / total));
}

/**
 * 특정 기준일에 대해 한 작업의 실적 투입 일수(AC) 계산.
 * actualStart ~ min(actualEnd, baseDate) 의 일수.
 */
function getActualCostDays(task: Task, baseDate: Date): number {
  const as = toDate(task.actualStart);
  if (!as) return 0;

  const ae = toDate(task.actualEnd);
  const endDate = ae && isBefore(ae, baseDate) ? ae : baseDate;

  if (isBefore(endDate, as)) return 0;
  return differenceInDays(endDate, as) + 1; // inclusive
}

// ─── EVM 계산 ───────────────────────────────────────────────

export function calculateEVM(
  tasks: Task[],
  _projectStartDate: string,
  _projectEndDate: string,
  baseDateStr?: string,
): EVMMetrics {
  const baseDate = baseDateStr ? parseISO(baseDateStr) : new Date();
  const leafTasks = getLeafTasks(tasks);

  // BAC = 리프 작업들의 가중치 합
  const bac = leafTasks.reduce((sum, t) => sum + safeWeight(t.weight), 0);

  // PV = 기준일까지의 계획 가치
  //  각 작업의 (가중치 × 계획 진행률 비례) 합
  const pv = leafTasks.reduce((sum, t) => {
    const w = safeWeight(t.weight);
    const fraction = getPlannedFractionAtDate(t, baseDate);
    return sum + w * fraction;
  }, 0);

  // EV = 각 작업의 (가중치 × 실적 공정율 / 100) 합
  const ev = leafTasks.reduce((sum, t) => {
    const w = safeWeight(t.weight);
    return sum + w * (t.actualProgress / 100);
  }, 0);

  // AC = 각 작업에 투입된 실적 일수 합
  const ac = leafTasks.reduce((sum, t) => {
    return sum + getActualCostDays(t, baseDate);
  }, 0);

  // Derived metrics
  const sv = ev - pv;
  const cv = ev - ac;
  const spi = pv > 0 ? ev / pv : 0;
  const cpi = ac > 0 ? ev / ac : 0;
  const eac = cpi > 0 ? bac / cpi : bac;
  const etc = Math.max(0, eac - ac);
  const vac = bac - eac;
  const tcpi = (bac - ac) > 0 ? (bac - ev) / (bac - ac) : 0;

  return { bac, pv, ev, ac, sv, cv, spi, cpi, eac, etc, vac, tcpi };
}

// ─── 시계열 데이터 생성 ─────────────────────────────────────

export function generateTimeSeries(
  tasks: Task[],
  startDateStr: string,
  endDateStr: string,
): EVMTimeSeriesPoint[] {
  const projectStart = parseISO(startDateStr);
  const projectEnd = parseISO(endDateStr);
  const leafTasks = getLeafTasks(tasks);
  const now = new Date();

  const points: EVMTimeSeriesPoint[] = [];
  let current = startOfWeek(projectStart, { weekStartsOn: 1 });

  // 주 단위로 시계열 데이터 생성
  while (!isAfter(current, projectEnd)) {
    const bac = leafTasks.reduce((sum, t) => sum + safeWeight(t.weight), 0);

    // PV at this date
    const pvVal = leafTasks.reduce((sum, t) => {
      const w = safeWeight(t.weight);
      const fraction = getPlannedFractionAtDate(t, current);
      return sum + w * fraction;
    }, 0);

    // EV at this date (only if date <= now)
    let evVal = 0;
    let acVal = 0;
    if (!isAfter(current, now)) {
      evVal = leafTasks.reduce((sum, t) => {
        const w = safeWeight(t.weight);
        // For past dates, we use actual progress (best approximation)
        // In reality EV should be a snapshot, but we use current progress for simplicity
        return sum + w * (t.actualProgress / 100);
      }, 0);

      acVal = leafTasks.reduce((sum, t) => {
        return sum + getActualCostDays(t, current);
      }, 0);
    }

    // Normalize to percentage of BAC
    const pvPct = bac > 0 ? (pvVal / bac) * 100 : 0;
    const evPct = bac > 0 ? (evVal / bac) * 100 : 0;
    const acPct = bac > 0 ? (acVal / bac) * 100 : 0;

    points.push({
      date: current.toISOString().split('T')[0],
      pv: Math.round(pvPct * 10) / 10,
      ev: !isAfter(current, now) ? Math.round(evPct * 10) / 10 : 0,
      ac: !isAfter(current, now) ? Math.round(acPct * 10) / 10 : 0,
    });

    current = addWeeks(current, 1);
  }

  return points;
}

// ─── SPI/CPI 해석 ───────────────────────────────────────────

export function interpretSPI(spi: number): { text: string; color: string } {
  if (spi > 1.05) return { text: '일정보다 빠르게 진행 중', color: '#22c55e' };
  if (spi >= 0.95) return { text: '계획대로 진행 중', color: '#2BAAA0' };
  return { text: '일정 지연 중', color: '#cb4b5f' };
}

export function interpretCPI(cpi: number): { text: string; color: string } {
  if (cpi > 1.05) return { text: '비용 효율적으로 진행 중', color: '#22c55e' };
  if (cpi >= 0.95) return { text: '예산대로 진행 중', color: '#2BAAA0' };
  return { text: '비용 초과 중', color: '#cb4b5f' };
}

/**
 * 현재 SPI 추세로 예상 완료일 계산
 */
export function estimateCompletionDate(
  projectStartDate: string,
  projectEndDate: string,
  spi: number,
): Date | null {
  if (spi <= 0) return null;
  const start = parseISO(projectStartDate);
  const end = parseISO(projectEndDate);
  const totalDays = differenceInDays(end, start);
  if (totalDays <= 0) return null;

  const estimatedDays = Math.round(totalDays / spi);
  const estimated = new Date(start);
  estimated.setDate(estimated.getDate() + estimatedDays);
  return estimated;
}
