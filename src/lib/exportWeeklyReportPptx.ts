/**
 * exportWeeklyReportPptx.ts
 * 주간보고 PowerPoint 내보내기
 *
 * 1페이지: 요약 현황
 * 2페이지~: 상세 작업 (좌: 금주실적, 우: 차주계획)
 */

import PptxGenJS from 'pptxgenjs';
import type { WeeklyReportData, WeeklyReportTask } from './weeklyReport';
import { ATTENDANCE_TYPE_COLORS } from '../types';

// ── 색상 (동국제강그룹 CI 기반) ──────────────────────────────
const C = {
  // 동국블루 — 투명성·신뢰·품격
  primary: '002452',
  primaryLight: '003670',
  primaryTint: 'E8EDF4',
  // 동국레드 — 자부심·열정·의지
  accent: 'C51F2A',
  accentLight: 'FDEAEB',
  // 뉴트럴
  dark: '1A1A2E',
  darkBg: '002452',
  white: 'FFFFFF',
  gray50: 'F7F8FA',
  gray100: 'ECEEF2',
  gray200: 'D4D8E0',
  gray400: '8B92A0',
  gray500: '5C6370',
  gray600: '3E4555',
  gray700: '2A2F3C',
  // 상태
  danger: 'C51F2A',
  dangerBg: 'FDEAEB',
  warning: 'D97706',
  warningBg: 'FEF3C7',
  success: '0D7C3E',
  successBg: 'E2F5EA',
};

