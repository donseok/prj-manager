import { TASK_STATUS_LABELS, LEVEL_LABELS, type Project, type ProjectMember, type Task } from '../types';
import { calculateOverallProgress, formatDate, getDelayedTasks, getDelayDays, getWeeklyTasks } from './utils';

export interface ChatbotContext {
  project: Project | null;
  members: ProjectMember[];
  tasks: Task[];
}

export const CHATBOT_SUGGESTIONS = [
  '현재 프로젝트 진행률 요약해줘',
  '지금 지연된 작업이 뭐야?',
  '이번 주 집중해야 할 작업 알려줘',
  '멤버별 담당 업무를 정리해줘',
  'WBS와 간트는 어떻게 활용하면 돼?',
];

const HELP_TEXT =
  '진행률, 지연 작업, 이번 주 일정, 담당자 업무, 특정 작업 상태, WBS·간트·엑셀 활용법을 물어보면 현재 데이터 기준으로 바로 정리해 드릴게요.';

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^0-9a-z가-힣]/g, '');
}

function getLeafTasks(tasks: Task[]): Task[] {
  const parentIds = new Set(tasks.map((task) => task.parentId).filter(Boolean));
  return tasks.filter((task) => !parentIds.has(task.id));
}

function getAssigneeName(task: Task, members: ProjectMember[]): string {
  return members.find((member) => member.id === task.assigneeId)?.name || '미지정';
}

function formatTaskPeriod(task: Task): string {
  if (!task.planStart && !task.planEnd) return '계획일정 미입력';
  return `${formatDate(task.planStart) || '미정'} ~ ${formatDate(task.planEnd) || '미정'}`;
}

function getBaseDate(project: Project | null): Date {
  return project?.baseDate ? new Date(project.baseDate) : new Date();
}

function matchTask(question: string, tasks: Task[]): Task | null {
  const normalizedQuestion = normalizeText(question);

  return (
    tasks
      .filter((task) => {
        const taskName = normalizeText(task.name);
        return taskName.length >= 2 && normalizedQuestion.includes(taskName);
      })
      .sort((a, b) => b.name.length - a.name.length)[0] || null
  );
}

function matchMember(question: string, members: ProjectMember[]): ProjectMember | null {
  const normalizedQuestion = normalizeText(question);

  return (
    members
      .filter((member) => {
        const memberName = normalizeText(member.name);
        return memberName.length >= 2 && normalizedQuestion.includes(memberName);
      })
      .sort((a, b) => b.name.length - a.name.length)[0] || null
  );
}

function hasKeyword(question: string, keywords: string[]): boolean {
  return keywords.some((keyword) => question.includes(keyword));
}

function buildGreeting(context: ChatbotContext): string {
  if (!context.project) {
    return `안녕하세요. DK Bot입니다.\n${HELP_TEXT}\n먼저 프로젝트를 선택해 주시면 더 정확하게 답변할 수 있습니다.`;
  }

  const leafTasks = getLeafTasks(context.tasks);
  const overallProgress = Math.round(calculateOverallProgress(context.tasks));

  return [
    `안녕하세요. DK Bot입니다. 지금 보고 있는 프로젝트는 "${context.project.name}"입니다.`,
    leafTasks.length > 0
      ? `현재 등록된 실행 단위 작업은 ${leafTasks.length}건이고, 실적 기준 전체 공정률은 ${overallProgress}%입니다.`
      : '아직 실행 단위 작업이 많지 않아서, WBS에 작업이 더 쌓이면 답변 정확도가 더 올라갑니다.',
    HELP_TEXT,
  ].join('\n');
}

