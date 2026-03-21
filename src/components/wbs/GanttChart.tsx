import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  startOfWeek,
  addWeeks,
  addDays,
  differenceInDays,
  isSameDay,
  parseISO,
  min as minDate,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, ScanSearch } from 'lucide-react';
import type { Task } from '../../types';
import { cn } from '../../lib/utils';
import { useThemeStore } from '../../store/themeStore';
import Button from '../common/Button';

interface GanttChartProps {
  tasks: Task[];
  allTasks?: Task[];
  selectedTaskId?: string | null;
  startDate?: Date;
  weeksToShow?: number;
  dayWidth?: number;
  rowHeight?: number;
  highlightWeekends?: boolean;
  showDependencies?: boolean;
  onTaskClick?: (task: Task) => void;
  onVerticalScroll?: (scrollTop: number) => void;
  externalScrollTop?: number;
  onToolbarHeightChange?: (height: number) => void;
}

const DEFAULT_DAY_WIDTH = 44;
const DEFAULT_ROW_HEIGHT = 42;
const HEADER_HEIGHT = 68;

export { HEADER_HEIGHT };

export default function GanttChart({
  tasks,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  allTasks: _allTasks,
  selectedTaskId = null,
  startDate: propStartDate,
  weeksToShow = 12,
  dayWidth = DEFAULT_DAY_WIDTH,
  rowHeight = DEFAULT_ROW_HEIGHT,
  highlightWeekends = true,
  showDependencies = true,
  onTaskClick,
  onVerticalScroll,
  externalScrollTop,
  onToolbarHeightChange,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isDark = useThemeStore((s) => s.isDark);
  const isExternalScroll = useRef(false);
  const prevSelectedIdRef = useRef<string | null>(null);
  const skipAutoFocusRef = useRef(false);

  const recommendedStartDate = useMemo(() => {
    if (propStartDate) return startOfWeek(propStartDate, { weekStartsOn: 1 });

    const taskStartDates = tasks
      .flatMap((task) => [task.planStart, task.actualStart])
      .filter(Boolean)
      .map((date) => parseISO(date!));

    if (taskStartDates.length === 0) {
      return startOfWeek(addWeeks(new Date(), -1), { weekStartsOn: 1 });
    }

    return startOfWeek(addDays(minDate(taskStartDates), -7), { weekStartsOn: 1 });
  }, [propStartDate, tasks]);

  const [manualViewStartDate, setManualViewStartDate] = useState<Date | null>(null);
  const today = new Date();

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );

  const selectedAnchorDate = useMemo(() => {
    const anchor =
      selectedTask?.planStart ||
      selectedTask?.actualStart ||
      selectedTask?.planEnd ||
      selectedTask?.actualEnd;

    return anchor ? parseISO(anchor) : null;
  }, [selectedTask]);

  const baseStartDate = manualViewStartDate ?? recommendedStartDate;
  const displayStartDate = useMemo(() => {
    if (!selectedAnchorDate) return baseStartDate;

    const baseEndDate = addDays(baseStartDate, weeksToShow * 7 - 1);
    if (selectedAnchorDate < baseStartDate || selectedAnchorDate > baseEndDate) {
      return startOfWeek(addDays(selectedAnchorDate, -7), { weekStartsOn: 1 });
    }

    return baseStartDate;
  }, [baseStartDate, selectedAnchorDate, weeksToShow]);

  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    const totalDays = weeksToShow * 7;
    for (let index = 0; index < totalDays; index += 1) {
      dates.push(addDays(displayStartDate, index));
    }
    return dates;
  }, [displayStartDate, weeksToShow]);

  const viewEndDate = dateRange[dateRange.length - 1];

  const months = useMemo(() => {
    const result: Array<{ month: string; days: number }> = [];
    let currentMonth = '';
    let dayCount = 0;

    dateRange.forEach((date) => {
      const monthKey = format(date, 'yyyy-MM');
      if (monthKey !== currentMonth) {
        if (currentMonth) {
          result.push({ month: currentMonth, days: dayCount });
        }
        currentMonth = monthKey;
        dayCount = 1;
      } else {
        dayCount += 1;
      }
    });

    if (currentMonth) {
      result.push({ month: currentMonth, days: dayCount });
    }

    return result;
  }, [dateRange]);

  const dateToX = (date: Date | string | null | undefined): number | null => {
    if (!date) return null;
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    const daysDiff = differenceInDays(parsedDate, displayStartDate);
    if (daysDiff < 0 || daysDiff >= dateRange.length) return null;
    return daysDiff * dayWidth;
  };

  const calculateBar = (
    start: string | null | undefined,
    end: string | null | undefined
  ): { left: number; width: number } | null => {
    if (!start || !end) return null;

    const startX = dateToX(start);
    const endX = dateToX(end);

    if (startX === null && endX === null) return null;

    const left = startX ?? 0;
    const right = endX !== null ? endX + dayWidth : dateRange.length * dayWidth;
    const width = Math.max(right - left, dayWidth / 2);

    return { left: Math.max(left, 0), width };
  };

  const todayX = dateToX(today);
  const barHeight = rowHeight >= 40 ? 10 : 8;
  const planBarTop = rowHeight >= 40 ? 8 : 6;
  const actualBarTop = planBarTop + barHeight + 6;

  useEffect(() => {
    if (!selectedTask || !containerRef.current) return;

    // "오늘" 버튼 등에서 자동 포커스를 건너뛰도록 요청한 경우
    if (skipAutoFocusRef.current) {
      skipAutoFocusRef.current = false;
      return;
    }

    // 선택 작업이 실제로 변경된 경우에만 스크롤
    if (prevSelectedIdRef.current === selectedTask.id) return;
    prevSelectedIdRef.current = selectedTask.id;

    const rowIndex = tasks.findIndex((task) => task.id === selectedTask.id);
    if (rowIndex < 0) return;

    const anchorX =
      selectedAnchorDate
        ? Math.max(differenceInDays(selectedAnchorDate, displayStartDate) * dayWidth, 0)
        : null;

    containerRef.current.scrollTo({
      top: Math.max(rowIndex * rowHeight - rowHeight * 3, 0),
      left: anchorX !== null ? Math.max(anchorX - dayWidth * 5, 0) : containerRef.current.scrollLeft,
      behavior: 'smooth',
    });
  }, [dayWidth, displayStartDate, rowHeight, selectedAnchorDate, selectedTask, tasks]);

  // Measure toolbar height and report to parent
  useEffect(() => {
    if (!toolbarRef.current || !onToolbarHeightChange) return;
    const observer = new ResizeObserver(() => {
      if (toolbarRef.current) {
        onToolbarHeightChange(toolbarRef.current.offsetHeight);
      }
    });
    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, [onToolbarHeightChange]);

  // Report vertical scroll to parent
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onVerticalScroll) return;
    if (isExternalScroll.current) {
      isExternalScroll.current = false;
      return;
    }
    onVerticalScroll(containerRef.current.scrollTop);
  }, [onVerticalScroll]);

  // Apply external scroll position
  useEffect(() => {
    if (externalScrollTop === undefined || !containerRef.current) return;
    if (Math.abs(containerRef.current.scrollTop - externalScrollTop) > 1) {
      isExternalScroll.current = true;
      containerRef.current.scrollTop = externalScrollTop;
    }
  }, [externalScrollTop]);

  const handlePrevWeek = () => {
    setManualViewStartDate(addWeeks(displayStartDate, -Math.max(2, Math.floor(weeksToShow / 2))));
  };

  const handleNextWeek = () => {
    setManualViewStartDate(addWeeks(displayStartDate, Math.max(2, Math.floor(weeksToShow / 2))));
  };

  const handleGoToToday = () => {
    // 오늘 날짜가 화면 왼쪽 1/4 지점에 오도록 설정
    const offsetDays = Math.floor(weeksToShow * 7 * 0.25);
    const newStartDate = startOfWeek(addDays(new Date(), -offsetDays), { weekStartsOn: 1 });

    // 자동 포커스(선택 작업 위치로 스크롤)를 건너뛰기
    skipAutoFocusRef.current = true;
    setManualViewStartDate(newStartDate);

    // 다음 렌더 후 오늘 날짜 위치로 직접 스크롤
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const todayPixel = differenceInDays(new Date(), newStartDate) * dayWidth;
      const clientWidth = containerRef.current.clientWidth;
      containerRef.current.scrollTo({
        left: Math.max(todayPixel - clientWidth / 2, 0),
        behavior: 'smooth',
      });
    });
  };

  const handleFitToTasks = () => {
    setManualViewStartDate(recommendedStartDate);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={toolbarRef} className="flex flex-col gap-3 border-b border-[var(--border-color)] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleGoToToday}>
            <CalendarDays className="w-4 h-4" />
            오늘
          </Button>
          <Button variant="ghost" size="sm" onClick={handleFitToTasks}>
            <ScanSearch className="w-4 h-4" />
            일정에 맞춤
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedTask && (
            <div className="surface-badge">
              선택됨: {selectedTask.name || '이름 없는 작업'}
            </div>
          )}
          <div className="surface-badge">
            {format(displayStartDate, 'yyyy년 M월 d일', { locale: ko })} ~{' '}
            {format(viewEndDate, 'yyyy년 M월 d일', { locale: ko })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-visible" ref={containerRef} onScroll={handleScroll}>
        <div
          style={{
            minWidth: dateRange.length * dayWidth,
            minHeight: tasks.length * rowHeight + HEADER_HEIGHT,
          }}
        >
          <div
            className="sticky top-0 z-10 border-b border-[var(--border-color)] backdrop-blur-2xl"
            style={{
              height: HEADER_HEIGHT,
              backgroundColor: isDark ? '#1b2340' : 'rgba(255,248,241,0.95)',
            }}
          >
            <div className="flex h-1/2 border-b border-[var(--border-color)]">
              {months.map((month) => (
                <div
                  key={month.month}
                  className="flex items-center justify-center border-r border-[var(--border-color)] text-xs font-semibold uppercase tracking-[0.16em]"
                  style={{
                    width: month.days * dayWidth,
                    backgroundColor: isDark ? '#1e2750' : undefined,
                    color: isDark ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {format(parseISO(`${month.month}-01`), 'yyyy년 M월', { locale: ko })}
                </div>
              ))}
            </div>

            <div className="flex h-1/2">
              {dateRange.map((date) => {
                const isToday = isSameDay(date, today);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                let bgColor: string | undefined;
                let numColor: string;
                let dayColor: string;

                if (isDark) {
                  if (isToday) {
                    bgColor = 'rgba(15,118,110,0.35)';
                    numColor = '#5eead4';
                    dayColor = '#5eead4';
                  } else if (isWeekend) {
                    bgColor = '#8b2030';
                    numColor = '#ffffff';
                    dayColor = '#ffffff';
                  } else {
                    bgColor = '#1b2340';
                    numColor = '#ffffff';
                    dayColor = '#cbd5e1';
                  }
                } else {
                  if (isToday) {
                    bgColor = 'rgba(15,118,110,0.15)';
                    numColor = 'var(--accent-primary)';
                    dayColor = 'var(--accent-primary)';
                  } else if (isWeekend) {
                    bgColor = 'rgba(127,111,97,0.08)';
                    numColor = 'var(--text-secondary)';
                    dayColor = 'var(--text-muted)';
                  } else {
                    bgColor = undefined;
                    numColor = 'var(--text-primary)';
                    dayColor = 'var(--text-secondary)';
                  }
                }

                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      'flex flex-col items-center justify-center border-r border-[var(--border-color)] text-xs',
                      isToday && 'font-semibold'
                    )}
                    style={{ width: dayWidth, backgroundColor: bgColor }}
                  >
                    <span className="font-medium" style={{ color: numColor }}>
                      {format(date, 'd')}
                    </span>
                    <span className="text-[10px]" style={{ color: dayColor }}>
                      {format(date, 'E', { locale: ko })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 pointer-events-none">
              {dateRange.map((date, index) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div
                    key={`${date.toISOString()}-grid`}
                    className={cn(
                      'absolute top-0 bottom-0 border-r border-[var(--border-color)]',
                      highlightWeekends && isWeekend && 'bg-[rgba(127,111,97,0.05)] dark:bg-[rgba(255,255,255,0.03)]'
                    )}
                    style={{ left: index * dayWidth, width: dayWidth }}
                  />
                );
              })}
            </div>

            {todayX !== null && (
              <>
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 bg-[color:var(--accent-danger)]"
                  style={{ left: todayX + dayWidth / 2 }}
                />
                <div
                  className="pointer-events-none absolute top-3 z-20 -translate-x-1/2 rounded-full bg-[color:var(--accent-danger)] px-2 py-1 text-[10px] font-semibold text-white shadow-[0_16px_36px_-20px_rgba(203,75,95,0.9)]"
                  style={{ left: todayX + dayWidth / 2 }}
                >
                  오늘
                </div>
              </>
            )}

            {/* Dependency lines */}
            {showDependencies && (
              <svg
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  width: dateRange.length * dayWidth,
                  height: tasks.length * rowHeight,
                }}
              >
                {tasks.map((task, rowIndex) => {
                  if (!task.predecessorIds || task.predecessorIds.length === 0) return null;
                  return task.predecessorIds.map((predId) => {
                    const predIndex = tasks.findIndex((t) => t.id === predId);
                    if (predIndex < 0) return null;
                    const predTask = tasks[predIndex];
                    const predBar = calculateBar(predTask.planStart, predTask.planEnd);
                    const taskBar = calculateBar(task.planStart, task.planEnd);
                    if (!predBar || !taskBar) return null;

                    const fromX = predBar.left + predBar.width;
                    const fromY = predIndex * rowHeight + planBarTop + barHeight / 2;
                    const toX = taskBar.left;
                    const toY = rowIndex * rowHeight + planBarTop + barHeight / 2;
                    const midX = (fromX + toX) / 2;

                    return (
                      <g key={`${predId}-${task.id}`}>
                        <path
                          d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                          fill="none"
                          stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                        />
                        {/* Arrow head */}
                        <polygon
                          points={`${toX},${toY} ${toX - 6},${toY - 3} ${toX - 6},${toY + 3}`}
                          fill={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
                        />
                      </g>
                    );
                  });
                })}
              </svg>
            )}

            {tasks.map((task, rowIndex) => {
              const planBar = calculateBar(task.planStart, task.planEnd);
              const actualBar = calculateBar(task.actualStart, task.actualEnd);
              const isSelected = task.id === selectedTaskId;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'relative border-b border-[var(--border-color)] transition-colors hover:bg-[rgba(15,118,110,0.04)]',
                    task.level === 1 && 'bg-[color:var(--bg-tertiary)]',
                    isSelected && 'bg-[rgba(15,118,110,0.08)]'
                  )}
                  style={{ height: rowHeight, minHeight: rowHeight, maxHeight: rowHeight }}
                  onClick={() => onTaskClick?.(task)}
                >
                  {planBar && (
                    <div
                      className={cn(
                        'absolute rounded-full border border-white/15 bg-[linear-gradient(135deg,#3b82f6,#60a5fa)] shadow-[0_12px_24px_-16px_rgba(59,130,246,0.7)] transition-all',
                        isSelected && 'ring-2 ring-[rgba(59,130,246,0.22)] ring-offset-1 ring-offset-transparent'
                      )}
                      style={{
                        left: planBar.left,
                        top: planBarTop,
                        width: planBar.width,
                        height: barHeight,
                      }}
                      title={`계획: ${task.planStart} ~ ${task.planEnd}`}
                    />
                  )}

                  {actualBar && (
                    <>
                      <div
                        className="absolute rounded-full bg-[rgba(249,115,22,0.16)]"
                        style={{
                          left: actualBar.left,
                          top: actualBarTop,
                          width: actualBar.width,
                          height: barHeight,
                        }}
                      />
                      <div
                        className={cn(
                          'absolute rounded-full border border-white/10 bg-[linear-gradient(135deg,#f97316,#fb923c)] shadow-[0_12px_24px_-16px_rgba(249,115,22,0.7)] transition-all',
                          isSelected && 'ring-2 ring-[rgba(249,115,22,0.24)] ring-offset-1 ring-offset-transparent'
                        )}
                        style={{
                          left: actualBar.left,
                          top: actualBarTop,
                          width: Math.max(actualBar.width * (task.actualProgress / 100), task.actualProgress > 0 ? 8 : 0),
                          height: barHeight,
                        }}
                        title={`실적: ${task.actualStart} ~ ${task.actualEnd} (${task.actualProgress}%)`}
                      />
                    </>
                  )}

                  {!planBar && !actualBar && (
                    <div className="absolute left-2 top-0 flex h-full items-center text-xs text-[color:var(--text-muted)]">
                      일정 없음
                    </div>
                  )}

                  {isSelected && (
                    <div
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[rgba(15,118,110,0.12)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--accent-primary)]"
                    >
                      {rowIndex + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
