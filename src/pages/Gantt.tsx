import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
  CalendarRange,
  Clock3,
  Target,
  Download,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  CalendarClock,
  Users,
  Zap,
  MessageCircle,
} from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import GanttChart, { HEADER_HEIGHT } from '../components/wbs/GanttChart';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn, formatDate, getDelayDays, parseDate } from '../lib/utils';
import Button from '../components/common/Button';
import FeedbackNotice from '../components/common/FeedbackNotice';
import { exportGanttWorkbook } from '../lib/excel';
import { syncProjectWorkspace } from '../lib/projectTaskSync';
import { isSyncableField, syncTaskField } from '../lib/taskFieldSync';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useGanttDrag } from '../hooks/useGanttDrag';
import { useProjectPermission, useCurrentMemberId } from '../hooks/useProjectPermission';
import { canEditSpecificTask } from '../lib/permissions';
import { openPopup } from '../lib/popupWindow';
import type { Task } from '../types';
import { LEVEL_LABELS, TASK_STATUS_LABELS } from '../types';
import { getLeafTasks } from '../lib/taskAnalytics';
import { calculateCriticalPath } from '../lib/criticalPath';
import { useCommentStore } from '../store/commentStore';
import TaskCommentPanel from '../components/common/TaskCommentPanel';


type FilterMode = 'all' | 'active' | 'delayed' | 'completed';
type DensityMode = 'compact' | 'comfortable';

const VIEW_OPTIONS = [4, 8, 12] as const;
const DENSITY_OPTIONS: Array<{ value: DensityMode; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
];

