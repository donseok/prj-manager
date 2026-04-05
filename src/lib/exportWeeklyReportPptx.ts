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

// ── 글꼴 ────────────────────────────────────────────────────
const FONT = 'Malgun Gothic';

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

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ── 공통 헤더 ────────────────────────────────────────────────
const HEADER_H = 1.05;

function addSlideHeader(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  projectName: string,
  subtitle: string,
) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: HEADER_H,
    fill: { color: C.darkBg },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: HEADER_H, w: '100%', h: 0.04,
    fill: { color: C.accent },
  });
  slide.addText(projectName, {
    x: 0.6, y: 0.2, w: 7, h: 0.35,
    fontSize: 16, fontFace: FONT, bold: true, color: C.white,
  });
  slide.addText(subtitle, {
    x: 0.6, y: 0.58, w: 7, h: 0.3,
    fontSize: 10, fontFace: FONT, color: C.gray400,
  });
}

// ── 슬라이드 1: 요약 현황 ───────────────────────────────────
function addSummarySlide(pptx: PptxGenJS, report: WeeklyReportData) {
  const slide = pptx.addSlide();

  // 공통 헤더 (요약은 제목이 더 크므로 직접 그림)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: HEADER_H,
    fill: { color: C.darkBg },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: HEADER_H, w: '100%', h: 0.04,
    fill: { color: C.accent },
  });

  slide.addText(report.projectName, {
    x: 0.6, y: 0.18, w: 7, h: 0.4,
    fontSize: 20, fontFace: FONT, bold: true, color: C.white,
  });
  slide.addText(`주간보고 · ${report.weekLabel} · ${report.generatedAt} 기준`, {
    x: 0.6, y: 0.6, w: 7, h: 0.3,
    fontSize: 10, fontFace: FONT, color: C.gray400,
  });

  // KPI 카드 4개 (압축)
  const kpis = [
    { label: '전체 작업', value: `${report.summary.totalLeafTasks}건`, color: C.primary },
    { label: '완료', value: `${report.summary.completedTasks}건`, color: C.success },
    { label: '실적 공정율', value: `${Math.round(report.summary.overallActualProgress)}%`, color: C.primaryLight },
    { label: '지연', value: `${report.summary.delayedTasks}건`, color: C.accent },
  ];

  const cardW = 2.05;
  const cardGap = 0.2;
  const startX = 0.6;
  const cardH = 0.72;
  const kpiStartY = 1.25;

  kpis.forEach((kpi, i) => {
    const x = startX + i * (cardW + cardGap);

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: kpiStartY, w: cardW, h: cardH,
      fill: { color: C.white },
      shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.06 },
      rectRadius: 0.08,
      line: { color: C.gray200, width: 0.5 },
    });

    // 색 인디케이터
    slide.addShape(pptx.ShapeType.rect, {
      x, y: kpiStartY, w: 0.06, h: cardH,
      fill: { color: kpi.color },
    });

    slide.addText(kpi.label, {
      x: x + 0.2, y: kpiStartY + 0.08, w: cardW - 0.3, h: 0.22,
      fontSize: 8, fontFace: FONT, bold: true, color: C.gray500,
    });

    slide.addText(kpi.value, {
      x: x + 0.2, y: kpiStartY + 0.32, w: cardW - 0.3, h: 0.32,
      fontSize: 18, fontFace: FONT, bold: true, color: C.dark,
    });
  });

  // 계획 vs 실적 프로그레스 바 (동적 Y)
  const barY = kpiStartY + cardH + 0.25;
  slide.addText('계획 vs 실적', {
    x: 0.6, y: barY, w: 4, h: 0.3,
    fontSize: 11, fontFace: FONT, bold: true, color: C.dark,
  });

  const planPct = report.summary.overallPlanProgress;
  const actualPct = report.summary.overallActualProgress;
  const barW = 8.4;
  const barH = 0.22;

  // 계획
  slide.addText(`계획 공정율   ${Math.round(planPct)}%`, {
    x: 0.6, y: barY + 0.35, w: 4, h: 0.2,
    fontSize: 9, fontFace: FONT, color: C.gray600,
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: barY + 0.6, w: barW, h: barH,
    fill: { color: C.primaryTint }, rectRadius: 0.1,
  });
  if (planPct > 0) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y: barY + 0.6, w: barW * (planPct / 100), h: barH,
      fill: { color: C.primaryLight }, rectRadius: 0.1,
    });
  }

  // 실적
  slide.addText(`실적 공정율   ${Math.round(actualPct)}%`, {
    x: 0.6, y: barY + 0.95, w: 4, h: 0.2,
    fontSize: 9, fontFace: FONT, color: C.gray600,
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: barY + 1.2, w: barW, h: barH,
    fill: { color: C.primaryTint }, rectRadius: 0.1,
  });
  if (actualPct > 0) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y: barY + 1.2, w: barW * (actualPct / 100), h: barH,
      fill: { color: C.primary }, rectRadius: 0.1,
    });
  }

  // 프로그레스 바 섹션 끝 Y
  let sectionEndY = barY + 1.2 + barH + 0.15;

  // 이슈 / 리스크 (동적 Y)
  if (report.issues.length > 0) {
    const issueY = sectionEndY;
    slide.addText('이슈 / 리스크', {
      x: 0.6, y: issueY, w: 4, h: 0.3,
      fontSize: 11, fontFace: FONT, bold: true, color: C.accent,
    });
    report.issues.slice(0, 4).forEach((issue, i) => {
      slide.addText(`${i + 1}. ${issue}`, {
        x: 0.8, y: issueY + 0.35 + i * 0.28, w: 8, h: 0.25,
        fontSize: 9, fontFace: FONT, color: C.gray700,
      });
    });
    sectionEndY = issueY + 0.35 + Math.min(report.issues.length, 4) * 0.28 + 0.15;
  }

  // 하단 섹션 요약 리본 (동적 Y, 압축)
  const ribbonY = sectionEndY;
  const ribbonH = 0.48;
  const ribbons = [
    { label: '금주 실적', count: report.thisWeekActual.tasks.length, color: C.primary },
    { label: '금주 완료', count: report.completedThisWeek.tasks.length, color: C.success },
    { label: '차주 계획', count: report.nextWeekPlan.tasks.length, color: C.primaryLight },
    { label: '지연 작업', count: report.delayed.tasks.length, color: C.accent },
  ];
  ribbons.forEach((r, i) => {
    const x = startX + i * (cardW + cardGap);
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: ribbonY, w: cardW, h: ribbonH,
      fill: { color: C.gray50 }, rectRadius: 0.06,
      line: { color: C.gray200, width: 0.5 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x, y: ribbonY, w: 0.05, h: ribbonH,
      fill: { color: r.color },
    });
    slide.addText(r.label, {
      x: x + 0.15, y: ribbonY + 0.04, w: cardW - 0.2, h: 0.18,
      fontSize: 8, fontFace: FONT, bold: true, color: C.gray500,
    });
    slide.addText(`${r.count}건`, {
      x: x + 0.15, y: ribbonY + 0.22, w: cardW - 0.2, h: 0.22,
      fontSize: 12, fontFace: FONT, bold: true, color: C.dark,
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
  const sectionY = 1.2;
  const tableY = 1.65;

  // 섹션 제목
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y: sectionY, w: colW, h: 0.35,
    fill: { color: titleColor }, rectRadius: 0.05,
  });
  slide.addText(title, {
    x, y: sectionY, w: colW, h: 0.35,
    fontSize: 11, fontFace: FONT, bold: true, color: C.white, align: 'center',
  });

  // 테이블 헤더
  const headerRow: PptxGenJS.TableRow = [
    { text: '작업명', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: FONT } },
    { text: '담당자', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: FONT } },
    { text: '상태', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: FONT } },
    { text: '공정율', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center', fontFace: FONT } },
  ];

  const dataRows: PptxGenJS.TableRow[] = tasks.map((t, i) => {
    const rowBg = i % 2 === 0 ? C.white : C.gray50;
    const sc = statusColor(t.status);
    const taskName = truncate(t.name, 30);
    const parentLabel = t.parentName ? `\n(${truncate(t.parentName, 15)})` : '';
    return [
      {
        text: taskName + parentLabel,
        options: { fontSize: 7.5, color: C.dark, fill: { color: rowBg }, fontFace: FONT, valign: 'middle' as const },
      },
      {
        text: t.assigneeName,
        options: { fontSize: 7.5, color: C.gray600, fill: { color: rowBg }, align: 'center' as const, fontFace: FONT, valign: 'middle' as const },
      },
      {
        text: t.statusLabel,
        options: { fontSize: 7, bold: true, color: sc.font, fill: { color: sc.bg }, align: 'center' as const, fontFace: FONT, valign: 'middle' as const },
      },
      {
        text: `${t.actualProgress}%`,
        options: { fontSize: 7.5, color: C.dark, fill: { color: rowBg }, align: 'center' as const, fontFace: FONT, valign: 'middle' as const },
      },
    ];
  });

  if (tasks.length === 0) {
    dataRows.push([
      {
        text: '해당 작업 없음',
        options: {
          fontSize: 8, color: C.gray400, fill: { color: C.gray50 },
          align: 'center' as const, fontFace: FONT, colspan: 4,
        },
      },
    ]);
  }

  slide.addTable([headerRow, ...dataRows], {
    x, y: tableY, w: colW,
    colW: [colW * 0.42, colW * 0.2, colW * 0.2, colW * 0.18],
    border: { type: 'solid', pt: 0.5, color: C.gray200 },
    rowH: 0.32, autoPage: false,
  });
}

