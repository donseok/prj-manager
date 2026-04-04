export function buildWbsGenerationPrompt(params: {
  projectName: string;
  description: string;
  startDate?: string;
  memberNames?: string[];
}): string {
  const membersInfo = params.memberNames?.length
    ? `\n참여 인력: ${params.memberNames.join(', ')}`
    : '';

  return `당신은 프로젝트 관리 전문가입니다. 아래 프로젝트 정보를 기반으로 WBS(Work Breakdown Structure)를 생성해주세요.

프로젝트명: ${params.projectName}
프로젝트 설명: ${params.description}
${params.startDate ? `시작일: ${params.startDate}` : ''}${membersInfo}

다음 4단계 계층으로 WBS를 생성하세요:
- Level 1: Phase (대분류)
- Level 2: Activity (중분류)
- Level 3: Task (소분류)
- Level 4: Todo (세부작업)

각 작업에는 다음 정보를 포함하세요:
- name: 작업명 (한국어)
- level: 1~4
- output: 산출물명 (Level 3, 4에만)
- durationDays: 예상 작업일수 (Level 4에만, 숫자)

반드시 아래 JSON 배열 형식으로만 응답하세요. 설명 텍스트 없이 JSON만 출력하세요:
[
  { "name": "분석", "level": 1, "children": [
    { "name": "요구사항 분석", "level": 2, "children": [
      { "name": "현행 시스템 분석", "level": 3, "output": "현행 분석서", "children": [
        { "name": "현행 프로세스 조사", "level": 4, "output": "프로세스 조사서", "durationDays": 3 },
        { "name": "현행 시스템 문서화", "level": 4, "output": "현행 시스템 문서", "durationDays": 2 }
      ]}
    ]}
  ]}
]

Phase는 3~6개, 각 Phase 아래 Activity 2~4개, 각 Activity 아래 Task 2~4개, 각 Task 아래 Todo 2~4개를 생성하세요.
프로젝트 성격에 맞는 현실적인 작업 구조를 만들어주세요.`;
}

export function buildProgressSuggestionPrompt(params: {
  tasks: Array<{
    id: string;
    name: string;
    level: number;
    planStart?: string | null;
    planEnd?: string | null;
    actualProgress: number;
    status: string;
    assignee?: string;
    parentName?: string;
    siblingProgress?: number[];
  }>;
  baseDate: string;
}): string {
  const taskDescriptions = params.tasks
    .map(
      (t) =>
        `- ID: ${t.id} | "${t.name}" (L${t.level}) | 계획: ${t.planStart || '?'}~${t.planEnd || '?'} | 실적: ${t.actualProgress}% | 상태: ${t.status}${t.assignee ? ` | 담당: ${t.assignee}` : ''}${t.parentName ? ` | 상위: ${t.parentName}` : ''}${t.siblingProgress?.length ? ` | 형제 진행률: ${t.siblingProgress.join(',')}%` : ''}`
    )
    .join('\n');

  return `당신은 프로젝트 진행률 분석 전문가입니다. 아래 작업 목록을 분석하고, 현재 기준일(${params.baseDate}) 기준으로 진행률과 상태 업데이트를 제안해주세요.

작업 목록:
${taskDescriptions}

각 작업에 대해 다음을 고려하여 제안하세요:
1. 계획 일정 대비 현재 날짜 위치
2. 형제 작업들의 진행 상황
3. 작업 간 논리적 선후행 관계

반드시 아래 JSON 배열 형식으로만 응답하세요:
[
  {
    "taskId": "작업ID",
    "suggestedProgress": 70,
    "suggestedStatus": "in_progress",
    "reason": "계획 종료일이 다가오고 형제 작업 대부분이 완료되어 70%로 제안합니다."
  }
]

status 값은 "pending", "in_progress", "completed", "on_hold" 중 하나만 사용하세요.
변경이 불필요한 작업은 제외하세요.`;
}
