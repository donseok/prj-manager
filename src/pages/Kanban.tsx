import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  LayoutGrid,
  Users,
  Layers3,
  ListChecks,
  Target,
  Clock3,
  CheckCircle2,
  ExternalLink,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { openPopup } from '../lib/popupWindow';

type GroupBy = 'phase' | 'assignee' | 'status';
type FilterMode = 'all' | 'in_progress' | 'completed';

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
  const { t } = useTranslation();
  const { tasks, updateTask, loadedProjectId } = useTaskStore();
  const { currentProject, members, updateProject } = useProjectStore();
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;

  const isInPopup = window.location.pathname.startsWith('/popup/');

  const [groupBy, setGroupBy] = useState<GroupBy>('phase');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(
    () => currentProject?.settings?.kanbanSummaryCollapsed ?? false
  );
  const toggleSummary = useCallback(() => {
    setSummaryCollapsed((prev) => {
      const next = !prev;
      if (currentProject) {
        const newSettings = { ...currentProject.settings, kanbanSummaryCollapsed: next };
        updateProject(currentProject.id, { settings: newSettings });
      }
      return next;
    });
  }, [currentProject, updateProject]);

  const FILTER_OPTIONS: Array<{ value: FilterMode; label: string }> = [
    { value: 'all', label: t('kanban.filterAll') },
    { value: 'in_progress', label: t('kanban.filterInProgress') },
    { value: 'completed', label: t('kanban.filterCompleted') },
  ];

  const GROUP_OPTIONS: Array<{ value: GroupBy; label: string; icon: typeof Layers3 }> = [
    { value: 'phase', label: t('kanban.groupPhase'), icon: Layers3 },
    { value: 'assignee', label: t('kanban.groupAssignee'), icon: Users },
    { value: 'status', label: t('kanban.groupStatus'), icon: ListChecks },
  ];

  // 프로젝트 전환 시 접기 상태 동기화
  useEffect(() => {
    setSummaryCollapsed(currentProject?.settings?.kanbanSummaryCollapsed ?? false);
  }, [currentProject?.id]);

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
    for (const tk of tasks) map.set(tk.id, tk);
    return map;
  }, [tasks]);

  const leafTasks = useMemo(() => getLeafTasks(tasks), [tasks]);

  // Stats
  const stats = useMemo(() => {
    const total = leafTasks.length;
    const inProgress = leafTasks.filter((tk) => tk.status === 'in_progress').length;
    const completed = leafTasks.filter((tk) => tk.status === 'completed').length;
    const overallProgress = calculateOverallProgress(tasks);
    return { total, inProgress, completed, overallProgress };
  }, [tasks, leafTasks]);

  // Filtering
  const filteredTasks = useMemo(() => {
    // phase 그룹 시에도 leafTasks를 사용하여 모든 실제 작업을 표시
    const baseTasks = leafTasks;

    let result = baseTasks;

    if (filterMode === 'in_progress') {
      result = result.filter((tk) => tk.status !== 'completed');
    } else if (filterMode === 'completed') {
      result = result.filter((tk) => tk.status === 'completed');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (tk) =>
          tk.name.toLowerCase().includes(q) ||
          getAssigneeName(tk, members).toLowerCase().includes(q)
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

      for (const tk of filteredTasks) {
        const phase = getPhaseAncestor(tk.id, taskMap);
        if (phase) {
          const group = phaseGroups.get(phase.id);
          if (group) {
            group.tasks.push(tk);
          } else {
            phaseGroups.set(phase.id, { phase, tasks: [tk] });
          }
        } else {
          noPhase.push(tk);
        }
      }

      const sorted = [...phaseGroups.values()].sort(
        (a, b) => a.phase.orderIndex - b.phase.orderIndex
      );

      const cols: ColumnDef[] = sorted.map((g) => ({
        id: g.phase.id,
        title: g.phase.name || t('kanban.unnamed'),
        tasks: g.tasks.sort((a, b) => a.orderIndex - b.orderIndex),
        accentColor: projectTone?.accent || '#0f766e',
      }));

      if (noPhase.length > 0) {
        cols.push({
          id: '__no_phase__',
          title: t('kanban.uncategorized'),
          tasks: noPhase,
        });
      }

      return cols;
    }

    if (groupBy === 'assignee') {
      const assigneeGroups = new Map<string, { name: string; tasks: Task[] }>();
      const unassigned: Task[] = [];

      for (const tk of filteredTasks) {
        if (!tk.assigneeId) {
          unassigned.push(tk);
          continue;
        }
        const group = assigneeGroups.get(tk.assigneeId);
        if (group) {
          group.tasks.push(tk);
        } else {
          const member = members.find((m) => m.id === tk.assigneeId);
          assigneeGroups.set(tk.assigneeId, {
            name: member?.name || t('kanban.unspecified'),
            tasks: [tk],
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
          title: t('kanban.unassigned'),
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
      tasks: filteredTasks.filter((tk) => tk.status === status),
      accentColor: STATUS_ACCENT_COLORS[status],
    }));
  }, [filteredTasks, groupBy, taskMap, members, projectTone]);

  // Task edit handlers
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
  };

  const handleSaveTask = (taskId: string, updates: Partial<Task>) => {
    const task = tasks.find((tk) => tk.id === taskId);
    if (!task || !canEditSpecificTask(permissions, task, currentMemberId)) {
      showFeedback({
        tone: 'warning',
        title: t('kanban.noPermission'),
        message: t('kanban.noPermissionMessage'),
      });
      return;
    }

    updateTask(taskId, { ...updates, updatedAt: new Date().toISOString() });
    setEditingTask(null);
    showFeedback({
      tone: 'success',
      title: t('kanban.saveComplete'),
      message: t('kanban.taskUpdated'),
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
      .filter((tk) => tk.parentId === editingTask.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [editingTask, tasks]);

  // ── 팝업 모드: 칸반 보드만 꽉 차게 표시 ──
  if (isInPopup) {
    return (
      <div className="flex h-full flex-col">
        {feedback && (
          <FeedbackNotice
            tone={feedback.tone}
            title={feedback.title}
            message={feedback.message}
            onClose={clearFeedback}
          />
        )}

        {/* 컴팩트 툴바 */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-2">
          <div className="relative flex-shrink-0 w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="field-input"
              style={{ paddingLeft: '3rem' }}
            />
          </div>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterMode(opt.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                filterMode === opt.value
                  ? 'bg-[rgba(15,118,110,0.14)] text-[color:var(--accent-primary)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
              )}
            >
              {opt.label}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-[var(--border-color)]" />
          {GROUP_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
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
          <div className="ml-auto flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
            <span>{t('kanban.taskCount', { count: stats.total })}</span>
            <span>·</span>
            <span>{stats.overallProgress}%</span>
          </div>
        </div>

        {/* 칸반 보드 */}
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4">
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
                  {t('kanban.noTasksToShow')}
                </p>
              </div>
            </div>
          )}
        </div>

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

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-6">
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      {/* Hero Section */}
      {summaryCollapsed ? (
        <div className="app-panel flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-4">
            {ToneIcon && <ToneIcon className="h-5 w-5" style={{ color: projectTone?.accent }} />}
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
              {currentProject?.name || t('common.project')} {t('kanban.kanbanBoard')}
            </h2>
            <div className="flex items-center gap-3 text-sm text-[color:var(--text-secondary)]">
              <span>{t('kanban.totalTasks')}: <strong className="text-[color:var(--text-primary)]">{stats.total}</strong></span>
              <span className="h-3.5 w-px bg-[var(--border-color)]" />
              <span>{t('kanban.filterInProgress')}: <strong className="text-[color:var(--text-primary)]">{stats.inProgress}</strong></span>
              <span className="h-3.5 w-px bg-[var(--border-color)]" />
              <span>{t('kanban.overallProgress')}: <strong className="text-[color:var(--text-primary)]">{stats.overallProgress}%</strong></span>
            </div>
          </div>
          <button
            onClick={toggleSummary}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {t('kanban.expandSummary')}
          </button>
        </div>
      ) : (
      <section className="relative">
        <button
          onClick={toggleSummary}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          {t('kanban.collapseSummary')}
        </button>
        <div
          className="app-panel-dark relative overflow-hidden p-6 md:p-8"
          style={{
            backgroundImage: `radial-gradient(circle at 86% 18%, ${(projectTone?.accent || '#18a79b')}30, transparent 26%), radial-gradient(circle at 18% 84%, ${(projectTone?.accent || '#18a79b')}18, transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))`,
          }}
        >
          <div className="pointer-events-none absolute right-[-6rem] top-[-6rem] h-64 w-64 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${(projectTone?.accent || '#18a79b')}24, transparent 70%)` }} />
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
              {currentProject?.name || t('common.project')} {t('kanban.kanbanBoard')}
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {projectTone.note}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
              {t('kanban.heroDescription')}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('kanban.totalTasks')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{stats.total}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <div className="flex items-center gap-1.5">
                  <Clock3 className="h-3 w-3 text-white/60" />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('kanban.filterInProgress')}</p>
                </div>
                <p className="mt-2 text-3xl font-semibold text-white">{stats.inProgress}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-white/60" />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('kanban.filterCompleted')}</p>
                </div>
                <p className="mt-2 text-3xl font-semibold text-white">{stats.completed}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3 w-3 text-white/60" />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('kanban.overallProgress')}</p>
                </div>
                <p className="mt-2 text-3xl font-semibold text-white">{stats.overallProgress}%</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

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
        <div className="relative ml-auto max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('kanban.searchPlaceholder')}
            className="field-input"
            style={{ paddingLeft: '3rem' }}
          />
        </div>
      </section>

      {/* Kanban Board */}
      <section className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-1">
        {currentProject && (
          <button
            onClick={() => openPopup({ projectId: currentProject.id, page: 'kanban' })}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
            title={t('kanban.openInNewWindow')}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
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
                  {t('kanban.noTasksToShow')}
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {t('kanban.adjustFilterHint')}
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