export default function Gantt() {
  const { t } = useTranslation();
  const { tasks, flatTasks, loadedProjectId, toggleExpand, updateTask } = useTaskStore();
  const { currentProject, members, updateProject } = useProjectStore();

  const FILTER_OPTIONS: Array<{ value: FilterMode; label: string }> = [
    { value: 'all', label: t('gantt.filterAll') },
    { value: 'active', label: t('gantt.filterActive') },
    { value: 'delayed', label: t('gantt.filterDelayed') },
    { value: 'completed', label: t('gantt.filterCompleted') },
  ];
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [weeksToShow, setWeeksToShow] = useState<(typeof VIEW_OPTIONS)[number]>(8);
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [highlightWeekends, setHighlightWeekends] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(() => {
    try { return localStorage.getItem('gantt_summary_collapsed') === 'true'; } catch { return false; }
  });
  const isInPopup = window.location.pathname.startsWith('/popup/');
  const loadGanttComments = useCommentStore((s) => s.loadComments);
  const ganttComments = useCommentStore((s) => s.comments);
  const ganttCommentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of ganttComments) {
      map.set(c.taskId, (map.get(c.taskId) || 0) + 1);
    }
    return map;
  }, [ganttComments]);
  const setDependency = useCallback(
    (taskId: string, predecessorIds: string[]) => {
      updateTask(taskId, { predecessorIds });
    },
    [updateTask]
  );
  const toggleSummary = useCallback(() => {
    setSummaryCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('gantt_summary_collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const permissions = useProjectPermission();
  const currentMemberId = useCurrentMemberId();
  const { isReadOnly } = permissions;

  const tableRef = useRef<HTMLDivElement>(null);
  const scrollSourceRef = useRef<'left' | 'right' | null>(null);
  const [ganttToolbarHeight, setGanttToolbarHeight] = useState(52);
  const [ganttScrollTop, setGanttScrollTop] = useState<number | undefined>(undefined);
  const rowHeight = density === 'compact' ? 34 : 42;


  useEffect(() => {
    if (loadedProjectId) loadGanttComments(loadedProjectId);
  }, [loadedProjectId, loadGanttComments]);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getResponsiveWidth = useCallback((basis: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, Math.round(basis)));
  }, []);

  const mainLeftPanelWidth = useMemo(
    () => getResponsiveWidth(viewportWidth * (isInPopup ? 0.18 : 0.22), isInPopup ? 280 : 300, isInPopup ? 380 : 440),
    [getResponsiveWidth, viewportWidth, isInPopup]
  );
  const mainDayWidth = useMemo(
    () =>
      getResponsiveWidth(
        viewportWidth * (density === 'compact' ? (isInPopup ? 0.023 : 0.02) : (isInPopup ? 0.028 : 0.024)),
        density === 'compact' ? (isInPopup ? 36 : 32) : (isInPopup ? 48 : 44),
        density === 'compact' ? (isInPopup ? 50 : 42) : (isInPopup ? 64 : 54)
      ),
    [density, getResponsiveWidth, viewportWidth, isInPopup]
  );

  const handleDragUpdate = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      updateTask(taskId, updates);
    },
    [updateTask]
  );

  const { dragState, handleMouseDown: handleDragStart, isLeafTask: isDragLeafTask, getDragLabel } = useGanttDrag({
    dayWidth: mainDayWidth,
    allTasks: tasks,
    onUpdate: handleDragUpdate,
    isReadOnly,
  });

  const dragLabel = dragState ? getDragLabel(dragState) : undefined;

  const taskMap = useMemo(
    () => Object.fromEntries(tasks.map((task) => [task.id, task])),
    [tasks]
  );

  const { filteredFlatTasks, directMatchIds } = useMemo(() => {
    const directMatchIds = new Set<string>();
    const query = searchQuery.trim().toLowerCase();
    if (!query && filterMode === 'all') {
      return { filteredFlatTasks: flatTasks, directMatchIds };
    }

    const matchedIds = new Set<string>();
    const assigneeNameMap = Object.fromEntries(members.map((member) => [member.id, member.name]));

    const matchesFilter = (task: Task) => {
      const assigneeName = task.assigneeId ? assigneeNameMap[task.assigneeId] || '' : '';
      const matchesQuery =
        !query ||
        task.name.toLowerCase().includes(query) ||
        (task.output || '').toLowerCase().includes(query) ||
        assigneeName.toLowerCase().includes(query);

      const matchesMode =
        filterMode === 'all' ||
        (filterMode === 'active' && task.status !== 'completed') ||
        (filterMode === 'delayed' && getDelayDays(task) > 0) ||
        (filterMode === 'completed' && task.status === 'completed');

      return matchesQuery && matchesMode;
    };

    flatTasks.forEach((task) => {
      if (!matchesFilter(task)) return;

      directMatchIds.add(task.id);
      let current: Task | undefined = task;
      while (current) {
        matchedIds.add(current.id);
        current = current.parentId ? taskMap[current.parentId] : undefined;
      }
    });

    return {
      filteredFlatTasks: flatTasks.filter((task) => matchedIds.has(task.id)),
      directMatchIds,
    };
  }, [filterMode, flatTasks, members, searchQuery, taskMap]);

  const resolvedSelectedTaskId = useMemo(() => {
    if (filteredFlatTasks.length === 0) return null;
    if (selectedTaskId && filteredFlatTasks.some((task) => task.id === selectedTaskId)) {
      return selectedTaskId;
    }

    return (
      filteredFlatTasks.find((task) => getDelayDays(task) > 0)?.id ||
      filteredFlatTasks.find((task) => task.status !== 'completed')?.id ||
      filteredFlatTasks[0]?.id ||
      null
    );
  }, [filteredFlatTasks, selectedTaskId]);

  useEffect(() => {
    if (!resolvedSelectedTaskId || !tableRef.current) return;

    const rowIndex = filteredFlatTasks.findIndex((task) => task.id === resolvedSelectedTaskId);
    if (rowIndex < 0) return;

    tableRef.current.scrollTo({
      top: Math.max(HEADER_HEIGHT + rowIndex * rowHeight - rowHeight * 2, 0),
      behavior: 'smooth',
    });
  }, [filteredFlatTasks, resolvedSelectedTaskId, rowHeight]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === resolvedSelectedTaskId) ?? null,
    [resolvedSelectedTaskId, tasks]
  );

  const selectedAssignee = useMemo(
    () =>
      selectedTask?.assigneeId
        ? members.find((member) => member.id === selectedTask.assigneeId)?.name || t('gantt.unspecified')
        : t('gantt.unspecified'),
    [members, selectedTask, t]
  );

  const selectedDelay = selectedTask ? getDelayDays(selectedTask) : 0;
  const leafTasks = useMemo(() => getLeafTasks(tasks), [tasks]);
  const delayedCount = leafTasks.filter((task) => getDelayDays(task) > 0).length;
  const activeCount = leafTasks.filter((task) => task.status !== 'completed').length;

  const criticalPathResult = useMemo(() => calculateCriticalPath(tasks), [tasks]);
  const criticalTaskIds = useMemo(
    () => new Set(criticalPathResult.criticalTasks),
    [criticalPathResult]
  );

  // 마감 임박 작업 (leaf tasks only, sorted by planEnd ascending)
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    return leafTasks
      .filter((tk) => tk.status !== 'completed' && tk.planEnd)
      .sort((a, b) => {
        const da = parseISO(a.planEnd!);
        const db = parseISO(b.planEnd!);
        return da.getTime() - db.getTime();
      })
      .slice(0, 5)
      .map((tk) => {
        const endDate = parseISO(tk.planEnd!);
        const daysLeft = differenceInCalendarDays(endDate, today);
        return { ...tk, daysLeft };
      });
  }, [leafTasks]);

  // 담당자별 워크로드
  const assigneeWorkload = useMemo(() => {
    const activeTasks = leafTasks.filter((tk) => tk.status !== 'completed');
    const countMap = new Map<string, { name: string; total: number; delayed: number }>();

    for (const tk of activeTasks) {
      const key = tk.assigneeId || '__unassigned__';
      const entry = countMap.get(key) || {
        name: tk.assigneeId
          ? members.find((m) => m.id === tk.assigneeId)?.name || t('gantt.unspecified')
          : t('gantt.unassigned'),
        total: 0,
        delayed: 0,
      };
      entry.total += 1;
      if (getDelayDays(tk) > 0) entry.delayed += 1;
      countMap.set(key, entry);
    }

    return [...countMap.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [leafTasks, members, t]);

  const maxWorkload = useMemo(
    () => Math.max(...assigneeWorkload.map((a) => a.total), 1),
    [assigneeWorkload]
  );

  const saveTasks = useCallback(
    async (data: Task[]) => {
      if (!currentProject) return;
      const { project } = await syncProjectWorkspace(currentProject, data, { skipNormalize: true });
      updateProject(project.id, project);
    },
    [currentProject, updateProject]
  );
  const { saveStatus, lastSavedAt, saveNow } = useAutoSave(tasks, saveTasks, {
    projectId: currentProject?.id,
    loadedProjectId,
  });

  // Scroll sync: left task list → right gantt chart
  const handleLeftScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    if (scrollSourceRef.current === 'right') {
      scrollSourceRef.current = null;
      return;
    }
    scrollSourceRef.current = 'left';
    setGanttScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Scroll sync: right gantt chart → left task list
  const handleGanttScroll = useCallback((scrollTop: number) => {
    if (scrollSourceRef.current === 'left') {
      scrollSourceRef.current = null;
      return;
    }
    scrollSourceRef.current = 'right';
    if (tableRef.current) {
      tableRef.current.scrollTop = scrollTop;
    }
  }, []);


  const handleExportExcel = async () => {
    if (filteredFlatTasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: t('gantt.noTasksToExport'),
        message: t('gantt.noTasksToExportMessage'),
      });
      return;
    }

    try {
      await exportGanttWorkbook({
        projectName: currentProject?.name,
        tasks: filteredFlatTasks,
        members,
        filterLabel: FILTER_OPTIONS.find((option) => option.value === filterMode)?.label || t('gantt.filterAll'),
        searchQuery,
        weeksToShow,
      });
    } catch (error) {
      console.error('Gantt export failed:', error);
    }
  };

  const handleTaskFieldChange = (taskId: string, field: keyof Task, value: Task[keyof Task]) => {
    const task = tasks.find((item) => item.id === taskId);
    const hasChildren = task ? tasks.some((item) => item.parentId === taskId) : false;

    if (task && !hasChildren && isSyncableField(field)) {
      const { updates, changed } = syncTaskField(
        { ...task, [field]: value },
        field,
        value
      );

      if (changed) {
        updateTask(taskId, { [field]: value, ...updates, updatedAt: new Date().toISOString() });
        return;
      }
    }

    updateTask(taskId, { [field]: value, updatedAt: new Date().toISOString() });
  };

  const handleManualSave = () => {
    requestAnimationFrame(() => {
      void saveNow(useTaskStore.getState().tasks);
    });
  };

  // ── 팝업 모드: 간트 차트만 꽉 차게 표시 ──
  if (isInPopup) {
    return (
      <div className="flex h-full flex-col">
        {/* 컴팩트 툴바 */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-2">
          <div className="relative flex-shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('common.search')}
              className="h-8 w-48 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] pl-10 pr-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[rgba(15,118,110,0.34)]"
            />
          </div>
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterMode(option.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                filterMode === option.value
                  ? 'bg-[rgba(15,118,110,0.14)] text-[color:var(--accent-primary)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
              )}
            >
              {option.label}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-[var(--border-color)]" />
          {VIEW_OPTIONS.map((weeks) => (
            <button
              key={weeks}
              onClick={() => setWeeksToShow(weeks)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                weeksToShow === weeks
                  ? 'bg-[rgba(15,118,110,0.14)] text-[color:var(--accent-primary)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
              )}
            >
              {t('gantt.weeksUnit', { count: weeks })}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-[var(--border-color)]" />
          {DENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setDensity(option.value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                density === option.value
                  ? 'bg-[rgba(15,118,110,0.14)] text-[color:var(--accent-primary)]'
                  : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
              )}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => setHighlightWeekends((prev) => !prev)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
              highlightWeekends
                ? 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]'
                : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
            )}
          >
            {t('gantt.weekends')}
          </button>
          <div className="mx-1 h-4 w-px bg-[var(--border-color)]" />
          <button
            onClick={() => setShowCriticalPath((prev) => !prev)}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
              showCriticalPath
                ? 'bg-[rgba(203,75,95,0.12)] text-[#CB4B5F]'
                : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
            )}
          >
            <Zap className="h-3 w-3" />
            크리티컬 패스
          </button>
          {showCriticalPath && criticalPathResult.criticalTasks.length > 0 && (
            <span className="rounded-full bg-[rgba(203,75,95,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[#CB4B5F]">
              {criticalPathResult.criticalTasks.length}개 작업, 총 {criticalPathResult.totalDuration}일
            </span>
          )}
        </div>

        {/* 간트 차트 (좌측 작업목록 + 우측 차트) */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className="flex flex-shrink-0 flex-col border-r border-[var(--border-color)] bg-[color:var(--bg-elevated)]"
            style={{ width: mainLeftPanelWidth }}
          >
            <div
              className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4"
              style={{ height: ganttToolbarHeight }}
            >
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">{t('gantt.taskList')}</span>
              <span className="text-xs text-[color:var(--text-secondary)]">{filteredFlatTasks.length}{t('gantt.countUnit')}</span>
            </div>
            <div ref={tableRef} className="flex-1 overflow-auto scrollbar-visible" onScroll={handleLeftScroll}>
              <div
                className="sticky top-0 z-10 border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)]"
                style={{ height: HEADER_HEIGHT }}
              />
              {filteredFlatTasks.map((task) => {
                const hasChildren = tasks.some((item) => item.parentId === task.id);
                const isSelected = resolvedSelectedTaskId === task.id;
                const delayDays = getDelayDays(task);
                const isDimmed = filterMode !== 'all' && !directMatchIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex cursor-pointer items-center overflow-hidden border-b border-[var(--border-color)] px-3 transition-colors hover:bg-[rgba(15,118,110,0.05)]',
                      isSelected && 'bg-[rgba(15,118,110,0.08)]',
                      task.level === 1 && 'bg-[color:var(--bg-tertiary)] font-medium',
                      isDimmed && 'opacity-40'
                    )}
                    style={{
                      height: rowHeight,
                      minHeight: rowHeight,
                      maxHeight: rowHeight,
                      paddingLeft: `${(task.depth || 0) * 16 + 12}px`,
                    }}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    {hasChildren ? (
                      <button
                        onClick={(event) => { event.stopPropagation(); toggleExpand(task.id); }}
                        className="mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--bg-tertiary)]"
                      >
                        {task.isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[color:var(--text-secondary)]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[color:var(--text-secondary)]" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-sm leading-tight text-[color:var(--text-primary)]" title={task.name || undefined}>
                        {task.name || <span className="text-[color:var(--text-secondary)]">{t('gantt.unnamed')}</span>}
                      </p>
                    </div>
                    <span className="ml-2 flex-shrink-0 text-xs font-semibold text-[color:var(--text-secondary)]">
                      {task.actualProgress}%
                    </span>
                    {delayDays > 0 && (
                      <span className="ml-1 flex-shrink-0 rounded-full bg-[rgba(203,75,95,0.1)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--accent-danger)]">
                        +{delayDays}d
                      </span>
                    )}
                  </div>
                );
              })}
              {filteredFlatTasks.length === 0 && (
                <div className="empty-state min-h-[16rem] px-5">
                  <p>{t('gantt.noFilteredTasks')}</p>
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <GanttChart
              tasks={filteredFlatTasks}
              allTasks={tasks}
              selectedTaskId={resolvedSelectedTaskId}
              onTaskClick={(task) => setSelectedTaskId(task.id)}
              weeksToShow={weeksToShow}
              dayWidth={mainDayWidth}
              rowHeight={rowHeight}
              highlightWeekends={highlightWeekends}
              showCriticalPath={showCriticalPath}
              criticalTaskIds={criticalTaskIds}
              onVerticalScroll={handleGanttScroll}
              externalScrollTop={ganttScrollTop}
              onToolbarHeightChange={setGanttToolbarHeight}
              dragState={dragState}
              onDragStart={handleDragStart}
              isLeafTask={isDragLeafTask}
              dragLabel={dragLabel}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── 일반 모드: 전체 대시보드 레이아웃 ──
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

      {summaryCollapsed ? (
        <div className="app-panel flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-4">
            {ToneIcon && <ToneIcon className="h-5 w-5" style={{ color: projectTone?.accent }} />}
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
              {currentProject?.name || t('common.project')} {t('gantt.scheduleFlow')}
            </h2>
            <div className="flex items-center gap-3 text-sm text-[color:var(--text-secondary)]">
              <span>{t('gantt.displayedTasks')}: <strong className="text-[color:var(--text-primary)]">{filteredFlatTasks.length}</strong></span>
              <span className="h-3.5 w-px bg-[var(--border-color)]" />
              <span>{t('gantt.openTasks')}: <strong className="text-[color:var(--text-primary)]">{activeCount}</strong></span>
              <span className="h-3.5 w-px bg-[var(--border-color)]" />
              <span>{t('gantt.delayedTasks')}: <strong className="text-[color:var(--accent-danger)]">{delayedCount}</strong></span>
            </div>
          </div>
          <button
            onClick={toggleSummary}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {t('gantt.expandSummary', { defaultValue: '요약 펼치기' })}
          </button>
        </div>
      ) : (
      <section className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <button
          onClick={toggleSummary}
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          {t('gantt.collapseSummary', { defaultValue: '요약 접기' })}
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
              {ToneIcon ? <ToneIcon className="h-3.5 w-3.5" style={{ color: projectTone?.accent }} /> : <CalendarRange className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />}
              {projectTone?.label || 'Timeline Control'}
            </div>
            <h1 className="mt-5 text-[clamp(2rem,4vw,3.6rem)] font-semibold tracking-[-0.06em] text-white">
              {currentProject?.name || t('common.project')} {t('gantt.scheduleFlow')}
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {projectTone.note}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
              {t('gantt.heroDescription')}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('gantt.displayedTasks')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{filteredFlatTasks.length}</p>
                <p className="mt-1 text-sm text-white/88">{t('gantt.displayedTasksDesc')}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('gantt.openTasks')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{activeCount}</p>
                <p className="mt-1 text-sm text-white/88">{t('gantt.openTasksDesc')}</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('gantt.delayedTasks')}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{delayedCount}</p>
                <p className="mt-1 text-sm text-white/88">{t('gantt.delayedTasksDesc')}</p>
              </div>
            </div>

            {/* 마감 임박 작업 + 담당자별 워크로드 */}
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {/* 마감 임박 작업 */}
              <div className="rounded-[24px] border border-white/12 bg-white/[0.07] p-5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-white/70" />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('gantt.upcomingDeadlines')}</p>
                </div>
                {upcomingDeadlines.length > 0 ? (
                  <ul className="mt-4 space-y-2.5">
                    {upcomingDeadlines.map((dl) => (
                      <li
                        key={dl.id}
                        className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06]"
                        onClick={() => setSelectedTaskId(dl.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white/95" title={dl.name}>{dl.name}</p>
                          <p className="mt-0.5 text-xs text-white/55">{formatDate(dl.planEnd, 'M/d (EEE)')}</p>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          dl.daysLeft < 0
                            ? 'bg-red-500/20 text-red-300'
                            : dl.daysLeft <= 3
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-white/10 text-white/70'
                        )}>
                          {dl.daysLeft < 0 ? t('gantt.daysOverdue', { days: Math.abs(dl.daysLeft) }) : dl.daysLeft === 0 ? t('gantt.today') : `D-${dl.daysLeft}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-white/50">{t('gantt.noUpcomingDeadlines')}</p>
                )}
              </div>

              {/* 담당자별 워크로드 */}
              <div className="rounded-[24px] border border-white/12 bg-white/[0.07] p-5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-white/70" />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">{t('gantt.assigneeWorkload')}</p>
                </div>
                {assigneeWorkload.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {assigneeWorkload.map((a, i) => (
                      <li key={i}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate text-white/90" title={a.name}>{a.name}</span>
                          <span className="ml-2 shrink-0 text-xs text-white/60">
                            {t('gantt.itemCount', { count: a.total })}{a.delayed > 0 && <span className="ml-1 text-red-400">({t('gantt.delayedCount', { count: a.delayed })})</span>}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(a.total / maxWorkload) * 100}%`,
                              background: a.delayed > 0
                                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                : 'linear-gradient(90deg, #1fa37a, #34c997)',
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-white/50">{t('gantt.noAssignedTasks')}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Selected Task</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {t('gantt.taskFocusCard')}
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_42px_-24px_rgba(15,118,110,0.75)]">
              <Target className="h-5 w-5" />
            </div>
          </div>

          {selectedTask ? (() => {
            const taskReadOnly = isReadOnly || !canEditSpecificTask(permissions, selectedTask, currentMemberId);
            return (
            <div className="mt-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="surface-badge">
                    {LEVEL_LABELS[selectedTask.level] || `L${selectedTask.level}`}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                    {selectedTask.name || t('gantt.unnamedTask')}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                    {t('gantt.assigneeLabel')}: {selectedAssignee}
                  </p>
                </div>
                <span className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  selectedTask.status === 'pending' && 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]',
                  selectedTask.status === 'in_progress' && 'bg-[rgba(15,118,110,0.12)] text-[color:var(--accent-primary)]',
                  selectedTask.status === 'completed' && 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]',
                  selectedTask.status === 'on_hold' && 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]'
                )}>
                  {TASK_STATUS_LABELS[selectedTask.status]}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailMetric
                  label={t('gantt.planPeriod')}
                  value={`${formatDate(selectedTask.planStart) || '-'} ~ ${formatDate(selectedTask.planEnd) || '-'}`}
                />
                <DetailMetric
                  label={t('gantt.actualPeriod')}
                  value={`${formatDate(selectedTask.actualStart) || '-'} ~ ${formatDate(selectedTask.actualEnd) || '-'}`}
                />
                <DetailMetric
                  label={t('gantt.estimatedDuration')}
                  value={getDurationLabel(selectedTask.planStart, selectedTask.planEnd, t)}
                />
                <DetailMetric
                  label={t('gantt.delay')}
                  value={selectedDelay > 0 ? t('gantt.daysUnit', { days: selectedDelay }) : t('gantt.none')}
                  tone={selectedDelay > 0 ? 'danger' : 'neutral'}
                />
              </div>

              <div className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">{t('gantt.actualProgress')}</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{selectedTask.actualProgress}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(249,115,22,0.08)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(135deg,#f97316,#fb923c)]"
                    style={{ width: `${selectedTask.actualProgress}%` }}
                  />
                </div>
              </div>

              {selectedTask.output && (
                <div className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4 text-sm leading-6 text-[color:var(--text-secondary)]">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                    {t('gantt.deliverable')}
                  </p>
                  {selectedTask.output}
                </div>
              )}

              <button
                onClick={() => setCommentTaskId(selectedTask.id)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3 text-sm font-medium text-[color:var(--text-secondary)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--accent-primary)] hover:text-[color:var(--accent-primary)]"
              >
                <MessageCircle className="h-4 w-4" />
                코멘트
                {(ganttCommentCountMap.get(selectedTask.id) || 0) > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] px-1 text-[10px] font-bold text-white">
                    {ganttCommentCountMap.get(selectedTask.id)}
                  </span>
                )}
              </button>

              <div className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                <div data-testid="gantt-quick-edit">
                <div className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                      {t('gantt.quickEdit')}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                      {t('gantt.quickEditDesc')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {taskReadOnly && (
                      <span className="rounded-full border border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-warning)]">
                        {t('common.readOnly')}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualSave}
                      disabled={!currentProject || saveStatus === 'saving' || taskReadOnly}
                      data-testid="gantt-save-button"
                    >
                      {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {t('common.save')}
                    </Button>
                    <div className={cn(
                      'surface-badge',
                      saveStatus === 'error' && 'border-[rgba(203,75,95,0.22)] text-[color:var(--accent-danger)]'
                    )}>
                      {saveStatus === 'pending' && t('gantt.savePending')}
                      {saveStatus === 'saving' && (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t('common.saving')}
                        </>
                      )}
                      {saveStatus === 'saved' && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--accent-success)]" />
                          {formatSaveStatus(lastSavedAt, t)}
                        </>
                      )}
                      {saveStatus === 'error' && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5" />
                          {t('gantt.saveFail')}
                        </>
                      )}
                      {saveStatus === 'idle' && t('gantt.autoSaveReady')}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="field-label">{t('gantt.taskName')}</label>
                    <input
                      type="text"
                      value={selectedTask.name}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'name', event.target.value)}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-name"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="field-label">{t('gantt.deliverable')}</label>
                    <input
                      type="text"
                      value={selectedTask.output || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'output', event.target.value)}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-output"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="field-label">선행 작업</label>
                    <DependencyMultiSelect
                      currentTaskId={selectedTask.id}
                      selectedIds={selectedTask.predecessorIds || []}
                      tasks={tasks}
                      disabled={taskReadOnly}
                      onChange={(ids) => setDependency(selectedTask.id, ids)}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.assigneeLabel')}</label>
                    <select
                      value={selectedTask.assigneeId || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'assigneeId', event.target.value || null)}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-assignee"
                      className={cn('field-select', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    >
                      <option value="">{t('gantt.unspecified')}</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.status')}</label>
                    <select
                      value={selectedTask.status}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'status', event.target.value as Task['status'])}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-status"
                      className={cn('field-select', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    >
                      {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.planStart')}</label>
                    <input
                      type="date"
                      value={selectedTask.planStart || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'planStart', event.target.value || null)}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-plan-start"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.planEnd')}</label>
                    <input
                      type="date"
                      value={selectedTask.planEnd || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'planEnd', event.target.value || null)}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-plan-end"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.actualStart')}</label>
                    <input
                      type="date"
                      value={selectedTask.actualStart || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'actualStart', event.target.value || null)}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-actual-start"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.actualEnd')}</label>
                    <input
                      type="date"
                      value={selectedTask.actualEnd || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'actualEnd', event.target.value || null)}
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-actual-end"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.actualProgressLabel')}</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selectedTask.actualProgress}
                      onChange={(event) =>
                        handleTaskFieldChange(
                          selectedTask.id,
                          'actualProgress',
                          Math.min(100, Math.max(0, Number(event.target.value) || 0))
                        )
                      }
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-actual-progress"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">{t('gantt.planProgressLabel')}</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selectedTask.planProgress}
                      onChange={(event) =>
                        handleTaskFieldChange(
                          selectedTask.id,
                          'planProgress',
                          Math.min(100, Math.max(0, Number(event.target.value) || 0))
                        )
                      }
                      disabled={taskReadOnly}
                      data-testid="gantt-edit-plan-progress"
                      className={cn('field-input', taskReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>
                </div>
                </div>
              </div>
            </div>
          );
          })() : (
            <div className="empty-state min-h-[18rem]">
              <p>{t('gantt.noSelectedTask')}</p>
            </div>
          )}
        </div>
      </section>
      )}

      <section className="app-panel p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('gantt.searchPlaceholder')}
              className="field-input"
              style={{ paddingLeft: '3rem' }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterMode(option.value)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200',
                  filterMode === option.value
                    ? 'bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_42px_-28px_rgba(15,118,110,0.72)]'
                    : 'border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]'
                )}
              >
                {option.label}
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredFlatTasks.length === 0}>
              <Download className="w-4 h-4" />
              {t('gantt.excelDownload')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={!currentProject || saveStatus === 'saving' || isReadOnly}
            >
              {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="surface-badge">{t('gantt.viewRange')}</div>
            {VIEW_OPTIONS.map((weeks) => (
              <button
                key={weeks}
                onClick={() => setWeeksToShow(weeks)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                  weeksToShow === weeks
                    ? 'bg-[rgba(15,118,110,0.12)] text-[color:var(--accent-primary)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
                )}
              >
                {t('gantt.weeksUnit', { count: weeks })}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="surface-badge">{t('gantt.rowDensity')}</div>
            {DENSITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDensity(option.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                  density === option.value
                    ? 'bg-[rgba(15,118,110,0.12)] text-[color:var(--accent-primary)]'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)]'
                )}
              >
                {option.label}
              </button>
            ))}
            <button
              onClick={() => setHighlightWeekends((prev) => !prev)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                highlightWeekends
                  ? 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]'
                  : 'border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]'
              )}
            >
              {t('gantt.highlightWeekends')}
            </button>
            <button
              onClick={() => setShowCriticalPath((prev) => !prev)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                showCriticalPath
                  ? 'bg-[rgba(203,75,95,0.12)] text-[#CB4B5F]'
                  : 'border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]'
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              크리티컬 패스
            </button>
            {showCriticalPath && criticalPathResult.criticalTasks.length > 0 && (
              <div className="surface-badge border-[rgba(203,75,95,0.2)] bg-[rgba(203,75,95,0.06)] text-[#CB4B5F]">
                크리티컬 패스: {criticalPathResult.criticalTasks.length}개 작업, 총 {criticalPathResult.totalDuration}일
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="app-panel relative flex min-h-0 flex-1 overflow-hidden">
        {currentProject && (
          <button
            onClick={() => openPopup({ projectId: currentProject.id, page: 'gantt' })}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
            title={t('gantt.openInNewWindow')}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
        <div className="flex min-h-0 flex-1 gap-0 overflow-hidden rounded-[28px]">
          <div
            className="flex flex-shrink-0 flex-col border-r border-[var(--border-color)] bg-[color:var(--bg-elevated)]"
            style={{ width: mainLeftPanelWidth }}
          >
            {/* Fixed header outside scroll — matches GanttChart toolbar height */}
            <div
              className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-color)] px-5"
              style={{ height: ganttToolbarHeight }}
            >
              <span className="text-base font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]">
                {t('gantt.taskList')}
              </span>
              <span className="text-sm text-[color:var(--text-secondary)]">{t('gantt.showingCount', { count: filteredFlatTasks.length })}</span>
            </div>
            <div ref={tableRef} className="flex-1 overflow-auto scrollbar-visible" onScroll={handleLeftScroll}>
              {/* Sticky header inside scroll — matches GanttChart HEADER_HEIGHT (month/day rows) */}
              <div
                className="sticky top-0 z-10 border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)]"
                style={{ height: HEADER_HEIGHT }}
              />
              {filteredFlatTasks.map((task) => {
                const hasChildren = tasks.some((item) => item.parentId === task.id);
                const isSelected = resolvedSelectedTaskId === task.id;
                const delayDays = getDelayDays(task);

                return (
                  <div
                    key={task.id}
                    data-testid={`gantt-row-${task.id}`}
                    className={cn(
                      'flex cursor-pointer items-center overflow-hidden border-b border-[var(--border-color)] px-3 transition-colors hover:bg-[rgba(15,118,110,0.05)]',
                      isSelected && 'bg-[rgba(15,118,110,0.08)]',
                      task.level === 1 && 'bg-[color:var(--bg-tertiary)] font-medium'
                    )}
                    style={{
                      height: rowHeight,
                      minHeight: rowHeight,
                      maxHeight: rowHeight,
                      paddingLeft: `${(task.depth || 0) * 16 + 12}px`,
                    }}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    {hasChildren ? (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpand(task.id);
                        }}
                        className="mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--bg-tertiary)]"
                      >
                        {task.isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[color:var(--text-secondary)]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[color:var(--text-secondary)]" />
                        )}
                      </button>
                    ) : (
                      <span className="w-5 flex-shrink-0" />
                    )}

                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-sm leading-tight text-[color:var(--text-primary)]" title={task.name || undefined}>
                        {task.name || <span className="text-[color:var(--text-secondary)]">{t('gantt.unnamed')}</span>}
                      </p>
                    </div>

                    <span className="ml-2 flex-shrink-0 text-xs font-semibold text-[color:var(--text-secondary)]">
                      {task.actualProgress}%
                    </span>
                    {delayDays > 0 && (
                      <span className="ml-1 flex-shrink-0 rounded-full bg-[rgba(203,75,95,0.1)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--accent-danger)]">
                        +{delayDays}d
                      </span>
                    )}
                  </div>
                );
              })}

              {filteredFlatTasks.length === 0 && (
                <div className="empty-state min-h-[16rem] px-5">
                  <p>{t('gantt.noFilteredTasks')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <GanttChart
              tasks={filteredFlatTasks}
              allTasks={tasks}
              selectedTaskId={resolvedSelectedTaskId}
              onTaskClick={(task) => setSelectedTaskId(task.id)}
              weeksToShow={weeksToShow}
              dayWidth={mainDayWidth}
              rowHeight={rowHeight}
              highlightWeekends={highlightWeekends}
              onVerticalScroll={handleGanttScroll}
              externalScrollTop={ganttScrollTop}
              onToolbarHeightChange={setGanttToolbarHeight}
              showCriticalPath={showCriticalPath}
              criticalTaskIds={criticalTaskIds}
              dragState={dragState}
              onDragStart={handleDragStart}
              isLeafTask={isDragLeafTask}
              dragLabel={dragLabel}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--text-secondary)]">
        <div className="surface-badge">
          <div className="h-3 w-6 rounded-full bg-[linear-gradient(135deg,#3b82f6,#60a5fa)]" />
          <span>{t('gantt.legendPlan')}</span>
        </div>
        <div className="surface-badge">
          <div className="h-3 w-6 rounded-full bg-[linear-gradient(135deg,#f97316,#fb923c)]" />
          <span>{t('gantt.legendActual')}</span>
        </div>
        <div className="surface-badge">
          <div className="h-4 w-0.5 bg-[color:var(--accent-danger)]" />
          <span>{t('gantt.legendToday')}</span>
        </div>
        <div className="surface-badge">
          <svg width="24" height="12" className="shrink-0"><path d="M2 6 L22 6" stroke="currentColor" strokeWidth="1.5" className="text-[color:var(--text-muted)]" /><polygon points="22,6 16,3 16,9" fill="currentColor" className="text-[color:var(--text-muted)]" /></svg>
          <span>의존성</span>
        </div>
        <div className="surface-badge">
          <svg width="24" height="12" className="shrink-0"><path d="M2 6 L22 6" stroke="#CB4B5F" strokeWidth="2" /><polygon points="22,6 16,3 16,9" fill="#CB4B5F" /></svg>
          <span>크리티컬 패스</span>
        </div>
        <div className="surface-badge">
          <Clock3 className="h-3.5 w-3.5 text-[color:var(--accent-warning)]" />
          {t('gantt.autoFocusHint')}
        </div>
      </div>

      {commentTaskId && loadedProjectId && (
        <TaskCommentPanel
          taskId={commentTaskId}
          projectId={loadedProjectId}
          isOpen={!!commentTaskId}
          onClose={() => setCommentTaskId(null)}
        />
      )}
    </div>
  );
}

function DetailMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-[20px] border p-4',
        tone === 'danger'
          ? 'border-[rgba(203,75,95,0.16)] bg-[rgba(203,75,95,0.06)]'
          : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)]'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{value}</p>
    </div>
  );
}

function getDurationLabel(start: string | null | undefined, end: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) return '-';
  return t('gantt.daysUnit', { days: differenceInCalendarDays(endDate, startDate) + 1 });
}

function formatSaveStatus(lastSavedAt: string | null, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!lastSavedAt) return t('gantt.saved');
  const time = new Date(lastSavedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return t('gantt.savedAt', { time });
}

/** 선행 작업 멀티 셀렉트 드롭다운 */
function DependencyMultiSelect({
  currentTaskId,
  selectedIds,
  tasks,
  disabled,
  onChange,
}: {
  currentTaskId: string;
  selectedIds: string[];
  tasks: Task[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 자식이 있는 작업의 ID 집합 (부모 작업 = summary row)
  const parentIds = useMemo(
    () => new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId!)),
    [tasks]
  );

  // 후손 ID를 구해서 순환을 방지
  const descendantIds = useMemo(() => {
    const descendants = new Set<string>();
    const collect = (pid: string) => {
      tasks.filter((t) => t.parentId === pid).forEach((t) => {
        descendants.add(t.id);
        collect(t.id);
      });
    };
    collect(currentTaskId);
    return descendants;
  }, [currentTaskId, tasks]);

  // 선택 가능한 작업 (자기 자신, 자손, 부모(summary) 작업 제외)
  const selectableTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.id !== currentTaskId &&
          !descendantIds.has(t.id) &&
          !parentIds.has(t.id)
      ),
    [tasks, currentTaskId, descendantIds, parentIds]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const taskNameMap = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.id, t.name || '이름 없음'])),
    [tasks]
  );

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'field-input flex min-h-[2.5rem] flex-wrap items-center gap-1 text-left',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        {selectedIds.length === 0 ? (
          <span className="text-sm text-[color:var(--text-muted)]">선행 작업 없음</span>
        ) : (
          selectedIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-[rgba(15,118,110,0.1)] px-2 py-0.5 text-xs font-medium text-[color:var(--accent-primary)]"
            >
              {taskNameMap[id] || id}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(id); }}
                  className="ml-0.5 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
                >
                  x
                </button>
              )}
            </span>
          ))
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] shadow-xl">
          {selectableTasks.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[color:var(--text-muted)]">선택 가능한 작업이 없습니다</div>
          ) : (
            selectableTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(15,118,110,0.05)]',
                  selectedSet.has(t.id) && 'bg-[rgba(15,118,110,0.08)]'
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                    selectedSet.has(t.id)
                      ? 'border-[color:var(--accent-primary)] bg-[color:var(--accent-primary)] text-white'
                      : 'border-[var(--border-color)]'
                  )}
                >
                  {selectedSet.has(t.id) && '\u2713'}
                </span>
                <span className="truncate text-[color:var(--text-primary)]" style={{ paddingLeft: `${(t.depth || 0) * 12}px` }}>
                  {t.name || '이름 없음'}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-[color:var(--text-muted)]">
                  {LEVEL_LABELS[t.level] || `L${t.level}`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