// ── 유틸 ────────────────────────────────────────────────────
function statusColor(status: string): { bg: string; font: string } {
  switch (status) {
    case 'completed':
      return { bg: C.successBg, font: C.success };
    case 'in_progress':
      return { bg: C.primaryTint, font: C.primary };
    case 'on_hold':
      return { bg: C.warningBg, font: C.warning };
    default:
      return { bg: C.gray100, font: C.gray600 };
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ── 슬라이드 1: 요약 현황 ───────────────────────────────────
function addSummarySlide(pptx: PptxGenJS, report: WeeklyReportData) {
  const slide = pptx.addSlide();

  // 상단 배경 바 (동국블루)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 1.3,
    fill: { color: C.darkBg },
  });
  // 동국레드 악센트 라인
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 1.3,
    w: '100%',
    h: 0.04,
    fill: { color: C.accent },
  });

  // 프로젝트명 + 주차
  slide.addText(report.projectName, {
    x: 0.6,
    y: 0.25,
    w: 7,
    h: 0.4,
    fontSize: 20,
    fontFace: 'Pretendard',
    bold: true,
    color: C.white,
  });
  slide.addText(`주간보고 · ${report.weekLabel} · ${report.generatedAt} 기준`, {
    x: 0.6,
    y: 0.7,
    w: 7,
    h: 0.3,
    fontSize: 10,
    fontFace: 'Pretendard',
    color: C.gray400,
  });

  // KPI 카드 4개
  const kpis = [
    { label: '전체 작업', value: `${report.summary.totalLeafTasks}건`, color: C.primary },
    { label: '완료', value: `${report.summary.completedTasks}건`, color: C.success },
    { label: '실적 공정율', value: `${Math.round(report.summary.overallActualProgress)}%`, color: C.primaryLight },
    { label: '지연', value: `${report.summary.delayedTasks}건`, color: C.accent },
  ];

  const cardW = 2.05;
  const cardGap = 0.2;
  const startX = 0.6;

  kpis.forEach((kpi, i) => {
    const x = startX + i * (cardW + cardGap);
    const y = 1.65;

    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: cardW,
      h: 1.0,
      fill: { color: C.white },
      shadow: { type: 'outer', blur: 6, offset: 2, color: '00000010' },
      rectRadius: 0.08,
      line: { color: C.gray200, width: 0.5 },
    });

    // 색 인디케이터
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.06,
      h: 1.0,
      fill: { color: kpi.color },
      rectRadius: 0.08,
    });

    slide.addText(kpi.label, {
      x: x + 0.2,
      y: y + 0.12,
      w: cardW - 0.3,
      h: 0.25,
      fontSize: 9,
      fontFace: 'Pretendard',
      bold: true,
      color: C.gray500,
    });

    slide.addText(kpi.value, {
      x: x + 0.2,
      y: y + 0.42,
      w: cardW - 0.3,
      h: 0.4,
      fontSize: 22,
      fontFace: 'Pretendard',
      bold: true,
      color: C.dark,
    });
  });

  // 계획 vs 실적 프로그레스 바
  const barY = 3.0;
  slide.addText('계획 vs 실적', {
    x: 0.6,
    y: barY,
    w: 4,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Pretendard',
    bold: true,
    color: C.dark,
  });

  const planPct = report.summary.overallPlanProgress;
  const actualPct = report.summary.overallActualProgress;
  const barW = 8.4;
  const barH = 0.22;

  // 계획
  slide.addText(`계획 공정율   ${Math.round(planPct)}%`, {
    x: 0.6,
    y: barY + 0.35,
    w: 4,
    h: 0.2,
    fontSize: 9,
    fontFace: 'Pretendard',
    color: C.gray600,
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: barY + 0.6,
    w: barW,
    h: barH,
    fill: { color: C.primaryTint },
    rectRadius: 0.1,
  });
  if (planPct > 0) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: barY + 0.6,
      w: barW * (planPct / 100),
      h: barH,
      fill: { color: C.primaryLight },
      rectRadius: 0.1,
    });
  }

  // 실적
  slide.addText(`실적 공정율   ${Math.round(actualPct)}%`, {
    x: 0.6,
    y: barY + 0.95,
    w: 4,
    h: 0.2,
    fontSize: 9,
    fontFace: 'Pretendard',
    color: C.gray600,
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: barY + 1.2,
    w: barW,
    h: barH,
    fill: { color: C.primaryTint },
    rectRadius: 0.1,
  });
  if (actualPct > 0) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: barY + 1.2,
      w: barW * (actualPct / 100),
      h: barH,
      fill: { color: C.primary },
      rectRadius: 0.1,
    });
  }

  // 이슈 / 리스크
  if (report.issues.length > 0) {
    const issueY = 4.6;
    slide.addText('이슈 / 리스크', {
      x: 0.6,
      y: issueY,
      w: 4,
      h: 0.3,
      fontSize: 11,
      fontFace: 'Pretendard',
      bold: true,
      color: C.accent,
    });
    report.issues.slice(0, 4).forEach((issue, i) => {
      slide.addText(`${i + 1}. ${issue}`, {
        x: 0.8,
        y: issueY + 0.35 + i * 0.28,
        w: 8,
        h: 0.25,
        fontSize: 9,
        fontFace: 'Pretendard',
        color: C.gray700,
      });
    });
  }

  // 하단 섹션 요약 리본
  const ribbonY = report.issues.length > 0 ? 4.6 + 0.35 + Math.min(report.issues.length, 4) * 0.28 + 0.2 : 4.6;
  const ribbons = [
    { label: '금주 실적', count: report.thisWeekActual.tasks.length, color: C.primary },
    { label: '금주 완료', count: report.completedThisWeek.tasks.length, color: C.success },
    { label: '차주 계획', count: report.nextWeekPlan.tasks.length, color: C.primaryLight },
    { label: '지연 작업', count: report.delayed.tasks.length, color: C.accent },
  ];
  ribbons.forEach((r, i) => {
    const x = startX + i * (cardW + cardGap);
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: ribbonY,
      w: cardW,
      h: 0.55,
      fill: { color: C.gray50 },
      rectRadius: 0.06,
      line: { color: C.gray200, width: 0.5 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y: ribbonY,
      w: 0.05,
      h: 0.55,
      fill: { color: r.color },
    });
    slide.addText(r.label, {
      x: x + 0.15,
      y: ribbonY + 0.05,
      w: cardW - 0.2,
      h: 0.2,
      fontSize: 8,
      fontFace: 'Pretendard',
      bold: true,
      color: C.gray500,
    });
    slide.addText(`${r.count}건`, {
      x: x + 0.15,
      y: ribbonY + 0.25,
      w: cardW - 0.2,
      h: 0.25,
      fontSize: 14,
      fontFace: 'Pretendard',
      bold: true,
      color: C.dark,
    });
  });
}

