/**
 * weeklyReportChart.ts
 *
 * 공정률 S-curve 차트 렌더링. 브라우저 canvas를 써서 PNG로 변환한 뒤
 * ExcelJS의 `workbook.addImage()` 로 삽입한다.
 *
 * 데이터 모델:
 *   - plan[w]   = 주차 w에 기대되는 누적 공정률(%) (각 leaf task의 planStart~planEnd 선형 보간 × weight 가중합)
 *   - actual[w] = 주차 w의 실제 누적 공정률(%) (과거 스냅샷 + 현재 actualProgress)
 */

import type { Task } from '../types';
import { getLeafTasks } from './taskAnalytics';
import { parseDate } from './utils';
import type { WeeklySnapshot } from './weeklySnapshot';
import { addWeeks, differenceInCalendarWeeks, format, startOfWeek } from 'date-fns';

export interface SCurvePoint {
  weekIndex: number;
  weekLabel: string;
  plan: number;
  actual: number | null;
}

export interface ComputeSCurveOptions {
  tasks: Task[];
  projectStart?: string | null;
  projectEnd?: string | null;
  currentDate?: Date;
  snapshots?: WeeklySnapshot[];
}

export function computeSCurve({
  tasks,
  projectStart,
  projectEnd,
  currentDate = new Date(),
  snapshots = [],
}: ComputeSCurveOptions): SCurvePoint[] {
  const leafs = getLeafTasks(tasks);
  if (leafs.length === 0) return [];

  // 프로젝트 기간 — 명시값이 없으면 task planStart/planEnd 의 min/max로 추정
  const pStart = parseDate(projectStart) || earliestDate(leafs.map((t) => t.planStart));
  const pEnd = parseDate(projectEnd) || latestDate(leafs.map((t) => t.planEnd));
  if (!pStart || !pEnd || pEnd < pStart) return [];

  const startWeek = startOfWeek(pStart, { weekStartsOn: 1 });
  const endWeek = startOfWeek(pEnd, { weekStartsOn: 1 });
  const weekCount = Math.max(1, differenceInCalendarWeeks(endWeek, startWeek, { weekStartsOn: 1 })) + 1;

  // 가중치 합계 (0일 땐 균등 분배)
  const totalWeight = leafs.reduce((s, t) => s + (t.weight || 1), 0);

  // 스냅샷을 주차별 actual 누적 진도율 맵으로
  const snapshotActualByWeek = new Map<string, number>();
  for (const snap of snapshots) {
    snapshotActualByWeek.set(snap.weekStart, snap.data.summary.overallActualProgress);
  }

  const currentWeekStart = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const currentActual = averageActualProgress(leafs, totalWeight);

  const points: SCurvePoint[] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekDate = addWeeks(startWeek, w);
    const weekKey = format(weekDate, 'yyyy-MM-dd');
    const weekEndDate = addWeeks(weekDate, 1);

    // plan = Σ (weight × 선형보간(%)/100)
    let planAccum = 0;
    for (const t of leafs) {
      const ps = parseDate(t.planStart);
      const pe = parseDate(t.planEnd);
      if (!ps || !pe || pe <= ps) continue;
      const wt = (t.weight || 1) / totalWeight;

      if (weekEndDate <= ps) {
        // not started
      } else if (weekDate >= pe) {
        planAccum += wt * 100;
      } else {
        const elapsedMs = Math.min(weekEndDate.getTime(), pe.getTime()) - ps.getTime();
        const totalMs = pe.getTime() - ps.getTime();
        planAccum += wt * Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
      }
    }

    // actual: 스냅샷이 있으면 사용, 현재 주이면 currentActual, 과거인데 스냅샷 없으면 null, 미래면 null
    let actual: number | null = null;
    if (snapshotActualByWeek.has(weekKey)) {
      actual = snapshotActualByWeek.get(weekKey)!;
    } else if (weekKey === currentWeekStart) {
      actual = currentActual;
    } else if (weekKey < currentWeekStart) {
      // 과거인데 스냅샷 없음 → 직전/이후 스냅샷으로 보간
      actual = null;
    } else {
      actual = null; // 미래
    }

    points.push({
      weekIndex: w + 1,
      weekLabel: format(weekDate, 'M/d'),
      plan: Math.round(planAccum * 10) / 10,
      actual: actual !== null ? Math.round(actual * 10) / 10 : null,
    });
  }

  // actual 선형 보간: 마지막 알려진 값과 현재 값 사이를 이어주는 보조선
  interpolateActualBackfill(points, currentWeekStart, startWeek);

  return points;
}

function averageActualProgress(leafs: Task[], totalWeight: number): number {
  if (leafs.length === 0) return 0;
  if (totalWeight === 0) {
    return leafs.reduce((s, t) => s + t.actualProgress, 0) / leafs.length;
  }
  return leafs.reduce((s, t) => s + (t.weight || 1) * t.actualProgress, 0) / totalWeight;
}