function buildOverviewAnswer(context: ChatbotContext): string {
  if (!context.project) {
    return `현재 선택된 프로젝트가 없습니다.\n${HELP_TEXT}`;
  }

  const leafTasks = getLeafTasks(context.tasks);
  if (leafTasks.length === 0) {
    return `${context.project.name} 프로젝트에는 아직 요약할 실행 단위 작업이 없습니다.\nWBS에서 작업명, 담당자, 계획일정을 입력하면 챗봇이 더 정확하게 답변할 수 있습니다.`;
  }

  const baseDate = getBaseDate(context.project);
  const completedCount = leafTasks.filter((task) => task.status === 'completed').length;
  const inProgressCount = leafTasks.filter((task) => task.status === 'in_progress').length;
  const delayedTasks = getDelayedTasks(leafTasks, baseDate).sort(
    (a, b) => getDelayDays(b, baseDate) - getDelayDays(a, baseDate)
  );
  const thisWeekTasks = getWeeklyTasks(leafTasks, 'this');
  const overallProgress = Math.round(calculateOverallProgress(context.tasks));
  const timeline =
    context.project.startDate || context.project.endDate
      ? `일정은 ${formatDate(context.project.startDate) || '미정'}부터 ${formatDate(context.project.endDate) || '미정'}까지 잡혀 있습니다.`
      : '프로젝트 전체 일정은 아직 설정되지 않았습니다.';

  return [
    `${context.project.name} 프로젝트 요약입니다.`,
    `실행 단위 작업 ${leafTasks.length}건 중 완료 ${completedCount}건, 진행중 ${inProgressCount}건이며 현재 실적 공정률은 ${overallProgress}%입니다.`,
    timeline,
    delayedTasks[0]
      ? `가장 먼저 확인할 리스크는 "${delayedTasks[0].name}" 작업으로, 계획 종료일 대비 ${getDelayDays(delayedTasks[0], baseDate)}일 지연 상태입니다.`
      : '현재 기준으로 지연으로 판정되는 작업은 없습니다.',
    thisWeekTasks.length > 0
      ? `이번 주 일정에 걸린 작업은 ${thisWeekTasks.length}건입니다. 우선순위는 ${thisWeekTasks
          .slice(0, 3)
          .map((task) => `"${task.name}"`)
          .join(', ')} 순으로 보는 것이 좋습니다.`
      : '이번 주 일정에 걸린 작업은 아직 없습니다.',
  ].join('\n');
}

function buildDelayAnswer(context: ChatbotContext): string {
  if (!context.project) {
    return '프로젝트를 선택하면 지연 작업을 바로 추려드릴 수 있습니다.';
  }

  const baseDate = getBaseDate(context.project);
  const delayedTasks = getDelayedTasks(getLeafTasks(context.tasks), baseDate).sort(
    (a, b) => getDelayDays(b, baseDate) - getDelayDays(a, baseDate)
  );

  if (delayedTasks.length === 0) {
    return `${context.project.name} 프로젝트에는 ${formatDate(baseDate)} 기준 지연 작업이 없습니다.`;
  }

  return [
    `${context.project.name} 프로젝트의 지연 작업 상위 ${Math.min(delayedTasks.length, 5)}건입니다.`,
    ...delayedTasks.slice(0, 5).map((task) => {
      const assignee = getAssigneeName(task, context.members);
      return `- ${task.name} | 담당 ${assignee} | 계획종료 ${formatDate(task.planEnd)} | ${getDelayDays(task, baseDate)}일 지연`;
    }),
  ].join('\n');
}

function buildWeeklyAnswer(context: ChatbotContext, type: 'this' | 'next'): string {
  if (!context.project) {
    return '프로젝트를 선택하면 주간 일정도 바로 요약할 수 있습니다.';
  }

  const label = type === 'this' ? '이번 주' : '다음 주';
  const weeklyTasks = getWeeklyTasks(getLeafTasks(context.tasks), type).sort((a, b) => {
    const aDate = a.planStart || a.planEnd || '';
    const bDate = b.planStart || b.planEnd || '';
    return aDate.localeCompare(bDate);
  });

  if (weeklyTasks.length === 0) {
    return `${context.project.name} 프로젝트에는 ${label}에 걸린 실행 단위 작업이 없습니다.`;
  }

  return [
    `${label} 집중 작업 ${Math.min(weeklyTasks.length, 5)}건입니다.`,
    ...weeklyTasks.slice(0, 5).map((task) => {
      const assignee = getAssigneeName(task, context.members);
      return `- ${task.name} | ${formatTaskPeriod(task)} | 담당 ${assignee} | ${Math.round(task.actualProgress)}%`;
    }),
  ].join('\n');
}