// ── 상세 슬라이드: 좌(금주실적) / 우(차주계획) ─────────────
function addTaskTable(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  title: string,
  tasks: WeeklyReportTask[],
  x: number,
  titleColor: string
) {
  const colW = 4.2;

  // 섹션 제목
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y: 1.45,
    w: colW,
    h: 0.35,
    fill: { color: titleColor },
    rectRadius: 0.05,
  });
  slide.addText(title, {
    x,
    y: 1.45,
    w: colW,
    h: 0.35,
    fontSize: 11,
    fontFace: 'Pretendard',
    bold: true,
    color: C.white,
    align: 'center',
  });

  // 테이블 헤더
  const headerRow: PptxGenJS.TableRow = [
    { text: '작업명', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: 'Pretendard' } },
    { text: '담당자', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: 'Pretendard' } },
    { text: '상태', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: 'Pretendard' } },
    { text: '공정율', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: 'Pretendard' } },
  ];

  const dataRows: PptxGenJS.TableRow[] = tasks.map((t, i) => {
    const rowBg = i % 2 === 0 ? C.white : C.gray50;
    const sc = statusColor(t.status);
    return [
      {
        text: t.name + (t.parentName ? `\n(${t.parentName})` : ''),
        options: { fontSize: 7.5, color: C.dark, fill: { color: rowBg }, fontFace: 'Pretendard', valign: 'middle' as const },
      },
      {
        text: t.assigneeName,
        options: { fontSize: 7.5, color: C.gray600, fill: { color: rowBg }, align: 'center' as const, fontFace: 'Pretendard', valign: 'middle' as const },
      },
      {
        text: t.statusLabel,
        options: { fontSize: 7, bold: true, color: sc.font, fill: { color: sc.bg }, align: 'center' as const, fontFace: 'Pretendard', valign: 'middle' as const },
      },
      {
        text: `${t.actualProgress}%`,
        options: { fontSize: 7.5, color: C.dark, fill: { color: rowBg }, align: 'center' as const, fontFace: 'Pretendard', valign: 'middle' as const },
      },
    ];
  });

  if (tasks.length === 0) {
    dataRows.push([
      {
        text: '해당 작업 없음',
        options: {
          fontSize: 8,
          color: C.gray400,
          fill: { color: C.gray50 },
          align: 'center' as const,
          fontFace: 'Pretendard',
          colspan: 4,
        },
      },
    ]);
  }

  slide.addTable([headerRow, ...dataRows], {
    x,
    y: 1.9,
    w: colW,
    colW: [colW * 0.42, colW * 0.2, colW * 0.2, colW * 0.18],
    border: { type: 'solid', pt: 0.5, color: C.gray200 },
    rowH: 0.32,
    autoPage: false,
  });
}

