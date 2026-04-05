import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { cn, formatDate, getLocalDateString } from '../../lib/utils';
import type { Task, ProjectMember } from '../../types';
import { LEVEL_LABELS } from '../../types';

interface QuickProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  members: ProjectMember[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

export default function QuickProgressModal({
  isOpen,
  onClose,
  tasks,
  members,
  onUpdateTask,
}: QuickProgressModalProps) {
  const { t } = useTranslation();
  const [localChanges, setLocalChanges] = useState<Record<string, Partial<Task>>>({});

  // Show only leaf tasks that are not completed
  const activeTasks = useMemo(() => {
    const parentIds = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!));
    return tasks
      .filter((t) => !parentIds.has(t.id) && t.status !== 'completed')
      .sort((a, b) => {
        // Sort: in_progress first, then by delay
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
        return (b.actualProgress || 0) - (a.actualProgress || 0);
      });
  }, [tasks]);

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.name])),
    [members]
  );

  const getEffectiveValue = useCallback(
    (task: Task, field: keyof Task) => {
      const changes = localChanges[task.id];
      if (changes && field in changes) return changes[field];
      return task[field];
    },
    [localChanges]
  );

  const handleLocalChange = (taskId: string, field: keyof Task, value: unknown) => {
    setLocalChanges((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value },
    }));
  };

  const handleApplyAll = () => {
    for (const [taskId, changes] of Object.entries(localChanges)) {
      if (Object.keys(changes).length > 0) {
        onUpdateTask(taskId, { ...changes, updatedAt: new Date().toISOString() });
      }
    }
    setLocalChanges({});
    onClose();
  };

  const handleMarkComplete = (taskId: string) => {
    const today = getLocalDateString();
    const task = tasks.find((t) => t.id === taskId);
    onUpdateTask(taskId, {
      actualProgress: 100,
      status: 'completed',
      actualEnd: today,
      actualStart: task?.actualStart || task?.planStart || today,
      updatedAt: new Date().toISOString(),
    });
    // Clear local changes to prevent overwriting completed state on "Apply All"
    setLocalChanges((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };


  const isDelayed = (task: Task) => {
    if (!task.planEnd) return false;
    const planEnd = new Date(task.planEnd);
    const now = new Date();
    return now > planEnd && task.status !== 'completed';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('wbsComponents.quickProgress.title')} size="xl">
      <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="border-b border-[var(--border-color)] px-6 py-3">
          <p className="text-sm text-[color:var(--text-secondary)]">
            {t('wbsComponents.quickProgress.description')}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="surface-badge text-xs">
              <Clock3 className="h-3 w-3" />
              {t('wbsComponents.quickProgress.taskCount', { count: activeTasks.length })}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {activeTasks.length === 0 ? (
            <div className="empty-state min-h-[12rem]">
              <p>{t('wbsComponents.quickProgress.noTasks')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTasks.map((task) => {
                const progress = (getEffectiveValue(task, 'actualProgress') as number) ?? 0;
                const delayed = isDelayed(task);

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'rounded-[18px] border p-4 transition-colors',
                      delayed
                        ? 'border-[rgba(203,75,95,0.2)] bg-[rgba(203,75,95,0.04)]'
                        : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                            {LEVEL_LABELS[task.level]}
                          </span>
                          {delayed && (
                            <span className="flex items-center gap-1 rounded-full bg-[rgba(203,75,95,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent-danger)]">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {t('wbsComponents.quickProgress.delayed')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-[color:var(--text-primary)]" title={task.name || t('wbsComponents.quickProgress.unnamedTask')}>
                          {task.name || t('wbsComponents.quickProgress.unnamedTask')}
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
                          {task.assigneeId ? memberMap[task.assigneeId] || t('wbsComponents.quickProgress.unassigned') : t('wbsComponents.quickProgress.unassigned')}
                          {task.planEnd && ` · ${t('wbsComponents.quickProgress.planEnd')}: ${formatDate(task.planEnd)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkComplete(task.id)}
                        className="flex items-center gap-1 rounded-full border border-[rgba(31,163,122,0.2)] bg-[rgba(31,163,122,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-success)] transition-colors hover:bg-[rgba(31,163,122,0.16)]"
                        title={t('wbsComponents.quickProgress.markComplete')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('wbsComponents.quickProgress.complete')}
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex w-20 items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={progress}
                          onChange={(e) => {
                            const intPart = e.target.value.split('.')[0].replace(/[^0-9]/g, '');
                            const num = Math.min(100, Math.max(0, parseInt(intPart) || 0));
                            handleLocalChange(task.id, 'actualProgress', intPart === '' ? 0 : num);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === '.' || e.key === '-' || e.key === '+' || e.key === 'e') e.preventDefault();
                          }}
                          className="w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-2 py-1 text-center text-sm text-[color:var(--text-primary)] outline-none focus:border-[rgba(15,118,110,0.4)]"
                        />
                        <span className="text-xs text-[color:var(--text-muted)]">%</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                          {t('wbsComponents.quickProgress.actualStart')}
                        </label>
                        <input
                          type="date"
                          value={(getEffectiveValue(task, 'actualStart') as string) || ''}
                          onChange={(e) => {
                            const startVal = e.target.value || null;
                            handleLocalChange(task.id, 'actualStart', startVal);
                            const endVal = (getEffectiveValue(task, 'actualEnd') as string) || null;
                            if (startVal && endVal && endVal < startVal) {
                              handleLocalChange(task.id, 'actualEnd', startVal);
                            }
                          }}
                          className="mt-0.5 w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-2 py-1 text-sm text-[color:var(--text-primary)] outline-none focus:border-[rgba(15,118,110,0.4)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                          {t('wbsComponents.quickProgress.actualEnd')}
                        </label>
                        <input
                          type="date"
                          value={(getEffectiveValue(task, 'actualEnd') as string) || ''}
                          min={(getEffectiveValue(task, 'actualStart') as string) || undefined}
                          onChange={(e) => {
                            const endVal = e.target.value || null;
                            const startVal = (getEffectiveValue(task, 'actualStart') as string) || null;
                            if (endVal && startVal && endVal < startVal) {
                              handleLocalChange(task.id, 'actualEnd', startVal);
                            } else {
                              handleLocalChange(task.id, 'actualEnd', endVal);
                            }
                          }}
                          className="mt-0.5 w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-2 py-1 text-sm text-[color:var(--text-primary)] outline-none focus:border-[rgba(15,118,110,0.4)]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-color)] px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            {t('wbsComponents.quickProgress.close')}
          </Button>
          <Button onClick={handleApplyAll}>
            {t('wbsComponents.quickProgress.applyAll')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
