import { TASK_STATUS_LABELS, LEVEL_LABELS, type Project, type ProjectMember, type Task, type TaskStatus } from '../types';
import { calculateOverallProgress, formatDate, getDelayedTasks, getDelayDays, getWeeklyTasks } from './utils';
import { isSupabaseConfigured, supabase } from './supabase';

// ─── Public types ────────────────────────────────────────────

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
  '완료된 작업 목록 보여줘',
];

// ─── Intent types ────────────────────────────────────────────

type IntentType =
  | 'greeting'
  | 'overview'
  | 'delay'
  | 'weekly_this'
  | 'weekly_next'
  | 'member_summary'
  | 'member_detail'
  | 'member_delay'
  | 'member_weekly'
  | 'task_detail'
  | 'status_query'
  | 'guide_wbs'
  | 'guide_gantt'
  | 'guide_workflow'
  | 'guide_export';

interface ScoredIntent {
  type: IntentType;
  score: number;
  matchedTask?: Task;
  matchedMember?: ProjectMember;
  taskStatus?: TaskStatus;
}

// ─── Intent keyword map (primary=3, secondary=2, weak=1) ────

const INTENT_KEYWORDS: Record<string, { primary: string[]; secondary: string[]; weak: string[] }> = {
  greeting: {
    primary: ['안녕', '반가', '헬로', 'hello', 'hi', '하이', '안녕하세요', '처음'],
    secondary: ['시작', '소개'],
    weak: [],
  },
  overview: {
    primary: ['진행률', '진척률', '진도', '요약', '현황', '종합', '대시보드', '전체상태', '공정률', '공정율'],
    secondary: ['어때', '어떻게', '얼마나', '몇퍼센트', '전체', '프로젝트상태', '총괄'],
    weak: ['상태', '알려줘', '보여줘'],
  },
  delay: {
    primary: ['지연', '리스크', '밀린', '늦은', '위험', '딜레이', 'delay', '초과', '오버런'],
    secondary: ['마감지남', '못끝낸', '넘긴', '문제', '이슈', '경고', '주의'],
    weak: ['확인', '점검', '늦'],
  },
  weekly_this: {
    primary: ['이번주', '금주', '이주'],
    secondary: ['이번에', '오늘포함', '주간', '이번주간'],
    weak: ['일정', '스케줄'],
  },
  weekly_next: {
    primary: ['다음주', '차주', '내주'],
    secondary: ['다다음', '다음주간'],
    weak: [],
  },
  member_summary: {
    primary: ['멤버별', '담당자별', '인력', '워크로드', '팀원별'],
    secondary: ['멤버', '담당자', '팀원', '사람', '배분', '배정', '할당', '누가'],
    weak: ['업무', '인원'],
  },
  status_query: {
    primary: ['완료된', '끝난', '보류중', '대기중', '진행중인', '하고있는', '완료작업', '보류작업', '대기작업'],
    secondary: ['완료목록', '끝난것', '보류', '대기'],
    weak: ['목록', '리스트'],
  },
  guide_wbs: {
    primary: ['wbs', '작업구조', '작업분류', '작업분해', '작업구조도'],
    secondary: ['구조도', '분류체계'],
    weak: [],
  },
  guide_gantt: {
    primary: ['간트', 'gantt', '간트차트'],
    secondary: ['일정표', '바차트'],
    weak: [],
  },
  guide_export: {
    primary: ['엑셀', '내보내기', 'export', '다운로드'],
    secondary: ['출력', '보고서', '리포트', 'docx', '워드'],
    weak: ['저장', '인쇄'],
  },
};

// ─── Text utilities ──────────────────────────────────────────

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^0-9a-z가-힣]/g, '');
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s,·.;:!?]+/)
    .map((t) => t.replace(/[^0-9a-z가-힣]/g, ''))
    .filter((t) => t.length >= 2);
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  const total = bigramsA.size + bigramsB.size;
  return total === 0 ? 0 : (2 * intersection) / total;
}

// ─── Fuzzy entity matching ───────────────────────────────────

