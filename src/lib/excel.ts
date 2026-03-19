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
import * as XLSX from 'xlsx';
import type { ProjectMember, Task, TaskStatus } from '../types';
import { LEVEL_LABELS, TASK_STATUS_LABELS } from '../types';
import { buildTaskTree, formatDate, getDelayDays, parseDate } from './utils';

const DEFAULT_PROJECT_NAME = 'project';
const WBS_VIEW_SHEET_NAME = 'WBS 보기';
export const WBS_DATA_SHEET_NAME = 'WBS 데이터';
const GANTT_VIEW_SHEET_NAME = '간트 보기';
const GANTT_DATA_SHEET_NAME = '간트 데이터';
const ROOT_ORDER_KEY = '__root__';
const NAME_INDENT = '    ';
const WEEK_STARTS_ON = 1 as const;

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

type SheetValue = string | number;
type SheetRow = SheetValue[];
type JsonRow = Record<string, string | number>;

const STATUS_CODES = new Set<TaskStatus>(['pending', 'in_progress', 'completed', 'on_hold']);
const STATUS_LABEL_TO_CODE = Object.fromEntries(
  Object.entries(TASK_STATUS_LABELS).map(([code, label]) => [label, code as TaskStatus])
);
const LEVEL_TEXT_TO_NUMBER: Record<string, number> = {
  phase: 1,
  activity: 2,
  task: 3,
  function: 4,
};

