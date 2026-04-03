import { useState, useEffect, useCallback, useRef } from 'react';
import { X, CheckCircle2, Circle, Calendar, User, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Task, ProjectMember, TaskStatus } from '../../types';
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '../../types';
import { format } from 'date-fns';

interface KanbanTaskEditModalProps {
  task: Task;
  childTasks: Task[];
  members: ProjectMember[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
}

const STATUS_PILL_CLASSES: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function KanbanTaskEditModal({
  task,
  childTasks,
  members,
  isOpen,
  onClose,
  onSave,
}: KanbanTaskEditModalProps) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [actualProgress, setActualProgress] = useState<number>(task.actualProgress);
  const [actualStart, setActualStart] = useState<string>(task.actualStart || '');
  const [actualEnd, setActualEnd] = useState<string>(task.actualEnd || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset local state when task changes
  const [prevTaskId, setPrevTaskId] = useState(task.id);
  if (task.id !== prevTaskId) {
    setPrevTaskId(task.id);
    setStatus(task.status);
    setActualProgress(task.actualProgress);
    setActualStart(task.actualStart || '');
    setActualEnd(task.actualEnd || '');
    setErrors({});
  }

  // Enter animation on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isDirty =
    status !== task.status ||
    actualProgress !== task.actualProgress ||
    actualStart !== (task.actualStart || '') ||
    actualEnd !== (task.actualEnd || '');

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (actualProgress < 0 || actualProgress > 100 || !Number.isInteger(actualProgress)) {
      newErrors.actualProgress = '실적 진행률은 0~100 사이의 정수여야 합니다.';
    }

    if (actualStart && actualEnd && actualStart > actualEnd) {
      newErrors.actualEnd = '실적 종료일은 실적 시작일 이후여야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [actualProgress, actualStart, actualEnd]);

  const handleStatusChange = (newStatus: TaskStatus) => {
    setStatus(newStatus);

    if (newStatus === 'completed') {
      setActualProgress(100);
      if (!actualEnd) {
        setActualEnd(getTodayString());
      }
    }

    if (newStatus === 'in_progress') {
      if (!actualStart) {
        setActualStart(getTodayString());
      }
    }
  };

  const handleProgressChange = (value: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(value)));
    setActualProgress(clamped);

    if (clamped === 100 && status !== 'completed') {
      setStatus('completed');
      if (!actualEnd) {
        setActualEnd(getTodayString());
      }
    }
  };