function fuzzyMatchTask(question: string, tasks: Task[]): { task: Task; score: number } | null {
  const nq = normalizeText(question);
  const qTokens = tokenize(question);

  const scored = tasks
    .map((task) => {
      const nt = normalizeText(task.name);
      const tTokens = tokenize(task.name);
      let score = 0;

      // Exact substring (strongest signal)
      if (nt.length >= 2 && nq.includes(nt)) score += 12;
      // Reverse substring
      if (nq.length >= 3 && nt.includes(nq)) score += 8;

      // Token overlap
      if (tTokens.length > 0) {
        const overlap = tTokens.filter((tt) =>
          qTokens.some((qt) => qt.includes(tt) || tt.includes(qt))
        );
        score += (overlap.length / tTokens.length) * 6;
      }

      // Bigram similarity for each token pair
      for (const qt of qTokens) {
        for (const tt of tTokens) {
          const dice = diceCoefficient(qt, tt);
          if (dice >= 0.55) score += dice * 3;
        }
      }

      // Whole-string bigram similarity
      const wholeDice = diceCoefficient(nq, nt);
      if (wholeDice >= 0.4) score += wholeDice * 4;

      return { task, score };
    })
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score || b.task.name.length - a.task.name.length);

  return scored[0] || null;
}

function fuzzyMatchMember(question: string, members: ProjectMember[]): { member: ProjectMember; score: number } | null {
  const nq = normalizeText(question);

  const scored = members
    .map((member) => {
      const nm = normalizeText(member.name);
      let score = 0;

      if (nm.length >= 2 && nq.includes(nm)) {
        // Short names (2 chars) require exact match to prevent false positives
        score += nm.length <= 2 ? 8 : 10;
      }

      // Bigram similarity
      const dice = diceCoefficient(nq, nm);
      if (dice >= 0.5 && nm.length >= 3) score += dice * 5;

      return { member, score };
    })
    .filter((item) => item.score >= 6)
    .sort((a, b) => b.score - a.score || b.member.name.length - a.member.name.length);

  return scored[0] || null;
}

// ─── Intent scoring ──────────────────────────────────────────

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.filter((kw) => text.includes(kw)).length;
}

function scoreIntents(question: string, normalized: string, context: ChatbotContext): ScoredIntent[] {
  const intents: ScoredIntent[] = [];

  // Score keyword-based intents
  for (const [intentType, kw] of Object.entries(INTENT_KEYWORDS)) {
    const score =
      countKeywordMatches(normalized, kw.primary) * 3 +
      countKeywordMatches(normalized, kw.secondary) * 2 +
      countKeywordMatches(normalized, kw.weak) * 1;
    if (score >= 2) {
      intents.push({ type: intentType as IntentType, score });
    }
  }

  // Score entity matches
  const taskMatch = fuzzyMatchTask(question, context.tasks);
  const memberMatch = fuzzyMatchMember(question, context.members);

  if (taskMatch) {
    intents.push({ type: 'task_detail', score: taskMatch.score, matchedTask: taskMatch.task });
  }

  if (memberMatch) {
    const hasDelay = intents.some((i) => i.type === 'delay');
    const hasWeekly = intents.some((i) => i.type === 'weekly_this' || i.type === 'weekly_next');

    if (hasDelay) {
      // Compound: member + delay → member's delayed tasks
      intents.push({ type: 'member_delay', score: memberMatch.score + 6, matchedMember: memberMatch.member });
    } else if (hasWeekly) {
      intents.push({ type: 'member_weekly', score: memberMatch.score + 5, matchedMember: memberMatch.member });
    } else {
      intents.push({ type: 'member_detail', score: memberMatch.score, matchedMember: memberMatch.member });
    }
  }

  // Detect status query with specific status
  const statusIntent = intents.find((i) => i.type === 'status_query');
  if (statusIntent) {
    if (/완료|끝난/.test(normalized)) statusIntent.taskStatus = 'completed';
    else if (/보류/.test(normalized)) statusIntent.taskStatus = 'on_hold';
    else if (/대기/.test(normalized)) statusIntent.taskStatus = 'pending';
    else if (/진행중/.test(normalized)) statusIntent.taskStatus = 'in_progress';
  }

  // WBS + Gantt compound
  const hasWbs = intents.some((i) => i.type === 'guide_wbs');
  const hasGantt = intents.some((i) => i.type === 'guide_gantt');
  if (hasWbs && hasGantt) {
    intents.push({ type: 'guide_workflow', score: 10 });
  }

  return intents.sort((a, b) => b.score - a.score);
}

// ─── Data helpers ────────────────────────────────────────────

const HELP_TEXT =
  '진행률, 지연 작업, 이번 주 일정, 담당자 업무, 특정 작업 상태 등을 물어보시면 현재 데이터 기준으로 정리해 드립니다.';

