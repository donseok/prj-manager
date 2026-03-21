import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isValid,
  min as minDate,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import type { ProjectMember, Task, TaskStatus } from '../types';
import { LEVEL_LABELS, TASK_STATUS_LABELS } from '../types';
import { buildTaskTree, formatDate, getDelayDays, parseDate } from './utils';

export const WBS_DATA_SHEET_NAME = 'WBS 데이터';

const DEFAULT_PROJECT_NAME = 'project';
const GANTT_DATA_SHEET_NAME = '간트 데이터';
const ROOT_ORDER_KEY = '__root__';
const WEEK_STARTS_ON = 1 as const;

// ── Color palette ──────────────────────────────────────────────
const C = {
  primary: '0F766E',
  primaryDark: '0D5E58',
  primaryLight: 'CCFBF1',
  headerBg: '1E293B',
  headerFont: 'FFFFFF',
  metaLabel: '64748B',
  metaValue: '1E293B',
  titleBg: '0F172A',
  titleFont: 'FFFFFF',
  border: 'CBD5E1',
  borderLight: 'E2E8F0',
  white: 'FFFFFF',
  rowEven: 'F8FAFC',
  rowOdd: 'FFFFFF',
  phase: 'DBEAFE',
  phaseBorder: '93C5FD',
  phaseFont: '1E40AF',
  activity: 'E0E7FF',
  activityFont: '3730A3',
  task: 'FFFFFF',
  func: 'F9FAFB',
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
  plan: 'DBEAFE',
  actual: 'D1FAE5',
  both: 'E0E7FF',
};

const FONT_NAME = 'Pretendard';

interface ExportBaseOptions {
  projectName?: string;
  tasks: Task[];
  members?: ProjectMember[];
}

interface ExportGanttOptions extends ExportBaseOptions {
  filterLabel?: string;
  searchQuery?: string;
  startDate?: Date;
  weeksToShow?: number;
}

interface OrderedTaskRow {
  depth: number;
  parentWbsCode: string;
  task: Task;
  wbsCode: string;
}

const STATUS_CODES = new Set<TaskStatus>(['pending', 'in_progress', 'completed', 'on_hold']);
const STATUS_LABEL_TO_CODE = Object.fromEntries(
  Object.entries(TASK_STATUS_LABELS).map(([code, label]) => [label, code as TaskStatus])
);
const LEVEL_TEXT_TO_NUMBER: Record<string, number> = {
  phase: 1, activity: 2, task: 3,
};

// ── Shared helpers ─────────────────────────────────────────────

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


function statusFill(status: TaskStatus): { bg: string; fg: string } {
  switch (status) {
    case 'completed': return { bg: C.completed, fg: C.completedFont };
    case 'in_progress': return { bg: C.inProgress, fg: C.inProgressFont };
    case 'on_hold': return { bg: C.onHold, fg: C.onHoldFont };
    default: return { bg: C.pending, fg: C.pendingFont };
  }
}

function levelRowBg(level: number): string {
  switch (level) {
    case 1: return C.phase;
    case 2: return C.activity;
    default: return C.task;
  }
}

function levelFontStyle(level: number): Partial<ExcelJS.Font> {
  switch (level) {
    case 1: return { bold: true, size: 11, color: { argb: C.phaseFont } };
    case 2: return { bold: true, size: 10, color: { argb: C.activityFont } };
    default: return { size: 10, color: { argb: '334155' } };
  }
}