export function exportWbsWorkbook({ projectName, tasks, members = [] }: ExportBaseOptions) {
  const displayProjectName = projectName?.trim() || '프로젝트';
  const safeProjectName = getSafeProjectName(projectName);
  const orderedRows = getOrderedTaskRows(tasks);
  const memberNameMap = createMemberNameMap(members);
  const generatedAt = format(new Date(), 'yyyy-MM-dd HH:mm');

  const viewHeaders = [
    'WBS',
    '구분',
    '작업명',
    '담당자',
    '산출물',
    '가중치',
    '계획 기간',
    '계획 공정율',
    '실적 기간',
    '실적 공정율',
    '상태',
  ];

  const viewRows: SheetRow[] = orderedRows.map(({ depth, task, wbsCode }) => [
    wbsCode,
    LEVEL_LABELS[task.level] || `L${task.level}`,
    `${NAME_INDENT.repeat(depth)}${task.name || '이름 없는 작업'}`,
    getAssigneeLabel(task, memberNameMap),
    task.output || '-',
    Number(task.weight.toFixed(3)),
    formatDateRange(task.planStart, task.planEnd),
    `${task.planProgress}%`,
    formatDateRange(task.actualStart, task.actualEnd),
    `${task.actualProgress}%`,
    TASK_STATUS_LABELS[task.status],
  ]);

  const dataRows = orderedRows.map(({ parentWbsCode, task, wbsCode }) => ({
    WBS코드: wbsCode,
    상위WBS코드: parentWbsCode,
    구분: LEVEL_LABELS[task.level] || `L${task.level}`,
    작업명: task.name,
    산출물: task.output || '',
    담당자: getAssigneeLabel(task, memberNameMap),
    담당자ID: task.assigneeId || '',
    가중치: Number(task.weight.toFixed(3)),
    계획시작: formatDate(task.planStart),
    계획종료: formatDate(task.planEnd),
    계획공정율: task.planProgress,
    실적시작: formatDate(task.actualStart),
    실적종료: formatDate(task.actualEnd),
    실적공정율: task.actualProgress,
    상태: TASK_STATUS_LABELS[task.status],
    상태코드: task.status,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createReadableSheet({
      title: `${displayProjectName} WBS`,
      metadataRows: [
        ['프로젝트', displayProjectName, '생성일', generatedAt, '작업 수', orderedRows.length],
        ['안내', 'WBS 데이터 시트는 다시 가져오기 가능한 원본 데이터입니다.'],
      ],
      headers: viewHeaders,
      rows: viewRows,
      columnWidths: [10, 12, 36, 14, 22, 10, 24, 12, 24, 12, 12],
    }),
    getSafeSheetName(WBS_VIEW_SHEET_NAME)
  );
  XLSX.utils.book_append_sheet(
    workbook,
    createDataSheet(dataRows, [10, 12, 12, 28, 24, 14, 18, 10, 12, 12, 12, 12, 12, 12, 12, 14]),
    getSafeSheetName(WBS_DATA_SHEET_NAME)
  );

  XLSX.writeFile(workbook, `${safeProjectName}_WBS.xlsx`);
}

export function exportGanttWorkbook({
  projectName,
  tasks,
  members = [],
  filterLabel = '전체',
  searchQuery = '',
  startDate,
  weeksToShow = 12,
}: ExportGanttOptions) {
  const displayProjectName = projectName?.trim() || '프로젝트';
  const safeProjectName = getSafeProjectName(projectName);
  const orderedRows = getOrderedTaskRows(tasks);
  const memberNameMap = createMemberNameMap(members);
  const generatedAt = format(new Date(), 'yyyy-MM-dd HH:mm');
  const timelineStartDate = getRecommendedGanttStartDate(tasks, startDate);
  const weeks = Array.from({ length: weeksToShow }, (_, index) => {
    const weekStart = addWeeks(timelineStartDate, index);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON });
    return {
      end: weekEnd,
      label: `${format(weekStart, 'M/d', { locale: ko })}~${format(weekEnd, 'M/d', { locale: ko })}`,
      start: weekStart,
    };
  });

  const viewHeaders = [
    'WBS',
    '구분',
    '작업명',
    '담당자',
    '상태',
    '계획 기간',
    '실적 기간',
    '지연',
    ...weeks.map((week) => week.label),
  ];

  const viewRows: SheetRow[] = orderedRows.map(({ depth, task, wbsCode }) => [
    wbsCode,
    LEVEL_LABELS[task.level] || `L${task.level}`,
    `${NAME_INDENT.repeat(depth)}${task.name || '이름 없는 작업'}`,
    getAssigneeLabel(task, memberNameMap),
    TASK_STATUS_LABELS[task.status],
    formatDateRange(task.planStart, task.planEnd),
    formatDateRange(task.actualStart, task.actualEnd),
    getDelayDays(task) > 0 ? `${getDelayDays(task)}일` : '-',
    ...weeks.map((week) => getTimelineMarker(task, week.start, week.end)),
  ]);

  const dataRows = orderedRows.map(({ parentWbsCode, task, wbsCode }) => ({
    WBS코드: wbsCode,
    상위WBS코드: parentWbsCode,
    구분: LEVEL_LABELS[task.level] || `L${task.level}`,
    작업명: task.name,
    담당자: getAssigneeLabel(task, memberNameMap),
    담당자ID: task.assigneeId || '',
    계획시작: formatDate(task.planStart),
    계획종료: formatDate(task.planEnd),
    계획기간일수: getDurationDays(task.planStart, task.planEnd),
    실적시작: formatDate(task.actualStart),
    실적종료: formatDate(task.actualEnd),
    실적기간일수: getDurationDays(task.actualStart, task.actualEnd),
    계획공정율: task.planProgress,
    실적공정율: task.actualProgress,
    지연일수: getDelayDays(task),
    상태: TASK_STATUS_LABELS[task.status],
    상태코드: task.status,
    산출물: task.output || '',
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createReadableSheet({
      title: `${displayProjectName} 간트 일정표`,
      metadataRows: [
        ['프로젝트', displayProjectName, '생성일', generatedAt, '작업 수', orderedRows.length],
        ['필터', filterLabel, '검색어', searchQuery.trim() || '-', '보기 범위', `${weeksToShow}주`],
        ['타임라인', '계획 / 실적 / 계획+실적'],
      ],
      headers: viewHeaders,
      rows: viewRows,
      columnWidths: [10, 12, 34, 14, 12, 24, 24, 10, ...weeks.map(() => 13)],
    }),
    getSafeSheetName(GANTT_VIEW_SHEET_NAME)
  );
  XLSX.utils.book_append_sheet(
    workbook,
    createDataSheet(dataRows, [10, 12, 12, 28, 14, 18, 12, 12, 12, 12, 12, 12, 12, 12, 10, 12, 14, 24]),
    getSafeSheetName(GANTT_DATA_SHEET_NAME)
  );

  XLSX.writeFile(workbook, `${safeProjectName}_간트.xlsx`);
}

export function parseTasksFromWorkbook(data: ArrayBuffer, projectId: string): Task[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheetName =
    workbook.SheetNames.find((name) => name === WBS_DATA_SHEET_NAME) ??
    workbook.SheetNames.find((name) => name === 'WBS') ??
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
    if (wbsCode) {
      codeToId.set(wbsCode, taskId);
    }

    const level = parseLevel(getStringValue(row, ['구분', '레벨', 'Level']), wbsCode);
    const status = parseStatus(getStringValue(row, ['상태코드', '상태', 'Status']));

    return {
      id: taskId,
      projectId,
      parentId,
      level,
      orderIndex,
      name: getStringValue(row, ['작업명', '이름', 'Task Name']),
      output: getOptionalStringValue(row, ['산출물', 'Output']) || undefined,
      assigneeId: getOptionalStringValue(row, ['담당자ID', 'Assignee ID', 'assigneeId']),
      weight: parseNumberValue(row['가중치']),
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

function createReadableSheet({
  title,
  metadataRows,
  headers,
  rows,
  columnWidths,
}: {
  title: string;
  metadataRows: SheetRow[];
  headers: string[];
  rows: SheetRow[];
  columnWidths: number[];
}) {
  const totalColumns = Math.max(
    headers.length,
    ...metadataRows.map((row) => row.length),
    1
  );
  const sheet = XLSX.utils.aoa_to_sheet([
    [title],
    ...metadataRows,
    [],
    headers,
    ...rows,
  ]);
  const headerRowIndex = metadataRows.length + 2;

  sheet['!cols'] = Array.from({ length: totalColumns }, (_, index) => ({
    wch: columnWidths[index] ?? 14,
  }));
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalColumns - 1 } }];

  if (headers.length > 0) {
    sheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: headerRowIndex, c: 0 },
        e: { r: headerRowIndex + rows.length, c: headers.length - 1 },
      }),
    };
  }

  return sheet;
}