function getLeafTasks(tasks: Task[]): Task[] {
  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean));
  return tasks.filter((t) => !parentIds.has(t.id));
}

function getAssigneeName(task: Task, members: ProjectMember[]): string {
  return members.find((m) => m.id === task.assigneeId)?.name || '미지정';
}

function formatTaskPeriod(task: Task): string {
  if (!task.planStart && !task.planEnd) return '계획일정 미입력';
  return `${formatDate(task.planStart) || '미정'} ~ ${formatDate(task.planEnd) || '미정'}`;
}

function getBaseDate(project: Project | null): Date {
  return project?.baseDate ? new Date(project.baseDate) : new Date();
}

// ─── Answer builders ─────────────────────────────────────────

function buildGreeting(context: ChatbotContext): string {
  if (!context.project) {
    return `안녕하세요, DK Bot입니다.\n${HELP_TEXT}\n먼저 프로젝트를 선택해 주세요.`;
  }
  const leafTasks = getLeafTasks(context.tasks);
  const progress = Math.round(calculateOverallProgress(context.tasks));
  return [
    `안녕하세요, DK Bot입니다. 현재 프로젝트: "${context.project.name}"`,
    leafTasks.length > 0
      ? `실행 작업 ${leafTasks.length}건, 실적 공정률 ${progress}%입니다.`
      : '아직 등록된 실행 작업이 없습니다.',
    HELP_TEXT,
  ].join('\n');
}

function buildOverviewAnswer(context: ChatbotContext): string {
  if (!context.project) return `프로젝트가 선택되지 않았습니다.\n${HELP_TEXT}`;
  const leafTasks = getLeafTasks(context.tasks);
  if (leafTasks.length === 0) return `${context.project.name}에 아직 실행 작업이 없습니다.`;

  const baseDate = getBaseDate(context.project);
  const completed = leafTasks.filter((t) => t.status === 'completed').length;
  const inProgress = leafTasks.filter((t) => t.status === 'in_progress').length;
  const delayed = getDelayedTasks(leafTasks, baseDate);
  const progress = Math.round(calculateOverallProgress(context.tasks));

  return [
    `${context.project.name} 프로젝트 요약`,
    `작업 ${leafTasks.length}건 | 완료 ${completed} | 진행 ${inProgress} | 지연 ${delayed.length} | 공정률 ${progress}%`,
    context.project.startDate
      ? `일정: ${formatDate(context.project.startDate)} ~ ${formatDate(context.project.endDate) || '미정'}`
      : '전체 일정 미설정',
    delayed[0]
      ? `최우선 리스크: "${delayed[0].name}" (${getDelayDays(delayed[0], baseDate)}일 지연)`
      : '지연 작업 없음',
  ].join('\n');
}

function buildDelayAnswer(context: ChatbotContext): string {
  if (!context.project) return '프로젝트를 선택하면 지연 작업을 확인할 수 있습니다.';
  const baseDate = getBaseDate(context.project);
  const delayed = getDelayedTasks(getLeafTasks(context.tasks), baseDate)
    .sort((a, b) => getDelayDays(b, baseDate) - getDelayDays(a, baseDate));

  if (delayed.length === 0) return `${context.project.name}에 지연 작업이 없습니다.`;

  return [
    `지연 작업 ${delayed.length}건 (상위 ${Math.min(delayed.length, 5)}건)`,
    ...delayed.slice(0, 5).map((t) =>
      `- ${t.name} | ${getAssigneeName(t, context.members)} | ${formatDate(t.planEnd)} | ${getDelayDays(t, baseDate)}일 지연`
    ),
  ].join('\n');
}

function buildWeeklyAnswer(context: ChatbotContext, type: 'this' | 'next'): string {
  if (!context.project) return '프로젝트를 선택하면 주간 일정을 확인할 수 있습니다.';
  const label = type === 'this' ? '이번 주' : '다음 주';
  const weekly = getWeeklyTasks(getLeafTasks(context.tasks), type)
    .sort((a, b) => (a.planStart || '').localeCompare(b.planStart || ''));

  if (weekly.length === 0) return `${label} 예정 작업이 없습니다.`;

  return [
    `${label} 작업 ${weekly.length}건`,
    ...weekly.slice(0, 5).map((t) =>
      `- ${t.name} | ${formatTaskPeriod(t)} | ${getAssigneeName(t, context.members)} | ${Math.round(t.actualProgress)}%`
    ),
  ].join('\n');
}

