import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import KanbanCard from './KanbanCard';
import type { Task, ProjectMember } from '../../types';

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  allTasks: Task[];
  members: ProjectMember[];
  canEditTask: (task: Task) => boolean;
  onEditTask?: (task: Task) => void;
  accentColor?: string;
}

export default function KanbanColumn({
  title,
  tasks,
  allTasks,
  members,
  canEditTask,
  onEditTask,
  accentColor,
}: KanbanColumnProps) {
  const childTasksMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      map.set(
        task.id,
        allTasks.filter((t) => t.parentId === task.id)
      );
    }
    return map;
  }, [tasks, allTasks]);

  return (
    <div
      className={cn(
        'flex flex-col min-w-[320px] rounded-2xl',
        'bg-[var(--bg-secondary-solid)]',
        'border border-[var(--border-color)]'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        {accentColor && (
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
        )}
        <h3 className="font-semibold text-sm text-[var(--text-primary)]">
          {title}
        </h3>
        <span
          className={cn(
            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
            'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 max-h-[calc(100vh-240px)]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--text-muted)]">
            등록된 작업이 없습니다
          </div>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              childTasks={childTasksMap.get(task.id) ?? []}
              members={members}
              canEdit={canEditTask(task)}
              onEditClick={onEditTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
