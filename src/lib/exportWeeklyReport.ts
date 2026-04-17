/**
 * exportWeeklyReport.ts
 *
 * 주간보고 Excel 내보내기 (3시트 구조).
 *
 *  - 1.공정보고  → 대시보드 요약 + 금주 실적 / 차주 계획
 *  - 2.WBS      → 프로그램 WBS 전체 (계획/실적/상태/공정율)
 *  - 3.프로그램개발현황 → WBS 기반 To-do 리스트 (미완료 leaf task)
 *
 * 양식(타이틀/컬러/공정항목)은 프로젝트 최초 다운로드 시점에 고정되어
 * 프로젝트 종료 시까지 변하지 않는다. (weeklyReportTemplate.ts 참고)
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { WeeklyReportData, WeeklyReportTask, WeeklyAttendanceSummary } from './weeklyReport';
import type { Task, WeeklyReportTemplate } from '../types';
import { ATTENDANCE_TYPE_COLORS, LEVEL_LABELS, TASK_STATUS_LABELS } from '../types';
import { lightenHex } from './weeklyReportTemplate';
import { computeSCurve, renderSCurvePng } from './weeklyReportChart';
import type { WeeklySnapshot } from './weeklySnapshot';
import { format, differenceInCalendarDays } from 'date-fns';

const FONT_NAME = 'Pretendard';

// 기본 팔레트 (테마 컬러는 런타임 주입)
const BASE = {
  headerFont: 'FFFFFF',
  titleFont: 'FFFFFF',
  border: 'CBD5E1',
  borderDark: '334155',
  borderLight: 'E2E8F0',
  white: 'FFFFFF',
  rowEven: 'F8FAFC',
  rowOdd: 'FFFFFF',
  metaLabel: '64748B',
  metaValue: '1E293B',
  completed: 'DCFCE7',
  completedFont: '166534',
  inProgress: 'FEF9C3',
  inProgressFont: '854D0E',
  pending: 'F1F5F9',
  pendingFont: '475569',
  onHold: 'FFE4E6',
  onHoldFont: '9F1239',
  delayed: 'FEE2E2',
  delayedFont: 'DC2626',
  issueBg: 'FFF7ED',
  issueFont: '9A3412',
};

function font(opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: FONT_NAME, size: 10, ...opts };
}

function fill(color: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function thinBorder(color = BASE.border): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: color } };
  return { top: side, bottom: side, left: side, right: side };
}

function colNumToLetter(col: number): string {
  let s = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function statusColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'completed': return { bg: BASE.completed, fg: BASE.completedFont };
    case 'in_progress': return { bg: BASE.inProgress, fg: BASE.inProgressFont };
    case 'on_hold': return { bg: BASE.onHold, fg: BASE.onHoldFont };
    default: return { bg: BASE.pending, fg: BASE.pendingFont };
  }
}

export interface ExportWeeklyReportOptions {
  /** 양식 고정용 템플릿 — 없으면 단일 시트(기존 동작)로 fallback */
  template?: WeeklyReportTemplate;
  /** WBS/개발현황 시트 생성에 사용되는 전체 task 트리 (flat) */
  allTasks?: Task[];
  /** 담당자 id → 이름 매핑 (WBS 시트용) */
  memberNameById?: Map<string, string>;
  /** 프로젝트 시작일 (S-curve 시계열 계산용) */
  projectStart?: string | null;
  /** 프로젝트 종료일 */
  projectEnd?: string | null;
  /** 과거 주간 스냅샷 (S-curve actual 보간용) */
  snapshots?: WeeklySnapshot[];
}

