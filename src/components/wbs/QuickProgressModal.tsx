import { useState, useMemo, useCallback } from 'react';
import { CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { cn, formatDate } from '../../lib/utils';
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
    const today = new Date().toISOString().split('T')[0];
    const task = tasks.find((t) => t.id === taskId);
    onUpdateTask(taskId, {
      actualProgress: 100,
      status: 'completed',
      actualEnd: today,
      actualStart: task?.actualStart || task?.planStart || today,
      updatedAt: new Date().toISOString(),
    });
  };

  const hasChanges = Object.keys(localChanges).some(
    (id) => Object.keys(localChanges[id]).length > 0
  );

  const isDelayed = (task: Task) => {
    if (!task.planEnd) return false;
    const planEnd = new Date(task.planEnd);
    const now = new Date();
    return now > planEnd && task.status !== 'completed';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="빠른 실적 입력" size="xl">
      <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div className="border-b border-[var(--border-color)] px-6 py-3">
          <p className="text-sm text-[color:var(--text-secondary)]">
            진행 중이거나 대기 중인 leaf 작업만 표시됩니다. 변경 후 "일괄 적용"을 눌러주세요.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="surface-badge text-xs">
              <Clock3 className="h-3 w-3" />
              {activeTasks.length}개 작업
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {activeTasks.length === 0 ? (
            <div className="empty-state min-h-[12rem]">
              <p>진행할 작업이 없습니다</p>
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
                              지연
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-[color:var(--text-primary)]" title={task.name || '이름 없는 작업'}>
                          {task.name || '이름 없는 작업'}
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">
                          {task.assigneeId ? memberMap[task.assigneeId] || '미지정' : '미지정'}
                          {task.planEnd && ` · 계획 종료: ${formatDate(task.planEnd)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkComplete(task.id)}
                        className="flex items-center gap-1 rounded-full border border-[rgba(31,163,122,0.2)] bg-[rgba(31,163,122,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-success)] transition-colors hover:bg-[rgba(31,163,122,0.16)]"
                        title="완료 처리"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        완료
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex w-20 items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={progress}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            const num = Math.min(100, Math.max(0, parseInt(raw) || 0));
                            handleLocalChange(task.id, 'actualProgress', raw === '' ? 0 : num);
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
                          실적시작
                        </label>
                        <input
                          type="date"
                          value={(getEffectiveValue(task, 'actualStart') as string) || ''}
                          onChange={(e) =>
                            handleLocalChange(task.id, 'actualStart', e.target.value || null)
                          }
                          className="mt-0.5 w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] px-2 py-1 text-sm text-[color:var(--text-primary)] outline-none focus:border-[rgba(15,118,110,0.4)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                          실적종료
                        </label>
                        <input
                          type="date"
                          value={(getEffectiveValue(task, 'actualEnd') as string) || ''}
                          onChange={(e) =>
                            handleLocalChange(task.id, 'actualEnd', e.target.value || null)
                          }
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
            닫기
          </Button>
          <Button onClick={handleApplyAll} disabled={!hasChanges}>
            일괄 적용
          </Button>
        </div>
      </div>
    </Modal>
  );
}
