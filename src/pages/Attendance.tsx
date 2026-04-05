import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarCheck, Plus, Trash2, Edit2, ChevronLeft, ChevronRight,
  Calendar as CalendarIcon, List, Users,
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths,
  addDays, format, isSameMonth, isToday,
} from 'date-fns';
import { ko, enUS, vi } from 'date-fns/locale';
import { useProjectStore } from '../store/projectStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useProjectPermission } from '../hooks/useProjectPermission';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { loadAttendances, upsertAttendance, deleteAttendanceById } from '../lib/dataRepository';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn } from '../lib/utils';
import { isDefaultAttendance } from '../lib/attendanceDefaults';
import { getKoreanHolidayNames } from '../lib/koreanHolidays';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import AttendanceModal from '../components/attendance/AttendanceModal';
import type { Attendance, AttendanceType } from '../types';
import { ATTENDANCE_TYPE_COLORS } from '../types';

type ViewMode = 'calendar' | 'list';

export default function Attendance() {
  const { t, i18n } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { members, currentProject } = useProjectStore();
  const { attendances, setAttendances, addAttendance, updateAttendance, removeAttendance } = useAttendanceStore();
  const { canEditAllAttendance, canEditOwnAttendance, canViewAttendance } = useProjectPermission();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();

  const getDateLocale = () => {
    if (i18n.language === 'ko') return 'ko-KR';
    if (i18n.language === 'vi') return 'vi-VN';
    return 'en-US';
  };

  const getDateFnsLocale = () => {
    if (i18n.language === 'ko') return ko;
    if (i18n.language === 'vi') return vi;
    return enUS;
  };

  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Attendance | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultMemberId, setDefaultMemberId] = useState<string | undefined>();
  const [filterMemberId, setFilterMemberId] = useState<string>('all');

  // 근태 데이터 로딩
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void loadAttendances(projectId).then((data) => {
      if (!cancelled) setAttendances(data, projectId);
    });
    return () => { cancelled = true; };
  }, [projectId, setAttendances]);

  const canEdit = canEditAllAttendance || canEditOwnAttendance;

  // 저장 핸들러
  const handleSave = useCallback(async (attendance: Attendance) => {
    try {
      await upsertAttendance(attendance);
      const existing = useAttendanceStore.getState().attendances.find((a) => a.id === attendance.id);
      if (existing) {
        updateAttendance(attendance.id, attendance);
      } else {
        addAttendance(attendance);
      }
      showFeedback({ tone: 'success', title: t('attendance.saveSuccess'), message: t('attendance.saveSuccessMsg') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('attendance.saveFailMsg');
      showFeedback({ tone: 'error', title: t('attendance.saveFail'), message: msg });
    }
  }, [addAttendance, updateAttendance, showFeedback]);

  // 삭제 핸들러 (가상 레코드는 삭제 불가)
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || !projectId) return;
    if (isDefaultAttendance(pendingDelete.id)) { setPendingDelete(null); return; }
    try {
      await deleteAttendanceById(projectId, pendingDelete.id);
      removeAttendance(pendingDelete.id);
      showFeedback({ tone: 'success', title: t('attendance.deleteSuccess'), message: t('attendance.deleteSuccessMsg') });
    } catch {
      showFeedback({ tone: 'error', title: t('attendance.deleteFail'), message: t('attendance.deleteFailMsg') });
    }
    setPendingDelete(null);
  }, [pendingDelete, projectId, removeAttendance, showFeedback]);

  const handleCellClick = (date: Date) => {
    if (!canEdit) return;
    setDefaultDate(format(date, 'yyyy-MM-dd'));
    setDefaultMemberId(filterMemberId !== 'all' ? filterMemberId : undefined);
    setEditingRecord(null);
    setShowModal(true);
  };

  const handleEditClick = (record: Attendance) => {
    // 가상 레코드(기본 출근)는 편집 불가
    if (isDefaultAttendance(record.id)) return;
    setEditingRecord(record);
    setShowModal(true);
  };

  const handleAddClick = () => {
    setDefaultDate(format(new Date(), 'yyyy-MM-dd'));
    setDefaultMemberId(undefined);
    setEditingRecord(null);
    setShowModal(true);
  };

  // 현재 월의 근태 필터링
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // 기본 출근을 포함한 근태 데이터 (스토어 getWithDefaults 사용)
  const getWithDefaults = useAttendanceStore((s) => s.getWithDefaults);
  const allAttendancesForMonth = useMemo(() => {
    const startStr = format(monthStart, 'yyyy-MM-dd');
    const endStr = format(monthEnd, 'yyyy-MM-dd');
    return getWithDefaults(members, startStr, endStr);
  }, [attendances, monthStart, monthEnd, members, getWithDefaults]);

  const filteredAttendances = useMemo(() => {
    return allAttendancesForMonth.filter((a) => {
      const memberMatch = filterMemberId === 'all' || a.memberId === filterMemberId;
      return memberMatch;
    });
  }, [allAttendancesForMonth, filterMemberId]);

  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.name || t('attendance.unknown');

  // 월간 요약 통계
  const monthlySummary = useMemo(() => {
    const summary: Record<string, Record<AttendanceType, number>> = {};
    for (const m of members) {
      summary[m.id] = {} as Record<AttendanceType, number>;
    }
    for (const a of filteredAttendances) {
      if (!summary[a.memberId]) summary[a.memberId] = {} as Record<AttendanceType, number>;
      summary[a.memberId][a.type] = (summary[a.memberId][a.type] || 0) + 1;
    }
    return summary;
  }, [filteredAttendances, members]);

  if (!canViewAttendance) {
    return (
      <div className="empty-state px-6 py-14">
        <CalendarCheck className="h-14 w-14 text-[color:var(--text-muted)]" />
        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{t('attendance.noPermission')}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {feedback && <FeedbackNotice tone={feedback.tone} title={feedback.title} message={feedback.message} onClose={clearFeedback} />}

      {/* 헤더 */}
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className="app-panel-dark relative overflow-hidden p-6 md:p-8"
          style={{
            backgroundImage: `radial-gradient(circle at 84% 18%, ${(projectTone?.accent || '#18a79b')}2c, transparent 26%), radial-gradient(circle at 20% 84%, ${(projectTone?.accent || '#18a79b')}16, transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))`,
          }}
        >
          <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-56 w-56 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${(projectTone?.accent || '#18a79b')}24, transparent 70%)` }} />
          <div className="relative">
            <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
              {ToneIcon ? <ToneIcon className="h-3.5 w-3.5" style={{ color: projectTone?.accent }} /> : <CalendarCheck className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />}
              Attendance
            </div>
            <h1 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-[-0.06em] text-white">
              {t('attendance.title')}
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {currentProject?.name}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">
              {t('attendance.heroDesc')}
            </p>
            <div className="mt-8 flex items-center gap-3">
              {canEdit && (
                <Button onClick={handleAddClick}>
                  <Plus className="w-4 h-4" />
                  {t('attendance.register')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-1">
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Total Records</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">{filteredAttendances.length}</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('attendance.recordCount', { month: format(currentMonth, t('attendance.monthFormat'), { locale: getDateFnsLocale() }) })}</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Leave Days</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {filteredAttendances.filter((a) => ['annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave'].includes(a.type)).length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('attendance.leaveDaysDesc')}</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Business Trip</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {filteredAttendances.filter((a) => a.type === 'business_trip').length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t('attendance.businessTripDesc')}</p>
          </div>
        </div>
      </section>

      {/* 툴바 */}
      <section className="app-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentMonth((m) => addMonths(m, -1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              {format(currentMonth, t('attendance.monthFormat'), { locale: getDateFnsLocale() })}
            </h3>
            <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())} className="rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]">
              {t('attendance.today')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              className="field-select w-auto min-w-[8rem] py-2"
            >
              <option value="all">{t('attendance.allMembers')}</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="flex rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-tertiary)] p-0.5">
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'calendar' ? 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-sm' : 'text-[color:var(--text-secondary)]'
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {t('attendance.calendarView')}
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'list' ? 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-sm' : 'text-[color:var(--text-secondary)]'
                )}
              >
                <List className="h-3.5 w-3.5" />
                {t('attendance.listView')}
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <CalendarView
            currentMonth={currentMonth}
            attendances={filteredAttendances}
            members={members}
            getMemberName={getMemberName}
            onCellClick={handleCellClick}
            onEditClick={handleEditClick}
            canEdit={canEdit}
            t={t}
          />
        ) : (
          <ListView
            attendances={filteredAttendances}
            getMemberName={getMemberName}
            onEditClick={handleEditClick}
            onDeleteClick={setPendingDelete}
            canEdit={canEdit}
            t={t}
            locale={getDateLocale()}
          />
        )}
      </section>

      {/* 월간 요약 테이블 */}
      {members.length > 0 && (
        <section className="app-panel overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-6 py-5">
            <p className="page-kicker">Monthly Summary</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {t('attendance.monthlySummary')}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-tertiary)]">
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">
                    <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{t('attendance.member')}</div>
                  </th>
                  {(['present', 'annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave', 'business_trip', 'late', 'early_leave', 'absence'] as AttendanceType[]).map((at) => (
                    <th key={at} className="px-3 py-3 text-center font-medium text-[color:var(--text-secondary)]">
                      <div className="flex items-center justify-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[at] }} />
                        {t(`labels.attendanceType.${at}`)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border-color)] hover:bg-[color:var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[color:var(--text-primary)]">{m.name}</td>
                    {(['present', 'annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave', 'business_trip', 'late', 'early_leave', 'absence'] as AttendanceType[]).map((at) => (
                      <td key={at} className="px-3 py-3 text-center text-[color:var(--text-secondary)]">
                        {monthlySummary[m.id]?.[at] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 모달 */}
      {showModal && (
        <AttendanceModal
          key={editingRecord?.id || `new:${defaultDate || ''}:${defaultMemberId || ''}`}
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingRecord(null); }}
          onSave={handleSave}
          members={members}
          projectId={projectId!}
          editingAttendance={editingRecord}
          defaultDate={defaultDate}
          defaultMemberId={defaultMemberId}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={t('attendance.deleteTitle')}
        description={pendingDelete ? t('attendance.deleteConfirmDesc', { name: getMemberName(pendingDelete.memberId), date: pendingDelete.date, type: t(`labels.attendanceType.${pendingDelete.type}`) }) : ''}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
      />
    </div>
  );
}

// ── Calendar View ──────────────────────────────────────────

interface CalendarViewProps {
  currentMonth: Date;
  attendances: Attendance[];
  members: { id: string; name: string }[];
  getMemberName: (id: string) => string;
  onCellClick: (date: Date) => void;
  onEditClick: (record: Attendance) => void;
  canEdit: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function CalendarView({ currentMonth, attendances, getMemberName, onCellClick, onEditClick, canEdit, t }: CalendarViewProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // 공휴일 이름 맵 (캘린더에 표시되는 연도들)
  const holidayNames = useMemo(() => {
    const years = new Set<number>();
    for (const d of days) years.add(d.getFullYear());
    const map = new Map<string, string>();
    for (const y of years) {
      for (const [k, v] of getKoreanHolidayNames(y)) map.set(k, v);
    }
    return map;
  }, [days]);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    for (const a of attendances) {
      const list = map.get(a.date) || [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [attendances]);

  const dayHeaders = [
    t('attendance.daySun'), t('attendance.dayMon'), t('attendance.dayTue'),
    t('attendance.dayWed'), t('attendance.dayThu'), t('attendance.dayFri'), t('attendance.daySat'),
  ];

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-px rounded-xl border border-[var(--border-color)] bg-[var(--border-color)] overflow-hidden">
        {dayHeaders.map((d, i) => (
          <div key={d} className={cn(
            'bg-[color:var(--bg-tertiary)] px-2 py-2.5 text-center text-xs font-semibold',
            i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-[color:var(--text-secondary)]'
          )}>
            {d}
          </div>
        ))}

        {weeks.map((week) =>
          week.map((d) => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayAttendances = attendanceByDate.get(dateStr) || [];
            const inMonth = isSameMonth(d, currentMonth);
            const today = isToday(d);
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const holiday = holidayNames.get(dateStr);
            const isHoliday = Boolean(holiday);
            const isNonWorkday = isWeekend || isHoliday;

            // 기본 출근과 사용자 등록 근태 분리
            const defaultRecords = dayAttendances.filter((a) => isDefaultAttendance(a.id));
            const userRecords = dayAttendances.filter((a) => !isDefaultAttendance(a.id));
            const defaultPresentCount = defaultRecords.filter((a) => a.type === 'present').length;

            return (
              <div
                key={dateStr}
                onClick={() => canEdit && inMonth && !isNonWorkday && onCellClick(d)}
                className={cn(
                  'min-h-[5.5rem] bg-[color:var(--bg-primary)] p-1.5 transition-colors',
                  !inMonth && 'opacity-30',
                  canEdit && inMonth && !isNonWorkday && 'cursor-pointer hover:bg-[color:var(--bg-tertiary)]',
                  isWeekend && 'bg-[color:var(--bg-elevated)]',
                  isHoliday && !isWeekend && 'bg-red-50/60 dark:bg-red-950/20'
                )}
              >
                <div className={cn(
                  'mb-1 text-xs font-medium',
                  today && 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white',
                  !today && dayOfWeek === 6 && 'text-blue-500',
                  !today && (dayOfWeek === 0 || isHoliday) && 'text-red-500',
                  !today && !isWeekend && !isHoliday && 'text-[color:var(--text-secondary)]'
                )}>
                  {format(d, 'd')}
                </div>
                {/* Holiday display */}
                {isHoliday && inMonth && (
                  <div className="mb-0.5 truncate px-0.5 text-[9px] font-medium text-red-500" title={holiday}>
                    {holiday}
                  </div>
                )}
                {/* Attendance: workdays only */}
                {!isNonWorkday && (
                  <div className="space-y-0.5">
                    {defaultPresentCount > 0 && (
                      <div className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight text-[color:var(--text-muted)]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ATTENDANCE_TYPE_COLORS.present }} />
                        <span>{t('labels.attendanceType.present')} {defaultPresentCount}{t('attendance.personsUnit')}</span>
                      </div>
                    )}
                    {userRecords.slice(0, 3).map((a) => (
                      <button
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); onEditClick(a); }}
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight hover:bg-black/5 dark:hover:bg-white/5 truncate"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[a.type] }} />
                        <span className="truncate text-[color:var(--text-secondary)]" title={`${getMemberName(a.memberId)} ${t(`labels.attendanceType.${a.type}`)}`}>
                          {getMemberName(a.memberId)} {t(`labels.attendanceType.${a.type}`)}
                        </span>
                      </button>
                    ))}
                    {userRecords.length > 3 && (
                      <span className="block px-1 text-[10px] text-[color:var(--text-muted)]">{t('attendance.moreItems', { count: userRecords.length - 3 })}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── List View ──────────────────────────────────────────────

interface ListViewProps {
  attendances: Attendance[];
  getMemberName: (id: string) => string;
  onEditClick: (record: Attendance) => void;
  onDeleteClick: (record: Attendance) => void;
  canEdit: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  locale: string;
}

function ListView({ attendances, getMemberName, onEditClick, onDeleteClick, canEdit, t }: ListViewProps) {
  const sorted = useMemo(() =>
    [...attendances].sort((a, b) => b.date.localeCompare(a.date) || getMemberName(a.memberId).localeCompare(getMemberName(b.memberId))),
    [attendances, getMemberName]
  );

  if (sorted.length === 0) {
    return (
      <div className="empty-state px-6 py-14">
        <CalendarCheck className="h-14 w-14 text-[color:var(--text-muted)]" />
        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{t('attendance.noRecords')}</h3>
        <p className="text-sm text-[color:var(--text-secondary)]">{t('attendance.noRecordsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-tertiary)]">
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">{t('attendance.date')}</th>
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">{t('attendance.assignee')}</th>
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">{t('attendance.type')}</th>
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">{t('attendance.reason')}</th>
            {canEdit && <th className="px-4 py-3 text-center font-medium text-[color:var(--text-secondary)]">{t('attendance.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const isDefault = isDefaultAttendance(a.id);
            return (
              <tr key={a.id} className={cn(
                'border-b border-[var(--border-color)] hover:bg-[color:var(--bg-tertiary)] transition-colors',
                isDefault && 'opacity-60'
              )}>
                <td className="px-4 py-3 text-[color:var(--text-primary)] whitespace-nowrap">{a.date}</td>
                <td className="px-4 py-3 text-[color:var(--text-primary)]">{getMemberName(a.memberId)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${ATTENDANCE_TYPE_COLORS[a.type]}18`, color: ATTENDANCE_TYPE_COLORS[a.type] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[a.type] }} />
                    {t(`labels.attendanceType.${a.type}`)}
                    {isDefault && ` (${t('attendance.auto')})`}
                  </span>
                </td>
                <td className="px-4 py-3 text-[color:var(--text-secondary)]">{a.note || (isDefault ? t('attendance.defaultPresent') : '-')}</td>
                {canEdit && (
                  <td className="px-4 py-3">
                    {!isDefault ? (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onEditClick(a)} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onDeleteClick(a)} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] hover:bg-[rgba(203,75,95,0.08)] hover:text-[color:var(--accent-danger)]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[color:var(--text-muted)]">-</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