function interpolateActualBackfill(points: SCurvePoint[], currentWeekStart: string, startWeek: Date) {
  // 현재 주의 인덱스
  const currentIdx = points.findIndex((p) => {
    const weekDate = addWeeks(startWeek, p.weekIndex - 1);
    return format(weekDate, 'yyyy-MM-dd') === currentWeekStart;
  });
  if (currentIdx < 0) return;

  // 0 ~ currentIdx 구간에서 actual이 null인 곳을 채움
  // 이전에 알려진 값에서 현재값까지 선형 보간 (단순히 0부터 current까지)
  const current = points[currentIdx]?.actual ?? 0;
  // 첫 번째 known 이전은 0으로
  let lastKnownIdx = -1;
  let lastKnownValue = 0;
  for (let i = 0; i <= currentIdx; i++) {
    if (points[i].actual !== null) {
      // 사이 구간 보간
      if (lastKnownIdx < i - 1) {
        const startV = lastKnownValue;
        const endV = points[i].actual!;
        const gap = i - lastKnownIdx;
        for (let j = lastKnownIdx + 1; j < i; j++) {
          points[j].actual = Math.round((startV + ((endV - startV) * (j - lastKnownIdx)) / gap) * 10) / 10;
        }
      }
      lastKnownIdx = i;
      lastKnownValue = points[i].actual!;
    }
  }
  // 마지막 known 이후 ~ currentIdx까지 currentActual로 마감
  if (lastKnownIdx < currentIdx) {
    const gap = currentIdx - lastKnownIdx;
    const startV = lastKnownValue;
    for (let j = lastKnownIdx + 1; j <= currentIdx; j++) {
      points[j].actual = Math.round((startV + ((current - startV) * (j - lastKnownIdx)) / gap) * 10) / 10;
    }
  }
}

function earliestDate(dates: (string | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    const parsed = parseDate(d);
    if (parsed && (!best || parsed < best)) best = parsed;
  }
  return best;
}

function latestDate(dates: (string | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    const parsed = parseDate(d);
    if (parsed && (!best || parsed > best)) best = parsed;
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════
//  Canvas → PNG 렌더러
// ═══════════════════════════════════════════════════════════════

export interface RenderSCurveOptions {
  points: SCurvePoint[];
  title: string;
  /** 6자 HEX (# 제외), plan 라인에 사용 */
  themeColor?: string;
  width?: number;
  height?: number;
}

/** 브라우저 환경 전용 — OffscreenCanvas 또는 document.createElement('canvas') 사용 */
export async function renderSCurvePng({
  points,
  title,
  themeColor = '1E40AF',
  width = 1400,
  height = 560,
}: RenderSCurveOptions): Promise<ArrayBuffer | null> {
  if (typeof document === 'undefined' || points.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 배경
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 여백
  const margin = { top: 60, right: 40, bottom: 70, left: 70 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // 제목
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 24px Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 34);

  // 축
  const maxY = 100;
  const stepY = 10;
  const xScale = plotW / Math.max(1, points.length - 1);
  const yScale = plotH / maxY;

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748B';
  ctx.font = '12px Pretendard, sans-serif';
  ctx.textAlign = 'right';

  // Y 그리드/눈금
  for (let v = 0; v <= maxY; v += stepY) {
    const y = margin.top + plotH - v * yScale;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    ctx.fillText(String(v), margin.left - 8, y + 4);
  }

  // X 눈금 (일부만 표시)
  ctx.textAlign = 'center';
  const xStep = Math.max(1, Math.ceil(points.length / 20));
  for (let i = 0; i < points.length; i += xStep) {
    const x = margin.left + i * xScale;
    ctx.fillText(points[i].weekLabel, x, height - margin.bottom + 20);
  }

  // X축 주차 번호 (작은 보조)
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px Pretendard, sans-serif';
  for (let i = 0; i < points.length; i += xStep) {
    const x = margin.left + i * xScale;
    ctx.fillText(`${points[i].weekIndex}`, x, height - margin.bottom + 36);
  }

  // 세로 주차 그리드 (얇게)
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < points.length; i++) {
    const x = margin.left + i * xScale;
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + plotH);
    ctx.stroke();
  }

  // Plan 라인 (blue)
  ctx.strokeStyle = `#${themeColor}`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = margin.left + i * xScale;
    const y = margin.top + plotH - Math.min(maxY, Math.max(0, p.plan)) * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Actual 라인 (orange)
  const actualIdxs = points.map((p, i) => (p.actual !== null ? i : -1)).filter((i) => i >= 0);
  if (actualIdxs.length > 0) {
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (const i of actualIdxs) {
      const p = points[i];
      const x = margin.left + i * xScale;
      const y = margin.top + plotH - Math.min(maxY, Math.max(0, p.actual!)) * yScale;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Actual 포인트
    ctx.fillStyle = '#F97316';
    for (const i of actualIdxs) {
      const p = points[i];
      const x = margin.left + i * xScale;
      const y = margin.top + plotH - Math.min(maxY, Math.max(0, p.actual!)) * yScale;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 범례
  ctx.font = '13px Pretendard, sans-serif';
  ctx.textAlign = 'left';
  const legendY = height - 12;
  ctx.strokeStyle = `#${themeColor}`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(margin.left, legendY);
  ctx.lineTo(margin.left + 28, legendY);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.fillText('계획', margin.left + 34, legendY + 4);

  ctx.strokeStyle = '#F97316';
  ctx.beginPath();
  ctx.moveTo(margin.left + 90, legendY);
  ctx.lineTo(margin.left + 118, legendY);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.fillText('실적', margin.left + 124, legendY + 4);

  return new Promise<ArrayBuffer | null>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(null);
      const buf = await blob.arrayBuffer();
      resolve(buf);
    }, 'image/png');
  });
}
