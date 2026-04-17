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
import { format } from 'date-fns';

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
}

export function exportWeeklyReportExcel(report: WeeklyReportData, options: ExportWeeklyReportOptions = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DK Flow';
  wb.created = new Date();

  if (options.template) {
    writeProgressReportSheet(wb, report, options.template);
    writeWBSSheet(wb, report, options.template, options.allTasks || [], options.memberNameById || new Map());
    writeDevStatusSheet(wb, report, options.template, options.allTasks || [], options.memberNameById || new Map());
  } else {
    writeSingleSheetLegacy(wb, report);
  }

  const safeName = report.projectName
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'project';

  void wb.xlsx.writeBuffer().then((buffer) => {
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${safeName}_주간보고_${report.weekStart}.xlsx`,
    );
  });
}

// ═══════════════════════════════════════════════════════════════
//  시트 1 — 1.공정보고
// ═══════════════════════════════════════════════════════════════

function writeProgressReportSheet(
  wb: ExcelJS.Workbook,
  report: WeeklyReportData,
  tpl: WeeklyReportTemplate,
) {
  const ws = wb.addWorksheet(tpl.labels.reportSheet, {
    views: [{ state: 'normal', showGridLines: false }],
  });

  const THEME = tpl.themeColor;
  const THEME_LIGHT = lightenHex(THEME, 0.85);
  const TOTAL_COLS = 9;

  const widths = [14, 32, 12, 12, 12, 12, 12, 12, 10];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── 타이틀 ─────────────────────────────────────────────────
  ws.addRow([]).height = 6;
  const title = `${tpl.titlePrefix} ${report.weekLabel.split(' ').slice(0, 2).join(' ')} 공정보고`;
  const titleRow = ws.addRow([title]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, TOTAL_COLS);
  titleRow.height = 32;
  for (let c = 1; c <= TOTAL_COLS; c++) {
    const cell = titleRow.getCell(c);
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 16, color: { argb: BASE.titleFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(THEME);
  }

  // 메타 (기준주 / 생성일)
  const meta = ws.addRow(['기준주', report.weekLabel, '', '', '', '생성일', report.generatedAt, '', '']);
  meta.height = 22;
  ws.mergeCells(meta.number, 2, meta.number, 5);
  ws.mergeCells(meta.number, 7, meta.number, 9);
  meta.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.border = thinBorder(BASE.border);
    cell.alignment = { vertical: 'middle', horizontal: cn === 1 || cn === 6 ? 'center' : 'left', indent: 1 };
    cell.font = font(cn === 1 || cn === 6 ? { bold: true, size: 9, color: { argb: BASE.metaLabel } } : { size: 10 });
    cell.fill = fill(cn === 1 || cn === 6 ? THEME_LIGHT : BASE.white);
  });

  ws.addRow([]).height = 8;

  // ── 1) 공정 진도 현황 ───────────────────────────────────────
  writeSectionTitle(ws, tpl.labels.progressSection, TOTAL_COLS, THEME);

  const progressHeader = ws.addRow(['구분', '항목', '점유율(%)', '계획(%)', '실적(%)', '누계(%)', '비고', '', '']);
  ws.mergeCells(progressHeader.number, 7, progressHeader.number, 9);
  progressHeader.height = 26;
  progressHeader.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(THEME);
  });

  // Phase별 진척률 매핑
  const phaseMap = new Map(report.phaseBreakdowns.map((p) => [p.phaseName, p]));

  tpl.progressCategories.forEach((cat, idx) => {
    const breakdown = phaseMap.get(cat.item);
    const plan = breakdown ? Math.round(breakdown.planProgress) : 0;
    const actual = breakdown ? Math.round(breakdown.actualProgress) : 0;
    const gap = plan - actual;
    const note = breakdown
      ? `${breakdown.completedTasks}/${breakdown.totalLeafTasks} 완료${breakdown.delayedTasks > 0 ? `, ${breakdown.delayedTasks}건 지연` : ''}`
      : '';

    const row = ws.addRow([cat.section, cat.item, cat.weight, plan, actual, actual, note, '', '']);
    ws.mergeCells(row.number, 7, row.number, 9);
    row.height = 22;
    const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10 });
      cell.border = thinBorder(BASE.borderLight);
      cell.alignment = {
        vertical: 'middle',
        horizontal: cn === 1 || cn === 2 ? 'left' : 'center',
        indent: cn === 1 || cn === 2 ? 1 : 0,
      };
      if ([3, 4, 5, 6].includes(cn)) {
        cell.numFmt = '0.0';
      }
      if (cn === 5 && gap > 5) {
        cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
      }
    });
  });

  // 합계
  const totalWeight = tpl.progressCategories.reduce((s, c) => s + c.weight, 0);
  const planRow = Math.round(report.summary.overallPlanProgress * 10) / 10;
  const actualRow = Math.round(report.summary.overallActualProgress * 10) / 10;
  const total = ws.addRow(['합계', '', totalWeight, planRow, actualRow, actualRow, '', '', '']);
  ws.mergeCells(total.number, 1, total.number, 2);
  ws.mergeCells(total.number, 7, total.number, 9);
  total.height = 24;
  total.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fill(THEME_LIGHT);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.metaValue } });
    cell.border = thinBorder(THEME);
    cell.alignment = { vertical: 'middle', horizontal: cn === 1 ? 'center' : 'center' };
    if ([3, 4, 5, 6].includes(cn)) cell.numFmt = '0.0';
  });

  ws.addRow([]).height = 10;

  // ── 2) 공정 실적 및 계획 ────────────────────────────────────
  writeSectionTitle(ws, tpl.labels.planSection, TOTAL_COLS, THEME);

  const planHeader = ws.addRow(['금주 실적', '', '', '', '', '차주 계획', '', '', '']);
  ws.mergeCells(planHeader.number, 1, planHeader.number, 5);
  ws.mergeCells(planHeader.number, 6, planHeader.number, 9);
  planHeader.height = 26;
  planHeader.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 11, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(THEME);
  });

  const bullet = (prefix: string, t: WeeklyReportTask) =>
    `${prefix} ${t.parentName ? `[${t.parentName}] ` : ''}${t.name}${t.assigneeName && t.assigneeName !== '미지정' ? ` (${t.assigneeName})` : ''}`;

  const thisWeekBody = [
    ...report.thisWeekActual.tasks.slice(0, 20).map((t) => bullet('▸', t)),
    ...(report.completedThisWeek.tasks.length > 0
      ? ['', '[금주 완료]', ...report.completedThisWeek.tasks.slice(0, 10).map((t) => bullet('✓', t))]
      : []),
  ].join('\n') || '(해당 없음)';

  const nextWeekBody = [
    ...report.nextWeekPlan.tasks.slice(0, 25).map((t) => bullet('▸', t)),
    ...(report.delayed.tasks.length > 0
      ? ['', '[지연 이월]', ...report.delayed.tasks.slice(0, 10).map((t) => bullet('!', t))]
      : []),
  ].join('\n') || '(해당 없음)';

  const planRowBody = ws.addRow([thisWeekBody, '', '', '', '', nextWeekBody, '', '', '']);
  ws.mergeCells(planRowBody.number, 1, planRowBody.number, 5);
  ws.mergeCells(planRowBody.number, 6, planRowBody.number, 9);
  const maxLines = Math.max(thisWeekBody.split('\n').length, nextWeekBody.split('\n').length);
  planRowBody.height = Math.max(80, Math.min(500, maxLines * 16));
  planRowBody.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = fill(BASE.white);
    cell.font = font({ size: 10 });
    cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
    cell.border = thinBorder(BASE.border);
  });

  ws.addRow([]).height = 10;

  // ── 3) 이슈 / 리스크 ────────────────────────────────────────
  if (report.gradedIssues.length > 0) {
    writeSectionTitle(ws, '3) 이슈 / 리스크', TOTAL_COLS, THEME);
    const issueHeader = ws.addRow(['#', '등급', '내용', '', '', '', '대응방안', '', '']);
    ws.mergeCells(issueHeader.number, 3, issueHeader.number, 6);
    ws.mergeCells(issueHeader.number, 7, issueHeader.number, 9);
    issueHeader.height = 24;
    issueHeader.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(THEME);
      cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder(THEME);
    });
    report.gradedIssues.forEach((issue, idx) => {
      const sevLabel = issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '중간' : '낮음';
      const row = ws.addRow([idx + 1, sevLabel, issue.message, '', '', '', issue.response || '', '', '']);
      ws.mergeCells(row.number, 3, row.number, 6);
      ws.mergeCells(row.number, 7, row.number, 9);
      row.height = 24;
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cell.fill = fill(cn === 2 ? BASE.issueBg : BASE.white);
        cell.font = font({
          size: 10,
          bold: cn === 2,
          color: {
            argb: cn === 2 && issue.severity === 'high'
              ? BASE.delayedFont
              : cn === 2
                ? BASE.issueFont
                : BASE.metaValue,
          },
        });
        cell.alignment = {
          vertical: 'middle',
          horizontal: cn === 1 || cn === 2 ? 'center' : 'left',
          wrapText: cn === 3 || cn === 7,
          indent: cn === 3 || cn === 7 ? 1 : 0,
        };
        cell.border = thinBorder(BASE.border);
      });
    });
    ws.addRow([]).height = 10;
  }

  // ── 4) 근태현황 (출근 제외) ─────────────────────────────────
  if (report.attendanceSummary && report.attendanceSummary.length > 0) {
    const filtered = filterOutPresent(report.attendanceSummary);
    if (filtered.length > 0) {
      writeSectionTitle(ws, '4) 금주 근태현황 (비출근)', TOTAL_COLS, THEME);
      writeAttendanceTable(ws, filtered, TOTAL_COLS, THEME);
      ws.addRow([]).height = 10;
    }
  }
  if (report.nextWeekAttendanceSummary && report.nextWeekAttendanceSummary.length > 0) {
    const filtered = filterOutPresent(report.nextWeekAttendanceSummary);
    if (filtered.length > 0) {
      writeSectionTitle(ws, '5) 차주 근태현황 (비출근)', TOTAL_COLS, THEME);
      writeAttendanceTable(ws, filtered, TOTAL_COLS, THEME);
      ws.addRow([]).height = 10;
    }
  }

  // ── 담당자 작성 ─────────────────────────────────────────────
  if (report.memberReports && report.memberReports.length > 0) {
    writeSectionTitle(ws, '6) 담당자 작성', TOTAL_COLS, THEME);
    const h = ws.addRow(['담당자', '금주 실적', '', '', '', '차주 계획', '', '', '']);
    ws.mergeCells(h.number, 2, h.number, 5);
    ws.mergeCells(h.number, 6, h.number, 9);
    h.height = 24;
    h.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(THEME);
      cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = thinBorder(THEME);
    });
    report.memberReports.forEach((entry, idx) => {
      const row = ws.addRow([entry.memberName, entry.thisWeekResult || '-', '', '', '', entry.nextWeekPlan || '-', '', '', '']);
      ws.mergeCells(row.number, 2, row.number, 5);
      ws.mergeCells(row.number, 6, row.number, 9);
      row.height = 50;
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

// ═══════════════════════════════════════════════════════════════
//  시트 2 — 2.WBS
// ═══════════════════════════════════════════════════════════════

function writeWBSSheet(
  wb: ExcelJS.Workbook,
  report: WeeklyReportData,
  tpl: WeeklyReportTemplate,
  allTasks: Task[],
  memberNames: Map<string, string>,
) {
  const ws = wb.addWorksheet(tpl.labels.wbsSheet, {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 3 }],
  });

  const THEME = tpl.themeColor;
  const THEME_LIGHT = lightenHex(THEME, 0.82);
  const headers = ['No', 'Lv', '작업명', '산출물', '담당자', '가중치', '계획시작', '계획종료', '계획(%)', '실적시작', '실적종료', '실적(%)', '상태'];
  const widths = [5, 6, 40, 18, 12, 8, 12, 12, 8, 12, 12, 8, 10];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // 타이틀
  const titleRow = ws.addRow([`${tpl.titlePrefix} WBS`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
  titleRow.height = 28;
  titleRow.getCell(1).fill = fill(THEME);
  titleRow.getCell(1).font = font({ bold: true, size: 13, color: { argb: BASE.titleFont } });
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= headers.length; c++) {
    titleRow.getCell(c).fill = fill(THEME);
    titleRow.getCell(c).border = thinBorder(THEME);
  }

  const meta = ws.addRow([`기준주 ${report.weekLabel}`, '', '', '', '', '', '', '', '', '', '', '', `생성 ${report.generatedAt}`]);
  ws.mergeCells(meta.number, 1, meta.number, 6);
  ws.mergeCells(meta.number, 7, meta.number, 13);
  meta.height = 20;
  meta.eachCell({ includeEmpty: true }, (cell, cn) => {
    cell.fill = fill(THEME_LIGHT);
    cell.font = font({ size: 9, color: { argb: BASE.metaValue } });
    cell.alignment = { vertical: 'middle', horizontal: cn === 1 ? 'left' : 'right', indent: 1 };
    cell.border = thinBorder(THEME_LIGHT);
  });

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(THEME);
  });

  const ordered = buildOrderedTasks(allTasks);

  ordered.forEach((t, idx) => {
    const assignee = t.assigneeId ? memberNames.get(t.assigneeId) || '-' : '-';
    const row = ws.addRow([
      idx + 1,
      LEVEL_LABELS[t.level] || `L${t.level}`,
      `${'  '.repeat(Math.max(0, t.level - 1))}${t.name}`,
      t.output || '',
      assignee,
      t.weight || 0,
      t.planStart || '',
      t.planEnd || '',
      Math.round(t.planProgress),
      t.actualStart || '',
      t.actualEnd || '',
      Math.round(t.actualProgress),
      TASK_STATUS_LABELS[t.status] || t.status,
    ]);
    row.height = 22;

    const isSummary = t.level <= 2;
    const bg = isSummary ? THEME_LIGHT : (idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd);

    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10, bold: isSummary });
      cell.border = thinBorder(BASE.borderLight);
      cell.alignment = {
        vertical: 'middle',
        horizontal: cn === 3 ? 'left' : 'center',
        indent: cn === 3 ? 0 : 0,
      };
      if (cn === 13) {
        const sc = statusColors(t.status);
        cell.fill = fill(isSummary ? bg : sc.bg);
        if (!isSummary) cell.font = font({ size: 10, bold: true, color: { argb: sc.fg } });
      }
      if (cn === 9 || cn === 12) {
        cell.numFmt = '0"%"';
      }
    });
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
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const THEME = tpl.themeColor;
  const THEME_LIGHT = lightenHex(THEME, 0.85);
  const headers = ['No', '상위', '항목', '담당자', '계획종료', '실적(%)', '상태', '비고'];
  const widths = [5, 24, 36, 12, 12, 10, 10, 24];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const titleRow = ws.addRow([`${tpl.titlePrefix} 프로그램 개발현황 (미완료 To-do)`]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, headers.length);
  titleRow.height = 28;
  titleRow.getCell(1).fill = fill(THEME);
  titleRow.getCell(1).font = font({ bold: true, size: 13, color: { argb: BASE.titleFont } });
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= headers.length; c++) {
    titleRow.getCell(c).fill = fill(THEME);
    titleRow.getCell(c).border = thinBorder(THEME);
  }

  const meta = ws.addRow([`기준주 ${report.weekLabel} · 생성 ${report.generatedAt}`]);
  ws.mergeCells(meta.number, 1, meta.number, headers.length);
  meta.height = 20;
  meta.getCell(1).fill = fill(THEME_LIGHT);
  meta.getCell(1).font = font({ size: 9, color: { argb: BASE.metaValue } });
  meta.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 1; c <= headers.length; c++) {
    meta.getCell(c).fill = fill(THEME_LIGHT);
    meta.getCell(c).border = thinBorder(THEME_LIGHT);
  }

  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = fill(THEME);
    cell.font = font({ bold: true, size: 10, color: { argb: BASE.headerFont } });
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(THEME);
  });

  // Leaf + 미완료 + planEnd 기준 정렬
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const childrenCount = new Map<string, number>();
  for (const t of allTasks) {
    if (t.parentId) childrenCount.set(t.parentId, (childrenCount.get(t.parentId) || 0) + 1);
  }
  const todos = allTasks
    .filter((t) => (childrenCount.get(t.id) || 0) === 0)
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => {
      const ae = a.planEnd || '9999-12-31';
      const be = b.planEnd || '9999-12-31';
      return ae.localeCompare(be);
    });

  const now = format(new Date(), 'yyyy-MM-dd');

  todos.forEach((t, idx) => {
    const parent = t.parentId ? taskMap.get(t.parentId) : null;
    const assignee = t.assigneeId ? memberNames.get(t.assigneeId) || '-' : '-';
    const isDelayed = !!t.planEnd && t.planEnd < now;

    const row = ws.addRow([
      idx + 1,
      parent ? parent.name : '-',
      t.name,
      assignee,
      t.planEnd || '',
      Math.round(t.actualProgress),
      TASK_STATUS_LABELS[t.status] || t.status,
      isDelayed ? `⚠ 지연 (${t.planEnd})` : (t.output || ''),
    ]);
    row.height = 22;
    const bg = idx % 2 === 0 ? BASE.rowEven : BASE.rowOdd;
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10 });
      cell.border = thinBorder(BASE.borderLight);
      cell.alignment = {
        vertical: 'middle',
        horizontal: cn === 3 || cn === 8 || cn === 2 ? 'left' : 'center',
        wrapText: cn === 3 || cn === 8,
        indent: cn === 3 || cn === 8 ? 1 : 0,
      };
      if (cn === 6) cell.numFmt = '0"%"';
      if (cn === 7) {
        const sc = statusColors(t.status);
        cell.fill = fill(sc.bg);
        cell.font = font({ size: 10, bold: true, color: { argb: sc.fg } });
      }
      if (cn === 8 && isDelayed) {
        cell.fill = fill(BASE.delayed);
        cell.font = font({ size: 10, bold: true, color: { argb: BASE.delayedFont } });
      }
    });
  });

  if (todos.length === 0) {
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
