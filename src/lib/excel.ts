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

export async function exportWbsWorkbook({ projectName, tasks, members = [] }: ExportBaseOptions) {
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

  await saveWorkbook(wb, `${safeName}_WBS.xlsx`);
}

// ══════════════════════════════════════════════════════════════
// Gantt Export
// ══════════════════════════════════════════════════════════════

export async function exportGanttWorkbook({
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

  await saveWorkbook(wb, `${safeName}_간트.xlsx`);
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

// ══════════════════════════════════════════════════════════════
// WBS Upload Template
// ══════════════════════════════════════════════════════════════

export function generateWbsTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DK Flow';
  wb.created = new Date();

  // ── Sheet 1: WBS 데이터 (import parser 호환) ──
  const ws = wb.addWorksheet(WBS_DATA_SHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 2, xSplit: 0 }],
  });

  const headers = [
    'WBS코드', '상위WBS코드', '구분', '작업명', '산출물',
    '담당자', '가중치', '기간일수', '계획시작', '계획종료', '상태',
  ];
  const colWidths = [12, 14, 12, 40, 20, 12, 10, 10, 14, 14, 10];
  const colDescriptions = [
    '계층 번호\n(예: 1, 1.1, 1.1.1)',
    '상위 작업의\nWBS코드',
    'Phase / Activity\n/ Task',
    '작업 이름\n(필수)',
    '산출물명\n(선택)',
    '담당자 이름\n(선택)',
    '리프 작업의\n비중 (합계≈100)',
    '예상 소요일\n(리프 작업만)',
    'YYYY-MM-DD\n형식',
    'YYYY-MM-DD\n형식',
    '대기 / 진행중\n/ 완료 / 보류',
  ];

  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Row 1: Column descriptions (sub-header)
  const descRow = ws.addRow(colDescriptions);
  descRow.height = 36;
  descRow.eachCell((cell) => {
    cell.font = font({ size: 8, italic: true, color: { argb: '64748B' } });
    cell.fill = fill('F1F5F9');
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(C.borderLight);
  });

  // Row 2: Headers
  const headerRow = ws.addRow(headers);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = font({ bold: true, size: 10, color: { argb: C.headerFont } });
    cell.fill = fill(C.headerBg);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder(C.headerBg);
  });

  // ── Example data ──
  const examples: (string | number)[][] = [
    ['1',     '',  'Phase',    '분석',               '',              '',      '',  '',  '',            '',            ''],
    ['1.1',   '1', 'Activity', '현황 분석',           '',              '',      '',  '',  '',            '',            ''],
    ['1.1.1', '1.1', 'Task',   '현행 시스템 분석',     'AS-IS 분석서',  '홍길동', 15,   5,  '2026-04-01', '2026-04-07', '대기'],
    ['1.1.2', '1.1', 'Task',   '요구사항 수집',       '요구사항 정의서', '김영희', 15,   5,  '2026-04-08', '2026-04-14', '대기'],
    ['1.2',   '1', 'Activity', '개선방안 도출',       '',              '',      '',  '',  '',            '',            ''],
    ['1.2.1', '1.2', 'Task',   '개선방안 수립',       'TO-BE 설계서',  '박철수', 20,   7,  '2026-04-15', '2026-04-23', '대기'],
    ['2',     '',  'Phase',    '설계',               '',              '',      '',  '',  '',            '',            ''],
    ['2.1',   '2', 'Activity', '상세 설계',           '',              '',      '',  '',  '',            '',            ''],
    ['2.1.1', '2.1', 'Task',   '화면 설계',           '화면설계서',     '홍길동', 25,  10,  '2026-04-24', '2026-05-07', '대기'],
    ['2.1.2', '2.1', 'Task',   'DB 설계',            'ERD 문서',      '김영희', 25,   7,  '2026-04-24', '2026-05-02', '대기'],
  ];

  examples.forEach((data) => {
    const row = ws.addRow(data);
    const level = data[2] as string;
    row.height = 24;

    // Level-based row coloring
    let bg = C.white;
    let nameFont: Partial<ExcelJS.Font> = { size: 10, color: { argb: '334155' } };
    if (level === 'Phase') {
      bg = C.phase;
      nameFont = { bold: true, size: 11, color: { argb: C.phaseFont } };
    } else if (level === 'Activity') {
      bg = C.activity;
      nameFont = { bold: true, size: 10, color: { argb: C.activityFont } };
    }

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = fill(bg);
      cell.font = font({ size: 10, color: { argb: '475569' } });
      cell.border = thinBorder(C.borderLight);
      cell.alignment = { vertical: 'middle' };

      // WBS코드, 상위WBS코드, 구분 → center
      if (colNum <= 3) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      // 작업명 → level-based font
      if (colNum === 4) cell.font = font(nameFont);
      // 가중치, 기간일수 → center
      if (colNum === 7 || colNum === 8) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      // 날짜 → center
      if (colNum === 9 || colNum === 10) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      // 상태 → center
      if (colNum === 11) cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  });

  // ── Data Validation ──
  const dataStartRow = 3; // after desc + header
  const dataEndRow = 100;

  // 구분 (column 3): dropdown
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    ws.getCell(r, 3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Phase,Activity,Task"'],
      showErrorMessage: true,
      errorTitle: '입력 오류',
      error: 'Phase, Activity, Task 중 선택하세요.',
    };
  }

  // 상태 (column 11): dropdown
  for (let r = dataStartRow; r <= dataEndRow; r++) {
    ws.getCell(r, 11).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"대기,진행중,완료,보류"'],
      showErrorMessage: true,
      errorTitle: '입력 오류',
      error: '대기, 진행중, 완료, 보류 중 선택하세요.',
    };
  }

  // ── Sheet 2: 작성 가이드 ──
  const guide = wb.addWorksheet('작성 가이드');
  guide.getColumn(1).width = 4;
  guide.getColumn(2).width = 18;
  guide.getColumn(3).width = 70;

  const guideData: [string, string][] = [
    ['WBS 업로드 양식 — 작성 가이드', ''],
    ['', ''],
    ['1. 기본 규칙', ''],
    ['WBS코드', '계층 번호 체계입니다. 점(.)으로 레벨을 구분합니다.\n  Phase: 1, 2, 3 ...\n  Activity: 1.1, 1.2, 2.1 ...\n  Task: 1.1.1, 1.1.2, 2.1.1 ...'],
    ['상위WBS코드', 'WBS코드에서 마지막 번호를 뺀 상위 코드입니다.\n  1.1의 상위 → 1\n  1.1.2의 상위 → 1.1\n  Phase(최상위)는 빈칸으로 둡니다.'],
    ['구분', 'Phase(단계), Activity(활동), Task(작업) 중 하나를 선택합니다.\n드롭다운으로 선택할 수 있습니다.'],
    ['작업명', '작업의 이름입니다. 필수 입력 항목입니다.'],
    ['', ''],
    ['2. 계층 구조', ''],
    ['Phase (1레벨)', '프로젝트의 대단계입니다. (예: 분석, 설계, 개발, 테스트)\n날짜/공정율/상태는 하위 작업에서 자동 계산되므로 비워두세요.'],
    ['Activity (2레벨)', 'Phase 하위의 주요 활동입니다.\n날짜/공정율/상태는 하위 작업에서 자동 계산되므로 비워두세요.'],
    ['Task (3레벨)', '실제 수행하는 작업(리프 태스크)입니다.\n담당자, 가중치, 기간일수, 계획시작/종료, 상태를 입력하세요.'],
    ['', ''],
    ['3. 필드 설명', ''],
    ['산출물', '해당 작업의 결과물 이름입니다. (선택)'],
    ['담당자', '작업 담당자의 이름입니다. (선택)\n프로젝트 멤버와 자동 매칭되지는 않습니다.\n가져오기 후 WBS 화면에서 담당자를 지정해주세요.'],
    ['가중치', '리프(Task) 작업의 비중입니다. 모든 리프 작업의 가중치 합계가\n100에 가깝도록 배분하세요. 공정율 계산에 사용됩니다.\nPhase/Activity는 자동 계산되므로 비워두세요.'],
    ['기간일수', '예상 소요일입니다. (선택) 리프 작업에만 입력합니다.'],
    ['계획시작 / 종료', '날짜 형식: YYYY-MM-DD (예: 2026-04-01)\nYYYY.MM.DD, YYYY/MM/DD 형식도 인식합니다.\nPhase/Activity는 비워두면 하위에서 자동 계산됩니다.'],
    ['상태', '대기, 진행중, 완료, 보류 중 선택합니다. (드롭다운)\n비워두면 "대기"로 설정됩니다.\nPhase/Activity는 자동 계산되므로 비워두세요.'],
    ['', ''],
    ['4. 주의사항', ''],
    ['자동 계산', 'Phase/Activity의 계획시작, 계획종료, 공정율, 상태는\n하위 Task들로부터 자동으로 집계됩니다.\n직접 입력해도 가져오기 후 하위 값으로 덮어씌워집니다.'],
    ['순서', '같은 레벨 내에서 행 순서대로 정렬됩니다.\nWBS코드 번호 순서와 행 순서를 일치시키세요.'],
    ['예제 데이터', '"WBS 데이터" 시트에 예제가 포함되어 있습니다.\n예제를 지우고 실제 데이터를 입력하세요.'],
    ['시트 이름', '"WBS 데이터" 시트 이름을 변경하지 마세요.\n시스템이 이 시트 이름으로 데이터를 찾습니다.'],
  ];

  // Title row
  guide.mergeCells('B1:C1');
  const titleCell = guide.getCell('B1');
  titleCell.value = guideData[0][0];
  titleCell.font = font({ bold: true, size: 16, color: { argb: C.headerFont } });
  titleCell.fill = fill(C.titleBg);
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  guide.getCell('A1').fill = fill(C.titleBg);
  guide.getRow(1).height = 44;

  // Content rows
  guideData.slice(1).forEach(([label, desc], idx) => {
    const rowNum = idx + 2;
    const row = guide.getRow(rowNum);

    if (!label && !desc) {
      row.height = 12;
      return;
    }

    // Section headers (e.g., "1. 기본 규칙")
    if (!desc && label) {
      guide.mergeCells(`B${rowNum}:C${rowNum}`);
      const cell = guide.getCell(`B${rowNum}`);
      cell.value = label;
      cell.font = font({ bold: true, size: 12, color: { argb: C.primaryDark } });
      cell.fill = fill(C.primaryLight);
      cell.alignment = { vertical: 'middle' };
      guide.getCell(`A${rowNum}`).fill = fill(C.primaryLight);
      row.height = 30;
      return;
    }

    // Regular rows
    const labelCell = guide.getCell(`B${rowNum}`);
    labelCell.value = label;
    labelCell.font = font({ bold: true, size: 10, color: { argb: '1E293B' } });
    labelCell.alignment = { vertical: 'top' };

    const descCell = guide.getCell(`C${rowNum}`);
    descCell.value = desc;
    descCell.font = font({ size: 10, color: { argb: '475569' } });
    descCell.alignment = { vertical: 'top', wrapText: true };

    const lineCount = desc.split('\n').length;
    row.height = Math.max(22, lineCount * 16 + 6);
  });

  void saveWorkbook(wb, 'WBS_업로드_양식.xlsx');
}