function addDetailSlides(pptx: PptxGenJS, report: WeeklyReportData) {
  const maxRowsPerSlide = 12;
  const actualTasks = report.thisWeekActual.tasks;
  const planTasks = report.nextWeekPlan.tasks;

  const actualChunks = actualTasks.length > 0 ? chunk(actualTasks, maxRowsPerSlide) : [[]];
  const planChunks = planTasks.length > 0 ? chunk(planTasks, maxRowsPerSlide) : [[]];
  const pageCount = Math.max(actualChunks.length, planChunks.length);

  for (let p = 0; p < pageCount; p++) {
    const slide = pptx.addSlide();

    // 헤더 바 (동국블루)
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: '100%',
      h: 1.3,
      fill: { color: C.darkBg },
    });
    // 동국레드 악센트 라인
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 1.3,
      w: '100%',
      h: 0.04,
      fill: { color: C.accent },
    });

    slide.addText(report.projectName, {
      x: 0.6,
      y: 0.25,
      w: 7,
      h: 0.35,
      fontSize: 16,
      fontFace: 'Pretendard',
      bold: true,
      color: C.white,
    });

    const pageLabel = pageCount > 1 ? ` (${p + 1}/${pageCount})` : '';
    slide.addText(`상세 작업 현황${pageLabel} · ${report.weekLabel}`, {
      x: 0.6,
      y: 0.65,
      w: 7,
      h: 0.3,
      fontSize: 10,
      fontFace: 'Pretendard',
      color: C.gray400,
    });

    // 좌: 금주 실적
    addTaskTable(slide, pptx, '금주 실적', actualChunks[p] || [], 0.4, C.primary);

    // 우: 차주 계획
    addTaskTable(slide, pptx, '차주 계획', planChunks[p] || [], 5.2, C.primaryLight);
  }
}