function addDetailSlides(pptx: PptxGenJS, report: WeeklyReportData) {
  const maxRowsPerSlide = 14;
  const actualTasks = report.thisWeekActual.tasks;
  const planTasks = report.nextWeekPlan.tasks;

  const actualChunks = actualTasks.length > 0 ? chunk(actualTasks, maxRowsPerSlide) : [[]];
  const planChunks = planTasks.length > 0 ? chunk(planTasks, maxRowsPerSlide) : [[]];
  const pageCount = Math.max(actualChunks.length, planChunks.length);

  // 금주/차주 날짜 범위 계산
  const ws = new Date(report.weekStart + 'T00:00:00');
  const we = new Date(report.weekEnd + 'T00:00:00');
  const nws = new Date(ws);
  nws.setDate(nws.getDate() + 7);
  const nwe = new Date(we);
  nwe.setDate(nwe.getDate() + 7);

  const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const thisWeekRange = `(${fmtDate(ws)}~ ${fmtDate(we)})`;
  const nextWeekRange = `(${fmtDate(nws)}~ ${fmtDate(nwe)})`;

  for (let p = 0; p < pageCount; p++) {
    const slide = pptx.addSlide();
    const pageLabel = pageCount > 1 ? ` (${p + 1}/${pageCount})` : '';
    addSlideHeader(slide, pptx, report.projectName, `상세 작업 현황${pageLabel} · ${report.weekLabel}`);

    // 좌: 금주 실적
    addTaskTable(slide, pptx, `금주 실적 ${thisWeekRange}`, actualChunks[p] || [], 0.4, C.primary);

    // 우: 차주 계획
    addTaskTable(slide, pptx, `차주 계획 ${nextWeekRange}`, planChunks[p] || [], 5.2, C.primaryLight);
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
  const nws = new Date(report.weekStart + 'T00:00:00');
  nws.setDate(nws.getDate() + 7);
  const nextWeekStartStr = `${nws.getFullYear()}-${String(nws.getMonth() + 1).padStart(2, '0')}-${String(nws.getDate()).padStart(2, '0')}`;
  const nextWeekDays = getDayHeaders(nextWeekStartStr);

  // 공통 헤더
  addSlideHeader(slide, pptx, report.projectName, `근태현황 · ${report.weekLabel}`);

  // 멤버가 많으면 rowH 축소
  const totalMembers = Math.max(thisWeek.length, nextWeek.length);
  const rowH = totalMembers > 10 ? 0.24 : 0.28;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cellOpts = (opts: Record<string, any> = {}): Record<string, any> => ({
    fontSize: 7, fontFace: FONT, align: 'center', valign: 'middle', ...opts,
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
  let curY = 1.2;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fill: { color: C.primary }, rectRadius: 0.05,
  });
  slide.addText('금주 근태현황', {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fontSize: 10, fontFace: FONT, bold: true, color: C.white, align: 'center',
  });
  curY += 0.38;

  const thisTable = buildAttendanceTable(thisWeek, thisWeekDays);
  const thisRowCount = 1 + Math.max(thisTable.rows.length, 1);
  slide.addTable([thisTable.header, ...thisTable.rows], {
    x: 0.4, y: curY, w: tableW, colW: colWidths,
    border: { type: 'solid', pt: 0.5, color: C.gray200 },
    rowH, autoPage: false,
  });
  curY += thisRowCount * rowH + 0.25;

  // ── 차주 근태현황 ──
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fill: { color: C.primaryLight }, rectRadius: 0.05,
  });
  slide.addText('차주 근태현황', {
    x: 0.4, y: curY, w: tableW, h: 0.32,
    fontSize: 10, fontFace: FONT, bold: true, color: C.white, align: 'center',
  });
  curY += 0.38;

  const nextTable = buildAttendanceTable(nextWeek, nextWeekDays);
  slide.addTable([nextTable.header, ...nextTable.rows], {
    x: 0.4, y: curY, w: tableW, colW: colWidths,
    border: { type: 'solid', pt: 0.5, color: C.gray200 },
    rowH, autoPage: false,
  });
}

