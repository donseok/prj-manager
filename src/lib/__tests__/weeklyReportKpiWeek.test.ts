/**
 * weeklyReportKpiWeek.test.ts
 *
 * L-9: on_hold(보류) leaf 작업이 KPI '대기'(pending) 집계에 섞이지 않아야 한다.
 *      summary.onHoldTasks 가 추가되고, pending 계산에서 제외된다.
 * L-10: weekLabel 의 'YYYY년 N주차' 가 ISO 주차/주차연도와 일치해야 한다
 *       (연말·연초 경계에서 ±1 어긋나지 않음).
 */

import { describe, it, expect } from 'vitest';
import { generateWeeklyReport } from '../weeklyReport';
import type { Task, ProjectMember } from '../types';

function createTask(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    projectId: 'p1',
    parentId: null,
    name: 'task',
    level: 1,
    orderIndex: 0,
    status: 'pending',
    planStart: null,
    planEnd: null,
    actualStart: null,
    actualEnd: null,
    planProgress: 0,
    actualProgress: 0,
    weight: 1,
    assigneeId: null,
    output: '',
    predecessorIds: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  } as Task;
}

const members: ProjectMember[] = [];

describe('L-9: on_hold leaf 작업은 KPI 대기(pending) 집계에서 제외', () => {
  it('summary.onHoldTasks 를 별도로 세고, pending 계산에서 빠진다', () => {
    const phase = createTask({ id: 'ph1', level: 1, name: 'Phase 1' });
    const tasks: Task[] = [
      phase,
      createTask({ id: 't1', parentId: 'ph1', level: 2, name: '완료작업', status: 'completed', actualProgress: 100 }),
      createTask({ id: 't2', parentId: 'ph1', level: 2, name: '진행작업', status: 'in_progress', actualProgress: 50 }),
      createTask({ id: 't3', parentId: 'ph1', level: 2, name: '대기작업', status: 'pending', actualProgress: 0 }),
      createTask({ id: 't4', parentId: 'ph1', level: 2, name: '보류작업', status: 'on_hold', actualProgress: 0 }),
    ];

    const report = generateWeeklyReport({
      projectName: '테스트',
      tasks,
      members,
      baseDate: new Date('2026-05-30T00:00:00'),
    });

    // leaf = t1..t4 (phase 는 children 보유 → leaf 아님)
    expect(report.summary.totalLeafTasks).toBe(4);
    expect(report.summary.completedTasks).toBe(1);
    expect(report.summary.inProgressTasks).toBe(1);
    // 보류 1건이 별도로 집계되어야 한다
    expect(report.summary.onHoldTasks).toBe(1);

    // KPI 스트립의 pending 공식: total - completed - inProgress - onHold = 4-1-1-1 = 1
    const pending =
      report.summary.totalLeafTasks -
      report.summary.completedTasks -
      report.summary.inProgressTasks -
      report.summary.onHoldTasks;
    expect(pending).toBe(1);
  });
});

describe('L-10: weekLabel 은 ISO 주차/주차연도를 사용한다', () => {
  // [baseDate(yyyy-MM-dd), 기대 year, 기대 weekNum]
  // 2021-01-01 (금) → ISO 2020년 53주차
  // 2021-01-04 (월) → ISO 2021년 1주차
  // 2026-01-01 (목) → ISO 2026년 1주차
  // 2024-12-30 (월) → ISO 2025년 1주차  (getFullYear=2024 와 다름)
  // 2025-12-29 (월) → ISO 2026년 1주차
  // 2023-01-01 (일) → ISO 2022년 52주차
  const cases: Array<[string, number, number]> = [
    ['2021-01-01', 2020, 53],
    ['2021-01-04', 2021, 1],
    ['2026-01-01', 2026, 1],
    ['2024-12-30', 2025, 1],
    ['2025-12-29', 2026, 1],
    ['2023-01-01', 2022, 52],
  ];

  for (const [dateStr, year, weekNum] of cases) {
    it(`${dateStr} → "${year}년 ${weekNum}주차"`, () => {
      const report = generateWeeklyReport({
        projectName: '테스트',
        tasks: [],
        members,
        baseDate: new Date(`${dateStr}T00:00:00`),
      });
      expect(report.weekLabel.startsWith(`${year}년 ${weekNum}주차`)).toBe(true);
    });
  }
});
