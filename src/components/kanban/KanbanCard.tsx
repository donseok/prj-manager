import { useMemo } from 'react';
import { Calendar, CheckCircle2, Circle, Pencil } from 'lucide-react';
import { cn, formatDate } from '../../lib/utils';
import type { Task, ProjectMember, TaskStatus } from '../../types';

interface KanbanCardProps {
  task: Task;
  childTasks: Task[];
  members: ProjectMember[];
  canEdit: boolean;
  onEditClick?: (task: Task) => void;
}

const AVATAR_COLORS = [
  '#0f766e', '#b45309', '#7c3aed', '#be185d',
  '#0369a1', '#c2410c', '#4338ca', '#15803d',
];

function hashStringToIndex(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % max;
}

const STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  pending: '#9ca3af',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  on_hold: '#eab308',
};

function isOverdue(task: Task): boolean {
  if (task.status === 'completed' || !task.planEnd) return false;
  return new Date(task.planEnd) < new Date();
}

function getProgressColor(task: Task): string {
  if (task.status === 'completed') return '#22c55e';
  if (isOverdue(task)) return '#ef4444';
  if (task.status === 'in_progress') return '#3b82f6';
  if (task.status === 'on_hold') return '#eab308';
  return '#9ca3af';
}

const MAX_CHECKLIST = 5;

export default function KanbanCard({ task, childTasks, members, canEdit, onEditClick }: KanbanCardProps) {
  const assignee = useMemo(() => {
    if (!task.assigneeId) return null;
    return members.find((m) => m.id === task.assigneeId) ?? null;
  }, [task.assigneeId, members]);

  const barColor = isOverdue(task) ? '#ef4444' : STATUS_BAR_COLORS[task.status];
  const progressColor = getProgressColor(task);
  const visibleChildren = childTasks.slice(0, MAX_CHECKLIST);
  const remainingCount = childTasks.length - MAX_CHECKLIST;

  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-[var(--border-color)]',
        'bg-[var(--bg-secondary-solid)] p-4 shadow-sm',
        'hover:shadow-md transition-shadow',
        canEdit ? 'cursor-pointer' : 'cursor-default'
      )}
      onClick={() => canEdit && onEditClick?.(task)}
    >
      {/* Status color bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: barColor }}
      />

      {/* Edit button (hover) */}
      {canEdit && (
        <button
          className={cn(
            'absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100',
            'bg-[var(--bg-elevated)] hover:bg-[var(--bg-tertiary)]',
            'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            'transition-all duration-150'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick?.(task);
          }}
        >
          <Pencil size={14} />
        </button>
      )}

      {/* Title */}
      <h4 className="mt-1 font-semibold text-sm text-[var(--text-primary)] truncate pr-8">
        {task.name}
      </h4>

      {/* Checklist */}
      {childTasks.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {visibleChildren.map((child) => (
            <li key={child.id} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              {child.status === 'completed' ? (
                <CheckCircle2 size={14} className="shrink-0 text-[var(--accent-success)]" />
              ) : (
                <Circle size={14} className="shrink-0 text-[var(--text-muted)]" />
              )}
              <span className="truncate">{child.name}</span>
            </li>
          ))}
          {remainingCount > 0 && (
            <li className="text-xs text-[var(--text-muted)] pl-5">
              +{remainingCount}개 더보기
            </li>
          )}
        </ul>
      )}

      {/* Date range */}
      {(task.planStart || task.planEnd) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Calendar size={13} className="shrink-0" />
          <span>
            {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
          </span>
        </div>
      )}

      {/* Bottom row: progress + assignee */}
      <div className="mt-3 flex items-center gap-3">
        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${task.actualProgress}%`,
                backgroundColor: progressColor,
              }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-[var(--text-muted)] min-w-[28px] text-right">
            {task.actualProgress}%
          </span>
        </div>

        {/* Assignee avatar */}
        {assignee && (
          <div className="relative group/avatar" title={assignee.name}>
            {assignee.avatarUrl ? (
              <img
                src={assignee.avatarUrl}
                alt={assignee.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-[var(--bg-secondary)]"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-[var(--bg-secondary)]"
                style={{
                  backgroundColor: AVATAR_COLORS[hashStringToIndex(assignee.name, AVATAR_COLORS.length)],
                }}
              >
                {assignee.name.charAt(0)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