function buildMemberSummaryAnswer(context: ChatbotContext): string {
  if (!context.project) return '프로젝트를 선택하면 멤버별 현황을 확인할 수 있습니다.';
  const leafTasks = getLeafTasks(context.tasks);
  const baseDate = getBaseDate(context.project);

  const workloads = context.members
    .map((m) => {
      const mt = leafTasks.filter((t) => t.assigneeId === m.id);
      return {
        name: m.name,
        total: mt.length,
        inProgress: mt.filter((t) => t.status === 'in_progress').length,
        completed: mt.filter((t) => t.status === 'completed').length,
        delayed: getDelayedTasks(mt, baseDate).length,
      };
    })
    .filter((w) => w.total > 0)
    .sort((a, b) => b.delayed - a.delayed || b.total - a.total);

  if (workloads.length === 0) return '담당자가 배정된 작업이 없습니다.';

  const unassigned = leafTasks.filter((t) => !t.assigneeId).length;
  return [
    '멤버별 업무 현황',
    ...workloads.slice(0, 6).map((w) =>
      `- ${w.name}: 총 ${w.total} | 진행 ${w.inProgress} | 완료 ${w.completed} | 지연 ${w.delayed}`
    ),
    unassigned > 0 ? `미지정 ${unassigned}건` : '',
  ].filter(Boolean).join('\n');
}

function buildMemberDetailAnswer(member: ProjectMember, context: ChatbotContext): string {
  if (!context.project) return '프로젝트를 선택한 뒤 다시 질문해 주세요.';
  const baseDate = getBaseDate(context.project);
  const mt = getLeafTasks(context.tasks).filter((t) => t.assigneeId === member.id);

  if (mt.length === 0) return `${member.name}님에게 배정된 작업이 없습니다.`;

  const delayed = getDelayedTasks(mt, baseDate);
  return [
    `${member.name}님 업무 요약`,
    `총 ${mt.length}건 | 진행 ${mt.filter((t) => t.status === 'in_progress').length} | 완료 ${mt.filter((t) => t.status === 'completed').length} | 지연 ${delayed.length}`,
    ...mt.slice(0, 4).map((t) =>
      `- ${t.name} | ${TASK_STATUS_LABELS[t.status]} | ${Math.round(t.actualProgress)}%`
    ),
  ].join('\n');
}

function buildMemberDelayAnswer(member: ProjectMember, context: ChatbotContext): string {
  if (!context.project) return '프로젝트를 선택한 뒤 다시 질문해 주세요.';
  const baseDate = getBaseDate(context.project);
  const mt = getLeafTasks(context.tasks).filter((t) => t.assigneeId === member.id);
  const delayed = getDelayedTasks(mt, baseDate)
    .sort((a, b) => getDelayDays(b, baseDate) - getDelayDays(a, baseDate));

  if (delayed.length === 0) return `${member.name}님 담당 작업 중 지연된 것은 없습니다.`;

  return [
    `${member.name}님 지연 작업 ${delayed.length}건`,
    ...delayed.slice(0, 5).map((t) =>
      `- ${t.name} | ${formatDate(t.planEnd)} | ${getDelayDays(t, baseDate)}일 지연`
    ),
  ].join('\n');
}

function buildMemberWeeklyAnswer(member: ProjectMember, context: ChatbotContext): string {
  if (!context.project) return '프로젝트를 선택한 뒤 다시 질문해 주세요.';
  const mt = getLeafTasks(context.tasks).filter((t) => t.assigneeId === member.id);
  const weekly = getWeeklyTasks(mt, 'this');

  if (weekly.length === 0) return `${member.name}님의 이번 주 작업은 없습니다.`;

  return [
    `${member.name}님 이번 주 작업 ${weekly.length}건`,
    ...weekly.slice(0, 5).map((t) =>
      `- ${t.name} | ${formatTaskPeriod(t)} | ${Math.round(t.actualProgress)}%`
    ),
  ].join('\n');
}

