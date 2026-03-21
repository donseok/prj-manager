import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import type { Attendance, AttendanceType, ProjectMember } from '../../types';
import { ATTENDANCE_TYPE_LABELS, ATTENDANCE_TYPE_COLORS } from '../../types';
import { generateId } from '../../lib/utils';

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
  const [memberId, setMemberId] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<AttendanceType>('present');
  const [note, setNote] = useState('');
  const [useRange, setUseRange] = useState(false);

  const isEdit = Boolean(editingAttendance);

  useEffect(() => {
    if (!isOpen) return;
    if (editingAttendance) {
      setMemberId(editingAttendance.memberId);
      setDate(editingAttendance.date);
      setEndDate('');
      setType(editingAttendance.type);
      setNote(editingAttendance.note || '');
      setUseRange(false);
    } else {
      setMemberId(defaultMemberId || (members[0]?.id ?? ''));
      setDate(defaultDate || new Date().toISOString().slice(0, 10));
      setEndDate('');
      setType('present');
      setNote('');
      setUseRange(false);
    }
  }, [isOpen, editingAttendance, defaultDate, defaultMemberId, members]);

  const handleSubmit = () => {
    if (!memberId || !date) return;

    if (useRange && endDate && endDate > date) {
      // 범위 등록: 각 날짜에 대해 개별 레코드 생성
      const current = new Date(date);
      const end = new Date(endDate);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        // 주말 제외 (토:6, 일:0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? '근태 수정' : '근태 등록'} size="md">
      <div className="space-y-4 p-6">
        {/* 담당자 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">담당자</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="field-select w-full py-2.5"
            disabled={isEdit}
          >
            <option value="">선택하세요</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* 날짜 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-[color:var(--text-secondary)]">날짜</label>
            {!isEdit && (
              <label className="flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRange}
                  onChange={(e) => setUseRange(e.target.checked)}
                  className="rounded border-[var(--border-color)]"
                />
                범위 선택
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
        </div>

        {/* 근태유형 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">근태유형</label>
          <div className="grid grid-cols-2 gap-2">
            {attendanceTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  type === t
                    ? 'border-[var(--accent-primary)] bg-[rgba(15,118,110,0.08)] text-[color:var(--text-primary)]'
                    : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:border-[rgba(15,118,110,0.2)]'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ATTENDANCE_TYPE_COLORS[t] }}
                />
                {ATTENDANCE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 사유/비고 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-secondary)]">사유/비고</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field-input w-full py-2.5"
            placeholder="사유를 입력하세요 (선택)"
          />
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 border-t border-[var(--border-color)] pt-4">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={!memberId || !date}>
            {isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? '수정' : useRange && endDate ? '일괄 등록' : '등록'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