// ── 근태현황 슬라이드 (금주 + 차주 통합) ─────────────────────
function addAttendanceCombinedSlide(pptx: PptxGenJS, report: WeeklyReportData) {
  const slide = pptx.addSlide();

  const thisWeek = report.attendanceSummary || [];
  const nextWeek = report.nextWeekAttendanceSummary || [];

  // 주 시작일로부터 요일별 날짜 계산
  const getDayHeaders = (weekStartStr: string): string[] => {
    const ws = new Date(weekStartStr + 'T00:00:00');
    const dayNames = ['월', '화', '수', '목', '금'];
    return dayNames.map((name, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      return `${name}\n(${d.getMonth() + 1}/${d.getDate()})`;
    });
  };

  const thisWeekDays = getDayHeaders(report.weekStart);
  // 차주 시작일: 금주 시작일 + 7일
  const nws = new Date(report.weekStart + 'T00:00:00');
  nws.setDate(nws.getDate() + 7);
  const nextWeekStartStr = `${nws.getFullYear()}-${String(nws.getMonth() + 1).padStart(2, '0')}-${String(nws.getDate()).padStart(2, '0')}`;
  const nextWeekDays = getDayHeaders(nextWeekStartStr);

  // 헤더 바 (동국블루)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 1.3,
    fill: { color: C.darkBg },
  });
  // 동국레드 악센트 라인
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 1.3, w: '100%', h: 0.04,
    fill: { color: C.accent },
  });

  slide.addText(report.projectName, {
    x: 0.6, y: 0.25, w: 7, h: 0.35,
    fontSize: 16, fontFace: 'Pretendard', bold: true, color: C.white,
  });

  slide.addText(`근태현황 · ${report.weekLabel}`, {
    x: 0.6, y: 0.65, w: 7, h: 0.3,
    fontSize: 10, fontFace: 'Pretendard', color: C.gray400,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cellOpts = (opts: Record<string, any> = {}): Record<string, any> => ({
    fontSize: 7, fontFace: 'Pretendard', align: 'center', valign: 'middle', ...opts,
  });

  // 테이블 빌드 함수
  const buildAttendanceTable = (
    summary: import('./weeklyReport').WeeklyAttendanceSummary[],
    dayHeaders: string[],
  ): { header: PptxGenJS.TableRow; rows: PptxGenJS.TableRow[] } => {
    const header: PptxGenJS.TableRow = [
      { text: '담당자', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark }, fontSize: 7.5 }) },
      ...dayHeaders.map((d) => ({ text: d, options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark }, fontSize: 7 }) })),
      { text: '소계', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark }, fontSize: 7.5 }) },
    ];

    const rows: PptxGenJS.TableRow[] = summary.map((member, i) => {
      const rowBg = i % 2 === 0 ? C.white : C.gray50;
      const dayMap = new Map<number, { label: string; color: string }>();
      for (const r of member.records) {
        const dow = new Date(r.date).getDay();
        if (dow >= 1 && dow <= 5) {
          dayMap.set(dow, {
            label: r.typeLabel,
            color: ATTENDANCE_TYPE_COLORS[r.type]?.replace('#', '') || C.gray600,
          });
        }
      }

      const statsStr = Object.entries(member.stats).map(([k, v]) => `${k}${v}`).join('/');

      const dayCell = (dow: number): PptxGenJS.TableCell => {
        const info = dayMap.get(dow);
        return {
          text: info?.label || '-',
          options: cellOpts({
            color: info?.color || C.gray400,
            bold: !!info,
            fill: { color: rowBg },
            fontSize: 7,
          }),
        };
      };

      return [
        { text: member.memberName, options: cellOpts({ color: C.dark, fill: { color: rowBg }, align: 'left' as const, fontSize: 7.5 }) },
        dayCell(1), dayCell(2), dayCell(3), dayCell(4), dayCell(5),
        { text: statsStr, options: cellOpts({ color: C.gray600, fill: { color: rowBg }, fontSize: 6.5 }) },
      ];
    });

    if (summary.length === 0) {
      rows.push([{
        text: '근태 기록 없음',
        options: cellOpts({ color: C.gray400, fill: { color: C.gray50 }, colspan: 7 }),
      }]);
    }

    return { header, rows };
  };

  const tableW = 9.0;
  const colWidths = [tableW * 0.17, tableW * 0.13, tableW * 0.13, tableW * 0.13, tableW * 0.13, tableW * 0.13, tableW * 0.18];

  // ── 금주 근태현황 ──
  let curY = 1.45;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fill: { color: C.primary }, rectRadius: 0.05,
  });
  slide.addText('금주 근태현황', {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fontSize: 10, fontFace: 'Pretendard', bold: true, color: C.white, align: 'center',
  });
  curY += 0.38;

  const thisTable = buildAttendanceTable(thisWeek, thisWeekDays);
  const thisRowCount = 1 + Math.max(thisTable.rows.length, 1); // header + data
  slide.addTable([thisTable.header, ...thisTable.rows], {
    x: 0.4, y: curY, w: tableW, colW: colWidths,
    border: { type: 'solid', pt: 0.5, color: C.gray200 },
    rowH: 0.28, autoPage: false,
  });
  curY += thisRowCount * 0.28 + 0.25;

  // ── 차주 근태현황 ──
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fill: { color: C.primaryLight }, rectRadius: 0.05,
  });
  slide.addText('차주 근태현황', {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fontSize: 10, fontFace: 'Pretendard', bold: true, color: C.white, align: 'center',
  });
  curY += 0.38;

  const nextTable = buildAttendanceTable(nextWeek, nextWeekDays);
  slide.addTable([nextTable.header, ...nextTable.rows], {
    x: 0.4, y: curY, w: tableW, colW: colWidths,
    border: { type: 'solid', pt: 0.5, color: C.gray200 },
    rowH: 0.28, autoPage: false,
  });
}

// ── 메인 내보내기 함수 ──────────────────────────────────────
export async function exportWeeklyReportPptx(report: WeeklyReportData) {
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'DK Flow';
  pptx.subject = `${report.projectName} 주간보고`;
  pptx.title = `${report.projectName} 주간보고 - ${report.weekLabel}`;

  // 슬라이드 1: 요약
  addSummarySlide(pptx, report);

  // 슬라이드 2~: 상세 (좌: 금주실적, 우: 차주계획)
  addDetailSlides(pptx, report);

  // 근태현황 슬라이드 (금주 + 차주 통합)
  const hasThisWeek = report.attendanceSummary && report.attendanceSummary.length > 0;
  const hasNextWeek = report.nextWeekAttendanceSummary && report.nextWeekAttendanceSummary.length > 0;
  if (hasThisWeek || hasNextWeek) {
    addAttendanceCombinedSlide(pptx, report);
  }

  const filename = `${report.projectName}_주간보고_${report.weekStart}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