function progressBar(progress: number): string {
  const filled = Math.round(progress / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${progress}%`;
}

function createMemberNameMap(members: ProjectMember[]) {
  return new Map(members.map((m) => [m.id, m.name]));
}

function getAssigneeLabel(task: Task, map: Map<string, string>) {
  if (!task.assigneeId) return '미지정';
  return map.get(task.assigneeId) || task.assigneeId;
}

function getOrderedTaskRows(tasks: Task[]): OrderedTaskRow[] {
  const taskTree = buildTaskTree(tasks.map((t) => ({ ...t })));
  const rows: OrderedTaskRow[] = [];
  const visit = (nodes: Task[], parentCode = '', depth = 0) => {
    nodes.forEach((node, i) => {
      const code = parentCode ? `${parentCode}.${i + 1}` : `${i + 1}`;
      rows.push({ depth, parentWbsCode: parentCode, task: node, wbsCode: code });
      if (node.children?.length) visit(node.children, code, depth + 1);
    });
  };
  visit(taskTree);
  return rows;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  return `${formatDate(start) || '-'} ~ ${formatDate(end) || '-'}`;
}

function getDurationDays(start: string | null | undefined, end: string | null | undefined) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return 0;
  return differenceInCalendarDays(e, s) + 1;
}

function getSafeProjectName(name?: string) {
  const cleaned = (name?.trim() || DEFAULT_PROJECT_NAME)
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || DEFAULT_PROJECT_NAME;
}

function safeSheetName(name: string) {
  return name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

async function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ── Title & metadata block ─────────────────────────────────────

function writeTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  metaRows: [string, string | number][][],
  totalCols: number
) {
  // Row 1: title
  const titleRow = ws.addRow([title]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.height = 40;
  titleRow.getCell(1).font = font({ bold: true, size: 16, color: { argb: C.headerFont } });
  titleRow.getCell(1).fill = fill(C.titleBg);
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  for (let c = 2; c <= totalCols; c++) {
    titleRow.getCell(c).fill = fill(C.titleBg);
  }

  // Metadata rows
  metaRows.forEach((pairs) => {
    const vals: (string | number)[] = [];
    pairs.forEach(([label, value]) => {
      vals.push(label, value);
    });
    const row = ws.addRow(vals);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = font(
        colNumber % 2 === 1
          ? { bold: true, size: 9, color: { argb: C.metaLabel } }
          : { size: 9, color: { argb: C.metaValue } }
      );
      cell.fill = fill(C.white);
      cell.alignment = { vertical: 'middle' };
    });
  });

  // Spacer row
  const spacer = ws.addRow([]);
  spacer.height = 6;
}

function writeHeaderRow(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.addRow(headers);
  row.height = 32;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = font({ bold: true, size: 10, color: { argb: C.headerFont } });
    cell.fill = fill(C.headerBg);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(C.headerBg);
  });
  return ws.rowCount;
}

// ══════════════════════════════════════════════════════════════
// WBS Export
// ══════════════════════════════════════════════════════════════

export function exportWbsWorkbook({ projectName, tasks, members = [] }: ExportBaseOptions) {
  const displayName = projectName?.trim() || '프로젝트';
  const safeName = getSafeProjectName(projectName);
  const orderedRows = getOrderedTaskRows(tasks);
  const memberMap = createMemberNameMap(members);
  const generatedAt = format(new Date(), 'yyyy-MM-dd HH:mm');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DK Flow';
  wb.created = new Date();

  // ── Sheet 1: WBS 보기 ──
  const ws = wb.addWorksheet(safeSheetName('WBS 보기'), {
    views: [{ state: 'frozen', ySplit: 5, xSplit: 0 }],
  });

  const headers = ['WBS', '구분', '작업명', '담당자', '산출물', '가중치', '계획 시작', '계획 종료', '계획 공정율', '실적 시작', '실적 종료', '실적 공정율', '상태', '지연'];
  const colWidths = [8, 10, 40, 12, 20, 9, 13, 13, 18, 13, 13, 18, 10, 8];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  writeTitleBlock(ws, `📋 ${displayName} — WBS`, [
    [['프로젝트', displayName], ['생성일', generatedAt], ['작업 수', `${orderedRows.length}개`]],
  ], headers.length);

  const headerRowNum = writeHeaderRow(ws, headers);

  orderedRows.forEach(({ depth, task, wbsCode }) => {
    const delay = getDelayDays(task);
    const indentedName = '  '.repeat(depth) + (task.name || '이름 없는 작업');
    const row = ws.addRow([
      wbsCode,
      LEVEL_LABELS[task.level] || `L${task.level}`,
      indentedName,
      getAssigneeLabel(task, memberMap),
      task.output || '',
      Number(task.weight.toFixed(3)),
      formatDate(task.planStart) || '',
      formatDate(task.planEnd) || '',
      progressBar(task.planProgress),
      formatDate(task.actualStart) || '',
      formatDate(task.actualEnd) || '',
      progressBar(task.actualProgress),
      TASK_STATUS_LABELS[task.status],
      delay > 0 ? `${delay}일` : '',
    ]);

    const bg = levelRowBg(task.level);
    const fontStyle = levelFontStyle(task.level);
    row.height = task.level <= 2 ? 28 : 24;

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10, color: { argb: '334155' } });
      cell.border = thinBorder(C.borderLight);
      cell.alignment = { vertical: 'middle', wrapText: true };

      // WBS code column
      if (colNum === 1) {
        cell.font = font({ size: 9, color: { argb: C.metaLabel } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Level column
      if (colNum === 2) {
        cell.font = font({ bold: task.level <= 2, size: 9, color: { argb: fontStyle.color?.argb || '334155' } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Task name
      if (colNum === 3) {
        cell.font = font(fontStyle);
        cell.alignment = { vertical: 'middle', indent: depth + 1 };
      }
      // Weight
      if (colNum === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '0.000';
      }
      // Date columns
      if ([7, 8, 10, 11].includes(colNum)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = font({ size: 9, color: { argb: '475569' } });
      }
      // Progress columns
      if (colNum === 9 || colNum === 12) {
        cell.font = font({ size: 8, color: { argb: task.level <= 2 ? fontStyle.color?.argb || '334155' : '64748B' } });
      }
      // Status column
      if (colNum === 13) {
        const sf = statusFill(task.status);
        cell.fill = fill(sf.bg);
        cell.font = font({ bold: true, size: 9, color: { argb: sf.fg } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Delay column
      if (colNum === 14 && delay > 0) {
        cell.fill = fill(C.delayed);
        cell.font = font({ bold: true, size: 9, color: { argb: C.delayedFont } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  // Auto-filter
  ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum + orderedRows.length, column: headers.length } };

  // ── Sheet 2: WBS 데이터 ──
  const dsHeaders = ['WBS코드', '상위WBS코드', '구분', '작업명', '산출물', '담당자', '담당자ID', '가중치', '기간일수', '선행작업', '작업출처', '계획시작', '계획종료', '계획공정율', '실적시작', '실적종료', '실적공정율', '상태', '상태코드'];
  const ds = wb.addWorksheet(safeSheetName(WBS_DATA_SHEET_NAME));
  const dsColWidths = [10, 12, 10, 30, 20, 12, 18, 9, 10, 18, 12, 12, 12, 11, 12, 12, 11, 10, 12];
  dsColWidths.forEach((w, i) => { ds.getColumn(i + 1).width = w; });

  const dsHeaderRow = ds.addRow(dsHeaders);
  dsHeaderRow.height = 28;
  dsHeaderRow.eachCell((cell) => {
    cell.font = font({ bold: true, size: 10, color: { argb: C.headerFont } });
    cell.fill = fill(C.primary);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(C.primary);
  });

  orderedRows.forEach(({ parentWbsCode, task, wbsCode }, idx) => {
    const row = ds.addRow([
      wbsCode, parentWbsCode,
      LEVEL_LABELS[task.level] || `L${task.level}`,
      task.name, task.output || '',
      getAssigneeLabel(task, memberMap), task.assigneeId || '',
      Number(task.weight.toFixed(3)),
      task.durationDays ?? '',
      (task.predecessorIds || []).join(','),
      task.taskSource || 'manual',
      formatDate(task.planStart) || '', formatDate(task.planEnd) || '', task.planProgress,
      formatDate(task.actualStart) || '', formatDate(task.actualEnd) || '', task.actualProgress,
      TASK_STATUS_LABELS[task.status], task.status,
    ]);
    const bg = idx % 2 === 0 ? C.rowEven : C.rowOdd;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 9 });
      cell.border = thinBorder(C.borderLight);
      cell.alignment = { vertical: 'middle' };
    });
  });

  ds.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + orderedRows.length, column: dsHeaders.length } };

  void saveWorkbook(wb, `${safeName}_WBS.xlsx`);
}

// ══════════════════════════════════════════════════════════════
// Gantt Export
// ══════════════════════════════════════════════════════════════

export function exportGanttWorkbook({
  projectName, tasks, members = [],
  filterLabel = '전체', searchQuery = '', startDate, weeksToShow = 12,
}: ExportGanttOptions) {
  const displayName = projectName?.trim() || '프로젝트';
  const safeName = getSafeProjectName(projectName);
  const orderedRows = getOrderedTaskRows(tasks);
  const memberMap = createMemberNameMap(members);
  const generatedAt = format(new Date(), 'yyyy-MM-dd HH:mm');
  const timelineStart = getRecommendedGanttStartDate(tasks, startDate);

  const weeks = Array.from({ length: weeksToShow }, (_, i) => {
    const ws = addWeeks(timelineStart, i);
    const we = endOfWeek(ws, { weekStartsOn: WEEK_STARTS_ON });
    return { start: ws, end: we, label: `${format(ws, 'M/d', { locale: ko })}~${format(we, 'M/d', { locale: ko })}` };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DK Flow';
  wb.created = new Date();

  // ── Sheet 1: 간트 보기 ──
  const fixedHeaders = ['WBS', '구분', '작업명', '담당자', '상태', '계획 기간', '실적 기간', '지연'];
  const headers = [...fixedHeaders, ...weeks.map((w) => w.label)];
  const ws = wb.addWorksheet(safeSheetName('간트 보기'), {
    views: [{ state: 'frozen', ySplit: 6, xSplit: 5 }],
  });

  const colWidths = [8, 10, 36, 12, 10, 22, 22, 8, ...weeks.map(() => 12)];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  writeTitleBlock(ws, `📊 ${displayName} — 간트 일정표`, [
    [['프로젝트', displayName], ['생성일', generatedAt], ['작업 수', `${orderedRows.length}개`]],
    [['필터', filterLabel], ['검색어', searchQuery.trim() || '-'], ['보기 범위', `${weeksToShow}주`]],
  ], headers.length);

  const headerRowNum = writeHeaderRow(ws, headers);

  // Color timeline header cells
  const hRow = ws.getRow(headerRowNum);
  for (let c = fixedHeaders.length + 1; c <= headers.length; c++) {
    hRow.getCell(c).fill = fill(C.primaryDark);
    hRow.getCell(c).font = font({ bold: true, size: 8, color: { argb: C.headerFont } });
  }

  orderedRows.forEach(({ depth, task, wbsCode }) => {
    const delay = getDelayDays(task);
    const indentedName = '  '.repeat(depth) + (task.name || '이름 없는 작업');
    const timelineMarkers = weeks.map((w) => getTimelineMarker(task, w.start, w.end));

    const row = ws.addRow([
      wbsCode,
      LEVEL_LABELS[task.level] || `L${task.level}`,
      indentedName,
      getAssigneeLabel(task, memberMap),
      TASK_STATUS_LABELS[task.status],
      formatDateRange(task.planStart, task.planEnd),
      formatDateRange(task.actualStart, task.actualEnd),
      delay > 0 ? `${delay}일` : '',
      ...timelineMarkers,
    ]);

    const bg = levelRowBg(task.level);
    const fontStyle = levelFontStyle(task.level);
    row.height = task.level <= 2 ? 26 : 22;

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 9, color: { argb: '334155' } });
      cell.border = thinBorder(C.borderLight);
      cell.alignment = { vertical: 'middle' };

      if (colNum === 1) {
        cell.font = font({ size: 8, color: { argb: C.metaLabel } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (colNum === 2) {
        cell.font = font({ bold: task.level <= 2, size: 8, color: { argb: fontStyle.color?.argb || '334155' } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (colNum === 3) {
        cell.font = font(fontStyle);
        cell.alignment = { vertical: 'middle', indent: depth + 1 };
      }
      if (colNum === 5) {
        const sf = statusFill(task.status);
        cell.fill = fill(sf.bg);
        cell.font = font({ bold: true, size: 8, color: { argb: sf.fg } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (colNum === 6 || colNum === 7) {
        cell.font = font({ size: 8, color: { argb: '475569' } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (colNum === 8 && delay > 0) {
        cell.fill = fill(C.delayed);
        cell.font = font({ bold: true, size: 8, color: { argb: C.delayedFont } });
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Timeline cells
      if (colNum > fixedHeaders.length) {
        const marker = timelineMarkers[colNum - fixedHeaders.length - 1];
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (marker === '계획+실적') {
          cell.fill = fill(C.both);
          cell.font = font({ bold: true, size: 7, color: { argb: '3730A3' } });
          cell.value = '●';
        } else if (marker === '계획') {
          cell.fill = fill(C.plan);
          cell.font = font({ size: 7, color: { argb: '2563EB' } });
          cell.value = '▪';
        } else if (marker === '실적') {
          cell.fill = fill(C.actual);
          cell.font = font({ size: 7, color: { argb: '16A34A' } });
          cell.value = '▪';
        } else {
          cell.value = '';
          cell.fill = fill(task.level <= 2 ? bg : C.white);
        }
      }
    });
  });

  ws.autoFilter = { from: { row: headerRowNum, column: 1 }, to: { row: headerRowNum + orderedRows.length, column: fixedHeaders.length } };

  // ── Sheet 2: 간트 데이터 ──
  const dsHeaders = ['WBS코드', '상위WBS코드', '구분', '작업명', '담당자', '담당자ID', '계획시작', '계획종료', '계획기간일수', '실적시작', '실적종료', '실적기간일수', '선행작업', '작업출처', '계획공정율', '실적공정율', '지연일수', '상태', '상태코드', '산출물'];
  const ds = wb.addWorksheet(safeSheetName(GANTT_DATA_SHEET_NAME));
  const dsWidths = [10, 12, 10, 30, 12, 18, 12, 12, 11, 12, 12, 11, 18, 12, 11, 11, 9, 10, 12, 20];
  dsWidths.forEach((w, i) => { ds.getColumn(i + 1).width = w; });

  const dsHRow = ds.addRow(dsHeaders);
  dsHRow.height = 28;
  dsHRow.eachCell((cell) => {
    cell.font = font({ bold: true, size: 10, color: { argb: C.headerFont } });
    cell.fill = fill(C.primary);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder(C.primary);
  });

  orderedRows.forEach(({ parentWbsCode, task, wbsCode }, idx) => {
    const row = ds.addRow([
      wbsCode, parentWbsCode,
      LEVEL_LABELS[task.level] || `L${task.level}`,
      task.name, getAssigneeLabel(task, memberMap), task.assigneeId || '',
      formatDate(task.planStart) || '', formatDate(task.planEnd) || '', getDurationDays(task.planStart, task.planEnd),
      formatDate(task.actualStart) || '', formatDate(task.actualEnd) || '', getDurationDays(task.actualStart, task.actualEnd),
      (task.predecessorIds || []).join(','), task.taskSource || 'manual',
      task.planProgress, task.actualProgress, getDelayDays(task),
      TASK_STATUS_LABELS[task.status], task.status, task.output || '',
    ]);
    const bg = idx % 2 === 0 ? C.rowEven : C.rowOdd;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 9 });
      cell.border = thinBorder(C.borderLight);
      cell.alignment = { vertical: 'middle' };
    });
  });

  ds.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + orderedRows.length, column: dsHeaders.length } };

  void saveWorkbook(wb, `${safeName}_간트.xlsx`);
}

// ══════════════════════════════════════════════════════════════
// Import (kept using xlsx for robust parsing)
// ══════════════════════════════════════════════════════════════

export function parseTasksFromWorkbook(data: ArrayBuffer, projectId: string): Task[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheetName =
    workbook.SheetNames.find((n) => n === WBS_DATA_SHEET_NAME) ??
    workbook.SheetNames.find((n) => n === 'WBS') ??
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const codeToId = new Map<string, string>();
  const orderCounter = new Map<string, number>();

  return jsonRows.map((row) => {
    const taskId = crypto.randomUUID();
    const wbsCode = getStringValue(row, ['WBS코드', 'WBS 코드']);
    const parentWbsCode = getStringValue(row, ['상위WBS코드', '상위 WBS코드', '상위WBS']);
    const parentId = parentWbsCode ? codeToId.get(parentWbsCode) ?? null : null;
    const orderKey = parentWbsCode || ROOT_ORDER_KEY;
    const orderIndex = orderCounter.get(orderKey) ?? 0;
    orderCounter.set(orderKey, orderIndex + 1);
    if (wbsCode) codeToId.set(wbsCode, taskId);

    const level = parseLevel(getStringValue(row, ['구분', '레벨', 'Level']), wbsCode);
    const status = parseStatus(getStringValue(row, ['상태코드', '상태', 'Status']));

    return {
      id: taskId, projectId, parentId, level, orderIndex,
      name: getStringValue(row, ['작업명', '이름', 'Task Name']),
      output: getOptionalStringValue(row, ['산출물', 'Output']) || undefined,
      assigneeId: getOptionalStringValue(row, ['담당자ID', 'Assignee ID', 'assigneeId']),
      weight: parseNumberValue(row['가중치']),
      durationDays: parseNumberValue(row['기간일수']) || parseNumberValue(row['계획기간일수']) || null,
      predecessorIds: getStringValue(row, ['선행작업', '선행 작업', 'predecessorIds'])
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      taskSource: (getOptionalStringValue(row, ['작업출처', 'taskSource']) as Task['taskSource'] | null) || 'imported',
      planStart: normalizeExcelDate(row['계획시작']),
      planEnd: normalizeExcelDate(row['계획종료']),
      planProgress: parseNumberValue(row['계획공정율']),
      actualStart: normalizeExcelDate(row['실적시작']),
      actualEnd: normalizeExcelDate(row['실적종료']),
      actualProgress: parseNumberValue(row['실적공정율']),
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isExpanded: true,
    };
  });
}

// ── Import helpers ─────────────────────────────────────────────

function getStringValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function getOptionalStringValue(row: Record<string, unknown>, keys: string[]) {
  return getStringValue(row, keys) || null;
}

function parseNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseLevel(value: string, wbsCode: string) {
  const n = value.trim().toLowerCase();
  if (LEVEL_TEXT_TO_NUMBER[n]) return LEVEL_TEXT_TO_NUMBER[n];
  const num = Number(n);
  if (Number.isFinite(num) && num > 0) return num;
  if (wbsCode) return Math.max(wbsCode.split('.').length, 1);
  return 3;
}

function parseStatus(value: string): TaskStatus {
  const n = value.trim();
  if (STATUS_CODES.has(n as TaskStatus)) return n as TaskStatus;
  if (n in STATUS_LABEL_TO_CODE) return STATUS_LABEL_TO_CODE[n];
  return 'pending';
}

function normalizeExcelDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && isValid(value)) return format(value, 'yyyy-MM-dd');
  if (typeof value === 'number' && Number.isFinite(value)) {
    const p = XLSX.SSF.parse_date_code(value);
    if (!p) return null;
    return format(new Date(p.y, p.m - 1, p.d), 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const norm = s.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = parseISO(norm);
  return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : norm;
}

// ── Gantt timeline helpers ─────────────────────────────────────

function getRecommendedGanttStartDate(tasks: Task[], startDate?: Date) {
  if (startDate) return startOfWeek(startDate, { weekStartsOn: WEEK_STARTS_ON });
  const dates = tasks
    .flatMap((t) => [t.planStart, t.actualStart])
    .filter(Boolean)
    .map((v) => parseISO(v!));
  if (!dates.length) return startOfWeek(addWeeks(new Date(), -1), { weekStartsOn: WEEK_STARTS_ON });
  return startOfWeek(addDays(minDate(dates), -7), { weekStartsOn: WEEK_STARTS_ON });
}

function getTimelineMarker(task: Task, weekStart: Date, weekEnd: Date) {
  const hasPlan = overlaps(task.planStart, task.planEnd, weekStart, weekEnd);
  const hasActual = overlaps(task.actualStart, task.actualEnd, weekStart, weekEnd);
  if (hasPlan && hasActual) return '계획+실적';
  if (hasPlan) return '계획';
  if (hasActual) return '실적';
  return '';
}

function overlaps(start: string | null | undefined, end: string | null | undefined, rs: Date, re: Date) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (s && e) return s <= re && e >= rs;
  if (s) return s >= rs && s <= re;
  if (e) return e >= rs && e <= re;
  return false;
}