function buildMemberSummaryAnswer(context: ChatbotContext): string {
  if (!context.project) {
    return '프로젝트를 선택하면 멤버별 업무 현황을 집계할 수 있습니다.';
  }

  const leafTasks = getLeafTasks(context.tasks);
  const baseDate = getBaseDate(context.project);

  const workloads = context.members
    .map((member) => {
      const memberTasks = leafTasks.filter((task) => task.assigneeId === member.id);
      const completed = memberTasks.filter((task) => task.status === 'completed').length;
      const inProgress = memberTasks.filter((task) => task.status === 'in_progress').length;
      const delayed = getDelayedTasks(memberTasks, baseDate).length;
      return {
        member,
        total: memberTasks.length,
        completed,
        inProgress,
        delayed,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.delayed - a.delayed || b.inProgress - a.inProgress || b.total - a.total);

  if (workloads.length === 0) {
    return `${context.project.name} 프로젝트에는 아직 담당자가 배정된 실행 단위 작업이 없습니다.`;
  }

  const unassignedCount = leafTasks.filter((task) => !task.assigneeId).length;

  return [
    '멤버별 업무 현황입니다.',
    ...workloads.slice(0, 6).map((item) => {
      return `- ${item.member.name}: 총 ${item.total}건, 진행중 ${item.inProgress}건, 완료 ${item.completed}건, 지연 ${item.delayed}건`;
    }),
    unassignedCount > 0 ? `미지정 작업은 ${unassignedCount}건입니다.` : '담당 미지정 작업은 없습니다.',
  ].join('\n');
}

function buildMemberDetailAnswer(member: ProjectMember, context: ChatbotContext): string {
  if (!context.project) {
    return '프로젝트를 선택한 뒤 다시 질문해 주세요.';
  }

  const baseDate = getBaseDate(context.project);
  const memberTasks = getLeafTasks(context.tasks).filter((task) => task.assigneeId === member.id);

  if (memberTasks.length === 0) {
    return `${member.name}님에게 배정된 실행 단위 작업은 아직 없습니다.`;
  }

  const delayedTasks = getDelayedTasks(memberTasks, baseDate);
  const nextTasks = [...memberTasks]
    .sort((a, b) => {
      const aDate = a.planEnd || a.planStart || '9999-12-31';
      const bDate = b.planEnd || b.planStart || '9999-12-31';
      return aDate.localeCompare(bDate);
    })
    .slice(0, 4);

  return [
    `${member.name}님 업무 요약입니다.`,
    `총 ${memberTasks.length}건 중 진행중 ${memberTasks.filter((task) => task.status === 'in_progress').length}건, 완료 ${memberTasks.filter((task) => task.status === 'completed').length}건, 지연 ${delayedTasks.length}건입니다.`,
    `우선 확인할 작업은 ${nextTasks.map((task) => `"${task.name}"`).join(', ')}입니다.`,
  ].join('\n');
}

function buildTaskDetailAnswer(task: Task, context: ChatbotContext): string {
  const parentTask = context.tasks.find((item) => item.id === task.parentId);
  const childCount = context.tasks.filter((item) => item.parentId === task.id).length;
  const assignee = getAssigneeName(task, context.members);
  const baseDate = getBaseDate(context.project);
  const delayDays = getDelayDays(task, baseDate);

  return [
    `"${task.name}" 작업 기준입니다.`,
    `${LEVEL_LABELS[task.level] || '작업'} 단계이고 상태는 ${TASK_STATUS_LABELS[task.status]}입니다. 담당자는 ${assignee}, 실적 공정률은 ${Math.round(task.actualProgress)}%입니다.`,
    `계획 일정은 ${formatTaskPeriod(task)}입니다.`,
    task.actualStart || task.actualEnd
      ? `실적 일정은 ${formatDate(task.actualStart) || '미정'} ~ ${formatDate(task.actualEnd) || '미정'}입니다.`
      : '실적 일정은 아직 충분히 입력되지 않았습니다.',
    delayDays > 0 ? `현재 기준 ${delayDays}일 지연 상태입니다.` : '현재 기준 지연으로 판정되지는 않습니다.',
    parentTask ? `상위 작업은 "${parentTask.name}"입니다.` : '최상위 레벨에 가까운 작업입니다.',
    childCount > 0 ? `하위 작업 ${childCount}건이 연결돼 있습니다.` : '하위 작업 없이 바로 실행되는 단위 작업입니다.',
  ].join('\n');
}

function buildWbsGuideAnswer(): string {
  return [
    'WBS는 작업 구조를 쪼개서 계획과 실적을 관리하는 화면입니다.',
    '- Phase > Activity > Task > Function 순으로 세분화하면서 작업명, 담당자, 계획일정, 공정률을 입력하세요.',
    '- 상위 작업은 하위 작업 공정률과 구조를 정리하는 기준점으로 보고, 실제 실행은 하위 작업 중심으로 관리하는 편이 좋습니다.',
    '- 엑셀 다운로드를 쓰면 계층 코드와 일정 정보를 한 번에 정리할 수 있어서 리뷰나 공유용으로 적합합니다.',
  ].join('\n');
}

function buildGanttGuideAnswer(): string {
  return [
    '간트는 일정 흐름과 병목을 보는 화면입니다.',
    '- 막대가 겹치는 구간을 보면 어떤 주차에 일이 몰리는지 바로 파악할 수 있습니다.',
    '- 지연 작업은 계획종료일과 실적 공정률을 같이 보면서 우선순위를 잡는 데 쓰는 것이 좋습니다.',
    '- 현재 필터와 보기 범위를 반영한 엑셀도 내려받을 수 있어서 주간회의 자료로 쓰기 좋습니다.',
  ].join('\n');
}

function buildWorkflowGuideAnswer(): string {
  return [
    buildWbsGuideAnswer(),
    '',
    buildGanttGuideAnswer(),
  ].join('\n');
}

function buildExportGuideAnswer(): string {
  return [
    '현재 프로젝트에서는 엑셀 내보내기를 이렇게 쓰면 됩니다.',
    '- WBS 화면: 계층형 작업표와 재가져오기용 데이터 시트를 함께 다운로드할 수 있습니다.',
    '- 간트 화면: 현재 검색어, 필터, 보기 범위를 반영한 일정 매트릭스를 다운로드할 수 있습니다.',
    '- 설정 화면: WBS 데이터 시트를 다시 가져와 구조를 복원할 수 있습니다.',
  ].join('\n');
}

function buildFallbackAnswer(question: string, context: ChatbotContext): string {
  const normalizedQuestion = normalizeText(question);
  const relatedTasks = context.tasks
    .map((task) => {
      const normalizedTaskName = normalizeText(task.name);
      let score = 0;
      if (normalizedQuestion.includes(normalizedTaskName)) score += 10;
      if (normalizedTaskName.includes(normalizedQuestion) && normalizedQuestion.length >= 2) score += 6;
      return { task, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.task.name.length - a.task.name.length)
    .slice(0, 3)
    .map((item) => item.task.name);

  if (relatedTasks.length > 0) {
    return [
      '질문 의도를 하나로 특정하진 못했지만, 현재 데이터에서 관련 가능성이 높은 작업은 아래와 같습니다.',
      ...relatedTasks.map((name) => `- ${name}`),
      '작업명이나 담당자명을 조금 더 구체적으로 적어주시면 상태와 일정까지 바로 정리해 드릴게요.',
    ].join('\n');
  }

  return `질문을 더 구체적으로 적어주시면 정확도가 올라갑니다.\n예: "지연 작업 요약", "홍길동 업무 현황", "설계 검토 작업 상태", "WBS 엑셀은 어디서 받아?"`;
}

export function createChatbotReply(question: string, context: ChatbotContext): string {
  const trimmedQuestion = question.trim();
  const normalizedQuestion = normalizeText(trimmedQuestion);
  const asksWbs = hasKeyword(normalizedQuestion, ['wbs', '작업구조']);
  const asksGantt = hasKeyword(normalizedQuestion, ['간트', 'gantt']);

  if (!trimmedQuestion) {
    return '질문을 입력해 주세요.';
  }

  if (hasKeyword(normalizedQuestion, ['안녕', '반가', '헬로', 'hello', 'hi'])) {
    return buildGreeting(context);
  }

  const matchedTask = matchTask(trimmedQuestion, context.tasks);
  if (matchedTask) {
    return buildTaskDetailAnswer(matchedTask, context);
  }

  const matchedMember = matchMember(trimmedQuestion, context.members);
  if (matchedMember) {
    return buildMemberDetailAnswer(matchedMember, context);
  }

  if (hasKeyword(normalizedQuestion, ['진행률', '진척', '진도', '요약', '현황', '상태'])) {
    return buildOverviewAnswer(context);
  }

  if (hasKeyword(normalizedQuestion, ['지연', '리스크', '밀린', '늦', '위험'])) {
    return buildDelayAnswer(context);
  }

  if (hasKeyword(normalizedQuestion, ['다음주', '차주'])) {
    return buildWeeklyAnswer(context, 'next');
  }

  if (hasKeyword(normalizedQuestion, ['이번주', '금주', '주간', '일정'])) {
    return buildWeeklyAnswer(context, 'this');
  }

  if (hasKeyword(normalizedQuestion, ['멤버', '담당자', '인력', '업무', '누가'])) {
    return buildMemberSummaryAnswer(context);
  }

  if (asksWbs && asksGantt) {
    return buildWorkflowGuideAnswer();
  }

  if (asksWbs) {
    return buildWbsGuideAnswer();
  }

  if (asksGantt) {
    return buildGanttGuideAnswer();
  }

  if (hasKeyword(normalizedQuestion, ['엑셀', '다운로드', '내보내기', '보고서', 'export'])) {
    return buildExportGuideAnswer();
  }

  if (!context.project) {
    return `현재 선택된 프로젝트가 없어서 일반 안내로 답변드릴게요.\n${HELP_TEXT}`;
  }

  return buildFallbackAnswer(trimmedQuestion, context);
}

export function createChatbotGreeting(context: ChatbotContext): string {
  return buildGreeting(context);
}