// ── 담당자 작성 슬라이드 ────────────────────────────────────
function addMemberReportSlides(pptx: PptxGenJS, report: WeeklyReportData) {
  const entries = report.memberReports || [];
  if (entries.length === 0) return;

  // 내용 길이에 따라 슬라이드당 개수 결정
  const maxTextLen = Math.max(
    ...entries.map((e) => Math.max((e.thisWeekResult || '').length, (e.nextWeekPlan || '').length)),
    0,
  );
  const maxPerSlide = maxTextLen > 200 ? 3 : 4;
  const chunks = chunk(entries, maxPerSlide);

  chunks.forEach((group, pageIdx) => {
    const slide = pptx.addSlide();

    const pageLabel = chunks.length > 1 ? ` (${pageIdx + 1}/${chunks.length})` : '';
    addSlideHeader(slide, pptx, report.projectName, `담당자 작성${pageLabel} · ${report.weekLabel}`);

    let curY = 1.25;
    const contentW = 8.8;

    group.forEach((entry) => {
      // 담당자명 배경 바
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.4, y: curY, w: contentW, h: 0.32,
        fill: { color: C.primary }, rectRadius: 0.05,
      });
      slide.addText(entry.memberName, {
        x: 0.6, y: curY, w: contentW - 0.4, h: 0.32,
        fontSize: 10, fontFace: FONT, bold: true, color: C.white,
      });
      curY += 0.38;

      // 내용 길이에 따라 rowH 동적 조정
      const entryMaxLen = Math.max((entry.thisWeekResult || '').length, (entry.nextWeekPlan || '').length);
      const dataRowH = entryMaxLen > 200 ? 1.1 : 0.8;

      // 텍스트 300자 초과 시 말줄임
      const thisText = truncate(entry.thisWeekResult || '(작성 없음)', 300);
      const nextText = truncate(entry.nextWeekPlan || '(작성 없음)', 300);

      const colW = contentW / 2;
      const headerRow: PptxGenJS.TableRow = [
        { text: '금주 실적', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center' as const, fontFace: FONT } },
        { text: '차주 계획', options: { fontSize: 8, bold: true, color: C.white, fill: { color: C.dark }, align: 'center' as const, fontFace: FONT } },
      ];
      const dataRow: PptxGenJS.TableRow = [
        {
          text: thisText,
          options: {
            fontSize: 8, color: entry.thisWeekResult ? C.dark : C.gray400,
            fill: { color: C.white }, fontFace: FONT, valign: 'top' as const,
          },
        },
        {
          text: nextText,
          options: {
            fontSize: 8, color: entry.nextWeekPlan ? C.dark : C.gray400,
            fill: { color: C.white }, fontFace: FONT, valign: 'top' as const,
          },
        },
      ];

      slide.addTable([headerRow, dataRow], {
        x: 0.4, y: curY, w: contentW,
        colW: [colW, colW],
        border: { type: 'solid', pt: 0.5, color: C.gray200 },
        rowH: [0.28, dataRowH],
        autoPage: false,
      });
      curY += 0.28 + dataRowH + 0.15;
    });
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

  // 담당자 작성 슬라이드
  addMemberReportSlides(pptx, report);

  const filename = `${report.projectName}_주간보고_${report.weekStart}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
