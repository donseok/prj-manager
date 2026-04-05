/**
 * taskAutoFill.ts
 * 산출물 자동추천 + 담당자 자동배정 + 가중치 자동계산
 */

import type { Task, ProjectMember } from '../types';
import { getLeafTasks } from './taskAnalytics';

// ── 산출물 자동추천 ─────────────────────────────────────────

/** 작업명 키워드 → 추천 산출물 매핑 */
const OUTPUT_RULES: Array<{ keywords: string[]; output: string }> = [
  // 기획
  { keywords: ['요구사항', '요구 사항', 'requirement'], output: '요구사항 정의서' },
  { keywords: ['기획', '기획서'], output: '기획서' },
  { keywords: ['정책', '정책 수립'], output: '정책 문서' },
  { keywords: ['사양', '스펙', 'spec'], output: '기능 사양서' },
  { keywords: ['IA', '정보구조', '정보 구조'], output: 'IA 문서' },
  { keywords: ['와이어프레임', 'wireframe'], output: '와이어프레임' },
  { keywords: ['프로토타입', 'prototype'], output: '프로토타입' },
  { keywords: ['사용자 조사', 'UT', '사용성', 'usability'], output: 'UT 결과 보고서' },

  // 디자인
  { keywords: ['디자인', 'design', 'UI'], output: '디자인 시안' },
  { keywords: ['스타일가이드', 'style guide', '디자인 시스템'], output: '스타일가이드' },
  { keywords: ['아이콘', 'icon'], output: '아이콘 세트' },
  { keywords: ['시안', '목업', 'mockup'], output: '디자인 시안' },

  // 개발
  { keywords: ['API', 'api', '인터페이스 개발'], output: 'API 명세서' },
  { keywords: ['DB', 'database', '데이터베이스', 'ERD', '스키마'], output: 'ERD / 스키마 문서' },
  { keywords: ['프론트엔드', 'frontend', '화면 개발', '퍼블리싱'], output: '소스코드' },
  { keywords: ['백엔드', 'backend', '서버'], output: '소스코드' },
  { keywords: ['배포', 'deploy', 'CI/CD', '빌드'], output: '배포 스크립트' },
  { keywords: ['설정', 'config', '환경'], output: '설정 문서' },
  { keywords: ['마이그레이션', 'migration'], output: '마이그레이션 스크립트' },
  { keywords: ['코드리뷰', 'code review'], output: '리뷰 결과' },

  // 테스트
  { keywords: ['테스트', 'test', 'QA', 'testing'], output: '테스트 결과서' },
  { keywords: ['테스트 케이스', 'TC', 'test case'], output: '테스트 케이스' },
  { keywords: ['테스트 계획', 'test plan'], output: '테스트 계획서' },
  { keywords: ['버그', 'bug', '결함'], output: '결함 보고서' },
  { keywords: ['성능', 'performance'], output: '성능 테스트 결과서' },
  { keywords: ['보안', 'security'], output: '보안 점검 결과서' },

  // 문서/보고
  { keywords: ['매뉴얼', 'manual', '가이드'], output: '사용자 매뉴얼' },
  { keywords: ['교육', '트레이닝', 'training'], output: '교육 자료' },
  { keywords: ['회의록', '미팅'], output: '회의록' },
  { keywords: ['보고', 'report', '보고서'], output: '보고서' },
  { keywords: ['계획', 'plan', '계획서'], output: '계획서' },
  { keywords: ['검수', '인수', '검증'], output: '검수 확인서' },
  { keywords: ['출시', '런칭', 'launch', 'release'], output: '출시 체크리스트' },
];

/** 작업명 기반 산출물 추천 */
export function suggestOutput(taskName: string): string | null {
  const lower = taskName.toLowerCase();
  for (const rule of OUTPUT_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return rule.output;
    }
  }
  return null;
}

/** 빈 산출물 필드를 자동으로 채움 */
export function autoFillOutputs(tasks: Task[]): Task[] {
  return tasks.map((task) => {
    if (task.output) return task;
    const suggested = suggestOutput(task.name);
    if (!suggested) return task;
    return { ...task, output: suggested, updatedAt: new Date().toISOString() };
  });
}

// ── 담당자 자동배정 ─────────────────────────────────────────

/**
 * 담당자가 미지정인 leaf task에 라운드로빈으로 멤버를 자동 배정한다.
 * 기존 배정된 멤버의 작업량을 고려하여 가장 작업이 적은 멤버부터 배정.
 */
