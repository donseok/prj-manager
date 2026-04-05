import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Save, AlertTriangle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import type { Attendance, AttendanceType, ProjectMember } from '../../types';
import { ATTENDANCE_TYPE_LABELS, ATTENDANCE_TYPE_COLORS } from '../../types';
import { generateId } from '../../lib/utils';
import { isKoreanHoliday, getKoreanHolidayNames } from '../../lib/koreanHolidays';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (attendance: Attendance) => void;
  members: ProjectMember[];
  projectId: string;
  editingAttendance?: Attendance | null;
  defaultDate?: string;
  defaultMemberId?: string;
}

const attendanceTypes: AttendanceType[] = [
  'present', 'annual_leave', 'half_day_am', 'half_day_pm',
  'sick_leave', 'business_trip', 'late', 'early_leave', 'absence',
];

function getInitialMemberId(
  editingAttendance: Attendance | null | undefined,
  defaultMemberId: string | undefined,
  members: ProjectMember[]
) {
  if (editingAttendance) return editingAttendance.memberId;
  return defaultMemberId || (members[0]?.id ?? '');
}

function getInitialDate(editingAttendance: Attendance | null | undefined, defaultDate: string | undefined) {
  if (editingAttendance) return editingAttendance.date;
  return defaultDate || new Date().toISOString().slice(0, 10);
}

function getInitialType(editingAttendance: Attendance | null | undefined): AttendanceType {
  return editingAttendance?.type || 'present';
}

function getInitialNote(editingAttendance: Attendance | null | undefined) {
  return editingAttendance?.note || '';
}

export default function AttendanceModal({
  isOpen,
  onClose,
  onSave,
  members,
  projectId,
  editingAttendance,
  defaultDate,
  defaultMemberId,
}: AttendanceModalProps) {
  const { t } = useTranslation();
  const [memberId, setMemberId] = useState(() => getInitialMemberId(editingAttendance, defaultMemberId, members));
  const [date, setDate] = useState(() => getInitialDate(editingAttendance, defaultDate));
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<AttendanceType>(() => getInitialType(editingAttendance));
  const [note, setNote] = useState(() => getInitialNote(editingAttendance));
  const [useRange, setUseRange] = useState(false);

  const isEdit = Boolean(editingAttendance);

  // 공휴일 경고
  const holidayWarning = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + 'T00:00:00');
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return '주말입니다.';
    if (isKoreanHoliday(d)) {
      const names = getKoreanHolidayNames(d.getFullYear());
      const name = names.get(date);
      return name ? `공휴일(${name})입니다.` : '공휴일입니다.';
    }
    return null;
  }, [date]);

  const handleSubmit = () => {
    if (!memberId || !date) return;

    if (useRange && endDate && endDate > date) {
      // 범위 등록: 각 날짜에 대해 개별 레코드 생성
      const current = new Date(date);
      const end = new Date(endDate);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        // 주말 및 공휴일 제외
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isKoreanHoliday(current)) {
          const now = new Date().toISOString();
          onSave({
            id: generateId(),
            projectId,
            memberId,
            date: current.toISOString().slice(0, 10),
            type,
            note: note || undefined,
            createdAt: now,
            updatedAt: now,
          });
        }
        current.setDate(current.getDate() + 1);
      }
    } else {
      const now = new Date().toISOString();
      onSave({
        id: editingAttendance?.id || generateId(),
        projectId,
        memberId,
        date,
        type,
        note: note || undefined,
        createdAt: editingAttendance?.createdAt || now,
        updatedAt: now,
      });
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('attendanceModal.editTitle') : t('attendanceModal.createTitle')} size="md">
      <div className="space-y-4 p-6">
        {/* 담당자 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">{t('attendanceModal.assignee')}</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="field-select w-full py-2.5"
            disabled={isEdit}
          >
            <option value="">{t('attendanceModal.selectPlaceholder')}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* 날짜 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">{t('attendanceModal.date')}</label>
            {!isEdit && (
              <label className="flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRange}
                  onChange={(e) => setUseRange(e.target.checked)}
                  className="rounded border-[var(--border-color)]"
                />
                {t('attendanceModal.dateRange')}
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field-input flex-1 py-2.5"
            />
            {useRange && !isEdit && (
              <>
                <span className="flex items-center text-sm text-[color:var(--text-secondary)]">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={date}
                  className="field-input flex-1 py-2.5"
                />
              </>
            )}
          </div>
          {holidayWarning && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {holidayWarning} 근태 등록이 필요한지 확인하세요.
            </div>
          )}
        </div>

        {/* 근태유형 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">{t('attendanceModal.attendanceType')}</label>
          <div className="grid grid-cols-2 gap-2">
            {attendanceTypes.map((at) => (
              <button
                key={at}
                type="button"
                onClick={() => setType(at)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  type === at
                    ? 'border-[var(--accent-primary)] bg-[rgba(15,118,110,0.08)] text-[color:var(--text-primary)]'
                    : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:border-[rgba(15,118,110,0.2)]'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[at] }}
                />
                {ATTENDANCE_TYPE_LABELS[at]}
              </button>
            ))}
          </div>
        </div>

        {/* 사유/비고 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">{t('attendanceModal.reasonNote')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field-input w-full py-2.5"
            placeholder={t('attendanceModal.reasonPlaceholder')}
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!memberId || !date}>
            {isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? t('attendanceModal.update') : useRange && endDate ? t('attendanceModal.bulkRegister') : t('attendanceModal.register')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
