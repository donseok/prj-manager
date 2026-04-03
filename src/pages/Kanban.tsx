import { useCallback, useMemo, useState } from 'react';
import {
  Search,
  LayoutGrid,
  Users,
  Layers3,
  ListChecks,
  Target,
  Clock3,
  CheckCircle2,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn } from '../lib/utils';
import FeedbackNotice from '../components/common/FeedbackNotice';
import KanbanColumn from '../components/kanban/KanbanColumn';
import KanbanTaskEditModal from '../components/kanban/KanbanTaskEditModal';
import { syncProjectWorkspace } from '../lib/projectTaskSync';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useProjectPermission, useCurrentMemberId } from '../hooks/useProjectPermission';
import { canEditSpecificTask } from '../lib/permissions';
import { getLeafTasks, getAssigneeName } from '../lib/taskAnalytics';
import { calculateOverallProgress } from '../lib/utils';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS } from '../types';

type GroupBy = 'phase' | 'assignee' | 'status';
type FilterMode = 'all' | 'in_progress' | 'completed';

const FILTER_OPTIONS: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
];

const GROUP_OPTIONS: Array<{ value: GroupBy; label: string; icon: typeof Layers3 }> = [
  { value: 'phase', label: 'Phase별', icon: Layers3 },
  { value: 'assignee', label: '담당자별', icon: Users },
  { value: 'status', label: '상태별', icon: ListChecks },
];

const STATUS_COLUMN_ORDER: TaskStatus[] = ['pending', 'in_progress', 'completed', 'on_hold'];
const STATUS_ACCENT_COLORS: Record<TaskStatus, string> = {
  pending: '#8B95A5',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  on_hold: '#eab308',
};

function getPhaseAncestor(taskId: string, taskMap: Map<string, Task>): Task | null {
  let current = taskMap.get(taskId);
  while (current) {
    if (current.level === 1) return current;
    if (!current.parentId) return null;
    current = taskMap.get(current.parentId);
  }
  return null;
}

interface ColumnDef {
  id: string;
  title: string;
  tasks: Task[];
  accentColor?: string;
}

