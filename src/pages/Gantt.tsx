import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
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
} from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
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
import { useProjectPermission } from '../hooks/useProjectPermission';
import { openPopup } from '../lib/popupWindow';
import type { Task } from '../types';
import { LEVEL_LABELS, TASK_STATUS_LABELS } from '../types';

type FilterMode = 'all' | 'active' | 'delayed' | 'completed';
type DensityMode = 'compact' | 'comfortable';

const FILTER_OPTIONS: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행중/대기' },
  { value: 'delayed', label: '지연' },
  { value: 'completed', label: '완료' },
];

const VIEW_OPTIONS = [4, 8, 12] as const;
const DENSITY_OPTIONS: Array<{ value: DensityMode; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
];

export default function Gantt() {
  const { tasks, flatTasks, loadedProjectId, toggleExpand, updateTask } = useTaskStore();
  const { currentProject, members, updateProject } = useProjectStore();
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
  const isInPopup = window.location.pathname.startsWith('/popup/');
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const { isReadOnly } = useProjectPermission();

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

  const taskMap = useMemo(
    () => Object.fromEntries(tasks.map((task) => [task.id, task])),
    [tasks]
  );

  const filteredFlatTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query && filterMode === 'all') return flatTasks;

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

      let current: Task | undefined = task;
      while (current) {
        matchedIds.add(current.id);
        current = current.parentId ? taskMap[current.parentId] : undefined;
      }
    });

    return flatTasks.filter((task) => matchedIds.has(task.id));
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
        ? members.find((member) => member.id === selectedTask.assigneeId)?.name || '미지정'
        : '미지정',
    [members, selectedTask]
  );

  const selectedDelay = selectedTask ? getDelayDays(selectedTask) : 0;
  const delayedCount = tasks.filter((task) => getDelayDays(task) > 0).length;
  const activeCount = tasks.filter((task) => task.status !== 'completed').length;

  // 마감 임박 작업 (leaf tasks only, sorted by planEnd ascending)
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    const leafTasks = tasks.filter((t) => !tasks.some((c) => c.parentId === t.id));
    return leafTasks
      .filter((t) => t.status !== 'completed' && t.planEnd)
      .sort((a, b) => {
        const da = parseISO(a.planEnd!);
        const db = parseISO(b.planEnd!);
        return da.getTime() - db.getTime();
      })
      .slice(0, 5)
      .map((t) => {
        const endDate = parseISO(t.planEnd!);
        const daysLeft = differenceInCalendarDays(endDate, today);
        return { ...t, daysLeft };
      });
  }, [tasks]);

  // 담당자별 워크로드
  const assigneeWorkload = useMemo(() => {
    const leafTasks = tasks.filter((t) => !tasks.some((c) => c.parentId === t.id));
    const activeTasks = leafTasks.filter((t) => t.status !== 'completed');
    const countMap = new Map<string, { name: string; total: number; delayed: number }>();

    for (const t of activeTasks) {
      const key = t.assigneeId || '__unassigned__';
      const entry = countMap.get(key) || {
        name: t.assigneeId
          ? members.find((m) => m.id === t.assigneeId)?.name || '미지정'
          : '미배정',
        total: 0,
        delayed: 0,
      };
      entry.total += 1;
      if (getDelayDays(t) > 0) entry.delayed += 1;
      countMap.set(key, entry);
    }

    return [...countMap.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [tasks, members]);

  const maxWorkload = useMemo(
    () => Math.max(...assigneeWorkload.map((a) => a.total), 1),
    [assigneeWorkload]
  );

  const saveTasks = useCallback(
    async (data: Task[]) => {
      if (!currentProject) return;
      const { project } = await syncProjectWorkspace(currentProject, data);
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


  const handleExportExcel = () => {
    if (filteredFlatTasks.length === 0) {
      showFeedback({
        tone: 'info',
        title: '내보낼 작업 없음',
        message: '현재 검색어와 필터 조건에 맞는 작업이 없습니다. 조건을 조정한 뒤 다시 시도해주세요.',
      });
      return;
    }

    exportGanttWorkbook({
      projectName: currentProject?.name,
      tasks: filteredFlatTasks,
      members,
      filterLabel: FILTER_OPTIONS.find((option) => option.value === filterMode)?.label || '전체',
      searchQuery,
      weeksToShow,
    });
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
              placeholder="검색"
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
              {weeks}주
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
            주말
          </button>
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
              <span className="text-sm font-semibold text-[color:var(--text-primary)]">작업 목록</span>
              <span className="text-xs text-[color:var(--text-secondary)]">{filteredFlatTasks.length}개</span>
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
                return (
                  <div
                    key={task.id}
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
                      <p className="truncate text-sm leading-tight text-[color:var(--text-primary)]">
                        {task.name || <span className="text-[color:var(--text-secondary)]">이름 없음</span>}
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
                  <p>필터에 맞는 작업이 없습니다</p>
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
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
              {currentProject?.name || '프로젝트'} 일정 흐름
            </h1>
            {projectTone && (
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] uppercase" style={{ color: projectTone.accent }}>
                {projectTone.note}
              </p>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
              검색, 상태 필터, 시야 범위, 선택된 작업 정보까지 한 화면에서 처리할 수 있게 간트 페이지 전체를 다시 구성했습니다.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">표시 작업</p>
                <p className="mt-2 text-3xl font-semibold text-white">{filteredFlatTasks.length}</p>
                <p className="mt-1 text-sm text-white/88">현재 필터 기준 표시 개수</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">오픈 작업</p>
                <p className="mt-2 text-3xl font-semibold text-white">{activeCount}</p>
                <p className="mt-1 text-sm text-white/88">완료되지 않은 전체 작업</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">지연 작업</p>
                <p className="mt-2 text-3xl font-semibold text-white">{delayedCount}</p>
                <p className="mt-1 text-sm text-white/88">즉시 확인이 필요한 일정</p>
              </div>
            </div>

            {/* 마감 임박 작업 + 담당자별 워크로드 */}
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {/* 마감 임박 작업 */}
              <div className="rounded-[24px] border border-white/12 bg-white/[0.07] p-5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-white/70" />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">마감 임박</p>
                </div>
                {upcomingDeadlines.length > 0 ? (
                  <ul className="mt-4 space-y-2.5">
                    {upcomingDeadlines.map((t) => (
                      <li
                        key={t.id}
                        className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06]"
                        onClick={() => setSelectedTaskId(t.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white/95">{t.name}</p>
                          <p className="mt-0.5 text-xs text-white/55">{formatDate(t.planEnd, 'M/d (EEE)')}</p>
                        </div>
                        <span className={cn(
                          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          t.daysLeft < 0
                            ? 'bg-red-500/20 text-red-300'
                            : t.daysLeft <= 3
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-white/10 text-white/70'
                        )}>
                          {t.daysLeft < 0 ? `${Math.abs(t.daysLeft)}일 초과` : t.daysLeft === 0 ? '오늘' : `D-${t.daysLeft}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-white/50">예정된 마감 작업이 없습니다.</p>
                )}
              </div>

              {/* 담당자별 워크로드 */}
              <div className="rounded-[24px] border border-white/12 bg-white/[0.07] p-5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-white/70" />
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">담당자별 워크로드</p>
                </div>
                {assigneeWorkload.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {assigneeWorkload.map((a, i) => (
                      <li key={i}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate text-white/90">{a.name}</span>
                          <span className="ml-2 shrink-0 text-xs text-white/60">
                            {a.total}건{a.delayed > 0 && <span className="ml-1 text-red-400">({a.delayed} 지연)</span>}
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
                  <p className="mt-4 text-sm text-white/50">배정된 작업이 없습니다.</p>
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
                작업 포커스 카드
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_42px_-24px_rgba(15,118,110,0.75)]">
              <Target className="h-5 w-5" />
            </div>
          </div>

          {selectedTask ? (
            <div className="mt-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="surface-badge">
                    {LEVEL_LABELS[selectedTask.level] || `L${selectedTask.level}`}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                    {selectedTask.name || '이름 없는 작업'}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                    담당자: {selectedAssignee}
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
                  label="계획 기간"
                  value={`${formatDate(selectedTask.planStart) || '-'} ~ ${formatDate(selectedTask.planEnd) || '-'}`}
                />
                <DetailMetric
                  label="실적 기간"
                  value={`${formatDate(selectedTask.actualStart) || '-'} ~ ${formatDate(selectedTask.actualEnd) || '-'}`}
                />
                <DetailMetric
                  label="예상 기간"
                  value={getDurationLabel(selectedTask.planStart, selectedTask.planEnd)}
                />
                <DetailMetric
                  label="지연"
                  value={selectedDelay > 0 ? `${selectedDelay}일` : '없음'}
                  tone={selectedDelay > 0 ? 'danger' : 'neutral'}
                />
              </div>

              <div className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">실적 공정율</span>
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
                    산출물
                  </p>
                  {selectedTask.output}
                </div>
              )}

              <div className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                <div data-testid="gantt-quick-edit">
                <div className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">
                      빠른 편집
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                      간트 화면에서 핵심 일정과 상태를 바로 수정할 수 있습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isReadOnly && (
                      <span className="rounded-full border border-[rgba(203,109,55,0.2)] bg-[rgba(203,109,55,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-warning)]">
                        읽기 전용
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualSave}
                      disabled={!currentProject || saveStatus === 'saving' || isReadOnly}
                      data-testid="gantt-save-button"
                    >
                      {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      저장
                    </Button>
                    <div className={cn(
                      'surface-badge',
                      saveStatus === 'error' && 'border-[rgba(203,75,95,0.22)] text-[color:var(--accent-danger)]'
                    )}>
                      {saveStatus === 'pending' && '변경사항 저장 대기'}
                      {saveStatus === 'saving' && (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          저장중...
                        </>
                      )}
                      {saveStatus === 'saved' && (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--accent-success)]" />
                          {formatSaveStatus(lastSavedAt)}
                        </>
                      )}
                      {saveStatus === 'error' && (
                        <>
                          <AlertCircle className="h-3.5 w-3.5" />
                          저장 실패
                        </>
                      )}
                      {saveStatus === 'idle' && '자동 저장 준비'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="field-label">작업명</label>
                    <input
                      type="text"
                      value={selectedTask.name}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'name', event.target.value)}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-name"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="field-label">산출물</label>
                    <input
                      type="text"
                      value={selectedTask.output || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'output', event.target.value)}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-output"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">담당자</label>
                    <select
                      value={selectedTask.assigneeId || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'assigneeId', event.target.value || null)}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-assignee"
                      className={cn('field-select', isReadOnly && 'cursor-not-allowed opacity-60')}
                    >
                      <option value="">미지정</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">상태</label>
                    <select
                      value={selectedTask.status}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'status', event.target.value as Task['status'])}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-status"
                      className={cn('field-select', isReadOnly && 'cursor-not-allowed opacity-60')}
                    >
                      {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">계획 시작</label>
                    <input
                      type="date"
                      value={selectedTask.planStart || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'planStart', event.target.value || null)}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-plan-start"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">계획 종료</label>
                    <input
                      type="date"
                      value={selectedTask.planEnd || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'planEnd', event.target.value || null)}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-plan-end"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">실적 시작</label>
                    <input
                      type="date"
                      value={selectedTask.actualStart || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'actualStart', event.target.value || null)}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-actual-start"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">실적 종료</label>
                    <input
                      type="date"
                      value={selectedTask.actualEnd || ''}
                      onChange={(event) => handleTaskFieldChange(selectedTask.id, 'actualEnd', event.target.value || null)}
                      disabled={isReadOnly}
                      data-testid="gantt-edit-actual-end"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">실적 공정율</label>
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
                      disabled={isReadOnly}
                      data-testid="gantt-edit-actual-progress"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>

                  <div>
                    <label className="field-label">계획 공정율</label>
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
                      disabled={isReadOnly}
                      data-testid="gantt-edit-plan-progress"
                      className={cn('field-input', isReadOnly && 'cursor-not-allowed opacity-60')}
                    />
                  </div>
                </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state min-h-[18rem]">
              <p>선택된 작업이 없습니다</p>
            </div>
          )}
        </div>
      </section>

      <section className="app-panel p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="작업명, 산출물, 담당자로 검색"
              className="field-input !pl-12"
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
              엑셀 다운로드
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={!currentProject || saveStatus === 'saving' || isReadOnly}
            >
              {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              저장
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="surface-badge">보기 범위</div>
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
                {weeks}주
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="surface-badge">행 밀도</div>
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
              주말 강조
            </button>
          </div>
        </div>
      </section>

      <div className="app-panel relative flex min-h-0 flex-1 overflow-hidden">
        {currentProject && (
          <button
            onClick={() => openPopup({ projectId: currentProject.id, page: 'gantt' })}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
            title="새 창에서 열기"
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
                작업 목록
              </span>
              <span className="text-sm text-[color:var(--text-secondary)]">{filteredFlatTasks.length}개 표시</span>
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
                      <p className="truncate text-sm leading-tight text-[color:var(--text-primary)]">
                        {task.name || <span className="text-[color:var(--text-secondary)]">이름 없음</span>}
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
                  <p>필터에 맞는 작업이 없습니다</p>
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
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--text-secondary)]">
        <div className="surface-badge">
          <div className="h-3 w-6 rounded-full bg-[linear-gradient(135deg,#3b82f6,#60a5fa)]" />
          <span>계획</span>
        </div>
        <div className="surface-badge">
          <div className="h-3 w-6 rounded-full bg-[linear-gradient(135deg,#f97316,#fb923c)]" />
          <span>실적</span>
        </div>
        <div className="surface-badge">
          <div className="h-4 w-0.5 bg-[color:var(--accent-danger)]" />
          <span>오늘</span>
        </div>
        <div className="surface-badge">
          <Clock3 className="h-3.5 w-3.5 text-[color:var(--accent-warning)]" />
          선택한 작업으로 차트가 자동 포커스됩니다
        </div>
      </div>

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

function getDurationLabel(start: string | null | undefined, end: string | null | undefined) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) return '-';
  return `${differenceInCalendarDays(endDate, startDate) + 1}일`;
}

function formatSaveStatus(lastSavedAt: string | null) {
  if (!lastSavedAt) return '저장됨';
  return `${new Date(lastSavedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })} 저장됨`;
}