function createDataSheet(rows: JsonRow[], columnWidths: number[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);

  sheet['!cols'] = columnWidths.map((width) => ({ wch: width }));

  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: headers.length - 1 },
      }),
    };
  }

  return sheet;
}

function createMemberNameMap(members: ProjectMember[]) {
  return new Map(members.map((member) => [member.id, member.name]));
}

function getAssigneeLabel(task: Task, memberNameMap: Map<string, string>) {
  if (!task.assigneeId) return '미지정';
  return memberNameMap.get(task.assigneeId) || task.assigneeId;
}

function getOrderedTaskRows(tasks: Task[]): OrderedTaskRow[] {
  const taskTree = buildTaskTree(tasks.map((task) => ({ ...task })));
  const orderedRows: OrderedTaskRow[] = [];

  const visit = (nodes: Task[], parentWbsCode = '', depth = 0) => {
    nodes.forEach((node, index) => {
      const wbsCode = parentWbsCode ? `${parentWbsCode}.${index + 1}` : `${index + 1}`;
      orderedRows.push({
        depth,
        parentWbsCode,
        task: node,
        wbsCode,
      });

      if (node.children && node.children.length > 0) {
        visit(node.children, wbsCode, depth + 1);
      }
    });
  };

  visit(taskTree);
  return orderedRows;
}

function getRecommendedGanttStartDate(tasks: Task[], startDate?: Date) {
  if (startDate) {
    return startOfWeek(startDate, { weekStartsOn: WEEK_STARTS_ON });
  }

  const taskStartDates = tasks
    .flatMap((task) => [task.planStart, task.actualStart])
    .filter(Boolean)
    .map((value) => parseISO(value!));

  if (taskStartDates.length === 0) {
    return startOfWeek(addWeeks(new Date(), -1), { weekStartsOn: WEEK_STARTS_ON });
  }

  return startOfWeek(addDays(minDate(taskStartDates), -7), { weekStartsOn: WEEK_STARTS_ON });
}

function getTimelineMarker(task: Task, weekStart: Date, weekEnd: Date) {
  const hasPlan = overlapsWithRange(task.planStart, task.planEnd, weekStart, weekEnd);
  const hasActual = overlapsWithRange(task.actualStart, task.actualEnd, weekStart, weekEnd);

  if (hasPlan && hasActual) return '계획+실적';
  if (hasPlan) return '계획';
  if (hasActual) return '실적';
  return '';
}

function overlapsWithRange(
  start: string | null | undefined,
  end: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date
) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (startDate && endDate) {
    return startDate <= rangeEnd && endDate >= rangeStart;
  }

  if (startDate) {
    return startDate >= rangeStart && startDate <= rangeEnd;
  }

  if (endDate) {
    return endDate >= rangeStart && endDate <= rangeEnd;
  }

  return false;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  return `${formatDate(start) || '-'} ~ ${formatDate(end) || '-'}`;
}

function getDurationDays(start: string | null | undefined, end: string | null | undefined) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) return 0;
  return differenceInCalendarDays(endDate, startDate) + 1;
}

function getSafeProjectName(projectName?: string) {
  const fileName = sanitizeFileName(projectName?.trim() || DEFAULT_PROJECT_NAME);
  return fileName || DEFAULT_PROJECT_NAME;
}

function getSafeSheetName(name: string) {
  return name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

function sanitizeFileName(name: string) {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getStringValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

function getOptionalStringValue(row: Record<string, unknown>, keys: string[]) {
  const value = getStringValue(row, keys);
  return value || null;
}

function parseNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseLevel(value: string, wbsCode: string) {
  const normalized = value.trim().toLowerCase();

  if (LEVEL_TEXT_TO_NUMBER[normalized]) {
    return LEVEL_TEXT_TO_NUMBER[normalized];
  }

  const asNumber = Number(normalized);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber;
  }

  if (wbsCode) {
    return Math.max(wbsCode.split('.').length, 1);
  }

  return 3;
}

function parseStatus(value: string): TaskStatus {
  const normalized = value.trim();

  if (STATUS_CODES.has(normalized as TaskStatus)) {
    return normalized as TaskStatus;
  }

  if (normalized in STATUS_LABEL_TO_CODE) {
    return STATUS_LABEL_TO_CODE[normalized];
  }

  return 'pending';
}

function normalizeExcelDate(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date && isValid(value)) {
    return format(value, 'yyyy-MM-dd');
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return format(new Date(parsed.y, parsed.m - 1, parsed.d), 'yyyy-MM-dd');
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  const normalizedValue = stringValue.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = parseISO(normalizedValue);

  if (isValid(parsed)) {
    return format(parsed, 'yyyy-MM-dd');
  }

  return normalizedValue;
}
