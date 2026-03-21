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

// ── 색상 ────────────────────────────────────────────────────
const C = {
  primary: '0F766E',
  primaryDark: '0D6B64',
  accent: '1FA37A',
  dark: '1E293B',
  darkBg: '0F172A',
  white: 'FFFFFF',
  gray50: 'F8FAFC',
  gray100: 'F1F5F9',
  gray200: 'E2E8F0',
  gray400: '94A3B8',
  gray500: '64748B',
  gray600: '475569',
  gray700: '334155',
  danger: 'DC2626',
  dangerBg: 'FEE2E2',
  warning: 'F59E0B',
  warningBg: 'FEF3C7',
  success: '16A34A',
  successBg: 'DCFCE7',
};

// ── 유틸 ────────────────────────────────────────────────────
function statusColor(status: string): { bg: string; font: string } {
  switch (status) {
    case 'completed':
      return { bg: C.successBg, font: C.success };
    case 'in_progress':
      return { bg: 'DBEAFE', font: '2563EB' };
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

  // 상단 배경 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 1.3,
    fill: { color: C.darkBg },
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
    { label: '완료', value: `${report.summary.completedTasks}건`, color: C.accent },
    { label: '실적 공정율', value: `${Math.round(report.summary.overallActualProgress)}%`, color: '5B8DEF' },
    { label: '지연', value: `${report.summary.delayedTasks}건`, color: C.danger },
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
    fill: { color: 'EEF2FF' },
    rectRadius: 0.1,
  });
  if (planPct > 0) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: barY + 0.6,
      w: barW * (planPct / 100),
      h: barH,
      fill: { color: '5B8DEF' },
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
    fill: { color: 'F0FDFA' },
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
      color: C.warning,
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
    { label: '차주 계획', count: report.nextWeekPlan.tasks.length, color: '6366F1' },
    { label: '지연 작업', count: report.delayed.tasks.length, color: C.danger },
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

    // 헤더 바
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: '100%',
      h: 1.3,
      fill: { color: C.darkBg },
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
    addTaskTable(slide, pptx, '차주 계획', planChunks[p] || [], 5.2, '6366F1');
  }
}

// ── 근태현황 슬라이드 ────────────────────────────────────────
function addAttendanceSlide(pptx: PptxGenJS, report: WeeklyReportData) {
  const slide = pptx.addSlide();
  const attendanceSummary = report.attendanceSummary!;

  // 헤더 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 1.3,
    fill: { color: C.darkBg },
  });

  slide.addText(report.projectName, {
    x: 0.6, y: 0.25, w: 7, h: 0.35,
    fontSize: 16, fontFace: 'Pretendard', bold: true, color: C.white,
  });

  slide.addText(`근태현황 · ${report.weekLabel}`, {
    x: 0.6, y: 0.65, w: 7, h: 0.3,
    fontSize: 10, fontFace: 'Pretendard', color: C.gray400,
  });

  // 섹션 제목
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4, y: 1.45, w: 9.0, h: 0.35,
    fill: { color: C.primary }, rectRadius: 0.05,
  });
  slide.addText('금주 근태현황', {
    x: 0.4, y: 1.45, w: 9.0, h: 0.35,
    fontSize: 11, fontFace: 'Pretendard', bold: true, color: C.white, align: 'center',
  });

  // 테이블 헤더
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cellOpts = (opts: Record<string, any> = {}): Record<string, any> => ({
    fontSize: 8, fontFace: 'Pretendard', align: 'center', valign: 'middle', ...opts,
  });

  const headerRow: PptxGenJS.TableRow = [
    { text: '담당자', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark } }) },
    { text: '월', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark } }) },
    { text: '화', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark } }) },
    { text: '수', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark } }) },
    { text: '목', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark } }) },
    { text: '금', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark } }) },
    { text: '소계', options: cellOpts({ bold: true, color: C.white, fill: { color: C.dark } }) },
  ];

  const dataRows: PptxGenJS.TableRow[] = attendanceSummary.map((member, i) => {
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
          fontSize: 7.5,
        }),
      };
    };

    return [
      { text: member.memberName, options: cellOpts({ color: C.dark, fill: { color: rowBg }, align: 'left' as const, fontSize: 8 }) },
      dayCell(1),
      dayCell(2),
      dayCell(3),
      dayCell(4),
      dayCell(5),
      { text: statsStr, options: cellOpts({ color: C.gray600, fill: { color: rowBg }, fontSize: 7 }) },
    ];
  });

  const tableW = 9.0;
  slide.addTable([headerRow, ...dataRows], {
    x: 0.4,
    y: 1.9,
    w: tableW,
    colW: [tableW * 0.18, tableW * 0.13, tableW * 0.13, tableW * 0.13, tableW * 0.13, tableW * 0.13, tableW * 0.17],
    border: { type: 'solid', pt: 0.5, color: C.gray200 },
    rowH: 0.32,
    autoPage: false,
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

  // 근태현황 슬라이드
  if (report.attendanceSummary && report.attendanceSummary.length > 0) {
    addAttendanceSlide(pptx, report);
  }

  const filename = `${report.projectName}_주간보고_${report.weekStart}.pptx`;
  await pptx.writeFile({ fileName: filename });
}
