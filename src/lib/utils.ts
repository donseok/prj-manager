import { format, parseISO, startOfWeek, endOfWeek, addWeeks, isWithinInterval, isBefore, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Task } from '../types';

// 날짜 포맷팅
export function formatDate(date: string | Date | null | undefined, formatStr: string = 'yyyy-MM-dd'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: ko });
}

// 날짜 파싱
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return parseISO(dateStr);
}

// 주차 계산
export function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
}

// 주 시작/종료일 계산
export function getWeekRange(date: Date) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

// 금주/차주 작업 필터링
export function getWeeklyTasks(tasks: Task[], type: 'this' | 'next'): Task[] {
  const now = new Date();
  const weekOffset = type === 'this' ? 0 : 1;
  const targetWeek = addWeeks(now, weekOffset);
  const { start, end } = getWeekRange(targetWeek);

  return tasks.filter((task) => {
    const planStart = parseDate(task.planStart);
    const planEnd = parseDate(task.planEnd);

    if (!planStart && !planEnd) return false;

    // 계획 기간이 해당 주와 겹치는지 확인
    if (planStart && planEnd) {
      return (
        isWithinInterval(start, { start: planStart, end: planEnd }) ||
        isWithinInterval(end, { start: planStart, end: planEnd }) ||
        isWithinInterval(planStart, { start, end }) ||
        isWithinInterval(planEnd, { start, end })
      );
    }

    if (planStart) {
      return isWithinInterval(planStart, { start, end });
    }

    return false;
  });
}

// 지연 작업 필터링
export function getDelayedTasks(tasks: Task[], baseDate: Date = new Date()): Task[] {
  return tasks.filter((task) => {
    if (task.status === 'completed') return false;

    const planEnd = parseDate(task.planEnd);
    if (!planEnd) return false;

    return isBefore(planEnd, baseDate) && task.actualProgress < 100;
  });
}

// 지연 일수 계산
export function getDelayDays(task: Task, baseDate: Date = new Date()): number {
  const planEnd = parseDate(task.planEnd);
  if (!planEnd) return 0;

  if (task.status === 'completed') return 0;
  if (!isBefore(planEnd, baseDate)) return 0;

  return differenceInDays(baseDate, planEnd);
}

// 계층 구조로 변환
export function buildTaskTree(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  const roots: Task[] = [];

  // 먼저 모든 작업을 맵에 저장
  tasks.forEach((task) => {
    taskMap.set(task.id, { ...task, children: [] });
  });

  // 부모-자식 관계 설정
  tasks.forEach((task) => {
    const taskWithChildren = taskMap.get(task.id)!;
    if (task.parentId && taskMap.has(task.parentId)) {
      const parent = taskMap.get(task.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(taskWithChildren);
    } else {
      roots.push(taskWithChildren);
    }
  });

  // 각 레벨에서 orderIndex로 정렬
  const sortChildren = (nodes: Task[]): Task[] => {
    nodes.sort((a, b) => a.orderIndex - b.orderIndex);
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        node.children = sortChildren(node.children);
      }
    });
    return nodes;
  };

  return sortChildren(roots);
}

// 트리를 평탄화 (표시용)
export function flattenTaskTree(tasks: Task[], depth: number = 0): Task[] {
  const result: Task[] = [];

  tasks.forEach((task) => {
    result.push({ ...task, depth });
    if (task.children && task.children.length > 0 && task.isExpanded !== false) {
      result.push(...flattenTaskTree(task.children, depth + 1));
    }
  });

  return result;
}

// 상위 작업 공정율 자동 계산
export function calculateParentProgress(tasks: Task[], parentId: string): number {
  const children = tasks.filter((t) => t.parentId === parentId);
  if (children.length === 0) return 0;

  const totalWeight = children.reduce((sum, t) => sum + t.weight, 0);
  // 가중치가 모두 0이면 단순 평균으로 fallback
  const progress =
    totalWeight > 0
      ? children.reduce((sum, t) => sum + t.weight * t.actualProgress, 0) / totalWeight
      : children.reduce((sum, t) => sum + t.actualProgress, 0) / children.length;

  return Math.round(progress);
}

// 전체 공정율 계산
export function calculateOverallProgress(tasks: Task[]): number {
  const topLevelTasks = tasks.filter((t) => !t.parentId || t.level === 1);
  if (topLevelTasks.length === 0) return 0;

  const totalWeight = topLevelTasks.reduce((sum, t) => sum + t.weight, 0);
  // 가중치가 모두 0이면 단순 평균으로 fallback (주간보고와 동일 기준)
  const progress =
    totalWeight > 0
      ? topLevelTasks.reduce((sum, t) => sum + t.weight * t.actualProgress, 0) / totalWeight
      : topLevelTasks.reduce((sum, t) => sum + t.actualProgress, 0) / topLevelTasks.length;

  return Math.round(progress);
}

// 숫자 포맷팅 (퍼센트)
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

// 숫자 포맷팅 (소수점)
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

// 클래스명 병합
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// UUID 생성
export function generateId(): string {
  return crypto.randomUUID();
}

// 디바운스
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// 로컬 스토리지 헬퍼
export const storage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.error('Failed to save to localStorage');
    }
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  },
};
