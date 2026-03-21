/**
 * exportWeeklyReport.ts
 * 주간보고 Excel 내보내기
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { WeeklyReportData, WeeklyReportTask, WeeklyAttendanceSummary } from './weeklyReport';
import { ATTENDANCE_TYPE_COLORS } from '../types';

const FONT_NAME = 'Pretendard';

const C = {
  primary: '0F766E',
  primaryLight: 'CCFBF1',
  headerBg: '1E293B',
  headerFont: 'FFFFFF',
  titleBg: '0F172A',
  titleFont: 'FFFFFF',
  border: 'CBD5E1',
  borderLight: 'E2E8F0',
  white: 'FFFFFF',
  rowEven: 'F8FAFC',
  rowOdd: 'FFFFFF',
  sectionBg: '0F766E',
  sectionFont: 'FFFFFF',
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
  summaryBg: 'F0FDFA',
};

function font(opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: FONT_NAME, size: 10, ...opts };
}

function fill(color: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function thinBorder(color = C.border): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: color } };
  return { top: side, bottom: side, left: side, right: side };
}

function statusColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'completed': return { bg: C.completed, fg: C.completedFont };
    case 'in_progress': return { bg: C.inProgress, fg: C.inProgressFont };
    case 'on_hold': return { bg: C.onHold, fg: C.onHoldFont };
    default: return { bg: C.pending, fg: C.pendingFont };
  }
}

export function exportWeeklyReportExcel(report: WeeklyReportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DK Flow';
  wb.created = new Date();

  const ws = wb.addWorksheet('주간보고', {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }],
  });

  const totalCols = 9;
  const colWidths = [6, 30, 12, 14, 14, 14, 14, 12, 10];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── 제목 ──────────────────────────────────────────────────
  const titleRow = ws.addRow([report.title]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 40;
  titleRow.getCell(1).font = font({ bold: true, size: 16, color: { argb: C.titleFont } });
  titleRow.getCell(1).fill = fill(C.titleBg);
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 2; c <= totalCols; c++) {
    titleRow.getCell(c).fill = fill(C.titleBg);
  }

  // ── 메타정보 ───────────────────────────────────────────────
  const metaRow = ws.addRow([
    '기준주:', report.weekLabel,
    '', '생성일:', report.generatedAt,
    '', '프로젝트:', report.projectName,
    '',
  ]);
  metaRow.height = 22;
  metaRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.font = font(
      [1, 4, 7].includes(colNum)
        ? { bold: true, size: 9, color: { argb: C.metaLabel } }
        : { size: 9, color: { argb: C.metaValue } }
    );
    cell.fill = fill(C.white);
    cell.alignment = { vertical: 'middle' };
  });

  // ── 요약 ──────────────────────────────────────────────────
  const spacer1 = ws.addRow([]);
  spacer1.height = 6;

  const summaryHeaderRow = ws.addRow(['요약']);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, totalCols);
  summaryHeaderRow.height = 28;
  summaryHeaderRow.getCell(1).font = font({ bold: true, size: 11, color: { argb: C.sectionFont } });
  summaryHeaderRow.getCell(1).fill = fill(C.sectionBg);
  summaryHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 2; c <= totalCols; c++) {
    summaryHeaderRow.getCell(c).fill = fill(C.sectionBg);
  }

  const s = report.summary;
  const summaryData = [
    ['전체 작업', `${s.totalLeafTasks}건`, '완료', `${s.completedTasks}건`, '진행중', `${s.inProgressTasks}건`, '지연', `${s.delayedTasks}건`, ''],
    ['계획 공정율', `${Math.round(s.overallPlanProgress)}%`, '실적 공정율', `${Math.round(s.overallActualProgress)}%`, '', '', '', '', ''],
  ];
  summaryData.forEach((data) => {
    const row = ws.addRow(data);
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = fill(C.summaryBg);
      cell.font = font(
        colNum % 2 === 1
          ? { bold: true, size: 9, color: { argb: C.metaLabel } }
          : { size: 10, color: { argb: C.metaValue } }
      );
      cell.alignment = { vertical: 'middle' };
      cell.border = thinBorder(C.borderLight);
    });
  });

  // ── 이슈 ──────────────────────────────────────────────────
  if (report.issues.length > 0) {
    const spacer2 = ws.addRow([]);
    spacer2.height = 6;

    const issueHeaderRow = ws.addRow(['이슈 / 리스크']);
    ws.mergeCells(ws.rowCount, 1, ws.rowCount, totalCols);
    issueHeaderRow.height = 28;
    issueHeaderRow.getCell(1).font = font({ bold: true, size: 11, color: { argb: C.sectionFont } });
    issueHeaderRow.getCell(1).fill = fill(C.sectionBg);
    issueHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    for (let c = 2; c <= totalCols; c++) {
      issueHeaderRow.getCell(c).fill = fill(C.sectionBg);
    }

    report.issues.forEach((issue, idx) => {
      const row = ws.addRow([`${idx + 1}`, issue]);
      ws.mergeCells(ws.rowCount, 2, ws.rowCount, totalCols);
      row.height = 24;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = fill(C.issueBg);
        cell.font = font({ size: 9, color: { argb: C.issueFont } });
        cell.alignment = { vertical: 'middle' };
        cell.border = thinBorder(C.borderLight);
      });
    });
  }

  // ── 금주 근태현황 ──────────────────────────────────────────
  if (report.attendanceSummary && report.attendanceSummary.length > 0) {
    const spacerA = ws.addRow([]);
    spacerA.height = 6;

    writeAttendanceSection(ws, report.attendanceSummary, totalCols, '금주 근태현황');
  }

  // ── 차주 근태현황 ──────────────────────────────────────────
  if (report.nextWeekAttendanceSummary && report.nextWeekAttendanceSummary.length > 0) {
    const spacerNA = ws.addRow([]);
    spacerNA.height = 6;

    writeAttendanceSection(ws, report.nextWeekAttendanceSummary, totalCols, '차주 근태현황');
  }

  // ── 섹션별 작업 목록 ───────────────────────────────────────
  const sections = [
    report.thisWeekActual,
    report.completedThisWeek,
    report.nextWeekPlan,
    report.delayed,
  ];

  sections.forEach((section) => {
    const spacer = ws.addRow([]);
    spacer.height = 6;

    writeSectionHeader(ws, section.title, totalCols);
    writeTaskTableHeader(ws);

    if (section.tasks.length === 0) {
      const emptyRow = ws.addRow(['', '해당 작업 없음']);
      ws.mergeCells(ws.rowCount, 2, ws.rowCount, totalCols);
      emptyRow.height = 24;
      emptyRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = fill(C.white);
        cell.font = font({ size: 9, color: { argb: C.metaLabel }, italic: true });
        cell.alignment = { vertical: 'middle' };
        cell.border = thinBorder(C.borderLight);
      });
    } else {
      section.tasks.forEach((task, idx) => {
        writeTaskRow(ws, task, idx);
      });
    }
  });

  // ── 저장 ──────────────────────────────────────────────────
  const safeName = report.projectName
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'project';

  void wb.xlsx.writeBuffer().then((buffer) => {
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${safeName}_주간보고_${report.weekStart}.xlsx`
    );
  });
}

// ── Helpers ──────────────────────────────────────────────────

function writeSectionHeader(ws: ExcelJS.Worksheet, title: string, totalCols: number) {
  const row = ws.addRow([title]);
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, totalCols);
  row.height = 28;
  row.getCell(1).font = font({ bold: true, size: 11, color: { argb: C.sectionFont } });
  row.getCell(1).fill = fill(C.sectionBg);
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 2; c <= totalCols; c++) {
    row.getCell(c).fill = fill(C.sectionBg);
  }
}

function writeTaskTableHeader(ws: ExcelJS.Worksheet) {
  const headers = ['#', '작업명', '담당자', '계획시작', '계획종료', '실적시작', '실적종료', '상태', '지연'];
  const row = ws.addRow(headers);
  row.height = 26;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = font({ bold: true, size: 9, color: { argb: C.headerFont } });
    cell.fill = fill(C.headerBg);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(C.headerBg);
  });
}

function writeAttendanceSection(ws: ExcelJS.Worksheet, attendanceSummary: WeeklyAttendanceSummary[], totalCols: number, title = '근태현황') {
  writeSectionHeader(ws, title, totalCols);

  // 헤더: 담당자, 월, 화, 수, 목, 금, 소계
  const attHeaders = ['', '담당자', '월', '화', '수', '목', '금', '소계', ''];
  const headerRow = ws.addRow(attHeaders);
  headerRow.height = 26;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = font({ bold: true, size: 9, color: { argb: C.headerFont } });
    cell.fill = fill(C.headerBg);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(C.headerBg);
  });

  attendanceSummary.forEach((member, idx) => {
    const dayMap = new Map<number, string>();
    const dayColorMap = new Map<number, string>();
    for (const r of member.records) {
      const dow = new Date(r.date).getDay(); // 0=일 ~ 6=토
      if (dow >= 1 && dow <= 5) {
        dayMap.set(dow, r.typeLabel);
        dayColorMap.set(dow, ATTENDANCE_TYPE_COLORS[r.type]?.replace('#', '') || '000000');
      }
    }

    const statsStr = Object.entries(member.stats).map(([k, v]) => `${k}${v}`).join('/');

    const rowData = [
      idx + 1,
      member.memberName,
      dayMap.get(1) || '-',
      dayMap.get(2) || '-',
      dayMap.get(3) || '-',
      dayMap.get(4) || '-',
      dayMap.get(5) || '-',
      statsStr,
      '',
    ];

    const row = ws.addRow(rowData);
    const bg = idx % 2 === 0 ? C.rowEven : C.rowOdd;
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 9 });
      cell.border = thinBorder(C.borderLight);
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 3 && colNum <= 7 ? 'center' : 'left' };

      if (colNum === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = font({ size: 8, color: { argb: C.metaLabel } });
      }
      if (colNum >= 3 && colNum <= 7) {
        const dow = colNum - 2;
        const color = dayColorMap.get(dow);
        if (color) {
          cell.font = font({ bold: true, size: 8, color: { argb: color } });
        } else {
          cell.font = font({ size: 8, color: { argb: C.metaLabel } });
        }
      }
      if (colNum === 8) {
        cell.font = font({ size: 8, color: { argb: C.metaValue } });
      }
    });
  });
}

function writeTaskRow(ws: ExcelJS.Worksheet, task: WeeklyReportTask, index: number) {
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

  const bg = index % 2 === 0 ? C.rowEven : C.rowOdd;
  row.height = 24;
  row.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.fill = fill(bg);
    cell.font = font({ size: 9 });
    cell.border = thinBorder(C.borderLight);
    cell.alignment = { vertical: 'middle' };

    if (colNum === 1) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = font({ size: 8, color: { argb: C.metaLabel } });
    }
    if ([4, 5, 6, 7].includes(colNum)) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = font({ size: 8, color: { argb: '475569' } });
    }
    if (colNum === 8) {
      const sc = statusColors(task.status);
      cell.fill = fill(sc.bg);
      cell.font = font({ bold: true, size: 8, color: { argb: sc.fg } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    if (colNum === 9 && task.delayDays > 0) {
      cell.fill = fill(C.delayed);
      cell.font = font({ bold: true, size: 8, color: { argb: C.delayedFont } });
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });
}
