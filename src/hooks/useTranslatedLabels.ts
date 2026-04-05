import { useTranslation } from 'react-i18next';
import type { ProjectStatus, TaskStatus, AttendanceType } from '../types';

/**
 * Returns translated label records that mirror the static *_LABELS constants
 * in types/index.ts, but react to the current i18n language.
 */
export function useTranslatedLabels() {
  const { t } = useTranslation();

  const projectStatusLabels: Record<ProjectStatus, string> = {
    preparing: t('labels.projectStatus.preparing'),
    active: t('labels.projectStatus.active'),
    completed: t('labels.projectStatus.completed'),
    deleted: t('labels.projectStatus.deleted'),
  };

  const taskStatusLabels: Record<TaskStatus, string> = {
    pending: t('labels.taskStatus.pending'),
    in_progress: t('labels.taskStatus.in_progress'),
    completed: t('labels.taskStatus.completed'),
    on_hold: t('labels.taskStatus.on_hold'),
  };

  const levelLabels: Record<number, string> = {
    0: t('labels.level.0'),
    1: t('labels.level.1'),
    2: t('labels.level.2'),
    3: t('labels.level.3'),
    4: t('labels.level.4'),
  };

  const attendanceTypeLabels: Record<AttendanceType, string> = {
    present: t('labels.attendanceType.present'),
    annual_leave: t('labels.attendanceType.annual_leave'),
    half_day_am: t('labels.attendanceType.half_day_am'),
    half_day_pm: t('labels.attendanceType.half_day_pm'),
    sick_leave: t('labels.attendanceType.sick_leave'),
    business_trip: t('labels.attendanceType.business_trip'),
    late: t('labels.attendanceType.late'),
    early_leave: t('labels.attendanceType.early_leave'),
    absence: t('labels.attendanceType.absence'),
  };

  const wbsColumnHeaders: Record<string, string> = {
    level: t('labels.wbsColumns.level'),
    name: t('labels.wbsColumns.name'),
    output: t('labels.wbsColumns.output'),
    assignee: t('labels.wbsColumns.assignee'),
    weight: t('labels.wbsColumns.weight'),
    planStart: t('labels.wbsColumns.planStart'),
    planEnd: t('labels.wbsColumns.planEnd'),
    planProgress: t('labels.wbsColumns.planProgress'),
    actualStart: t('labels.wbsColumns.actualStart'),
    actualEnd: t('labels.wbsColumns.actualEnd'),
    actualProgress: t('labels.wbsColumns.actualProgress'),
    status: t('labels.wbsColumns.status'),
  };

  return {
    projectStatusLabels,
    taskStatusLabels,
    levelLabels,
    attendanceTypeLabels,
    wbsColumnHeaders,
  };
}
