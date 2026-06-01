import { v4 as uuidv4 } from 'uuid';
import type { Task, MeetingTask, ProjectMember } from '../../types';

/**
 * 회의록에서 추출된 MeetingTask[] 를 실제 WBS Task[] 로 변환한다.
 *
 * - `parentId`: 사용자가 미리보기 모달에서 선택한 상위 항목. null 이면 최상위.
 * - `members`: assigneeName ↔ assigneeId 매칭에 사용할 프로젝트 멤버 목록.
 *
 * 순수 함수(uuid 제외) — 단위 테스트 대상.
 */
export function convertToTasks(
  meetingTasks: MeetingTask[],
  projectId: string,
  parentId: string | null,
  existingTasks: Task[],
  members: ProjectMember[] = [],
): Task[] {
  const now = new Date().toISOString();

  // 선택된 항목만 변환
  const selected = meetingTasks.filter((t) => t.selected);
  if (selected.length === 0) return [];

  // 선택한 상위 항목의 레벨. 추출 항목은 모두 이 상위의 직속 자식(=형제)으로 들어가므로
  // 모두 동일 레벨(parentLevel + 1)을 가져야 한다. 임포트 경로의 normalizeTaskHierarchy 가
  // parentId 트리 깊이로 level 을 재계산하므로, 여기서도 그에 맞춰 깊이를 산정한다.
  const parent = parentId ? existingTasks.find((t) => t.id === parentId) ?? null : null;
  const parentLevel = parent ? parent.level : 0;

  // 새 항목이 들어갈 위치(orderIndex) 계산: 동일 parentId 의 기존 형제 다음.
  const maxOrder = existingTasks
    .filter((t) => (t.parentId ?? null) === parentId)
    .reduce((max, t) => Math.max(max, t.orderIndex), -1);

  return selected.map((mt, idx) => {
    // 담당자명 → 멤버 id 매칭. 일치하는 멤버가 없으면 undefined(미지정) 유지.
    const assigneeId = mt.assigneeName
      ? members.find((m) => m.name === mt.assigneeName)?.id ?? undefined
      : undefined;

    // 상위가 선택되면 그 직속 자식 레벨(최대 4)로 통일. 최상위면 추출된 레벨을 그대로 사용.
    const level = (parentId ? Math.min(4, parentLevel + 1) : mt.level) as 1 | 2 | 3 | 4;

    return {
      id: uuidv4(),
      projectId,
      parentId: parentId ?? undefined,
      level,
      orderIndex: maxOrder + 1 + idx,
      name: mt.name,
      description: mt.description,
      assigneeId,
      weight: 1,
      planStart: mt.startDate || null,
      planEnd: mt.endDate || null,
      planProgress: 0,
      actualProgress: 0,
      status: 'pending' as const,
      taskSource: 'ai_generated' as const,
      createdAt: now,
      updatedAt: now,
    };
  });
}