  const handleSave = () => {
    if (!validate()) return;

    const updates: Partial<Task> = {};

    if (status !== task.status) updates.status = status;
    if (actualProgress !== task.actualProgress) updates.actualProgress = actualProgress;
    if (actualStart !== (task.actualStart || '')) updates.actualStart = actualStart || null;
    if (actualEnd !== (task.actualEnd || '')) updates.actualEnd = actualEnd || null;

    onSave(task.id, updates);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const assignee = task.assigneeId
    ? members.find((m) => m.id === task.assigneeId)
    : null;

  const statusColor = TASK_STATUS_COLORS[status];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div
        className={cn(
          'relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[color:var(--bg-secondary-solid)] shadow-2xl transition-all duration-200',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        style={{
          background: 'var(--bg-secondary-solid)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-6 pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-[color:var(--text-primary)]">
              {task.name || '이름 없음'}
            </h2>
            <div className="mt-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                  STATUS_PILL_CLASSES[statusColor] || STATUS_PILL_CLASSES.gray
                )}
              >
                {TASK_STATUS_LABELS[status]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Read-only Info Section */}
          <div className="space-y-3">
            {/* Assignee */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 flex-shrink-0 text-[color:var(--text-muted)]" />
              <span className="text-sm text-[color:var(--text-secondary)]">담당자</span>
              <span className="ml-auto text-sm font-medium text-[color:var(--text-primary)]">
                {assignee ? (
                  <span className="inline-flex items-center gap-2">
                    {assignee.avatarUrl ? (
                      <img
                        src={assignee.avatarUrl}
                        alt={assignee.name}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-[10px] font-bold text-white">
                        {assignee.name.charAt(0)}
                      </span>
                    )}
                    {assignee.name}
                  </span>
                ) : (
                  <span className="text-[color:var(--text-muted)]">미지정</span>
                )}
              </span>
            </div>

            {/* Plan Period */}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 flex-shrink-0 text-[color:var(--text-muted)]" />
              <span className="text-sm text-[color:var(--text-secondary)]">계획 기간</span>
              <span className="ml-auto text-sm text-[color:var(--text-primary)]">
                {task.planStart && task.planEnd
                  ? `${task.planStart} ~ ${task.planEnd}`
                  : task.planStart || task.planEnd || '-'}
              </span>
            </div>

            {/* Plan Progress */}
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 flex-shrink-0 text-[color:var(--text-muted)]" />
              <span className="text-sm text-[color:var(--text-secondary)]">계획 진행률</span>
              <span className="ml-auto text-sm font-medium text-[color:var(--text-primary)]">
                {task.planProgress}%
              </span>
            </div>
          </div>

          {/* Child Tasks Checklist (read-only) */}
          {childTasks.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[color:var(--text-primary)]">
                하위 작업
              </h3>
              <div className="space-y-1.5 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-3">
                {childTasks.map((child) => (
                  <div key={child.id} className="flex items-center gap-2">
                    {child.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[color:var(--accent-success)]" />
                    ) : (
                      <Circle className="h-4 w-4 flex-shrink-0 text-[color:var(--text-muted)]" />
                    )}
                    <span
                      className={cn(
                        'truncate text-sm',
                        child.status === 'completed'
                          ? 'text-[color:var(--text-muted)] line-through'
                          : 'text-[color:var(--text-primary)]'
                      )}
                    >
                      {child.name || '이름 없음'}
                    </span>
                    <span className="ml-auto text-xs text-[color:var(--text-muted)]">
                      {child.actualProgress}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <hr className="border-[var(--border-color)]" />

          {/* Editable Fields */}
          <div className="space-y-4">
            {/* Status */}
            <div>
              <label className="field-label">상태</label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="field-select"
              >
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Actual Progress */}
            <div>
              <label className="field-label">실적 진행률</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={actualProgress}
                  onChange={(e) => handleProgressChange(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[color:var(--bg-tertiary)] accent-[var(--accent-primary)]"
                />
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={actualProgress}
                    onChange={(e) => handleProgressChange(Number(e.target.value) || 0)}
                    className="field-input w-20 pr-7 text-right"
                  />
                  <span className="pointer-events-none absolute right-3 text-sm text-[color:var(--text-muted)]">
                    %
                  </span>
                </div>
              </div>
              {errors.actualProgress && (
                <p className="mt-1 text-xs text-[color:var(--accent-danger)]">
                  {errors.actualProgress}
                </p>
              )}
            </div>

            {/* Actual Start */}
            <div>
              <label className="field-label">실적 시작일</label>
              <input
                type="date"
                value={actualStart}
                onChange={(e) => setActualStart(e.target.value)}
                className="field-input"
              />
            </div>

            {/* Actual End */}
            <div>
              <label className="field-label">실적 종료일</label>
              <input
                type="date"
                value={actualEnd}
                onChange={(e) => setActualEnd(e.target.value)}
                className="field-input"
              />
              {errors.actualEnd && (
                <p className="mt-1 text-xs text-[color:var(--accent-danger)]">
                  {errors.actualEnd}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-2.5 text-sm font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-tertiary)]"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={cn(
              'rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all',
              isDirty
                ? 'bg-[image:var(--gradient-primary)] shadow-[0_8px_24px_-8px_rgba(15,118,110,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(15,118,110,0.6)]'
                : 'cursor-not-allowed bg-[color:var(--bg-tertiary)] text-[color:var(--text-muted)] opacity-50'
            )}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

export default KanbanTaskEditModal;
