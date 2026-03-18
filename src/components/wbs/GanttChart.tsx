import { useMemo, useRef, useState } from 'react';
import {
  format,
  startOfWeek,
  addWeeks,
  addDays,
  differenceInDays,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { Task } from '../../types';
import { cn } from '../../lib/utils';
import Button from '../common/Button';

interface GanttChartProps {
  tasks: Task[];
  startDate?: Date;
  weeksToShow?: number;
  onTaskClick?: (task: Task) => void;
  onDateChange?: (taskId: string, field: 'planStart' | 'planEnd' | 'actualStart' | 'actualEnd', date: string) => void;
}

const CELL_WIDTH = 40; // 하루 너비
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 60;

export default function GanttChart({
  tasks,
  startDate: propStartDate,
  weeksToShow = 12,
  onTaskClick,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setScrollLeft] = useState(0);
  const [viewStartDate, setViewStartDate] = useState(() => {
    if (propStartDate) return startOfWeek(propStartDate, { weekStartsOn: 1 });
    // 오늘 기준으로 2주 전부터 시작
    return startOfWeek(addWeeks(new Date(), -2), { weekStartsOn: 1 });
  });

  const today = new Date();

  // 날짜 범위 계산
  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    const totalDays = weeksToShow * 7;
    for (let i = 0; i < totalDays; i++) {
      dates.push(addDays(viewStartDate, i));
    }
    return dates;
  }, [viewStartDate, weeksToShow]);

  // 월 단위 그룹
  const months = useMemo(() => {
    const result: { month: string; days: number }[] = [];
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
        dayCount++;
      }
    });

    if (currentMonth) {
      result.push({ month: currentMonth, days: dayCount });
    }

    return result;
  }, [dateRange]);

  // 날짜를 x 좌표로 변환
  const dateToX = (date: Date | string | null | undefined): number | null => {
    if (!date) return null;
    const d = typeof date === 'string' ? parseISO(date) : date;
    const daysDiff = differenceInDays(d, viewStartDate);
    if (daysDiff < 0 || daysDiff >= dateRange.length) return null;
    return daysDiff * CELL_WIDTH;
  };

  // 간트 바 계산
  const calculateBar = (
    start: string | null | undefined,
    end: string | null | undefined
  ): { left: number; width: number } | null => {
    if (!start || !end) return null;

    const startX = dateToX(start);
    const endX = dateToX(end);

    if (startX === null && endX === null) return null;

    const left = startX ?? 0;
    const right = endX !== null ? endX + CELL_WIDTH : dateRange.length * CELL_WIDTH;
    const width = Math.max(right - left, CELL_WIDTH / 2);

    return { left: Math.max(left, 0), width };
  };

  // 오늘 위치
  const todayX = dateToX(today);

  // 이전/다음 주 이동
  const handlePrevWeek = () => {
    setViewStartDate((prev) => addWeeks(prev, -4));
  };

  const handleNextWeek = () => {
    setViewStartDate((prev) => addWeeks(prev, 4));
  };

  const handleGoToToday = () => {
    setViewStartDate(startOfWeek(addWeeks(new Date(), -2), { weekStartsOn: 1 }));
  };

  // 스크롤 동기화
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleGoToToday}>
            <CalendarDays className="w-4 h-4 mr-1" />
            오늘
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {format(viewStartDate, 'yyyy년 M월', { locale: ko })} ~{' '}
          {format(addDays(viewStartDate, weeksToShow * 7 - 1), 'yyyy년 M월', { locale: ko })}
        </div>
      </div>

      {/* 간트 차트 영역 */}
      <div className="flex-1 overflow-auto" ref={containerRef} onScroll={handleScroll}>
        <div
          style={{
            minWidth: dateRange.length * CELL_WIDTH,
            minHeight: tasks.length * ROW_HEIGHT + HEADER_HEIGHT,
          }}
        >
          {/* 헤더 */}
          <div
            className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
            style={{ height: HEADER_HEIGHT }}
          >
            {/* 월 헤더 */}
            <div className="flex h-1/2 border-b border-gray-100 dark:border-gray-700">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700"
                  style={{ width: m.days * CELL_WIDTH }}
                >
                  {format(parseISO(`${m.month}-01`), 'yyyy년 M월', { locale: ko })}
                </div>
              ))}
            </div>

            {/* 일 헤더 */}
            <div className="flex h-1/2">
              {dateRange.map((date, i) => {
                const isToday = isSameDay(date, today);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-col items-center justify-center text-xs border-r border-gray-100 dark:border-gray-700',
                      isToday && 'bg-blue-100 dark:bg-blue-900 font-bold text-blue-700 dark:text-blue-300',
                      isWeekend && !isToday && 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
                    )}
                    style={{ width: CELL_WIDTH }}
                  >
                    <span className="text-gray-700 dark:text-gray-300">{format(date, 'd')}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{format(date, 'E', { locale: ko })}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 바디 */}
          <div className="relative">
            {/* 그리드 라인 */}
            <div className="absolute inset-0 pointer-events-none">
              {dateRange.map((date, i) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={cn(
                      'absolute top-0 bottom-0 border-r border-gray-100 dark:border-gray-700',
                      isWeekend && 'bg-gray-50/50 dark:bg-gray-900/50'
                    )}
                    style={{ left: i * CELL_WIDTH, width: CELL_WIDTH }}
                  />
                );
              })}
            </div>

            {/* 오늘 라인 */}
            {todayX !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: todayX + CELL_WIDTH / 2 }}
              />
            )}

            {/* 작업 행 */}
            {tasks.map((task) => {
              const planBar = calculateBar(task.planStart, task.planEnd);
              const actualBar = calculateBar(task.actualStart, task.actualEnd);

              return (
                <div
                  key={task.id}
                  className="relative border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/20"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onTaskClick?.(task)}
                >
                  {/* 계획 바 */}
                  {planBar && (
                    <div
                      className="absolute top-1 h-3 bg-blue-200 dark:bg-blue-800 border border-blue-400 dark:border-blue-600 rounded cursor-pointer hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                      style={{
                        left: planBar.left,
                        width: planBar.width,
                      }}
                      title={`계획: ${task.planStart} ~ ${task.planEnd}`}
                    />
                  )}

                  {/* 실적 바 */}
                  {actualBar && (
                    <div
                      className="absolute top-5 h-3 bg-green-400 dark:bg-green-600 border border-green-500 dark:border-green-500 rounded cursor-pointer hover:bg-green-500 dark:hover:bg-green-500 transition-colors"
                      style={{
                        left: actualBar.left,
                        width: actualBar.width * (task.actualProgress / 100),
                      }}
                      title={`실적: ${task.actualStart} ~ ${task.actualEnd} (${task.actualProgress}%)`}
                    />
                  )}

                  {/* 작업명 (왼쪽 고정되지 않은 경우) */}
                  {!planBar && !actualBar && (
                    <div
                      className="absolute top-0 left-2 h-full flex items-center text-xs text-gray-400 dark:text-gray-500"
                    >
                      {task.name || '일정 없음'}
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