export default function Kanban() {
  const { tasks, updateTask, loadedProjectId } = useTaskStore();
  const { currentProject, members, updateProject } = useProjectStore();
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;

  const [groupBy, setGroupBy] = useState<GroupBy>('phase');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const permissions = useProjectPermission();
  const currentMemberId = useCurrentMemberId();

  // Auto-save (same pattern as Gantt.tsx)
  const saveTasks = useCallback(
    async (data: Task[]) => {
      if (!currentProject) return;
      const { project } = await syncProjectWorkspace(currentProject, data, { skipNormalize: true });
      updateProject(project.id, project);
    },
    [currentProject, updateProject]
  );
  useAutoSave(tasks, saveTasks, {
    projectId: currentProject?.id,
    loadedProjectId,
  });

  // Pre-compute maps
  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  const leafTasks = useMemo(() => getLeafTasks(tasks), [tasks]);

  // Stats
  const stats = useMemo(() => {
    const total = leafTasks.length;
    const inProgress = leafTasks.filter((t) => t.status === 'in_progress').length;
    const completed = leafTasks.filter((t) => t.status === 'completed').length;
    const overallProgress = calculateOverallProgress(tasks);
    return { total, inProgress, completed, overallProgress };
  }, [tasks, leafTasks]);

  // Filtering
  const filteredTasks = useMemo(() => {
    const baseTasks = groupBy === 'phase'
      ? tasks.filter((t) => t.level === 3 || (t.level === 2 && !tasks.some((c) => c.parentId === t.id)))
      : leafTasks;

    let result = baseTasks;

    if (filterMode === 'in_progress') {
      result = result.filter((t) => t.status !== 'completed');
    } else if (filterMode === 'completed') {
      result = result.filter((t) => t.status === 'completed');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          getAssigneeName(t, members).toLowerCase().includes(q)
      );
    }

    return result;
  }, [tasks, leafTasks, members, filterMode, searchQuery, groupBy]);

  // Columns
  const columns = useMemo((): ColumnDef[] => {
    if (groupBy === 'phase') {
      // Group level-2 tasks by their level-1 ancestor
      const phaseGroups = new Map<string, { phase: Task; tasks: Task[] }>();
      const noPhase: Task[] = [];

      for (const t of filteredTasks) {
        const phase = getPhaseAncestor(t.id, taskMap);
        if (phase) {
          const group = phaseGroups.get(phase.id);
          if (group) {
            group.tasks.push(t);
          } else {
            phaseGroups.set(phase.id, { phase, tasks: [t] });
          }
        } else {
          noPhase.push(t);
        }
      }

      const sorted = [...phaseGroups.values()].sort(
        (a, b) => a.phase.orderIndex - b.phase.orderIndex
      );

      const cols: ColumnDef[] = sorted.map((g) => ({
        id: g.phase.id,
        title: g.phase.name || '이름 없음',
        tasks: g.tasks.sort((a, b) => a.orderIndex - b.orderIndex),
        accentColor: projectTone?.accent || '#0f766e',
      }));

      if (noPhase.length > 0) {
        cols.push({
          id: '__no_phase__',
          title: '미분류',
          tasks: noPhase,
        });
      }

      return cols;
    }

    if (groupBy === 'assignee') {
      const assigneeGroups = new Map<string, { name: string; tasks: Task[] }>();
      const unassigned: Task[] = [];

      for (const t of filteredTasks) {
        if (!t.assigneeId) {
          unassigned.push(t);
          continue;
        }
        const group = assigneeGroups.get(t.assigneeId);
        if (group) {
          group.tasks.push(t);
        } else {
          const member = members.find((m) => m.id === t.assigneeId);
          assigneeGroups.set(t.assigneeId, {
            name: member?.name || '미지정',
            tasks: [t],
          });
        }
      }

      const cols: ColumnDef[] = [...assigneeGroups.entries()].map(([id, g]) => ({
        id,
        title: g.name,
        tasks: g.tasks,
        accentColor: '#0f766e',
      }));

      if (unassigned.length > 0) {
        cols.unshift({
          id: '__unassigned__',
          title: '미배정',
          tasks: unassigned,
          accentColor: '#8B95A5',
        });
      }

      return cols;
    }

    // status
    return STATUS_COLUMN_ORDER.map((status) => ({
      id: status,
      title: TASK_STATUS_LABELS[status],
      tasks: filteredTasks.filter((t) => t.status === status),
      accentColor: STATUS_ACCENT_COLORS[status],
    }));
  }, [filteredTasks, groupBy, taskMap, members, projectTone]);

  // Task edit handlers
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
  };

  const handleSaveTask = (taskId: string, updates: Partial<Task>) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !canEditSpecificTask(permissions, task, currentMemberId)) {
      showFeedback({
        tone: 'warning',
        title: '권한 없음',
        message: '이 작업을 편집할 권한이 없습니다.',
      });
      return;
    }

    updateTask(taskId, { ...updates, updatedAt: new Date().toISOString() });
    setEditingTask(null);
    showFeedback({
      tone: 'success',
      title: '저장 완료',
      message: '작업이 업데이트되었습니다.',
    });
  };

  const canEditTask = useCallback(
    (task: Task) => canEditSpecificTask(permissions, task, currentMemberId),
    [permissions, currentMemberId]
  );

  // Child tasks for the editing modal
  const editingChildTasks = useMemo(() => {
    if (!editingTask) return [];
    return tasks
      .filter((t) => t.parentId === editingTask.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [editingTask, tasks]);

  return (
    <div className="flex h-full flex-col gap-6">
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      {/* Hero Section */}
      <section
        className="app-panel-dark relative overflow-hidden p-6 md:p-8"
        style={{
          backgroundImage: `radial-gradient(circle at 86% 18%, ${(projectTone?.accent || '#18a79b')}30, transparent 26%), radial-gradient(circle at 18% 84%, ${(projectTone?.accent || '#18a79b')}18, transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))`,
        }}
      >
        <div
          className="pointer-events-none absolute right-[-6rem] top-[-6rem] h-64 w-64 rounded-full blur-3xl"
          style={{
            background: `radial-gradient(circle, ${(projectTone?.accent || '#18a79b')}24, transparent 70%)`,
          }}
        />
        <div className="relative">
          <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
            {ToneIcon ? (
              <ToneIcon className="h-3.5 w-3.5" style={{ color: projectTone?.accent }} />
            ) : (
              <LayoutGrid className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
            )}
            {projectTone?.label || 'Kanban Board'}
          </div>
          <h1 className="mt-5 text-[clamp(2rem,4vw,3.6rem)] font-semibold tracking-[-0.06em] text-white">
            {currentProject?.name || '프로젝트'} 칸반 보드
          </h1>
          {projectTone && (
            <p
              className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase"
              style={{ color: projectTone.accent }}
            >
              {projectTone.note}
            </p>
          )}
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
            작업을 시각적으로 분류하고, 상태별/담당자별/Phase별로 그룹핑하여 진행 현황을 한눈에 파악할 수 있습니다.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">전체 작업</p>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.total}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
              <div className="flex items-center gap-1.5">
                <Clock3 className="h-3 w-3 text-white/60" />
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">진행중</p>
              </div>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.inProgress}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-white/60" />
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">완료</p>
              </div>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.completed}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
              <div className="flex items-center gap-1.5">
                <Target className="h-3 w-3 text-white/60" />
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">전체 진척률</p>
              </div>
              <p className="mt-2 text-3xl font-semibold text-white">{stats.overallProgress}%</p>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="app-panel flex flex-wrap items-center gap-3 px-5 py-3">
        {/* Left: Filter tabs */}
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterMode(opt.value)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                filterMode === opt.value
                  ? 'bg-[rgba(15,118,110,0.14)] text-[color:var(--accent-primary)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mx-1 h-5 w-px bg-[var(--border-color)]" />

        {/* Center: Group-by toggle */}
        <div className="flex items-center gap-1">
          {GROUP_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  groupBy === opt.value
                    ? 'bg-[rgba(15,118,110,0.14)] text-[color:var(--accent-primary)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Right: Search */}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="작업명, 담당자 검색"
            className="h-9 w-56 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] pl-10 pr-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[rgba(15,118,110,0.34)]"
          />
        </div>
      </section>

      {/* Kanban Board */}
      <section className="flex-1 overflow-x-auto overflow-y-hidden px-1">
        <div className="flex gap-4 h-full pb-4">
          {columns.length > 0 ? (
            columns.map((col) => (
              <KanbanColumn
                key={col.id}
                title={col.title}
                tasks={col.tasks}
                allTasks={tasks}
                members={members}
                canEditTask={canEditTask}
                onEditTask={handleEditTask}
                accentColor={col.accentColor}
              />
            ))
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <LayoutGrid className="mx-auto h-12 w-12 text-[color:var(--text-muted)]" />
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
                  표시할 작업이 없습니다
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                  필터 조건을 조정하거나 WBS에서 작업을 추가하세요
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Edit Modal */}
      {editingTask && (
        <KanbanTaskEditModal
          task={editingTask}
          childTasks={editingChildTasks}
          members={members}
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onSave={handleSaveTask}
        />
      )}
    </div>
  );
}