function buildTaskDetailAnswer(task: Task, context: ChatbotContext): string {
  const parent = context.tasks.find((t) => t.id === task.parentId);
  const childCount = context.tasks.filter((t) => t.parentId === task.id).length;
  const assignee = getAssigneeName(task, context.members);
  const baseDate = getBaseDate(context.project);
  const delay = getDelayDays(task, baseDate);

  return [
    `"${task.name}" 상세`,
    `${LEVEL_LABELS[task.level] || '작업'} | ${TASK_STATUS_LABELS[task.status]} | 담당: ${assignee} | 공정률: ${Math.round(task.actualProgress)}%`,
    `계획: ${formatTaskPeriod(task)}`,
    task.actualStart || task.actualEnd
      ? `실적: ${formatDate(task.actualStart) || '미정'} ~ ${formatDate(task.actualEnd) || '미정'}`
      : '실적 일정 미입력',
    delay > 0 ? `${delay}일 지연` : '지연 없음',
    parent ? `상위: "${parent.name}"` : '',
    childCount > 0 ? `하위 작업 ${childCount}건` : '',
  ].filter(Boolean).join('\n');
}

function buildStatusFilterAnswer(status: TaskStatus, context: ChatbotContext): string {
  if (!context.project) return '프로젝트를 선택해 주세요.';
  const filtered = getLeafTasks(context.tasks).filter((t) => t.status === status);
  const label = TASK_STATUS_LABELS[status];

  if (filtered.length === 0) return `"${label}" 상태의 작업이 없습니다.`;

  return [
    `${label} 작업 ${filtered.length}건`,
    ...filtered.slice(0, 8).map((t) =>
      `- ${t.name} | ${getAssigneeName(t, context.members)} | ${Math.round(t.actualProgress)}%`
    ),
    filtered.length > 8 ? `외 ${filtered.length - 8}건` : '',
  ].filter(Boolean).join('\n');
}

function buildWbsGuideAnswer(): string {
  return [
    'WBS는 작업 구조를 쪼개서 계획과 실적을 관리하는 화면입니다.',
    '- Phase > Activity > Task > Function 순으로 세분화하여 작업명, 담당자, 계획일정, 공정률을 입력하세요.',
    '- 엑셀 다운로드로 계층 코드와 일정 정보를 한 번에 정리할 수 있습니다.',
  ].join('\n');
}

function buildGanttGuideAnswer(): string {
  return [
    '간트는 일정 흐름과 병목을 보는 화면입니다.',
    '- 막대가 겹치는 구간에서 일정 몰림을 파악할 수 있습니다.',
    '- 지연 작업은 계획종료일과 공정률을 같이 보면서 우선순위를 잡으세요.',
  ].join('\n');
}

function buildExportGuideAnswer(): string {
  return [
    '엑셀/보고서 내보내기 안내',
    '- WBS 화면: 계층형 작업표 다운로드',
    '- 간트 화면: 일정 매트릭스 다운로드',
    '- 설정 화면: WBS 데이터 가져오기/내보내기',
  ].join('\n');
}

// ─── Intent dispatch ─────────────────────────────────────────

function dispatchIntent(intent: ScoredIntent, context: ChatbotContext): string | null {
  switch (intent.type) {
    case 'greeting':
      return buildGreeting(context);
    case 'overview':
      return buildOverviewAnswer(context);
    case 'delay':
      return buildDelayAnswer(context);
    case 'weekly_this':
      return buildWeeklyAnswer(context, 'this');
    case 'weekly_next':
      return buildWeeklyAnswer(context, 'next');
    case 'member_summary':
      return buildMemberSummaryAnswer(context);
    case 'member_detail':
      return intent.matchedMember ? buildMemberDetailAnswer(intent.matchedMember, context) : null;
    case 'member_delay':
      return intent.matchedMember ? buildMemberDelayAnswer(intent.matchedMember, context) : null;
    case 'member_weekly':
      return intent.matchedMember ? buildMemberWeeklyAnswer(intent.matchedMember, context) : null;
    case 'task_detail':
      return intent.matchedTask ? buildTaskDetailAnswer(intent.matchedTask, context) : null;
    case 'status_query':
      return intent.taskStatus ? buildStatusFilterAnswer(intent.taskStatus, context) : buildOverviewAnswer(context);
    case 'guide_wbs':
      return buildWbsGuideAnswer();
    case 'guide_gantt':
      return buildGanttGuideAnswer();
    case 'guide_workflow':
      return [buildWbsGuideAnswer(), '', buildGanttGuideAnswer()].join('\n');
    case 'guide_export':
      return buildExportGuideAnswer();
    default:
      return null;
  }
}

// ─── Fallback: fuzzy local search ────────────────────────────