export function autoAssignMembers(tasks: Task[], members: ProjectMember[]): Task[] {
  const assignableMembers = members.filter((m) => m.role !== 'viewer');
  if (assignableMembers.length === 0) return tasks;

  const leafTaskIds = new Set(getLeafTasks(tasks).map((t) => t.id));

  // 현재 멤버별 작업 수 계산
  const workload = new Map<string, number>();
  assignableMembers.forEach((m) => workload.set(m.id, 0));
  tasks.forEach((t) => {
    if (t.assigneeId && workload.has(t.assigneeId) && leafTaskIds.has(t.id)) {
      workload.set(t.assigneeId, (workload.get(t.assigneeId) || 0) + 1);
    }
  });

  return tasks.map((task) => {
    // 이미 배정된 task 또는 부모 task는 건너뜀
    if (task.assigneeId || !leafTaskIds.has(task.id)) return task;

    // 가장 작업이 적은 멤버 선택
    let minMemberId = assignableMembers[0].id;
    let minCount = workload.get(minMemberId) ?? Infinity;

    for (const m of assignableMembers) {
      const count = workload.get(m.id) ?? 0;
      if (count < minCount) {
        minCount = count;
        minMemberId = m.id;
      }
    }

    workload.set(minMemberId, (workload.get(minMemberId) || 0) + 1);

    return {
      ...task,
      assigneeId: minMemberId,
      updatedAt: new Date().toISOString(),
    };
  });
}

// ── 가중치 자동계산 ─────────────────────────────────────────

/**
 * 가중치를 자동 계산한다.
 * - leaf task: 기간(durationDays)에 비례하여 형제 간 상대 가중치 배분
 * - parent task: 자식 가중치 합산
 *
 * 동일 부모 하위의 leaf task끼리 기간 비례로 나눈 뒤,
 * 최상위 Phase끼리 합이 100이 되도록 정규화한다.
 */
export function autoCalculateWeights(tasks: Task[]): Task[] {
  const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));
  const childrenMap = new Map<string | null, Task[]>();

  tasks.forEach((t) => {
    const parentId = t.parentId ?? null;
    const list = childrenMap.get(parentId) ?? [];
    list.push(taskMap.get(t.id)!);
    childrenMap.set(parentId, list);
  });

  // 같은 레벨 형제들의 가중치 배분
  // - 모든 형제가 명시적 durationDays를 가지면 기간 비례
  // - 하나라도 durationDays가 없으면 균등 배분
  const calculateWeights = (parentId: string | null) => {
    const children = childrenMap.get(parentId);
    if (!children || children.length === 0) return;

    const allHaveDuration = children.every((c) => taskMap.get(c.id)?.durationDays != null);

    children.forEach((c, i) => {
      const task = taskMap.get(c.id)!;
      if (allHaveDuration) {
        const durations = children.map((ch) => taskMap.get(ch.id)!.durationDays || 1);
        const total = durations.reduce((s, d) => s + d, 0);
        task.weight = total > 0
          ? Math.round((durations[i] / total) * 100)
          : Math.round(100 / children.length);
      } else {
        task.weight = Math.round(100 / children.length);
      }
      task.updatedAt = new Date().toISOString();
      calculateWeights(c.id);
    });
  };

  calculateWeights(null);

  return tasks.map((t) => taskMap.get(t.id)!);
}

// ── 통합 자동채움 ───────────────────────────────────────────

export interface AutoFillOptions {
  fillOutputs?: boolean;
  fillAssignees?: boolean;
  fillWeights?: boolean;
}

export interface AutoFillResult {
  tasks: Task[];
  outputsFilled: number;
  assigneesFilled: number;
  weightsCalculated: boolean;
}

/**
 * 선택된 옵션에 따라 자동채움을 수행한다.
 */
export function autoFillTasks(
  tasks: Task[],
  members: ProjectMember[],
  options: AutoFillOptions = { fillOutputs: true, fillAssignees: true, fillWeights: true }
): AutoFillResult {
  let result = [...tasks.map((t) => ({ ...t }))];
  let outputsFilled = 0;
  let assigneesFilled = 0;
  let weightsCalculated = false;

  if (options.fillOutputs) {
    const before = result.filter((t) => !t.output).length;
    result = autoFillOutputs(result);
    const after = result.filter((t) => !t.output).length;
    outputsFilled = before - after;
  }

  if (options.fillAssignees) {
    const before = result.filter((t) => !t.assigneeId).length;
    result = autoAssignMembers(result, members);
    const leafIds = new Set(getLeafTasks(result).map((t) => t.id));
    const after = result.filter((t) => !t.assigneeId && leafIds.has(t.id)).length;
    assigneesFilled = before - after;
  }

  if (options.fillWeights) {
    result = autoCalculateWeights(result);
    weightsCalculated = true;
  }

  return { tasks: result, outputsFilled, assigneesFilled, weightsCalculated };
}
