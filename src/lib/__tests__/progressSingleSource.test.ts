import { describe, it, expect } from 'vitest';
import { normalizeTaskHierarchy } from '../projectTaskSync';
import { calculateProjectProgress, roundProgress, formatProgress, roundTo } from '../progress';
import { calculateProjectStats } from '../taskAnalytics';
import { generateWeeklyReport } from '../weeklyReport';
import { calculateOverallProgress, calculateOverallPlanProgress, formatPercent } from '../utils';
import type { Task } from '../../types';

const now = '2026-01-01T00:00:00.000Z';

function makeTask(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    projectId: 'p1',
    parentId: null,
    level: 1,
    orderIndex: 0,
    name: overrides.id,
    weight: 1,
    planStart: null,
    planEnd: null,
    planProgress: 0,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Task;
}

/**
 * 두 Phase 의 가중치(9:1)가 하위 리프 가중치 합(1:3)과 정반대로 설정된 프로젝트.
 * 이 구성에서 "Phase 가중 롤업" 과 "리프 전역 가중 평균" 은 크게 갈린다.
 */
function buildSkewedProject(): Task[] {
  return [
    // Phase A: 가중치 9, 리프 1개(가중치 1), 실적 100%
    makeTask({ id: 'A', level: 1, orderIndex: 0, weight: 9 }),
    makeTask({ id: 'A1', parentId: 'A', level: 2, orderIndex: 0, weight: 1, actualProgress: 100, planProgress: 100 }),

    // Phase B: 가중치 1, 리프 3개(각 가중치 1), 실적 0%
    makeTask({ id: 'B', level: 1, orderIndex: 1, weight: 1 }),
    makeTask({ id: 'B1', parentId: 'B', level: 2, orderIndex: 0, weight: 1, actualProgress: 0, planProgress: 0 }),
    makeTask({ id: 'B2', parentId: 'B', level: 2, orderIndex: 1, weight: 1, actualProgress: 0, planProgress: 0 }),
    makeTask({ id: 'B3', parentId: 'B', level: 2, orderIndex: 2, weight: 1, actualProgress: 0, planProgress: 0 }),
  ];
}

/** 회귀 방지: 예전 주간보고가 쓰던 "리프 전역 가중 평균" */
function legacyLeafWeightedProgress(tasks: Task[], field: 'planProgress' | 'actualProgress'): number {
  const parentIds = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId));
  const leaves = tasks.filter((t) => !parentIds.has(t.id));
  const totalWeight = leaves.reduce((s, t) => s + t.weight, 0);
  return leaves.reduce((s, t) => s + t.weight * t[field], 0) / totalWeight;
}

describe('공정율 단일 기준 (progress.ts)', () => {
  it('Phase 가중 롤업과 리프 전역 가중 평균은 실제로 갈린다 — 그래서 기준 통일이 필요했다', () => {
    const tasks = normalizeTaskHierarchy(buildSkewedProject());

    // Phase 가중 롤업: A(100%)*9 + B(0%)*1 / 10 = 90%
    expect(calculateProjectProgress(tasks, 'actualProgress')).toBe(90);

    // 리프 전역 가중 평균: A1(100%)*1 + B1..B3(0%)*3 / 4 = 25%
    expect(legacyLeafWeightedProgress(tasks, 'actualProgress')).toBe(25);
  });

  it('대시보드(calculateProjectStats)와 주간보고는 같은 값을 낸다', async () => {
    const tasks = normalizeTaskHierarchy(buildSkewedProject());
    const stats = calculateProjectStats(tasks);

    // 주간보고 요약이 쓰는 것과 정확히 같은 함수 호출
    expect(stats.overallProgress).toBe(calculateProjectProgress(tasks, 'actualProgress'));
    expect(stats.planProgress).toBe(calculateProjectProgress(tasks, 'planProgress'));

    // utils 의 공개 API 도 같은 기준에 위임한다
    expect(calculateOverallProgress(tasks)).toBe(stats.overallProgress);
    expect(calculateOverallPlanProgress(tasks)).toBe(stats.planProgress);
  });

  it('주간보고 요약 == 대시보드 KPI (57% vs 51% 불일치 회귀 방지)', () => {
    const tasks = normalizeTaskHierarchy(buildSkewedProject());
    const stats = calculateProjectStats(tasks);

    const report = generateWeeklyReport({
      projectName: '동국씨엠 스마트 계량대',
      tasks,
      members: [],
      baseDate: new Date('2026-07-08T00:00:00.000Z'),
    });

    expect(report.summary.overallActualProgress).toBe(stats.overallProgress);
    expect(report.summary.overallPlanProgress).toBe(stats.planProgress);

    // 예전 리프 전역 가중 평균(25%)으로 되돌아가지 않는다.
    expect(report.summary.overallActualProgress).toBe(90);
  });

  it('가중치가 모두 0이면 단순 평균으로 fallback 한다', () => {
    const tasks = [
      makeTask({ id: 'A', level: 1, orderIndex: 0, weight: 0, actualProgress: 100 }),
      makeTask({ id: 'B', level: 1, orderIndex: 1, weight: 0, actualProgress: 0 }),
    ];
    expect(calculateProjectProgress(tasks, 'actualProgress')).toBe(50);
  });

  it('Phase 가 하나도 없으면 0 을 낸다 (0 으로 나누지 않는다)', () => {
    expect(calculateProjectProgress([], 'actualProgress')).toBe(0);
  });

  it('롤업은 단계마다 정수로 깎지 않고 소수점 2자리를 유지한다', () => {
    // 리프 3개, 실적 100/0/0 → 부모는 33.33% (정수 반올림이면 33%)
    const tasks = normalizeTaskHierarchy([
      makeTask({ id: 'A', level: 1, orderIndex: 0, weight: 1 }),
      makeTask({ id: 'A1', parentId: 'A', level: 2, orderIndex: 0, weight: 1, actualProgress: 100 }),
      makeTask({ id: 'A2', parentId: 'A', level: 2, orderIndex: 1, weight: 1, actualProgress: 0 }),
      makeTask({ id: 'A3', parentId: 'A', level: 2, orderIndex: 2, weight: 1, actualProgress: 0 }),
    ]);

    const phase = tasks.find((t) => t.id === 'A')!;
    expect(phase.actualProgress).toBe(33.33);
    expect(phase.actualProgress).toBe(roundProgress(100 / 3));
  });
});

describe('공정율 표시 포맷', () => {
  it('기본 소수점 1자리로 표시한다', () => {
    expect(formatProgress(42)).toBe('42.0%');
    expect(formatProgress(41.96)).toBe('42.0%');
    expect(formatProgress(33.33)).toBe('33.3%');
    expect(formatProgress(100)).toBe('100.0%');
  });

  it('formatPercent 는 formatProgress 에 위임한다', () => {
    expect(formatPercent(33.33)).toBe(formatProgress(33.33));
    expect(formatPercent(33.33, 0)).toBe('33%');
  });

  it('roundTo 는 부동소수점 경계에서 올림 방향이 흔들리지 않는다', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(8.575, 2)).toBe(8.58);
    expect(roundTo(NaN, 2)).toBe(0);
  });
});