function buildFallbackFromLocal(question: string, context: ChatbotContext): string | null {
  const nq = normalizeText(question);
  const qTokens = tokenize(question);

  const scored = context.tasks
    .map((task) => {
      const nt = normalizeText(task.name);
      const tTokens = tokenize(task.name);
      let score = 0;

      if (nt.length >= 2 && nq.includes(nt)) score += 10;
      if (nq.length >= 3 && nt.includes(nq)) score += 6;

      // Token overlap
      if (tTokens.length > 0 && qTokens.length > 0) {
        const overlap = tTokens.filter((tt) =>
          qTokens.some((qt) => qt.includes(tt) || tt.includes(qt))
        );
        score += (overlap.length / tTokens.length) * 5;
      }

      // Bigram similarity
      const dice = diceCoefficient(nq, nt);
      if (dice >= 0.3) score += dice * 4;

      return { task, score };
    })
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length > 0) {
    return [
      '관련 가능성이 높은 작업입니다.',
      ...scored.map((s) => {
        const t = s.task;
        return `- ${t.name} | ${TASK_STATUS_LABELS[t.status]} | ${Math.round(t.actualProgress)}%`;
      }),
      '더 구체적으로 질문하시면 상세 정보를 드릴 수 있습니다.',
    ].join('\n');
  }

  return null;
}

// ─── Fallback: Supabase DB search ────────────────────────────

async function searchSupabaseForAnswer(question: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const keyword = question.trim();
  if (keyword.length < 2) return null;

  try {
    const { data: projects } = await supabase
      .from('projects')
      .select('name, status, start_date, end_date')
      .ilike('name', `%${keyword}%`)
      .limit(3);

    if (projects && projects.length > 0) {
      return [
        'DB에서 관련 프로젝트를 찾았습니다.',
        ...projects.map((p: { name: string; status: string; start_date: string | null; end_date: string | null }) =>
          `- ${p.name} | ${p.status} | ${p.start_date || '미정'} ~ ${p.end_date || '미정'}`
        ),
      ].join('\n');
    }

    const { data: tasks } = await supabase
      .from('tasks')
      .select('name, status, plan_start, plan_end, actual_progress')
      .ilike('name', `%${keyword}%`)
      .limit(5);

    if (tasks && tasks.length > 0) {
      return [
        'DB에서 관련 작업을 찾았습니다.',
        ...tasks.map((t: { name: string; status: string; actual_progress: number }) =>
          `- ${t.name} | ${TASK_STATUS_LABELS[t.status as TaskStatus] || t.status} | ${Math.round(t.actual_progress)}%`
        ),
      ].join('\n');
    }

    const { data: members } = await supabase
      .from('project_members')
      .select('name, role')
      .ilike('name', `%${keyword}%`)
      .limit(3);

    if (members && members.length > 0) {
      return [
        'DB에서 관련 멤버를 찾았습니다.',
        ...members.map((m: { name: string; role: string }) => `- ${m.name} | ${m.role}`),
      ].join('\n');
    }
  } catch (error) {
    console.error('Chatbot DB search failed:', error);
  }

  return null;
}

// ─── Main entry ──────────────────────────────────────────────

const NOT_FOUND_MESSAGE =
  '해당 정보는 현재 데이터에서 찾을 수 없습니다.\n작업명, 담당자명, 또는 키워드를 더 구체적으로 입력해 주세요.';

export async function createChatbotReply(question: string, context: ChatbotContext): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) return '질문을 입력해 주세요.';

  const normalized = normalizeText(trimmed);

  // 1단계: 의도 분류 스코어링
  const intents = scoreIntents(trimmed, normalized, context);

  if (intents.length > 0) {
    const answer = dispatchIntent(intents[0], context);
    if (answer) return answer;
  }

  // 2단계: 프로젝트 미선택 시 안내
  if (!context.project) {
    return `프로젝트가 선택되지 않았습니다.\n${HELP_TEXT}`;
  }

  // 3단계: 로컬 퍼지 검색
  const localFallback = buildFallbackFromLocal(trimmed, context);
  if (localFallback) return localFallback;

  // 4단계: Supabase DB 검색
  const dbResult = await searchSupabaseForAnswer(trimmed);
  if (dbResult) return dbResult;

  // 5단계: 정보 없음
  return NOT_FOUND_MESSAGE;
}

export function createChatbotGreeting(context: ChatbotContext): string {
  return buildGreeting(context);
}
