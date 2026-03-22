import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarCheck, Plus, Trash2, Edit2, ChevronLeft, ChevronRight,
  Calendar as CalendarIcon, List, Users,
} from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths,
  addDays, format, isSameMonth, isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { useProjectStore } from '../store/projectStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useProjectPermission } from '../hooks/useProjectPermission';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { loadAttendances, upsertAttendance, deleteAttendanceById } from '../lib/dataRepository';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn } from '../lib/utils';
import Button from '../components/common/Button';
import ConfirmModal from '../components/common/ConfirmModal';
import FeedbackNotice from '../components/common/FeedbackNotice';
import AttendanceModal from '../components/attendance/AttendanceModal';
import type { Attendance, AttendanceType } from '../types';
import { ATTENDANCE_TYPE_LABELS, ATTENDANCE_TYPE_COLORS } from '../types';

type ViewMode = 'calendar' | 'list';

export default function Attendance() {
  const { projectId } = useParams<{ projectId: string }>();
  const { members, currentProject } = useProjectStore();
  const { attendances, setAttendances, addAttendance, updateAttendance, removeAttendance } = useAttendanceStore();
  const { canEditAllAttendance, canEditOwnAttendance, canViewAttendance } = useProjectPermission();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();

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
      showFeedback({ tone: 'success', title: '저장 완료', message: '근태가 저장되었습니다.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '근태 저장에 실패했습니다.';
      showFeedback({ tone: 'error', title: '저장 실패', message: msg });
    }
  }, [addAttendance, updateAttendance, showFeedback]);

  // 삭제 핸들러
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || !projectId) return;
    try {
      await deleteAttendanceById(projectId, pendingDelete.id);
      removeAttendance(pendingDelete.id);
      showFeedback({ tone: 'success', title: '삭제 완료', message: '근태 기록이 삭제되었습니다.' });
    } catch {
      showFeedback({ tone: 'error', title: '삭제 실패', message: '삭제에 실패했습니다.' });
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

  const filteredAttendances = useMemo(() => {
    return attendances.filter((a) => {
      const dateMatch = a.date >= format(monthStart, 'yyyy-MM-dd') && a.date <= format(monthEnd, 'yyyy-MM-dd');
      const memberMatch = filterMemberId === 'all' || a.memberId === filterMemberId;
      return dateMatch && memberMatch;
    });
  }, [attendances, monthStart, monthEnd, filterMemberId]);

  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.name || '알 수 없음';

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
        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">접근 권한이 없습니다</h3>
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
              근태현황
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {currentProject?.name}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">
              프로젝트 멤버의 출결 상태를 캘린더와 리스트로 한눈에 확인할 수 있습니다.
            </p>
            <div className="mt-8 flex items-center gap-3">
              {canEdit && (
                <Button onClick={handleAddClick}>
                  <Plus className="w-4 h-4" />
                  근태 등록
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
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{format(currentMonth, 'yyyy년 M월', { locale: ko })} 등록 건수</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Leave Days</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {filteredAttendances.filter((a) => ['annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave'].includes(a.type)).length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">연차/반차/병가</p>
          </div>
          <div className="metric-card p-6">
            <p className="eyebrow-stat">Business Trip</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {filteredAttendances.filter((a) => a.type === 'business_trip').length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">출장</p>
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
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </h3>
            <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())} className="rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]">
              오늘
            </button>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              className="field-select w-auto min-w-[8rem] py-2"
            >
              <option value="all">전체 멤버</option>
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
                캘린더
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'list' ? 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-sm' : 'text-[color:var(--text-secondary)]'
                )}
              >
                <List className="h-3.5 w-3.5" />
                리스트
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
          />
        ) : (
          <ListView
            attendances={filteredAttendances}
            getMemberName={getMemberName}
            onEditClick={handleEditClick}
            onDeleteClick={setPendingDelete}
            canEdit={canEdit}
          />
        )}
      </section>

      {/* 월간 요약 테이블 */}
      {members.length > 0 && (
        <section className="app-panel overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-6 py-5">
            <p className="page-kicker">Monthly Summary</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              멤버별 월간 요약
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-tertiary)]">
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">
                    <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />멤버</div>
                  </th>
                  {(['present', 'annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave', 'business_trip', 'late', 'early_leave', 'absence'] as AttendanceType[]).map((t) => (
                    <th key={t} className="px-3 py-3 text-center font-medium text-[color:var(--text-secondary)]">
                      <div className="flex items-center justify-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[t] }} />
                        {ATTENDANCE_TYPE_LABELS[t]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border-color)] hover:bg-[color:var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-3 font-medium text-[color:var(--text-primary)]">{m.name}</td>
                    {(['present', 'annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave', 'business_trip', 'late', 'early_leave', 'absence'] as AttendanceType[]).map((t) => (
                      <td key={t} className="px-3 py-3 text-center text-[color:var(--text-secondary)]">
                        {monthlySummary[m.id]?.[t] || '-'}
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
        title="근태 삭제"
        description={pendingDelete ? `${getMemberName(pendingDelete.memberId)}의 ${pendingDelete.date} ${ATTENDANCE_TYPE_LABELS[pendingDelete.type]} 기록을 삭제합니다.` : ''}
        confirmLabel="삭제"
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
}

function CalendarView({ currentMonth, attendances, getMemberName, onCellClick, onEditClick, canEdit }: CalendarViewProps) {
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

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, Attendance[]>();
    for (const a of attendances) {
      const list = map.get(a.date) || [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [attendances]);

  const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];

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

            return (
              <div
                key={dateStr}
                onClick={() => canEdit && inMonth && !isWeekend && onCellClick(d)}
                className={cn(
                  'min-h-[5.5rem] bg-[color:var(--bg-primary)] p-1.5 transition-colors',
                  !inMonth && 'opacity-30',
                  canEdit && inMonth && !isWeekend && 'cursor-pointer hover:bg-[color:var(--bg-tertiary)]',
                  isWeekend && 'bg-[color:var(--bg-elevated)]'
                )}
              >
                <div className={cn(
                  'mb-1 text-xs font-medium',
                  today && 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white',
                  !today && dayOfWeek === 6 && 'text-blue-500',
                  !today && dayOfWeek === 0 && 'text-red-500',
                  !today && !isWeekend && 'text-[color:var(--text-secondary)]'
                )}>
                  {format(d, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayAttendances.slice(0, 3).map((a) => (
                    <button
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); onEditClick(a); }}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight hover:bg-black/5 dark:hover:bg-white/5 truncate"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[a.type] }} />
                      <span className="truncate text-[color:var(--text-secondary)]">
                        {getMemberName(a.memberId)} {ATTENDANCE_TYPE_LABELS[a.type]}
                      </span>
                    </button>
                  ))}
                  {dayAttendances.length > 3 && (
                    <span className="block px-1 text-[10px] text-[color:var(--text-muted)]">+{dayAttendances.length - 3}건</span>
                  )}
                </div>
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
}

function ListView({ attendances, getMemberName, onEditClick, onDeleteClick, canEdit }: ListViewProps) {
  const sorted = useMemo(() =>
    [...attendances].sort((a, b) => b.date.localeCompare(a.date) || getMemberName(a.memberId).localeCompare(getMemberName(b.memberId))),
    [attendances, getMemberName]
  );

  if (sorted.length === 0) {
    return (
      <div className="empty-state px-6 py-14">
        <CalendarCheck className="h-14 w-14 text-[color:var(--text-muted)]" />
        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">등록된 근태가 없습니다</h3>
        <p className="text-sm text-[color:var(--text-secondary)]">근태 등록 버튼을 눌러 첫 기록을 추가하세요.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-tertiary)]">
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">날짜</th>
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">담당자</th>
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">유형</th>
            <th className="px-4 py-3 text-left font-medium text-[color:var(--text-secondary)]">사유</th>
            {canEdit && <th className="px-4 py-3 text-center font-medium text-[color:var(--text-secondary)]">관리</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.id} className="border-b border-[var(--border-color)] hover:bg-[color:var(--bg-tertiary)] transition-colors">
              <td className="px-4 py-3 text-[color:var(--text-primary)] whitespace-nowrap">{a.date}</td>
              <td className="px-4 py-3 text-[color:var(--text-primary)]">{getMemberName(a.memberId)}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${ATTENDANCE_TYPE_COLORS[a.type]}18`, color: ATTENDANCE_TYPE_COLORS[a.type] }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[a.type] }} />
                  {ATTENDANCE_TYPE_LABELS[a.type]}
                </span>
              </td>
              <td className="px-4 py-3 text-[color:var(--text-secondary)]">{a.note || '-'}</td>
              {canEdit && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onEditClick(a)} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onDeleteClick(a)} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--text-secondary)] hover:bg-[rgba(203,75,95,0.08)] hover:text-[color:var(--accent-danger)]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