export async function exportWeeklyReportExcel(
  report: WeeklyReportData,
  options: ExportWeeklyReportOptions = {},
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DK Flow';
  wb.created = new Date();

  if (options.template) {
    const allTasks = options.allTasks || [];
    const memberNames = options.memberNameById || new Map<string, string>();

    // S-curve PNG 미리 생성 (차트는 WBS 시트 상단에 삽입)
    let chartPngImageId: number | null = null;
    try {
      const points = computeSCurve({
        tasks: allTasks,
        projectStart: options.projectStart,
        projectEnd: options.projectEnd,
        snapshots: options.snapshots,
      });
      if (points.length > 0) {
        const png = await renderSCurvePng({
          points,
          title: report.projectName,
          themeColor: options.template.themeColor,
        });
        if (png) {
          chartPngImageId = wb.addImage({ buffer: png as ArrayBuffer, extension: 'png' });
        }
      }
    } catch (err) {
      console.warn('S-curve chart rendering failed:', err);
    }

    writeProgressReportSheet(wb, report, options.template, allTasks, memberNames);
    writeWBSSheet(wb, report, options.template, allTasks, memberNames, chartPngImageId);
    writeDevStatusSheet(wb, report, options.template, allTasks, memberNames);
  } else {
    writeSingleSheetLegacy(wb, report);
  }

  const safeName = report.projectName
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'project';

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeName}_주간보고_${report.weekStart}.xlsx`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  시트 1 — 1.공정보고
// ═══════════════════════════════════════════════════════════════

function writeProgressReportSheet(
  wb: ExcelJS.Workbook,
  report: WeeklyReportData,
  tpl: WeeklyReportTemplate,
  allTasks: Task[],
  memberNames: Map<string, string>,
) {
  const ws = wb.addWorksheet(tpl.labels.reportSheet, {
    views: [{ state: 'normal', showGridLines: false }],
  });

  const THEME = tpl.themeColor;
  const THEME_LIGHT = lightenHex(THEME, 0.85);
  const THEME_SOFT = lightenHex(THEME, 0.93);
  const TOTAL_COLS = 12;

  // 12-col grid: 구분(2) 항목(2) 금주실적(5) 계획(1) 실적(1) 비고(1)
  const widths = [10, 12, 16, 16, 16, 16, 16, 7, 7, 10, 10, 8];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── 타이틀 ─────────────────────────────────────────────────
  ws.addRow([]).height = 6;
  const title = `${tpl.titlePrefix} ${report.weekLabel.split(' ').slice(0, 2).join(' ')} 공정보고`;
  const titleRow = ws.addRow([title]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, TOTAL_COLS);
  titleRow.height = 36;
  for (let c = 1; c <= TOTAL_COLS; c++) {
    const cell = titleRow.getCell(c);
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 18, color: { argb: BASE.titleFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(THEME);
  }

  // 메타 (기준주 / 생성일 / 프로젝트기간)
  const meta = ws.addRow(['기준주', report.weekLabel, '', '', '생성일', report.generatedAt, '', '', '프로젝트', report.projectName, '', '']);
  meta.height = 22;
  ws.mergeCells(meta.number, 2, meta.number, 4);
  ws.mergeCells(meta.number, 6, meta.number, 8);
  ws.mergeCells(meta.number, 10, meta.number, 12);
  meta.eachCell({ includeEmpty: true }, (cell, cn) => {
    const isLabel = cn === 1 || cn === 5 || cn === 9;
    cell.border = thinBorder(BASE.border);
    cell.alignment = { vertical: 'middle', horizontal: isLabel ? 'center' : 'left', indent: 1 };
    cell.font = font(isLabel ? { bold: true, size: 9, color: { argb: BASE.metaLabel } } : { size: 10 });
    cell.fill = fill(isLabel ? THEME_LIGHT : BASE.white);
  });

  ws.addRow([]).height = 8;

  // ── KPI 스트립 (대시보드 지표) ──────────────────────────────
  writeSectionTitle(ws, '▣ 핵심 지표', TOTAL_COLS, THEME);
  writeKpiStrip(ws, report, allTasks, TOTAL_COLS, THEME, THEME_SOFT);
  ws.addRow([]).height = 10;

  // ── 1) 공정 진도 현황 ───────────────────────────────────────
  writeSectionTitle(ws, tpl.labels.progressSection, TOTAL_COLS, THEME);

  const progHeaders = ['구분', '항목', '점유율(%)', '계획(%)', '실적(%)', '격차(%p)', '완료/전체', '지연', '비고', '', '', ''];
  const progHeaderRow = ws.addRow(progHeaders);
  ws.mergeCells(progHeaderRow.number, 9, progHeaderRow.number, 12);
  progHeaderRow.height = 26;
  progHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(THEME);
  });

  const phaseMap = new Map(report.phaseBreakdowns.map((p) => [p.phaseName, p]));

  tpl.progressCategories.forEach((cat, idx) => {
    const breakdown = phaseMap.get(cat.item);
    const plan = breakdown ? Math.round(breakdown.planProgress * 10) / 10 : 0;
    const actual = breakdown ? Math.round(breakdown.actualProgress * 10) / 10 : 0;
    const gap = Math.round((plan - actual) * 10) / 10;
    const progressBar = makeProgressBar(actual);
    const note = breakdown && breakdown.delayedTasks > 0 ? `지연 조치 필요` : breakdown && actual >= plan ? '정상' : '';

    const row = ws.addRow([
      cat.section,
      cat.item,
      cat.weight,
      plan,
      actual,
      gap,
      breakdown ? `${breakdown.completedTasks}/${breakdown.totalLeafTasks}` : '0/0',
      breakdown?.delayedTasks || 0,
      `${progressBar} ${actual}%`,
      '', '', '',
    ]);
    ws.mergeCells(row.number, 9, row.number, 12);
    row.height = 22;
    const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10 });
      cell.border = thinBorder(BASE.borderLight);
      cell.alignment = {
        vertical: 'middle',
        horizontal: cn === 1 || cn === 2 || cn === 9 ? 'left' : 'center',
        indent: cn === 1 || cn === 2 || cn === 9 ? 1 : 0,
      };
      if ([3, 4, 5].includes(cn)) cell.numFmt = '0.0';
      if (cn === 6) {
        cell.numFmt = '0.0;[Red]-0.0';
        if (gap > 5) cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
        else if (gap < 0) cell.font = font({ size: 10, bold: true, color: { argb: '166534' } });
      }
      if (cn === 8 && breakdown && breakdown.delayedTasks > 0) {
        cell.fill = fill(BASE.delayed);
        cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
      }
      if (cn === 9) cell.font = font({ name: 'Consolas', size: 9, color: { argb: BASE.metaValue } });
      if (cn === 9 && note) cell.note = note;
    });
  });

  // 합계
  const totalWeight = tpl.progressCategories.reduce((s, c) => s + c.weight, 0);
  const planTot = Math.round(report.summary.overallPlanProgress * 10) / 10;
  const actualTot = Math.round(report.summary.overallActualProgress * 10) / 10;
  const gapTot = Math.round((planTot - actualTot) * 10) / 10;
  const total = ws.addRow([
    '합계', '', totalWeight, planTot, actualTot, gapTot,
    `${report.summary.completedTasks}/${report.summary.totalLeafTasks}`,
    report.summary.delayedTasks,
    `${makeProgressBar(actualTot)} ${actualTot}%`,
    '', '', '',
  ]);
  ws.mergeCells(total.number, 1, total.number, 2);
  ws.mergeCells(total.number, 9, total.number, 12);
  total.height = 26;
  total.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fill(THEME_LIGHT);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.metaValue } });
    cell.border = thinBorder(THEME);
    cell.alignment = { vertical: 'middle', horizontal: cn === 9 ? 'left' : 'center', indent: cn === 9 ? 1 : 0 };
    if ([3, 4, 5].includes(cn)) cell.numFmt = '0.0';
    if (cn === 6) cell.numFmt = '0.0;[Red]-0.0';
    if (cn === 9) cell.font = font({ name: 'Consolas', bold: true, size: 9 });
  });

  ws.addRow([]).height = 10;

  // ── 2) 공정 실적 및 계획 (레퍼런스 2-col 레이아웃) ───────────
  writeSectionTitle(ws, tpl.labels.planSection, TOTAL_COLS, THEME);
  writePhaseActualPlanTable(ws, report, tpl, allTasks, memberNames, THEME, THEME_LIGHT);
  ws.addRow([]).height = 10;

  // ── 3) 마일스톤 타임라인 ────────────────────────────────────
  if (report.milestones.length > 0) {
    writeSectionTitle(ws, '3) 마일스톤 타임라인', TOTAL_COLS, THEME);
    const mHeader = ws.addRow(['레벨', '마일스톤', '', '', '계획종료', '진척', 'D-day', '상태', '비고', '', '', '']);
    ws.mergeCells(mHeader.number, 2, mHeader.number, 4);
    ws.mergeCells(mHeader.number, 9, mHeader.number, 12);
    mHeader.height = 24;
    mHeader.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(THEME);
      cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder(THEME);
    });
    report.milestones.slice(0, 12).forEach((ms, idx) => {
      const dDayLabel = ms.daysUntil < 0 ? `${Math.abs(ms.daysUntil)}일 경과` : ms.daysUntil === 0 ? 'D-Day' : `D-${ms.daysUntil}`;
      const row = ws.addRow([
        ms.levelLabel, ms.taskName, '', '', ms.planEnd,
        `${makeProgressBar(ms.actualProgress)} ${Math.round(ms.actualProgress)}%`,
        dDayLabel, ms.statusLabel, '', '', '', '',
      ]);
      ws.mergeCells(row.number, 2, row.number, 4);
      ws.mergeCells(row.number, 9, row.number, 12);
      row.height = 22;
      const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = fill(bg);
        cell.font = font({ size: 10 });
        cell.border = thinBorder(BASE.borderLight);
        cell.alignment = { vertical: 'middle', horizontal: cn === 2 || cn === 9 ? 'left' : 'center', indent: cn === 2 || cn === 9 ? 1 : 0 };
        if (cn === 6) cell.font = font({ name: 'Consolas', size: 9 });
        if (cn === 7) {
          if (ms.daysUntil < 0) { cell.fill = fill(BASE.delayed); cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } }); }
          else if (ms.daysUntil <= 3) { cell.fill = fill(BASE.inProgress); cell.font = font({ size: 10, bold: true, color: { argb: BASE.inProgressFont } }); }
        }
        if (cn === 8) {
          const sc = statusColors(ms.status);
          cell.fill = fill(sc.bg);
          cell.font = font({ size: 10, bold: true, color: { argb: sc.fg } });
        }
      });
    });
    ws.addRow([]).height = 10;
  }

  // ── 4) 담당자별 작업 현황 ───────────────────────────────────
  if (report.workloadHeatmap.length > 0) {
    writeSectionTitle(ws, '4) 담당자별 워크로드', TOTAL_COLS, THEME);
    const wHeader = ws.addRow(['#', '담당자', '월', '화', '수', '목', '금', '합계', '비고', '', '', '']);
    ws.mergeCells(wHeader.number, 9, wHeader.number, 12);
    wHeader.height = 24;
    wHeader.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(THEME);
      cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder(THEME);
    });
    report.workloadHeatmap.forEach((entry, idx) => {
      const [mon, tue, wed, thu, fri] = entry.dailyLoad;
      const loadLevel = entry.totalLoad >= 15 ? '과부하' : entry.totalLoad >= 8 ? '보통' : '여유';
      const row = ws.addRow([idx + 1, entry.memberName, mon, tue, wed, thu, fri, entry.totalLoad, loadLevel, '', '', '']);
      ws.mergeCells(row.number, 9, row.number, 12);
      row.height = 22;
      const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = fill(bg);
        cell.font = font({ size: 10 });
        cell.border = thinBorder(BASE.borderLight);
        cell.alignment = { vertical: 'middle', horizontal: cn === 2 || cn === 9 ? 'left' : 'center', indent: cn === 2 || cn === 9 ? 1 : 0 };
        if (cn >= 3 && cn <= 7) {
          const val = row.getCell(cn).value as number;
          if (val > 0) {
            const intensity = Math.min(1, val / 5);
            const shade = lightenHex(THEME, 1 - intensity * 0.5);
            cell.fill = fill(shade);
            cell.font = font({ size: 10, bold: true, color: { argb: BASE.metaValue } });
          }
        }
        if (cn === 8) cell.font = font({ size: 10, bold: true });
        if (cn === 9) {
          if (loadLevel === '과부하') { cell.fill = fill(BASE.delayed); cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } }); }
          else if (loadLevel === '보통') { cell.fill = fill(BASE.inProgress); cell.font = font({ size: 10, bold: true, color: { argb: BASE.inProgressFont } }); }
          else { cell.fill = fill(BASE.completed); cell.font = font({ size: 10, bold: true, color: { argb: BASE.completedFont } }); }
        }
      });
    });
    ws.addRow([]).height = 10;
  }

  // ── 5) 이슈 / 리스크 ────────────────────────────────────────
  if (report.gradedIssues.length > 0) {
    writeSectionTitle(ws, '5) 이슈 / 리스크', TOTAL_COLS, THEME);
    const issueHeader = ws.addRow(['#', '등급', '내용', '', '', '', '', '대응방안', '', '', '', '']);
    ws.mergeCells(issueHeader.number, 3, issueHeader.number, 7);
    ws.mergeCells(issueHeader.number, 8, issueHeader.number, 12);
    issueHeader.height = 24;
    issueHeader.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(THEME);
      cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder(THEME);
    });
    report.gradedIssues.forEach((issue, idx) => {
      const sevLabel = issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '중간' : '낮음';
      const row = ws.addRow([idx + 1, sevLabel, issue.message, '', '', '', '', issue.response || '(미작성)', '', '', '', '']);
      ws.mergeCells(row.number, 3, row.number, 7);
      ws.mergeCells(row.number, 8, row.number, 12);
      row.height = 26;
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = fill(cn === 2 ? (issue.severity === 'high' ? BASE.delayed : BASE.issueBg) : BASE.white);
        cell.font = font({
          size: 10,
          bold: cn === 2,
          color: {
            argb: cn === 2 && issue.severity === 'high' ? BASE.delayedFont : cn === 2 ? BASE.issueFont : BASE.metaValue,
          },
        });
        cell.alignment = {
          vertical: 'middle',
          horizontal: cn === 1 || cn === 2 ? 'center' : 'left',
          wrapText: cn === 3 || cn === 8,
          indent: cn === 3 || cn === 8 ? 1 : 0,
        };
        cell.border = thinBorder(BASE.border);
      });
    });
    ws.addRow([]).height = 10;
  }

  // ── 6) 근태현황 (출근 제외) ─────────────────────────────────
  if (report.attendanceSummary && report.attendanceSummary.length > 0) {
    const filtered = filterOutPresent(report.attendanceSummary);
    if (filtered.length > 0) {
      writeSectionTitle(ws, '6) 금주 근태현황 (휴가·출장 등 비출근)', TOTAL_COLS, THEME);
      writeAttendanceTable(ws, filtered, TOTAL_COLS, THEME);
      ws.addRow([]).height = 10;
    }
  }
  if (report.nextWeekAttendanceSummary && report.nextWeekAttendanceSummary.length > 0) {
    const filtered = filterOutPresent(report.nextWeekAttendanceSummary);
    if (filtered.length > 0) {
      writeSectionTitle(ws, '7) 차주 근태현황 (휴가·출장 등 비출근)', TOTAL_COLS, THEME);
      writeAttendanceTable(ws, filtered, TOTAL_COLS, THEME);
      ws.addRow([]).height = 10;
    }
  }

  // ── 8) 담당자 작성 ─────────────────────────────────────────
  if (report.memberReports && report.memberReports.length > 0) {
    writeSectionTitle(ws, '8) 담당자 작성', TOTAL_COLS, THEME);
    const h = ws.addRow(['담당자', '금주 실적', '', '', '', '', '차주 계획', '', '', '', '', '']);
    ws.mergeCells(h.number, 2, h.number, 6);
    ws.mergeCells(h.number, 7, h.number, 12);
    h.height = 24;
    h.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(THEME);
      cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder(THEME);
    });
    report.memberReports.forEach((entry, idx) => {
      const row = ws.addRow([entry.memberName, entry.thisWeekResult || '-', '', '', '', '', entry.nextWeekPlan || '-', '', '', '', '', '']);
      ws.mergeCells(row.number, 2, row.number, 6);
      ws.mergeCells(row.number, 7, row.number, 12);
      const lines = Math.max(
        (entry.thisWeekResult || '-').split('\n').length,
        (entry.nextWeekPlan || '-').split('\n').length,
      );
      row.height = Math.max(40, Math.min(200, lines * 16));
      const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = fill(bg);
        cell.font = font({ size: 10 });
        cell.alignment = { vertical: 'top', horizontal: cn === 1 ? 'center' : 'left', wrapText: true, indent: cn === 1 ? 0 : 1 };
        cell.border = thinBorder(BASE.border);
      });
    });
  }
}

// ─── 공정보고 보조 함수들 ──────────────────────────────────

function writeKpiStrip(
  ws: ExcelJS.Worksheet,
  report: WeeklyReportData,
  allTasks: Task[],
  totalCols: number,
  theme: string,
  softBg: string,
) {
  const s = report.summary;
  const completion = s.totalLeafTasks > 0 ? Math.round((s.completedTasks / s.totalLeafTasks) * 100) : 0;
  const delayRate = s.totalLeafTasks > 0 ? Math.round((s.delayedTasks / s.totalLeafTasks) * 100) : 0;
  const gap = Math.round((s.overallPlanProgress - s.overallActualProgress) * 10) / 10;
  const pending = s.totalLeafTasks - s.completedTasks - s.inProgressTasks;

  // Phase count
  const phases = allTasks.filter((t) => t.level === 1);

  const kpis: Array<{ label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' | 'info' }> = [
    { label: '프로젝트 진척', value: `${Math.round(s.overallActualProgress)}%`, sub: `계획 ${Math.round(s.overallPlanProgress)}%`, tone: gap > 10 ? 'bad' : gap > 5 ? 'warn' : 'good' },
    { label: '계획-실적 격차', value: `${gap >= 0 ? '-' : '+'}${Math.abs(gap)}%p`, sub: gap > 0 ? '지연' : '정상', tone: gap > 10 ? 'bad' : gap > 0 ? 'warn' : 'good' },
    { label: '전체 작업', value: `${s.totalLeafTasks}`, sub: `${phases.length}개 Phase`, tone: 'info' },
    { label: '완료', value: `${s.completedTasks}`, sub: `${completion}%`, tone: 'good' },
    { label: '진행중', value: `${s.inProgressTasks}`, sub: `${Math.round((s.inProgressTasks / Math.max(1, s.totalLeafTasks)) * 100)}%`, tone: 'info' },
    { label: '대기', value: `${pending}`, sub: '미착수', tone: 'info' },
    { label: '지연', value: `${s.delayedTasks}`, sub: `${delayRate}%`, tone: s.delayedTasks > 0 ? 'bad' : 'good' },
    { label: '금주 완료', value: `${report.completedThisWeek.tasks.length}`, sub: `신규 ${report.completedVsNew.newlyAddedCount}`, tone: 'good' },
  ];

  // 8개를 12 col에 배치 (각 1.5col)
  const colSpan = Math.floor(totalCols / kpis.length) || 1;
  const labelRow = ws.addRow(Array(totalCols).fill(''));
  const valueRow = ws.addRow(Array(totalCols).fill(''));
  const subRow = ws.addRow(Array(totalCols).fill(''));
  labelRow.height = 18;
  valueRow.height = 32;
  subRow.height = 18;

  kpis.forEach((k, i) => {
    const startCol = i * colSpan + 1;
    const endCol = i === kpis.length - 1 ? totalCols : (i + 1) * colSpan;

    ws.mergeCells(labelRow.number, startCol, labelRow.number, endCol);
    ws.mergeCells(valueRow.number, startCol, valueRow.number, endCol);
    ws.mergeCells(subRow.number, startCol, subRow.number, endCol);

    const toneFg = k.tone === 'bad' ? BASE.delayedFont
      : k.tone === 'warn' ? BASE.inProgressFont
      : k.tone === 'good' ? BASE.completedFont
      : BASE.metaValue;
    const toneBg = k.tone === 'bad' ? BASE.delayed
      : k.tone === 'warn' ? BASE.inProgress
      : k.tone === 'good' ? BASE.completed
      : softBg;

    const lc = labelRow.getCell(startCol);
    lc.value = k.label;
    lc.fill = fill(toneBg);
    lc.font = font({ size: 9, bold: true, color: { argb: BASE.metaLabel } });
    lc.alignment = { vertical: 'middle', horizontal: 'center' };
    lc.border = { top: { style: 'thin', color: { argb: theme } }, left: { style: 'thin', color: { argb: theme } }, right: { style: 'thin', color: { argb: theme } } };

    const vc = valueRow.getCell(startCol);
    vc.value = k.value;
    vc.fill = fill(toneBg);
    vc.font = font({ size: 20, bold: true, color: { argb: toneFg } });
    vc.alignment = { vertical: 'middle', horizontal: 'center' };
    vc.border = { left: { style: 'thin', color: { argb: theme } }, right: { style: 'thin', color: { argb: theme } } };

    const sc = subRow.getCell(startCol);
    sc.value = k.sub || '';
    sc.fill = fill(toneBg);
    sc.font = font({ size: 9, color: { argb: toneFg } });
    sc.alignment = { vertical: 'middle', horizontal: 'center' };
    sc.border = { bottom: { style: 'thin', color: { argb: theme } }, left: { style: 'thin', color: { argb: theme } }, right: { style: 'thin', color: { argb: theme } } };
  });
}

function writePhaseActualPlanTable(
  ws: ExcelJS.Worksheet,
  report: WeeklyReportData,
  _tpl: WeeklyReportTemplate,
  allTasks: Task[],
  memberNames: Map<string, string>,
  theme: string,
  themeLight: string,
) {
  // 헤더: 구분(1-2) | 항목(3-4) | 금주실적(5-7) | 계획(%)(8) | 실적(%)(9) | 차주계획(10-11) | 계획(%)(12)
  const h1 = ws.addRow(['구분', '', '항목', '', '금주 실적', '', '', '계획', '실적', '차주 계획', '', '계획']);
  ws.mergeCells(h1.number, 1, h1.number, 2);
  ws.mergeCells(h1.number, 3, h1.number, 4);
  ws.mergeCells(h1.number, 5, h1.number, 7);
  ws.mergeCells(h1.number, 10, h1.number, 11);
  h1.height = 26;
  h1.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(theme);
    cell.font = font({ bold: true, size: 11, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(theme);
  });

  // Phase별 분류: phase -> { thisWeek: Task[], nextWeek: Task[] }
  const phases = allTasks.filter((t) => t.level === 1).sort((a, b) => a.orderIndex - b.orderIndex);
  const phaseMap = new Map(report.phaseBreakdowns.map((p) => [p.phaseId, p]));

  const thisWeekTasksByPhase = groupTasksByPhase(report.thisWeekActual.tasks, allTasks);
  const nextWeekTasksByPhase = groupTasksByPhase(report.nextWeekPlan.tasks, allTasks);
  const delayedByPhase = groupTasksByPhase(report.delayed.tasks, allTasks);
  const completedByPhase = groupTasksByPhase(report.completedThisWeek.tasks, allTasks);

  if (phases.length === 0) {
    const empty = ws.addRow(['Phase가 없습니다.']);
    ws.mergeCells(empty.number, 1, empty.number, 12);
    empty.height = 30;
    empty.getCell(1).font = font({ size: 10, italic: true, color: { argb: BASE.metaLabel } });
    empty.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    return;
  }

  phases.forEach((phase, idx) => {
    const bd = phaseMap.get(phase.id);
    const plan = bd ? Math.round(bd.planProgress * 10) / 10 : 0;
    const actual = bd ? Math.round(bd.actualProgress * 10) / 10 : 0;

    const thisWeekList = [
      ...(thisWeekTasksByPhase.get(phase.id) || []).map((t) => bulletTask('▸', t, allTasks, memberNames)),
      ...(completedByPhase.get(phase.id) || []).map((t) => bulletTask('✓', t, allTasks, memberNames)),
    ];
    const nextWeekList = [
      ...(nextWeekTasksByPhase.get(phase.id) || []).map((t) => bulletTask('▸', t, allTasks, memberNames)),
      ...(delayedByPhase.get(phase.id) || []).map((t) => bulletTask('!', t, allTasks, memberNames)),
    ];
    const thisText = thisWeekList.length > 0 ? thisWeekList.join('\n') : '(해당 없음)';
    const nextText = nextWeekList.length > 0 ? nextWeekList.join('\n') : '(해당 없음)';

    const row = ws.addRow([
      phase.name, '',
      phase.name, '',
      thisText, '', '',
      plan, actual,
      nextText, '',
      plan, // 차주 계획 %는 동일 (계획대비 누적)
    ]);
    ws.mergeCells(row.number, 1, row.number, 2);
    ws.mergeCells(row.number, 3, row.number, 4);
    ws.mergeCells(row.number, 5, row.number, 7);
    ws.mergeCells(row.number, 10, row.number, 11);

    const lines = Math.max(thisText.split('\n').length, nextText.split('\n').length);
    row.height = Math.max(60, Math.min(360, lines * 15));
    const bg = idx % 2 === 0 ? BASE.rowEven : themeLight;

    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 9 });
      cell.border = thinBorder(BASE.border);
      if (cn === 1 || cn === 3) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.font = font({ size: 10, bold: true });
      } else if (cn === 5 || cn === 10) {
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (cn === 8 || cn === 9 || cn === 12) {
        cell.numFmt = '0.0"%"';
        cell.font = font({ size: 10, bold: true, color: { argb: cn === 9 && actual < plan - 5 ? BASE.delayedFont : BASE.metaValue } });
      }
    });
  });
}

function groupTasksByPhase(tasks: WeeklyReportTask[], allTasks: Task[]): Map<string, WeeklyReportTask[]> {
  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const findPhaseId = (id: string): string | null => {
    let cur = taskById.get(id);
    while (cur) {
      if (cur.level === 1) return cur.id;
      if (!cur.parentId) return null;
      cur = taskById.get(cur.parentId);
    }
    return null;
  };
  const out = new Map<string, WeeklyReportTask[]>();
  for (const wt of tasks) {
    const phaseId = findPhaseId(wt.id);
    if (!phaseId) continue;
    const arr = out.get(phaseId) || [];
    arr.push(wt);
    out.set(phaseId, arr);
  }
  return out;
}

function bulletTask(prefix: string, t: WeeklyReportTask, allTasks: Task[], _memberNames: Map<string, string>): string {
  const taskById = new Map(allTasks.map((x) => [x.id, x]));
  const task = taskById.get(t.id);
  // Activity(level 2) 이름을 함께 표시
  let activityName = '';
  if (task && task.parentId) {
    const parent = taskById.get(task.parentId);
    if (parent && parent.level === 2) activityName = parent.name;
  }
  const prefixLabel = activityName ? `[${activityName}] ` : '';
  const assigneeLabel = t.assigneeName && t.assigneeName !== '미지정' ? ` (${t.assigneeName})` : '';
  return `  ${prefix} ${prefixLabel}${t.name}${assigneeLabel}`;
}

function makeProgressBar(percent: number, width = 12): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// ═══════════════════════════════════════════════════════════════
//  시트 2 — 2.WBS
// ═══════════════════════════════════════════════════════════════

function writeWBSSheet(
  wb: ExcelJS.Workbook,
  report: WeeklyReportData,
  tpl: WeeklyReportTemplate,
  allTasks: Task[],
  memberNames: Map<string, string>,
  chartImageId: number | null,
) {
  const ws = wb.addWorksheet(tpl.labels.wbsSheet, {
    views: [{ state: 'frozen', ySplit: 4, xSplit: 3 }],
  });

  const THEME = tpl.themeColor;
  const THEME_LIGHT = lightenHex(THEME, 0.82);
  const THEME_SOFT = lightenHex(THEME, 0.92);
  const headers = [
    'No', 'Lv', '작업명', '산출물', '담당자',
    '가중치', '계획시작', '계획종료', '계획(%)',
    '실적시작', '실적종료', '실적(%)', '격차(%p)',
    '지연일', '선행작업', '상태',
  ];
  const widths = [5, 6, 42, 20, 12, 8, 12, 12, 8, 12, 12, 8, 9, 8, 18, 10];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // 타이틀
  const titleRow = ws.addRow([`${tpl.titlePrefix} WBS`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
  titleRow.height = 32;
  titleRow.getCell(1).fill = fill(THEME);
  titleRow.getCell(1).font = font({ bold: true, size: 15, color: { argb: BASE.titleFont } });
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= headers.length; c++) {
    titleRow.getCell(c).fill = fill(THEME);
    titleRow.getCell(c).border = thinBorder(THEME);
  }

  // S-curve 차트 영역 (차트 이미지를 상단에 배치)
  if (chartImageId !== null) {
    const chartStartRow = titleRow.number + 1; // 1-based
    for (let i = 0; i < 14; i++) ws.addRow([]).height = 20;
    const endCol = colNumToLetter(headers.length);
    ws.addImage(chartImageId, `A${chartStartRow}:${endCol}${chartStartRow + 13}`);
  }

  // 메타
  const meta = ws.addRow([
    `기준주 ${report.weekLabel}`, '', '', '', '', '',
    `전체 ${report.summary.totalLeafTasks} · 완료 ${report.summary.completedTasks} · 진행중 ${report.summary.inProgressTasks} · 지연 ${report.summary.delayedTasks}`,
    '', '', '', '', '', '', '', '', `생성 ${report.generatedAt}`,
  ]);
  ws.mergeCells(meta.number, 1, meta.number, 6);
  ws.mergeCells(meta.number, 7, meta.number, 15);
  meta.height = 22;
  meta.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fill(THEME_LIGHT);
    cell.font = font({ size: 9, color: { argb: BASE.metaValue } });
    cell.alignment = { vertical: 'middle', horizontal: cn === 7 ? 'center' : cn === headers.length ? 'right' : 'left', indent: 1 };
    cell.border = thinBorder(THEME_LIGHT);
    if (cn === 7) cell.font = font({ size: 9, bold: true, color: { argb: BASE.metaValue } });
  });

  // 헤더
  const headerRow = ws.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(THEME);
  });

  const ordered = buildOrderedTasks(allTasks);
  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const now = new Date();
  const nowStr = format(now, 'yyyy-MM-dd');

  ordered.forEach((t, idx) => {
    const assignee = t.assigneeId ? memberNames.get(t.assigneeId) || '-' : '-';
    const planP = Math.round(t.planProgress);
    const actualP = Math.round(t.actualProgress);
    const gap = planP - actualP;

    const isDelayed = !!t.planEnd && t.planEnd < nowStr && t.status !== 'completed' && actualP < 100;
    const delayDays = isDelayed && t.planEnd ? differenceInCalendarDays(now, new Date(t.planEnd)) : 0;

    const predNames = (t.predecessorIds || [])
      .map((pid) => taskById.get(pid)?.name)
      .filter((n): n is string => !!n)
      .join(', ');

    const row = ws.addRow([
      idx + 1,
      LEVEL_LABELS[t.level] || `L${t.level}`,
      `${'  '.repeat(Math.max(0, t.level - 1))}${t.name}`,
      t.output || '',
      assignee,
      t.weight || 0,
      t.planStart || '',
      t.planEnd || '',
      planP,
      t.actualStart || '',
      t.actualEnd || '',
      actualP,
      gap,
      delayDays > 0 ? delayDays : '',
      predNames || '',
      TASK_STATUS_LABELS[t.status] || t.status,
    ]);
    row.height = 22;

    const level = t.level;
    const isPhase = level === 1;
    const isActivity = level === 2;
    const bg = isPhase ? THEME_LIGHT
      : isActivity ? THEME_SOFT
      : (idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd);

    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10, bold: isPhase || isActivity });
      cell.border = thinBorder(BASE.borderLight);
      cell.alignment = {
        vertical: 'middle',
        horizontal: cn === 3 || cn === 4 || cn === 15 ? 'left' : 'center',
        indent: cn === 3 ? 0 : 0,
        wrapText: cn === 3 || cn === 15,
      };
      if (cn === 9 || cn === 12) cell.numFmt = '0"%"';
      if (cn === 13) {
        cell.numFmt = '0;[Red]-0';
        if (gap > 10) cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
        else if (gap < -5) cell.font = font({ size: 10, bold: true, color: { argb: '166534' } });
      }
      if (cn === 14 && delayDays > 0) {
        cell.fill = fill(BASE.delayed);
        cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
      }
      if (cn === 16) {
        const sc = statusColors(t.status);
        if (!isPhase && !isActivity) {
          cell.fill = fill(sc.bg);
          cell.font = font({ size: 10, bold: true, color: { argb: sc.fg } });
        }
      }
    });
  });

  // 요약 바닥글
  ws.addRow([]).height = 6;
  const summaryRow = ws.addRow([
    '합계', '', '', '', '',
    allTasks.reduce((s, t) => s + (t.level === 1 ? (t.weight || 0) : 0), 0),
    '', '',
    Math.round(report.summary.overallPlanProgress),
    '', '',
    Math.round(report.summary.overallActualProgress),
    Math.round((report.summary.overallPlanProgress - report.summary.overallActualProgress) * 10) / 10,
    '', '', '',
  ]);
  ws.mergeCells(summaryRow.number, 1, summaryRow.number, 5);
  summaryRow.height = 28;
  summaryRow.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fill(THEME_LIGHT);
    cell.font = font({ bold: true, size: 11, color: { argb: BASE.metaValue } });
    cell.border = thinBorder(THEME);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    if (cn === 9 || cn === 12) cell.numFmt = '0"%"';
    if (cn === 13) cell.numFmt = '0.0;[Red]-0.0';
  });
}

// ═══════════════════════════════════════════════════════════════
//  시트 3 — 3.프로그램개발현황 (To-do)
// ═══════════════════════════════════════════════════════════════

function writeDevStatusSheet(
  wb: ExcelJS.Workbook,
  report: WeeklyReportData,
  tpl: WeeklyReportTemplate,
  allTasks: Task[],
  memberNames: Map<string, string>,
) {
  const ws = wb.addWorksheet(tpl.labels.devSheet, {
    views: [{ state: 'frozen', ySplit: 5, xSplit: 3 }],
  });

  const THEME = tpl.themeColor;
  const THEME_LIGHT = lightenHex(THEME, 0.82);
  const THEME_SOFT = lightenHex(THEME, 0.93);
  const headers = [
    'No', 'Phase', 'Activity', '작업명', '산출물',
    '담당자', '가중치',
    '계획시작', '계획종료', '계획(%)',
    '실적시작', '실적(%)',
    '지연일', '상태', '비고',
  ];
  const widths = [5, 18, 22, 32, 18, 12, 8, 12, 12, 9, 12, 9, 8, 10, 22];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // 타이틀
  const titleRow = ws.addRow([`${tpl.titlePrefix} 프로그램 개발현황`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
  titleRow.height = 32;
  titleRow.getCell(1).fill = fill(THEME);
  titleRow.getCell(1).font = font({ bold: true, size: 15, color: { argb: BASE.titleFont } });
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= headers.length; c++) {
    titleRow.getCell(c).fill = fill(THEME);
    titleRow.getCell(c).border = thinBorder(THEME);
  }

  // ── 상태별 요약 스트립 ──
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const childrenCount = new Map<string, number>();
  for (const t of allTasks) {
    if (t.parentId) childrenCount.set(t.parentId, (childrenCount.get(t.parentId) || 0) + 1);
  }
  const leafs = allTasks.filter((t) => (childrenCount.get(t.id) || 0) === 0);
  const todos = leafs.filter((t) => t.status !== 'completed');
  const inProgCount = todos.filter((t) => t.status === 'in_progress').length;
  const pendingCount = todos.filter((t) => t.status === 'pending').length;
  const holdCount = todos.filter((t) => t.status === 'on_hold').length;
  const nowDate = new Date();
  const nowStr = format(nowDate, 'yyyy-MM-dd');
  const delayedCount = todos.filter((t) => !!t.planEnd && t.planEnd < nowStr && t.actualProgress < 100).length;
  const completedCount = leafs.length - todos.length;

  const summary = ws.addRow([
    `전체 ${leafs.length}`,
    '', '',
    `진행중 ${inProgCount}`, `대기 ${pendingCount}`,
    `보류 ${holdCount}`, `지연 ${delayedCount}`,
    `완료 ${completedCount}`,
    '', '', '', '', '', '',
    `생성 ${report.generatedAt}`,
  ]);
  ws.mergeCells(summary.number, 1, summary.number, 3);
  ws.mergeCells(summary.number, 9, summary.number, 14);
  summary.height = 24;
  summary.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fill(THEME_LIGHT);
    cell.border = thinBorder(THEME_LIGHT);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.font = font({ size: 10, bold: true, color: { argb: BASE.metaValue } });
    if (cn === 7 && delayedCount > 0) cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
    if (cn === 8) cell.font = font({ size: 10, bold: true, color: { argb: BASE.completedFont } });
    if (cn === 15) cell.font = font({ size: 9, color: { argb: BASE.metaLabel } });
  });

  // ── 담당자별 미완료 요약 ──
  const byAssignee = new Map<string, { total: number; delayed: number; avgProgress: number; _progSum: number }>();
  for (const t of todos) {
    const name = t.assigneeId ? memberNames.get(t.assigneeId) || '미지정' : '미지정';
    const entry = byAssignee.get(name) || { total: 0, delayed: 0, avgProgress: 0, _progSum: 0 };
    entry.total += 1;
    entry._progSum += t.actualProgress;
    if (!!t.planEnd && t.planEnd < nowStr && t.actualProgress < 100) entry.delayed += 1;
    byAssignee.set(name, entry);
  }
  for (const v of byAssignee.values()) v.avgProgress = v.total > 0 ? Math.round(v._progSum / v.total) : 0;

  const assigneeSummary = Array.from(byAssignee.entries())
    .map(([name, v]) => `${name}: ${v.total}건(지연${v.delayed}, 평균${v.avgProgress}%)`)
    .join(' · ');

  const asgRow = ws.addRow([`▣ 담당자별 미완료: ${assigneeSummary || '—'}`]);
  ws.mergeCells(asgRow.number, 1, asgRow.number, headers.length);
  asgRow.height = 22;
  asgRow.getCell(1).fill = fill(THEME_SOFT);
  asgRow.getCell(1).font = font({ size: 9, color: { argb: BASE.metaValue } });
  asgRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 1; c <= headers.length; c++) {
    asgRow.getCell(c).fill = fill(THEME_SOFT);
    asgRow.getCell(c).border = thinBorder(THEME_SOFT);
  }

  // ── 헤더 ──
  const headerRow = ws.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(THEME);
  });

  // 정렬: 지연 → 진행중 → 대기 → 보류, 각 그룹 내 planEnd 오름차순
  const statusOrder: Record<string, number> = { in_progress: 1, pending: 2, on_hold: 3 };
  const sortedTodos = [...todos].sort((a, b) => {
    const aDelayed = !!a.planEnd && a.planEnd < nowStr && a.actualProgress < 100;
    const bDelayed = !!b.planEnd && b.planEnd < nowStr && b.actualProgress < 100;
    if (aDelayed !== bDelayed) return aDelayed ? -1 : 1;
    const so = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
    if (so !== 0) return so;
    return (a.planEnd || '9999-12-31').localeCompare(b.planEnd || '9999-12-31');
  });

  sortedTodos.forEach((t, idx) => {
    const activity = t.parentId ? taskMap.get(t.parentId) : null;
    const phase = activity?.parentId ? taskMap.get(activity.parentId) : activity?.level === 1 ? activity : null;
    const phaseName = phase?.name || (activity?.level === 1 ? activity.name : '-');
    const activityName = activity && activity.level === 2 ? activity.name : '-';
    const assignee = t.assigneeId ? memberNames.get(t.assigneeId) || '-' : '미지정';
    const isDelayed = !!t.planEnd && t.planEnd < nowStr && t.actualProgress < 100;
    const delayDays = isDelayed && t.planEnd ? differenceInCalendarDays(nowDate, new Date(t.planEnd)) : 0;

    const note = isDelayed
      ? `⚠ 계획종료 ${delayDays}일 경과`
      : (t.output || (t.planEnd && t.planEnd <= format(new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 7), 'yyyy-MM-dd') ? '금주~차주 마감' : ''));

    const row = ws.addRow([
      idx + 1,
      phaseName,
      activityName,
      t.name,
      t.output || '',
      assignee,
      t.weight || 0,
      t.planStart || '',
      t.planEnd || '',
      Math.round(t.planProgress),
      t.actualStart || '',
      Math.round(t.actualProgress),
      delayDays > 0 ? delayDays : '',
      TASK_STATUS_LABELS[t.status] || t.status,
      note,
    ]);
    row.height = 22;
    const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10 });
      cell.border = thinBorder(BASE.borderLight);
      cell.alignment = {
        vertical: 'middle',
        horizontal: cn === 4 || cn === 5 || cn === 15 || cn === 2 || cn === 3 ? 'left' : 'center',
        wrapText: cn === 4 || cn === 5 || cn === 15,
        indent: cn === 4 || cn === 15 ? 1 : 0,
      };
      if (cn === 10 || cn === 12) cell.numFmt = '0"%"';
      if (cn === 13 && delayDays > 0) {
        cell.fill = fill(BASE.delayed);
        cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
      }
      if (cn === 14) {
        const sc = statusColors(t.status);
        cell.fill = fill(sc.bg);
        cell.font = font({ size: 10, bold: true, color: { argb: sc.fg } });
      }
      if (cn === 15 && isDelayed) {
        cell.fill = fill(BASE.delayed);
        cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
      }
    });
  });

  if (sortedTodos.length === 0) {
    const empty = ws.addRow(['모든 작업이 완료되었습니다.']);
    ws.mergeCells(empty.number, 1, empty.number, headers.length);
    empty.height = 36;
    empty.getCell(1).fill = fill(BASE.white);
    empty.getCell(1).font = font({ size: 11, italic: true, color: { argb: BASE.metaLabel } });
    empty.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  }
}

// ═══════════════════════════════════════════════════════════════
//  공통 헬퍼
// ═══════════════════════════════════════════════════════════════

function writeSectionTitle(ws: ExcelJS.Worksheet, label: string, totalCols: number, theme: string) {
  const row = ws.addRow([label]);
  ws.mergeCells(row.number, 1, row.number, totalCols);
  row.height = 26;
  row.getCell(1).fill = fill(theme);
  row.getCell(1).font = font({ bold: true, size: 11, color: { argb: BASE.headerFont } });
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 1; c <= totalCols; c++) {
    row.getCell(c).fill = fill(theme);
    row.getCell(c).border = thinBorder(theme);
  }
}

function filterOutPresent(summary: WeeklyAttendanceSummary[]): WeeklyAttendanceSummary[] {
  return summary
    .map((s) => ({
      ...s,
      records: s.records.filter((r) => r.type !== 'present'),
      stats: Object.fromEntries(Object.entries(s.stats).filter(([k]) => k !== '출근')),
    }))
    .filter((s) => s.records.length > 0);
}

function writeAttendanceTable(
  ws: ExcelJS.Worksheet,
  summary: WeeklyAttendanceSummary[],
  totalCols: number,
  theme: string,
) {
  const pad: string[] = Array(Math.max(0, totalCols - 7)).fill('');
  const headerRow = ws.addRow(['담당자', '월', '화', '수', '목', '금', '사유', ...pad]);
  if (totalCols > 7) ws.mergeCells(headerRow.number, 7, headerRow.number, totalCols);
  headerRow.height = 24;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(theme);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(theme);
  });

  summary.forEach((member, idx) => {
    const byDay = new Map<number, string>();
    const byColor = new Map<number, string>();
    for (const r of member.records) {
      const dow = new Date(r.date).getDay();
      if (dow >= 1 && dow <= 5) {
        byDay.set(dow, r.typeLabel);
        byColor.set(dow, ATTENDANCE_TYPE_COLORS[r.type]?.replace('#', '') || '000000');
      }
    }
    const stats = Object.entries(member.stats).map(([k, v]) => `${k}${v}`).join(' · ');
    const row = ws.addRow([
      member.memberName,
      byDay.get(1) || '',
      byDay.get(2) || '',
      byDay.get(3) || '',
      byDay.get(4) || '',
      byDay.get(5) || '',
      stats,
      ...pad,
    ]);
    if (totalCols > 7) ws.mergeCells(row.number, 7, row.number, totalCols);
    row.height = 22;
    const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10 });
      cell.alignment = { vertical: 'middle', horizontal: cn === 1 || cn === 7 ? 'left' : 'center', indent: cn === 1 || cn === 7 ? 1 : 0 };
      cell.border = thinBorder(BASE.borderLight);
      if (cn >= 2 && cn <= 6) {
        const c = byColor.get(cn - 1);
        if (c) cell.font = font({ size: 10, bold: true, color: { argb: c } });
      }
    });
  });
}

function buildOrderedTasks(allTasks: Task[]): Task[] {
  const byParent = new Map<string | null, Task[]>();
  for (const t of allTasks) {
    const key = t.parentId || null;
    const arr = byParent.get(key) || [];
    arr.push(t);
    byParent.set(key, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.orderIndex - b.orderIndex);
  const out: Task[] = [];
  const walk = (parentId: string | null) => {
    const kids = byParent.get(parentId) || [];
    for (const k of kids) {
      out.push(k);
      walk(k.id);
    }
  };
  walk(null);
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  Legacy single-sheet (template 없을 때 fallback)
// ═══════════════════════════════════════════════════════════════

function writeSingleSheetLegacy(wb: ExcelJS.Workbook, report: WeeklyReportData) {
  const ws = wb.addWorksheet('주간보고', {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }],
  });

  const THEME = '0F766E';
  const totalCols = 9;
  const colWidths = [6, 30, 12, 14, 14, 14, 14, 12, 10];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // 제목
  const titleRow = ws.addRow([report.title]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 40;
  titleRow.getCell(1).font = font({ bold: true, size: 16, color: { argb: BASE.titleFont } });
  titleRow.getCell(1).fill = fill('0F172A');
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 2; c <= totalCols; c++) titleRow.getCell(c).fill = fill('0F172A');

  // 메타
  const metaRow = ws.addRow(['기준주:', report.weekLabel, '', '생성일:', report.generatedAt, '', '프로젝트:', report.projectName, '']);
  metaRow.height = 22;
  metaRow.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.font = font([1, 4, 7].includes(cn) ? { bold: true, size: 9, color: { argb: BASE.metaLabel } } : { size: 9 });
    cell.alignment = { vertical: 'middle' };
  });

  // 요약
  ws.addRow([]).height = 6;
  writeSectionTitle(ws, '요약', totalCols, THEME);
  const s = report.summary;
  const summary = [
    ['전체', `${s.totalLeafTasks}건`, '완료', `${s.completedTasks}건`, '진행중', `${s.inProgressTasks}건`, '지연', `${s.delayedTasks}건`, ''],
    ['계획', `${Math.round(s.overallPlanProgress)}%`, '실적', `${Math.round(s.overallActualProgress)}%`, '', '', '', '', ''],
  ];
  summary.forEach((data) => {
    const row = ws.addRow(data);
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.font = font(cn % 2 === 1 ? { bold: true, size: 9, color: { argb: BASE.metaLabel } } : { size: 10 });
      cell.border = thinBorder(BASE.borderLight);
    });
  });

  // 섹션
  const sections = [report.thisWeekActual, report.completedThisWeek, report.nextWeekPlan, report.delayed];
  sections.forEach((sec) => {
    ws.addRow([]).height = 6;
    writeSectionTitle(ws, sec.title, totalCols, THEME);
    const h = ws.addRow(['#', '작업명', '담당자', '계획시작', '계획종료', '실적시작', '실적종료', '상태', '지연']);
    h.height = 26;
    h.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = font({ bold: true, size: 9, color: { argb: BASE.headerFont } });
      cell.fill = fill('1E293B');
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder('1E293B');
    });
    if (sec.tasks.length === 0) {
      const empty = ws.addRow(['', '해당 작업 없음']);
      ws.mergeCells(empty.number, 2, empty.number, totalCols);
      empty.height = 24;
      empty.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = font({ size: 9, italic: true, color: { argb: BASE.metaLabel } });
        cell.border = thinBorder(BASE.borderLight);
      });
    } else {
      sec.tasks.forEach((t, idx) => writeLegacyTaskRow(ws, t, idx));
    }
  });
}

function writeLegacyTaskRow(ws: ExcelJS.Worksheet, task: WeeklyReportTask, index: number) {
  const row = ws.addRow([
    index + 1,
    task.parentName ? `[${task.parentName}] ${task.name}` : task.name,
    task.assigneeName,
    task.planStart || '-',
    task.planEnd || '-',
    task.actualStart || '-',
    task.actualEnd || '-',
    task.statusLabel,
    task.delayDays > 0 ? `${task.delayDays}일` : '',
  ]);
  const bg = index % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
  row.height = 24;
  row.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fill(bg);
    cell.font = font({ size: 9 });
    cell.border = thinBorder(BASE.borderLight);
    cell.alignment = { vertical: 'middle', horizontal: [4, 5, 6, 7, 8, 9].includes(cn) ? 'center' : 'left' };
    if (cn === 8) {
      const sc = statusColors(task.status);
      cell.fill = fill(sc.bg);
      cell.font = font({ bold: true, size: 8, color: { argb: sc.fg } });
    }
    if (cn === 9 && task.delayDays > 0) {
      cell.fill = fill(BASE.delayed);
      cell.font = font({ bold: true, size: 8, color: { argb: BASE.delayedFont } });
    }
  });
}
