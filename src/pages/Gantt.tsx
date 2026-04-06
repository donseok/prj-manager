import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Search,
  CalendarRange,
  Clock3,
  Download,
  Save,
  Loader2,
  ExternalLink,
  CalendarClock,
  Users,
  Zap,
} from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import GanttChart, { HEADER_HEIGHT } from '../components/wbs/GanttChart';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { cn, formatDate, getDelayDays } from '../lib/utils';
import Button from '../components/common/Button';
import FeedbackNotice from '../components/common/FeedbackNotice';
import { exportGanttWorkbook } from '../lib/excel';
import { syncProjectWorkspace } from '../lib/projectTaskSync';
import { useAutoSave } from '../hooks/useAutoSave';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { useGanttDrag } from '../hooks/useGanttDrag';
import { useProjectPermission } from '../hooks/useProjectPermission';
import { openPopup } from '../lib/popupWindow';
import type { Task } from '../types';
import { getLeafTasks } from '../lib/taskAnalytics';
import { calculateCriticalPath } from '../lib/criticalPath';


type FilterMode = 'all' | 'active' | 'delayed' | 'completed';
type DensityMode = 'compact' | 'comfortable';

const VIEW_OPTIONS = [4, 8, 12, 0] as const;
const DENSITY_OPTIONS: Array<{ value: DensityMode; labelKey: string }> = [
  { value: 'compact', labelKey: 'gantt.densityCompact' },
  { value: 'comfortable', labelKey: 'gantt.densityComfortable' },
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
  const [weeksToShow, setWeeksToShow] = useState<(typeof VIEW_OPTIONS)[number]>(0);
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [highlightWeekends, setHighlightWeekends] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(
    () => currentProject?.settings?.ganttSummaryCollapsed ?? false
  );
  const isInPopup = window.location.pathname.startsWith('/popup/');
  const toggleSummary = useCallback(() => {
    setSummaryCollapsed(prev => {
      const next = !prev;
      if (currentProject) {
        const newSettings = { ...currentProject.settings, ganttSummaryCollapsed: next };
        updateProject(currentProject.id, { settings: newSettings });
      }
      return next;
    });
  }, [currentProject, updateProject]);

  // 프로젝트 전환 시 설정 동기화
  useEffect(() => {
    setSummaryCollapsed(currentProject?.settings?.ganttSummaryCollapsed ?? false);
  }, [currentProject?.id]);

  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const permissions = useProjectPermission();
  const { isReadOnly } = permissions;

  const tableRef = useRef<HTMLDivElement>(null);
  const scrollSourceRef = useRef<'left' | 'right' | null>(null);
  const [ganttToolbarHeight, setGanttToolbarHeight] = useState(52);
  const [ganttScrollTop, setGanttScrollTop] = useState<number | undefined>(undefined);
  const rowHeight = density === 'compact' ? 34 : 42;


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

  const leafTasks = useMemo(() => getLeafTasks(tasks), [tasks]);
  const delayedCount = leafTasks.filter((task) => getDelayDays(task) > 0).length;
  const activeCount = leafTasks.filter((task) => task.status !== 'completed').length;

  // 전체 보기: 프로젝트 전체 기간을 주 단위로 자동 계산
  const effectiveWeeksToShow = useMemo(() => {
    if (weeksToShow !== 0) return weeksToShow;
    // 모든 작업의 날짜를 수집
    const allDates = tasks
      .flatMap((t) => [t.planStart, t.planEnd, t.actualStart, t.actualEnd])
      .filter(Boolean)
      .map((d) => parseISO(d!).getTime());
    // 프로젝트 시작/종료일도 포함
    if (currentProject?.startDate) allDates.push(parseISO(currentProject.startDate).getTime());
    if (currentProject?.endDate) allDates.push(parseISO(currentProject.endDate).getTime());
    if (allDates.length < 2) return 12;
    const minMs = Math.min(...allDates);
    const maxMs = Math.max(...allDates);
    const diffDays = differenceInCalendarDays(new Date(maxMs), new Date(minMs));
    // 앞뒤 2주 여유 포함
    return Math.max(4, Math.ceil((diffDays + 28) / 7));
  }, [weeksToShow, tasks, currentProject]);

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
  const { saveStatus, saveNow } = useAutoSave(tasks, saveTasks, {
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
        <div className="flex flex-shrink-0 flex-col gap-2 border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-2">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('gantt.searchPlaceholder')}
              className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary-solid)] pl-10 pr-3 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[rgba(15,118,110,0.34)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                {weeks === 0 ? t('gantt.viewAll', { defaultValue: '전체' }) : t('gantt.weeksUnit', { count: weeks })}
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
                {t(option.labelKey)}
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
              weeksToShow={effectiveWeeksToShow}
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
      <section className="relative">
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
                {weeks === 0 ? t('gantt.viewAll', { defaultValue: '전체' }) : t('gantt.weeksUnit', { count: weeks })}
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
                {t(option.labelKey)}
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
              weeksToShow={effectiveWeeksToShow}
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

    </div>
  );
}

