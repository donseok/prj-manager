import { TASK_STATUS_LABELS, LEVEL_LABELS, PROJECT_STATUS_LABELS, type Project, type ProjectMember, type Task, type TaskStatus } from '../types';
import { calculateOverallProgress, formatDate, getDelayedTasks, getDelayDays, getWeeklyTasks } from './utils';
import { getLeafTasks, getAssigneeName, calculateAssigneeWorkloads } from './taskAnalytics';
import { supabase } from './supabase';
import { loadProjectMembers, loadProjectTasks } from './dataRepository';
import { parseISO, differenceInDays } from 'date-fns';
import { isRagReady, searchKnowledgeBase, answerWithRag } from './rag';
import {
  detectDelayRisks,
  suggestNextTasks,
  generateWeeklySummary,
  formatRiskAnswer,
  formatSuggestionAnswer,
  formatWeeklySummaryAnswer,
} from './chatbotInsights';

// ─── Public types ────────────────────────────────────────────

export interface ChatbotContext {
  project: Project | null;
  members: ProjectMember[];
  tasks: Task[];
  allProjects: Project[];
}

export interface ChatbotMessage {
  role: 'assistant' | 'user';
  text: string;
}

export interface ChatbotReply {
  text: string;
  /** 후속 질문 제안 (답변 내용에 따라 동적 생성) */
  suggestions: string[];
}

export const CHATBOT_SUGGESTIONS = [
  '전체 프로젝트 현황 알려줘',
  '지연된 작업이 뭐야?',
  '이번 주 작업 알려줘',
  '멤버별 업무 정리해줘',
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
  | 'project_list'
  | 'project_detail'
  | 'guide_wbs'
  | 'guide_gantt'
  | 'guide_workflow'
  | 'guide_export'
  | 'upcoming_deadline'
  | 'unassigned'
  | 'priority'
  | 'progress_compare'
  | 'risk_insight'
  | 'next_suggestion'
  | 'weekly_summary'
  | 'help';

interface ScoredIntent {
  type: IntentType;
  score: number;
  matchedTask?: Task;
  matchedMember?: ProjectMember;
  matchedProject?: Project;
  taskStatus?: TaskStatus;
}

interface ResolvedContext {
  project: Project;
  members: ProjectMember[];
  tasks: Task[];
}

// ─── Korean morpheme stripping ───────────────────────────────
// 한국어 조사·어미·접미사를 제거하여 실질적 키워드만 남김

const KOREAN_PARTICLES = [
  // 길이 3 이상 우선
  '에서는', '이라고', '이라는', '에서도', '부터는', '까지는', '로부터',
  '에서', '부터', '까지', '이랑', '으로', '에게', '한테', '처럼', '만큼', '보다',
  '이나', '이든', '든지', '라도',
  // 2글자 조사
  '은', '는', '이', '가', '을', '를', '에', '의', '도', '로', '와', '과',
  '만', '요', '야', '서', '고',
];

const KOREAN_VERB_SUFFIXES = [
  // 길이 순 내림차순
  '해주세요', '알려주세요', '보여주세요', '가르쳐줘', '찾아주세요',
  '알려줘', '보여줘', '해줘', '찾아줘', '말해줘', '정리해줘', '설명해줘',
  '있나요', '없나요', '인가요', '할까요', '될까요',
  '있어요', '없어요', '인가', '인지', '건지', '는지', '인데', '이야',
  '있어', '없어', '뭐야', '뭐지', '어때', '줘', '좀',
];

function stripKoreanSuffixes(text: string): string {
  let result = text;
  // 여러 번 반복하여 중첩 접미사 처리
  for (let pass = 0; pass < 2; pass++) {
    for (const suffix of KOREAN_VERB_SUFFIXES) {
      if (result.endsWith(suffix) && result.length > suffix.length) {
        result = result.slice(0, -suffix.length);
      }
    }
  }
  return result;
}

function stripParticles(tokens: string[]): string[] {
  return tokens.map((token) => {
    let result = token;
    for (const particle of KOREAN_PARTICLES) {
      if (result.endsWith(particle) && result.length > particle.length + 1) {
        result = result.slice(0, -particle.length);
      }
    }
    return result;
  });
}

// ─── Text utilities ──────────────────────────────────────────

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/[^0-9a-z가-힣]/g, '');
}

/** 조사/어미 제거 후 정규화 */
function normalizeTextDeep(value: string): string {
  const base = normalizeText(value);
  return stripKoreanSuffixes(base);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s,·.;:!?~]+/)
    .map((t) => t.replace(/[^0-9a-z가-힣]/g, ''))
    .filter((t) => t.length >= 2);
}

/** 조사 제거 후 토큰화 */
function tokenizeDeep(value: string): string[] {
  const raw = tokenize(value);
  return stripParticles(raw);
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

// ─── Generic fuzzy matcher ───────────────────────────────────

interface FuzzyMatchOptions {
  threshold: number;
  useTokens?: boolean;
  containsBonus?: number;
  reverseContainsBonus?: number;
}

function fuzzyScore(
  nq: string,
  qTokens: string[],
  targetName: string,
  options: FuzzyMatchOptions
): number {
  const nt = normalizeText(targetName);
  const containsBonus = options.containsBonus ?? 12;
  const reverseBonus = options.reverseContainsBonus ?? 8;
  let score = 0;

  // 완전 일치
  if (nq === nt) return 30;

  if (nt.length >= 2 && nq.includes(nt)) {
    score += nt.length <= 2 ? Math.min(containsBonus, 8) : containsBonus;
  }
  if (nq.length >= 3 && nt.includes(nq)) score += reverseBonus;

  if (options.useTokens !== false) {
    const tTokens = tokenize(targetName);
    const tTokensDeep = stripParticles(tTokens);
    const qTokensDeep = stripParticles(qTokens);

    if (tTokensDeep.length > 0 && qTokensDeep.length > 0) {
      const overlap = tTokensDeep.filter((tt) =>
        qTokensDeep.some((qt) => qt.includes(tt) || tt.includes(qt))
      );
      score += (overlap.length / tTokensDeep.length) * 6;
    }

    for (const qt of qTokensDeep) {
      for (const tt of tTokensDeep) {
        const dice = diceCoefficient(qt, tt);
        if (dice >= 0.55) score += dice * 3;
      }
    }
  }

  // 조사 제거한 deep normalized로도 포함 매칭
  const nqDeep = normalizeTextDeep(nq);
  const ntDeep = normalizeTextDeep(targetName);
  if (ntDeep.length >= 2 && nqDeep.includes(ntDeep) && !nq.includes(nt)) {
    score += Math.min(containsBonus * 0.8, 10);
  }

  const wholeDice = diceCoefficient(nq, nt);
  if (wholeDice >= 0.4) score += wholeDice * 4;

  return score;
}

function fuzzyMatchTask(question: string, tasks: Task[]): { task: Task; score: number } | null {
  const nq = normalizeText(question);
  const qTokens = tokenize(question);

  const scored = tasks
    .map((task) => ({ task, score: fuzzyScore(nq, qTokens, task.name, { threshold: 4 }) }))
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score || b.task.name.length - a.task.name.length);

  return scored[0] || null;
}

function fuzzyMatchMember(question: string, members: ProjectMember[]): { member: ProjectMember; score: number } | null {
  const nq = normalizeText(question);

  const scored = members
    .map((member) => ({
      member,
      score: fuzzyScore(nq, [], member.name, {
        threshold: 6,
        useTokens: false,
        containsBonus: 10,
        reverseContainsBonus: 0,
      }),
    }))
    .filter((item) => item.score >= 6)
    .sort((a, b) => b.score - a.score || b.member.name.length - a.member.name.length);

  return scored[0] || null;
}

function fuzzyMatchProject(question: string, projects: Project[]): { project: Project; score: number } | null {
  const nq = normalizeText(question);
  const qTokens = tokenize(question);

  const scored = projects
    .filter((p) => p.status !== 'deleted')
    .map((project) => ({
      project,
      score: fuzzyScore(nq, qTokens, project.name, { threshold: 5, reverseContainsBonus: 6 }),
    }))
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

// ─── Intent keyword map (primary=3, secondary=2, weak=1) ────
// 각 인텐트에 대해 동의어·구어체·변형을 최대한 포함

const INTENT_KEYWORDS: Record<string, { primary: string[]; secondary: string[]; weak: string[] }> = {
  greeting: {
    primary: ['안녕', '반가', '헬로', 'hello', 'hi', '하이', '안녕하세요', '반갑'],
    secondary: ['처음', '시작', '소개', '뭐하', '뭘할', '할수있'],
    weak: [],
  },
  overview: {
    primary: ['진행률', '진척률', '진도', '요약', '현황', '종합', '대시보드', '전체상태', '공정률', '공정율', '총진행', '전체진행', '진척도', '진행상황', '진행상태'],
    secondary: ['어때', '어떻게', '얼마나', '몇퍼센트', '전체', '프로젝트상태', '총괄', '개요', '전반', '개괄', '진척', '어떤상태', '어떤상황', '상태가', '상황이'],
    weak: ['상태', '알려', '보여', '확인', '조회'],
  },
  delay: {
    primary: ['지연', '리스크', '밀린', '늦은', '위험', '딜레이', 'delay', '초과', '오버런', '늦어진', '늦어지', '미뤄진', '밀려', '기한초과', '연체', '지체'],
    secondary: ['마감지남', '못끝낸', '넘긴', '문제', '이슈', '경고', '주의', '늦', '못끝', '안끝', '안끝난', '끝나야하', '지나', '넘겨', '안된', '못한', '빨간불', '위기'],
    weak: ['확인', '점검', '체크', '검토'],
  },
  weekly_this: {
    primary: ['이번주', '금주', '이주', '이번한주', '이번주간'],
    secondary: ['이번에', '주간', '이번', '이번달', '이주일'],
    weak: ['일정', '스케줄', '예정'],
  },
  weekly_next: {
    primary: ['다음주', '차주', '내주', '다다음', '다음주간', '다음한주'],
    secondary: ['다음번', '다음에'],
    weak: [],
  },
  member_summary: {
    primary: ['멤버별', '담당자별', '인력', '워크로드', '팀원별', '인력현황', '업무분배', '업무배분'],
    secondary: ['멤버', '담당자', '팀원', '사람', '배분', '배정', '할당', '누가', '인원별', '사람별', '팀원들', '각자', '각각'],
    weak: ['업무', '인원'],
  },
  status_query: {
    primary: ['완료된', '끝난', '보류중', '대기중', '진행중인', '하고있는', '완료작업', '보류작업', '대기작업', '진행작업', '끝낸', '마친'],
    secondary: ['완료목록', '끝난것', '보류', '대기', '완료한', '마무리', '완성', '끝나', '다끝', '다했'],
    weak: ['목록', '리스트', '몇개'],
  },
  project_list: {
    primary: ['프로젝트목록', '프로젝트리스트', '프로젝트현황', '전체프로젝트', '모든프로젝트'],
    secondary: ['프로젝트몇개', '프로젝트몇건', '프로젝트얼마나', '다른프로젝트', '프로젝트전부'],
    weak: ['프로젝트'],
  },
  guide_wbs: {
    primary: ['wbs', '작업구조', '작업분류', '작업분해', '작업구조도'],
    secondary: ['구조도', '분류체계', 'wbs사용', 'wbs편집', 'wbs입력'],
    weak: [],
  },
  guide_gantt: {
    primary: ['간트', 'gantt', '간트차트'],
    secondary: ['일정표', '바차트', '간트사용', '간트보기'],
    weak: [],
  },
  guide_export: {
    primary: ['엑셀', '내보내기', 'export', '다운로드', '가져오기', 'import'],
    secondary: ['출력', '보고서', '리포트', 'docx', '워드', '파일', '저장'],
    weak: ['인쇄', '프린트'],
  },
  upcoming_deadline: {
    primary: ['마감임박', '곧마감', '데드라인', 'deadline', '마감일', '기한임박', '곧끝나', '임박'],
    secondary: ['곧', '다가오', '다가올', '마감', '기한', '마감되', '언제끝', '끝나는날', '마감날', '종료예정'],
    weak: ['날짜', '기간'],
  },
  unassigned: {
    primary: ['미배정', '미지정', '배정안된', '담당자없', '할당안된', '배정안', '담당없'],
    secondary: ['누구안', '안정해', '미정인', '빠진', '비어있', '사람없'],
    weak: [],
  },
  priority: {
    primary: ['우선순위', '급한', '시급', '중요', '먼저해야', '급선무', '최우선', '가장급', '빨리해야'],
    secondary: ['먼저', '우선', '급히', '서두', '시급한', '긴급', '중대', '크리티컬', 'critical'],
    weak: ['빨리', '빠른'],
  },
  progress_compare: {
    primary: ['계획대비', '대비', '비교', '계획vs', '차이', '실적대비', '계획실적'],
    secondary: ['많이했', '적게했', '계획보다', '실적이', '목표대비', '차이가', '격차', '갭'],
    weak: [],
  },
  risk_insight: {
    primary: ['지연위험', '리스크경고', '위험작업', '위험경고', '리스크분석', '위험분석', '위험도'],
    secondary: ['위험한', '위태', '삐걱', '주의작업', '리스크높'],
    weak: [],
  },
  next_suggestion: {
    primary: ['다음작업', '추천작업', '뭐할까', '뭐부터', '무엇부터', '다음에할', '다음에뭐', '시작할작업', '추천해줘'],
    secondary: ['먼저할', '다음것', '추천', '뭐하면', '뭐해야'],
    weak: [],
  },
  weekly_summary: {
    primary: ['주간요약', '주간리포트', '주간정리', '이번주요약', '주간브리핑', '주간인사이트'],
    secondary: ['요약카드', '주간보고', '브리핑'],
    weak: [],
  },
  help: {
    primary: ['도움말', '도움', '사용법', '사용방법', '뭘물어', '뭐물어', '어떻게물어', '기능', '할수있는것'],
    secondary: ['어떤질문', '뭐질문', '가능한', '기능이', '쓰는법', '명령어', '커맨드'],
    weak: [],
  },
};

// ─── Intent scoring ──────────────────────────────────────────

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.filter((kw) => text.includes(kw)).length;
}

function scoreIntents(question: string, normalized: string, context: ChatbotContext): ScoredIntent[] {
  const intents: ScoredIntent[] = [];
  const normalizedDeep = stripKoreanSuffixes(normalized);
  // 조사 제거한 토큰화
  const tokens = tokenizeDeep(question);
  const tokenJoined = tokens.join('');

  for (const [intentType, kw] of Object.entries(INTENT_KEYWORDS)) {
    // 원래 정규화 + 어미 제거 정규화 + 토큰 조합 모두에 대해 키워드 매칭
    const primaryHits =
      countKeywordMatches(normalized, kw.primary) +
      countKeywordMatches(normalizedDeep, kw.primary.filter((k) => !normalized.includes(k))) +
      countKeywordMatches(tokenJoined, kw.primary.filter((k) => !normalized.includes(k) && !normalizedDeep.includes(k)));

    const secondaryHits =
      countKeywordMatches(normalized, kw.secondary) +
      countKeywordMatches(normalizedDeep, kw.secondary.filter((k) => !normalized.includes(k)));

    const weakHits = countKeywordMatches(normalized, kw.weak);

    const score = primaryHits * 3 + secondaryHits * 2 + weakHits * 1;
    if (score >= 2) {
      intents.push({ type: intentType as IntentType, score });
    }
  }

  // Entity matching
  const allMembers = context.members;
  const allTasks = context.tasks;

  const taskMatch = fuzzyMatchTask(question, allTasks);
  const memberMatch = fuzzyMatchMember(question, allMembers);
  const projectMatch = fuzzyMatchProject(question, context.allProjects);

  if (taskMatch) {
    intents.push({ type: 'task_detail', score: taskMatch.score, matchedTask: taskMatch.task });
  }

  if (projectMatch && (!context.project || projectMatch.project.id !== context.project.id)) {
    intents.push({ type: 'project_detail', score: projectMatch.score, matchedProject: projectMatch.project });
  }

  if (memberMatch) {
    const hasDelay = intents.some((i) => i.type === 'delay');
    const hasWeekly = intents.some((i) => i.type === 'weekly_this' || i.type === 'weekly_next');
    const hasStatus = intents.some((i) => i.type === 'status_query');

    if (hasDelay) {
      intents.push({ type: 'member_delay', score: memberMatch.score + 6, matchedMember: memberMatch.member });
    } else if (hasWeekly) {
      intents.push({ type: 'member_weekly', score: memberMatch.score + 5, matchedMember: memberMatch.member });
    } else if (hasStatus) {
      // 멤버 + 상태 조합: member_detail로 처리
      intents.push({ type: 'member_detail', score: memberMatch.score + 4, matchedMember: memberMatch.member });
    } else {
      intents.push({ type: 'member_detail', score: memberMatch.score, matchedMember: memberMatch.member });
    }
  }

  const statusIntent = intents.find((i) => i.type === 'status_query');
  if (statusIntent) {
    if (/완료|끝난|끝낸|마친|다한|다끝/.test(normalized)) statusIntent.taskStatus = 'completed';
    else if (/보류/.test(normalized)) statusIntent.taskStatus = 'on_hold';
    else if (/대기/.test(normalized)) statusIntent.taskStatus = 'pending';
    else if (/진행중|하고있|진행인/.test(normalized)) statusIntent.taskStatus = 'in_progress';
  }

  const hasWbs = intents.some((i) => i.type === 'guide_wbs');
  const hasGantt = intents.some((i) => i.type === 'guide_gantt');
  if (hasWbs && hasGantt) {
    intents.push({ type: 'guide_workflow', score: 10 });
  }

  return intents.sort((a, b) => b.score - a.score);
}

// ─── Conversation context / follow-up detection ──────────────

interface FollowUpResult {
  type: 'detail' | 'filter_member' | 'filter_status' | 'more' | 'none';
  memberName?: string;
  status?: TaskStatus;
}

function detectFollowUp(question: string, history: ChatbotMessage[]): FollowUpResult {
  const normalized = normalizeText(question);
  const normalizedDeep = normalizeTextDeep(question);

  // 이전 대화가 없으면 후속질문 불가
  if (history.length < 2) return { type: 'none' };

  // "더 알려줘", "더 보여줘", "자세히" → 직전 답변 확장
  if (/더|자세히|상세|구체적|전부|모두|다보여|다알려|나머지/.test(normalizedDeep)) {
    return { type: 'more' };
  }

  // "그 중에서 완료된", "그중 진행중" → 상태 필터
  if (/그중|그가운데|거기서|그거|위에서|방금/.test(normalizedDeep)) {
    if (/완료|끝난/.test(normalized)) return { type: 'filter_status', status: 'completed' };
    if (/진행중/.test(normalized)) return { type: 'filter_status', status: 'in_progress' };
    if (/대기/.test(normalized)) return { type: 'filter_status', status: 'pending' };
    if (/보류/.test(normalized)) return { type: 'filter_status', status: 'on_hold' };
  }

  return { type: 'none' };
}

/** 이전 답변에서 작업 이름 목록 추출 */
function extractTaskNamesFromReply(reply: string): string[] {
  const lines = reply.split('\n');
  return lines
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const match = line.match(/^- (.+?)(?:\s*\||\s*$)/);
      return match ? match[1].trim() : '';
    })
    .filter(Boolean);
}

// ─── Data helpers ────────────────────────────────────────────


function formatTaskPeriod(task: Task): string {
  if (!task.planStart && !task.planEnd) return '일정 미입력';
  return `${formatDate(task.planStart) || '미정'} ~ ${formatDate(task.planEnd) || '미정'}`;
}

function getBaseDate(project: Project | null): Date {
  return project?.baseDate ? new Date(project.baseDate) : new Date();
}

/** 마감 임박 작업 (향후 N일 이내 마감, 미완료) */
function getUpcomingDeadlineTasks(tasks: Task[], baseDate: Date, withinDays: number = 7): Task[] {
  return tasks.filter((task) => {
    if (task.status === 'completed') return false;
    if (!task.planEnd) return false;
    const planEnd = parseISO(task.planEnd);
    const daysLeft = differenceInDays(planEnd, baseDate);
    return daysLeft >= 0 && daysLeft <= withinDays;
  }).sort((a, b) => {
    const daysA = differenceInDays(parseISO(a.planEnd!), baseDate);
    const daysB = differenceInDays(parseISO(b.planEnd!), baseDate);
    return daysA - daysB;
  });
}

/** 미배정 작업 */
function getUnassignedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.assigneeId && t.status !== 'completed');
}

/** 우선순위 판단: 지연일수 + 미진행 정도 + 마감 근접도 종합 */
function getPriorityTasks(tasks: Task[], baseDate: Date): { task: Task; urgency: number; reason: string }[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .map((task) => {
      let urgency = 0;
      const reasons: string[] = [];

      // 지연일수
      const delayDays = getDelayDays(task, baseDate);
      if (delayDays > 0) {
        urgency += delayDays * 2;
        reasons.push(`${delayDays}일 지연`);
      }

      // 마감 임박 (7일 이내)
      if (task.planEnd) {
        const daysLeft = differenceInDays(parseISO(task.planEnd), baseDate);
        if (daysLeft >= 0 && daysLeft <= 7) {
          urgency += (7 - daysLeft) * 1.5;
          reasons.push(`마감 ${daysLeft}일 전`);
        }
      }

      // 진행률 대비 기간 소진
      if (task.planStart && task.planEnd) {
        const totalDays = differenceInDays(parseISO(task.planEnd), parseISO(task.planStart));
        const elapsed = differenceInDays(baseDate, parseISO(task.planStart));
        if (totalDays > 0 && elapsed > 0) {
          const timeRatio = elapsed / totalDays;
          const progressRatio = task.actualProgress / 100;
          if (timeRatio > progressRatio + 0.2) {
            urgency += (timeRatio - progressRatio) * 10;
            reasons.push(`기간 ${Math.round(timeRatio * 100)}% 소진, 진행 ${Math.round(task.actualProgress)}%`);
          }
        }
      }

      return { task, urgency, reason: reasons.join(' / ') || '진행 필요' };
    })
    .filter((item) => item.urgency > 0)
    .sort((a, b) => b.urgency - a.urgency);
}

async function resolveContext(context: ChatbotContext, matchedProject?: Project): Promise<ResolvedContext | null> {
  if (matchedProject) {
    const [members, tasks] = await Promise.all([
      loadProjectMembers(matchedProject.id),
      loadProjectTasks(matchedProject.id),
    ]);
    return { project: matchedProject, members, tasks };
  }

  if (context.project) {
    return { project: context.project, members: context.members, tasks: context.tasks };
  }

  if (context.allProjects.length > 0) {
    const firstActive = context.allProjects.find((p) => p.status === 'active') || context.allProjects[0];
    const [members, tasks] = await Promise.all([
      loadProjectMembers(firstActive.id),
      loadProjectTasks(firstActive.id),
    ]);
    return { project: firstActive, members, tasks };
  }

  return null;
}

// ─── Answer builders ─────────────────────────────────────────

function buildGreeting(context: ChatbotContext): string {
  const projectCount = context.allProjects.filter((p) => p.status !== 'deleted').length;
  if (context.project) {
    const leafTasks = getLeafTasks(context.tasks);
    const progress = Math.round(calculateOverallProgress(context.tasks));
    const baseDate = getBaseDate(context.project);
    const delayed = getDelayedTasks(leafTasks, baseDate);
    return [
      `안녕하세요, DK Bot입니다.`,
      `현재 프로젝트: "${context.project.name}"`,
      `작업 ${leafTasks.length}건 | 공정률 ${progress}%${delayed.length > 0 ? ` | 지연 ${delayed.length}건` : ''}`,
      projectCount > 1 ? `전체 ${projectCount}개 프로젝트에 대해서도 질문할 수 있습니다.` : '',
      '',
      '궁금한 점을 자유롭게 질문하세요!',
    ].filter((line) => line !== '').join('\n');
  }
  return [
    `안녕하세요, DK Bot입니다.`,
    projectCount > 0 ? `현재 ${projectCount}개 프로젝트가 등록되어 있습니다.` : '등록된 프로젝트가 없습니다.',
    `프로젝트명을 포함해서 질문하시면 해당 프로젝트 기준으로 답변합니다.`,
    '',
    '궁금한 점을 자유롭게 질문하세요!',
  ].filter(Boolean).join('\n');
}

function buildHelpAnswer(): string {
  return [
    'DK Bot이 답변할 수 있는 질문 예시입니다.',
    '',
    '📊 프로젝트 현황',
    '  "현재 진행률 알려줘", "프로젝트 상태가 어때?"',
    '',
    '⚠️ 지연 · 리스크',
    '  "지연된 작업이 뭐야?", "밀린 일 있어?"',
    '',
    '📅 주간 일정',
    '  "이번 주 작업", "다음 주 뭐 해야 해?"',
    '',
    '👤 멤버별 업무',
    '  "홍길동 업무", "멤버별 워크로드"',
    '',
    '🔍 작업 상세 · 상태별 조회',
    '  "○○ 작업 알려줘", "완료된 작업", "보류 중인 건?"',
    '',
    '🔥 우선순위 · 마감임박',
    '  "급한 거 뭐야?", "마감 임박한 작업"',
    '',
    '📋 기타',
    '  "미배정 작업", "프로젝트 목록", "WBS 사용법"',
  ].join('\n');
}

function buildProjectListAnswer(context: ChatbotContext): string {
  const projects = context.allProjects.filter((p) => p.status !== 'deleted');
  if (projects.length === 0) return '등록된 프로젝트가 없습니다.';

  const byStatus = {
    preparing: projects.filter((p) => p.status === 'preparing'),
    active: projects.filter((p) => p.status === 'active'),
    completed: projects.filter((p) => p.status === 'completed'),
  };

  const lines: string[] = [`전체 프로젝트 ${projects.length}건`];

  for (const [status, list] of Object.entries(byStatus)) {
    if (list.length > 0) {
      lines.push(`\n[${PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS]}] ${list.length}건`);
      list.slice(0, 5).forEach((p) => {
        lines.push(`- ${p.name} | ${p.startDate ? formatDate(p.startDate) : '일정 미정'} ~ ${p.endDate ? formatDate(p.endDate) : '미정'}`);
      });
      if (list.length > 5) lines.push(`  외 ${list.length - 5}건`);
    }
  }

  return lines.join('\n');
}

function buildProjectDetailAnswer(rc: ResolvedContext): string {
  const leafTasks = getLeafTasks(rc.tasks);
  const baseDate = getBaseDate(rc.project);
  const completed = leafTasks.filter((t) => t.status === 'completed').length;
  const inProgress = leafTasks.filter((t) => t.status === 'in_progress').length;
  const pending = leafTasks.filter((t) => t.status === 'pending').length;
  const onHold = leafTasks.filter((t) => t.status === 'on_hold').length;
  const delayed = getDelayedTasks(leafTasks, baseDate);
  const progress = Math.round(calculateOverallProgress(rc.tasks));
  const unassigned = leafTasks.filter((t) => !t.assigneeId).length;

  const lines = [
    `"${rc.project.name}" 프로젝트 요약`,
    `상태: ${PROJECT_STATUS_LABELS[rc.project.status]} | 멤버: ${rc.members.length}명`,
    `작업 ${leafTasks.length}건 | 완료 ${completed} | 진행 ${inProgress} | 대기 ${pending}${onHold > 0 ? ` | 보류 ${onHold}` : ''} | 지연 ${delayed.length}`,
    `공정률: ${progress}%`,
    rc.project.startDate
      ? `일정: ${formatDate(rc.project.startDate)} ~ ${formatDate(rc.project.endDate) || '미정'}`
      : '전체 일정 미설정',
  ];

  if (unassigned > 0) {
    lines.push(`미배정 작업: ${unassigned}건`);
  }

  if (delayed.length > 0) {
    lines.push(`최우선 리스크: "${delayed[0].name}" (${getDelayDays(delayed[0], baseDate)}일 지연)`);
  } else {
    lines.push('지연 작업 없음');
  }

  return lines.join('\n');
}

function buildOverviewAnswer(rc: ResolvedContext): string {
  return buildProjectDetailAnswer(rc);
}

function buildDelayAnswer(rc: ResolvedContext): string {
  const baseDate = getBaseDate(rc.project);
  const delayed = getDelayedTasks(getLeafTasks(rc.tasks), baseDate)
    .sort((a, b) => getDelayDays(b, baseDate) - getDelayDays(a, baseDate));

  if (delayed.length === 0) return `"${rc.project.name}"에 지연 작업이 없습니다. 모든 작업이 정상 진행 중입니다.`;

  const lines = [
    `"${rc.project.name}" 지연 작업 ${delayed.length}건`,
    ...delayed.slice(0, 7).map((t, i) =>
      `${i + 1}. ${t.name} | ${getAssigneeName(t, rc.members)} | 마감 ${formatDate(t.planEnd)} | ${getDelayDays(t, baseDate)}일 지연 | ${Math.round(t.actualProgress)}%`
    ),
  ];

  if (delayed.length > 7) {
    lines.push(`외 ${delayed.length - 7}건`);
  }

  return lines.join('\n');
}

function buildWeeklyAnswer(rc: ResolvedContext, type: 'this' | 'next'): string {
  const label = type === 'this' ? '이번 주' : '다음 주';
  const weekly = getWeeklyTasks(getLeafTasks(rc.tasks), type)
    .sort((a, b) => (a.planStart || '').localeCompare(b.planStart || ''));

  if (weekly.length === 0) return `"${rc.project.name}" ${label} 예정 작업이 없습니다.`;

  const lines = [
    `"${rc.project.name}" ${label} 작업 ${weekly.length}건`,
    ...weekly.slice(0, 7).map((t, i) =>
      `${i + 1}. ${t.name} | ${formatTaskPeriod(t)} | ${getAssigneeName(t, rc.members)} | ${Math.round(t.actualProgress)}%`
    ),
  ];

  if (weekly.length > 7) {
    lines.push(`외 ${weekly.length - 7}건`);
  }

  return lines.join('\n');
}

function buildMemberSummaryAnswer(rc: ResolvedContext): string {
  const baseDate = getBaseDate(rc.project);
  const workloads = calculateAssigneeWorkloads(rc.tasks, rc.members, baseDate);

  if (workloads.length === 0) return `"${rc.project.name}"에 담당자 배정된 작업이 없습니다.`;

  const unassigned = getLeafTasks(rc.tasks).filter((t) => !t.assigneeId).length;
  const lines = [
    `"${rc.project.name}" 멤버별 업무 현황`,
    ...workloads.slice(0, 8).map((w) =>
      `- ${w.name}: 총 ${w.total} | 진행 ${w.inProgress} | 완료 ${w.completed} | 지연 ${w.delayed}`
    ),
  ];

  if (workloads.length > 8) {
    lines.push(`외 ${workloads.length - 8}명`);
  }

  if (unassigned > 0) {
    lines.push(`\n미지정 ${unassigned}건`);
  }

  return lines.join('\n');
}

function buildMemberDetailAnswer(member: ProjectMember, rc: ResolvedContext): string {
  const baseDate = getBaseDate(rc.project);
  const mt = getLeafTasks(rc.tasks).filter((t) => t.assigneeId === member.id);

  if (mt.length === 0) return `${member.name}님에게 배정된 작업이 없습니다.`;

  const delayed = getDelayedTasks(mt, baseDate);
  const completed = mt.filter((t) => t.status === 'completed').length;
  const inProgress = mt.filter((t) => t.status === 'in_progress').length;
  const pending = mt.filter((t) => t.status === 'pending').length;

  const lines = [
    `${member.name}님 업무 요약 ("${rc.project.name}")`,
    `총 ${mt.length}건 | 진행 ${inProgress} | 완료 ${completed} | 대기 ${pending} | 지연 ${delayed.length}`,
    '',
    ...mt.slice(0, 6).map((t) =>
      `- ${t.name} | ${TASK_STATUS_LABELS[t.status]} | ${Math.round(t.actualProgress)}%${getDelayDays(t, baseDate) > 0 ? ` | ${getDelayDays(t, baseDate)}일 지연` : ''}`
    ),
  ];

  if (mt.length > 6) {
    lines.push(`외 ${mt.length - 6}건`);
  }

  return lines.join('\n');
}

function buildMemberDelayAnswer(member: ProjectMember, rc: ResolvedContext): string {
  const baseDate = getBaseDate(rc.project);
  const mt = getLeafTasks(rc.tasks).filter((t) => t.assigneeId === member.id);
  const delayed = getDelayedTasks(mt, baseDate)
    .sort((a, b) => getDelayDays(b, baseDate) - getDelayDays(a, baseDate));

  if (delayed.length === 0) return `${member.name}님 담당 작업 중 지연된 것은 없습니다.`;

  return [
    `${member.name}님 지연 작업 ${delayed.length}건`,
    ...delayed.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.name} | 마감 ${formatDate(t.planEnd)} | ${getDelayDays(t, baseDate)}일 지연 | ${Math.round(t.actualProgress)}%`
    ),
  ].join('\n');
}

function buildMemberWeeklyAnswer(member: ProjectMember, rc: ResolvedContext): string {
  const mt = getLeafTasks(rc.tasks).filter((t) => t.assigneeId === member.id);
  const weekly = getWeeklyTasks(mt, 'this');

  if (weekly.length === 0) return `${member.name}님의 이번 주 작업은 없습니다.`;

  return [
    `${member.name}님 이번 주 작업 ${weekly.length}건`,
    ...weekly.slice(0, 5).map((t, i) =>
      `${i + 1}. ${t.name} | ${formatTaskPeriod(t)} | ${Math.round(t.actualProgress)}%`
    ),
  ].join('\n');
}

function buildTaskDetailAnswer(task: Task, rc: ResolvedContext): string {
  const parent = rc.tasks.find((t) => t.id === task.parentId);
  const children = rc.tasks.filter((t) => t.parentId === task.id);
  const assignee = getAssigneeName(task, rc.members);
  const baseDate = getBaseDate(rc.project);
  const delay = getDelayDays(task, baseDate);

  const lines = [
    `"${task.name}" 상세 ("${rc.project.name}")`,
    `구분: ${LEVEL_LABELS[task.level] || '작업'} | 상태: ${TASK_STATUS_LABELS[task.status]}`,
    `담당: ${assignee} | 공정률: ${Math.round(task.actualProgress)}%`,
    `계획: ${formatTaskPeriod(task)}`,
    task.actualStart || task.actualEnd
      ? `실적: ${formatDate(task.actualStart) || '미정'} ~ ${formatDate(task.actualEnd) || '미정'}`
      : '실적 일정 미입력',
    delay > 0 ? `⚠ ${delay}일 지연` : '지연 없음',
  ];

  if (task.description) {
    lines.push(`설명: ${task.description}`);
  }
  if (task.output) {
    lines.push(`산출물: ${task.output}`);
  }
  if (parent) {
    lines.push(`상위: "${parent.name}"`);
  }
  if (children.length > 0) {
    lines.push(`하위 작업 ${children.length}건`);
    children.slice(0, 3).forEach((c) => {
      lines.push(`  - ${c.name} | ${TASK_STATUS_LABELS[c.status]} | ${Math.round(c.actualProgress)}%`);
    });
    if (children.length > 3) lines.push(`  외 ${children.length - 3}건`);
  }

  return lines.join('\n');
}

function buildStatusFilterAnswer(status: TaskStatus, rc: ResolvedContext): string {
  const filtered = getLeafTasks(rc.tasks).filter((t) => t.status === status);
  const label = TASK_STATUS_LABELS[status];

  if (filtered.length === 0) return `"${rc.project.name}"에 "${label}" 상태 작업이 없습니다.`;

  const lines = [
    `"${rc.project.name}" ${label} 작업 ${filtered.length}건`,
    ...filtered.slice(0, 10).map((t, i) =>
      `${i + 1}. ${t.name} | ${getAssigneeName(t, rc.members)} | ${Math.round(t.actualProgress)}%`
    ),
  ];

  if (filtered.length > 10) {
    lines.push(`외 ${filtered.length - 10}건`);
  }

  return lines.join('\n');
}

function buildUpcomingDeadlineAnswer(rc: ResolvedContext): string {
  const baseDate = getBaseDate(rc.project);
  const upcoming = getUpcomingDeadlineTasks(getLeafTasks(rc.tasks), baseDate, 7);

  if (upcoming.length === 0) return `"${rc.project.name}"에 7일 이내 마감 예정 작업이 없습니다.`;

  return [
    `"${rc.project.name}" 마감 임박 작업 (7일 이내) ${upcoming.length}건`,
    ...upcoming.slice(0, 7).map((t, i) => {
      const daysLeft = differenceInDays(parseISO(t.planEnd!), baseDate);
      return `${i + 1}. ${t.name} | ${getAssigneeName(t, rc.members)} | 마감 ${formatDate(t.planEnd)} (${daysLeft === 0 ? '오늘' : `${daysLeft}일 후`}) | ${Math.round(t.actualProgress)}%`;
    }),
    upcoming.length > 7 ? `외 ${upcoming.length - 7}건` : '',
  ].filter(Boolean).join('\n');
}

function buildUnassignedAnswer(rc: ResolvedContext): string {
  const unassigned = getUnassignedTasks(getLeafTasks(rc.tasks));

  if (unassigned.length === 0) return `"${rc.project.name}"의 모든 작업에 담당자가 배정되어 있습니다.`;

  return [
    `"${rc.project.name}" 미배정 작업 ${unassigned.length}건`,
    ...unassigned.slice(0, 8).map((t, i) =>
      `${i + 1}. ${t.name} | ${TASK_STATUS_LABELS[t.status]} | ${formatTaskPeriod(t)}`
    ),
    unassigned.length > 8 ? `외 ${unassigned.length - 8}건` : '',
  ].filter(Boolean).join('\n');
}

function buildPriorityAnswer(rc: ResolvedContext): string {
  const baseDate = getBaseDate(rc.project);
  const priorities = getPriorityTasks(getLeafTasks(rc.tasks), baseDate);

  if (priorities.length === 0) return `"${rc.project.name}"에 긴급하게 처리할 작업이 없습니다.`;

  return [
    `"${rc.project.name}" 우선순위 높은 작업 (긴급도 순)`,
    ...priorities.slice(0, 7).map((item, i) =>
      `${i + 1}. ${item.task.name} | ${getAssigneeName(item.task, rc.members)} | ${item.reason}`
    ),
    priorities.length > 7 ? `외 ${priorities.length - 7}건` : '',
  ].filter(Boolean).join('\n');
}

function buildProgressCompareAnswer(rc: ResolvedContext): string {
  const baseDate = getBaseDate(rc.project);
  const leafTasks = getLeafTasks(rc.tasks);
  const progress = Math.round(calculateOverallProgress(rc.tasks));

  // 계획 공정률 계산 (기간 대비 경과 비율)
  let planProgress = 0;
  if (rc.project.startDate && rc.project.endDate) {
    const totalDays = differenceInDays(parseISO(rc.project.endDate), parseISO(rc.project.startDate));
    const elapsed = differenceInDays(baseDate, parseISO(rc.project.startDate));
    if (totalDays > 0) {
      planProgress = Math.min(100, Math.round((elapsed / totalDays) * 100));
    }
  }

  const gap = progress - planProgress;
  const delayed = getDelayedTasks(leafTasks, baseDate);

  // 작업별 진행률 vs 기간 소진률 비교
  const behindSchedule = leafTasks
    .filter((t) => t.status !== 'completed' && t.planStart && t.planEnd)
    .map((t) => {
      const totalDays = differenceInDays(parseISO(t.planEnd!), parseISO(t.planStart!));
      const elapsed = differenceInDays(baseDate, parseISO(t.planStart!));
      const timeRatio = totalDays > 0 ? Math.min(1, elapsed / totalDays) : 0;
      const progressRatio = t.actualProgress / 100;
      return { task: t, gap: timeRatio - progressRatio };
    })
    .filter((item) => item.gap > 0.15)
    .sort((a, b) => b.gap - a.gap);

  const lines = [
    `"${rc.project.name}" 계획 대비 실적 분석`,
    planProgress > 0
      ? `전체: 계획 ${planProgress}% 시점 → 실적 ${progress}% (${gap >= 0 ? `+${gap}%p 앞서는 중` : `${gap}%p 뒤처지는 중`})`
      : `전체 공정률: ${progress}%`,
    `지연 작업: ${delayed.length}건`,
  ];

  if (behindSchedule.length > 0) {
    lines.push(`\n기간 대비 진행이 부족한 작업:`);
    behindSchedule.slice(0, 5).forEach((item, i) => {
      lines.push(`${i + 1}. ${item.task.name} | 진행 ${Math.round(item.task.actualProgress)}% | 차이 ${Math.round(item.gap * 100)}%p`);
    });
  } else {
    lines.push('기간 대비 진행이 부족한 작업이 없습니다.');
  }

  return lines.join('\n');
}

function buildWbsGuideAnswer(): string {
  return [
    'WBS(작업분류체계) 사용 가이드',
    '',
    '▸ 계층 구조: Phase → Activity → Task 순으로 세분화',
    '▸ 작업 추가: 원하는 행 위/아래에 같은 레벨 또는 하위 레벨 추가',
    '▸ 진행률: 말단 작업의 진행률을 입력하면 상위 자동 집계',
    '▸ 담당자: 각 작업에 프로젝트 멤버를 배정',
    '▸ 엑셀 다운로드로 계층 코드와 일정을 한 번에 정리 가능',
  ].join('\n');
}

function buildGanttGuideAnswer(): string {
  return [
    '간트 차트 사용 가이드',
    '',
    '▸ 계획 바(파란색)와 실적 바(주황색)를 비교하여 진행 현황 파악',
    '▸ 막대가 겹치는 구간에서 일정 몰림을 확인',
    '▸ "오늘" 버튼으로 현재 시점으로 빠르게 이동',
    '▸ 지연 작업은 계획종료일과 공정률을 같이 비교하여 우선순위 결정',
    '▸ 주/월 단위로 확대·축소 가능',
  ].join('\n');
}

function buildExportGuideAnswer(): string {
  return [
    '내보내기·가져오기 가이드',
    '',
    '▸ WBS 화면: 계층형 작업표 엑셀 다운로드',
    '▸ 간트 화면: 일정 매트릭스 엑셀 다운로드',
    '▸ 설정 화면: WBS 데이터 JSON 가져오기/내보내기',
    '▸ 보고서: 대시보드에서 PDF/Word 형식 보고서 생성 가능',
  ].join('\n');
}

// ─── Contextual suggestions ──────────────────────────────────

function buildContextualSuggestions(intentType: IntentType, rc?: ResolvedContext | null): string[] {
  switch (intentType) {
    case 'overview':
      return ['지연된 작업 알려줘', '이번 주 일정은?', '우선순위 높은 작업은?'];
    case 'delay':
      return ['멤버별 업무 현황', '마감 임박 작업은?', '우선순위 정리해줘'];
    case 'weekly_this':
      return ['다음 주 작업은?', '지연된 작업 있어?', '멤버별 업무'];
    case 'weekly_next':
      return ['이번 주 작업은?', '마감 임박 작업', '전체 현황'];
    case 'member_summary':
      return rc?.members[0] ? [`${rc.members[0].name} 업무 상세`, '미배정 작업', '지연 현황'] : ['지연 현황', '미배정 작업', '전체 현황'];
    case 'member_detail':
    case 'member_delay':
    case 'member_weekly':
      return ['멤버별 업무 정리', '전체 지연 현황', '이번 주 작업'];
    case 'task_detail':
      return ['지연된 작업', '전체 현황 알려줘', '이번 주 작업'];
    case 'status_query':
      return ['지연 작업 알려줘', '멤버별 업무', '전체 현황'];
    case 'project_list':
    case 'project_detail':
      return ['프로젝트 현황', '지연 작업', '이번 주 일정'];
    case 'upcoming_deadline':
      return ['지연 현황', '우선순위 작업', '멤버별 업무'];
    case 'unassigned':
      return ['멤버별 업무', '전체 현황', '지연 작업'];
    case 'priority':
      return ['지연 작업 상세', '마감 임박 작업', '멤버별 업무'];
    case 'progress_compare':
      return ['우선순위 높은 작업', '지연 현황', '멤버별 업무'];
    case 'risk_insight':
      return ['다음 추천 작업은?', '주간 요약 보여줘', '멤버별 업무'];
    case 'next_suggestion':
      return ['지연 위험 작업은?', '주간 요약 보여줘', '이번 주 일정'];
    case 'weekly_summary':
      return ['지연 위험 작업은?', '다음 추천 작업은?', '멤버별 업무'];
    case 'help':
      return ['전체 현황 알려줘', '지연 작업', '이번 주 일정'];
    default:
      return [];
  }
}

// ─── Compound intent support ─────────────────────────────────

/** 복합 인텐트: 호환 가능한 인텐트 쌍만 합산 답변 */
const COMPOSABLE_INTENTS = new Set<IntentType>([
  'overview', 'delay', 'weekly_this', 'weekly_next',
  'member_summary', 'upcoming_deadline', 'unassigned',
  'priority', 'status_query', 'progress_compare',
]);

function isComposable(type: IntentType): boolean {
  return COMPOSABLE_INTENTS.has(type);
}

// ─── Intent dispatch ─────────────────────────────────────────

async function dispatchIntent(intent: ScoredIntent, context: ChatbotContext): Promise<{ text: string | null; intentType: IntentType }> {
  switch (intent.type) {
    case 'greeting':
      return { text: buildGreeting(context), intentType: intent.type };
    case 'help':
      return { text: buildHelpAnswer(), intentType: intent.type };
    case 'project_list':
      return { text: buildProjectListAnswer(context), intentType: intent.type };
    case 'guide_wbs':
      return { text: buildWbsGuideAnswer(), intentType: intent.type };
    case 'guide_gantt':
      return { text: buildGanttGuideAnswer(), intentType: intent.type };
    case 'guide_workflow':
      return { text: [buildWbsGuideAnswer(), '', buildGanttGuideAnswer()].join('\n'), intentType: intent.type };
    case 'guide_export':
      return { text: buildExportGuideAnswer(), intentType: intent.type };
    default:
      break;
  }

  const rc = await resolveContext(context, intent.matchedProject);
  if (!rc) return { text: '프로젝트 데이터가 없습니다. 프로젝트를 먼저 생성해 주세요.', intentType: intent.type };

  if (intent.type === 'project_detail' && intent.matchedProject) {
    return { text: buildProjectDetailAnswer(rc), intentType: intent.type };
  }

  if (intent.matchedTask) {
    const taskProjectId = intent.matchedTask.projectId;
    if (taskProjectId !== rc.project.id) {
      const taskProject = context.allProjects.find((p) => p.id === taskProjectId);
      if (taskProject) {
        const taskRc = await resolveContext(context, taskProject);
        if (taskRc) return { text: buildTaskDetailAnswer(intent.matchedTask, taskRc), intentType: intent.type };
      }
    }
    return { text: buildTaskDetailAnswer(intent.matchedTask, rc), intentType: intent.type };
  }

  let text: string | null = null;
  switch (intent.type) {
    case 'overview':
      text = buildOverviewAnswer(rc);
      break;
    case 'delay':
      text = buildDelayAnswer(rc);
      break;
    case 'weekly_this':
      text = buildWeeklyAnswer(rc, 'this');
      break;
    case 'weekly_next':
      text = buildWeeklyAnswer(rc, 'next');
      break;
    case 'member_summary':
      text = buildMemberSummaryAnswer(rc);
      break;
    case 'member_detail':
      text = intent.matchedMember ? buildMemberDetailAnswer(intent.matchedMember, rc) : null;
      break;
    case 'member_delay':
      text = intent.matchedMember ? buildMemberDelayAnswer(intent.matchedMember, rc) : null;
      break;
    case 'member_weekly':
      text = intent.matchedMember ? buildMemberWeeklyAnswer(intent.matchedMember, rc) : null;
      break;
    case 'task_detail':
      text = intent.matchedTask ? buildTaskDetailAnswer(intent.matchedTask, rc) : null;
      break;
    case 'status_query':
      text = intent.taskStatus ? buildStatusFilterAnswer(intent.taskStatus, rc) : buildOverviewAnswer(rc);
      break;
    case 'upcoming_deadline':
      text = buildUpcomingDeadlineAnswer(rc);
      break;
    case 'unassigned':
      text = buildUnassignedAnswer(rc);
      break;
    case 'priority':
      text = buildPriorityAnswer(rc);
      break;
    case 'progress_compare':
      text = buildProgressCompareAnswer(rc);
      break;
    case 'risk_insight': {
      const baseDate = getBaseDate(rc.project);
      const risks = detectDelayRisks(rc.tasks, rc.members, baseDate);
      text = formatRiskAnswer(risks, rc.project.name);
      break;
    }
    case 'next_suggestion': {
      const baseDate = getBaseDate(rc.project);
      const suggestions = suggestNextTasks(rc.tasks, rc.members, baseDate);
      text = formatSuggestionAnswer(suggestions, rc.project.name);
      break;
    }
    case 'weekly_summary': {
      const baseDate = getBaseDate(rc.project);
      const summary = generateWeeklySummary(rc.tasks, rc.members, baseDate);
      text = formatWeeklySummaryAnswer(summary, rc.project.name);
      break;
    }
  }

  return { text, intentType: intent.type };
}

// ─── RAG attempt ─────────────────────────────────────────────

// gte-small(코사인 유사도)은 OpenAI 임베딩보다 전반적으로 값이 낮게 분포하므로 임계값을 낮춘다.
const RAG_MIN_TOP_SIMILARITY = 0.35;

async function tryRagAnswer(
  question: string,
  context: ChatbotContext,
): Promise<string | null> {
  if (!context.project) return null;
  if (question.length < 3) return null;
  if (!isRagReady()) return null;

  try {
    const hits = await searchKnowledgeBase(question, context.project.id, {
      topK: 5,
      minSimilarity: 0.25,
    });
    if (hits.length === 0) return null;
    if (hits[0].similarity < RAG_MIN_TOP_SIMILARITY) return null;
    return answerWithRag(hits);
  } catch (err) {
    console.warn('[RAG] 검색 실패, 룰 폴백:', err);
    return null;
  }
}

// ─── Fallback: fuzzy local search ────────────────────────────

function buildFallbackFromLocal(question: string, context: ChatbotContext): string | null {
  const nq = normalizeText(question);
  const nqDeep = normalizeTextDeep(question);
  const qTokens = tokenize(question);
  const qTokensDeep = stripParticles(qTokens);

  const scored = context.tasks
    .map((task) => {
      const nt = normalizeText(task.name);
      const tTokens = tokenize(task.name);
      const tTokensDeep = stripParticles(tTokens);
      let score = 0;

      if (nt.length >= 2 && nq.includes(nt)) score += 10;
      if (nt.length >= 2 && nqDeep.includes(nt)) score += 8;
      if (nq.length >= 3 && nt.includes(nq)) score += 6;

      if (tTokensDeep.length > 0 && qTokensDeep.length > 0) {
        const overlap = tTokensDeep.filter((tt) =>
          qTokensDeep.some((qt) => qt.includes(tt) || tt.includes(qt))
        );
        score += (overlap.length / tTokensDeep.length) * 5;
      }

      const dice = diceCoefficient(nq, nt);
      if (dice >= 0.3) score += dice * 4;

      // deep normalized dice
      const ntDeep = normalizeTextDeep(task.name);
      const diceDeep = diceCoefficient(nqDeep, ntDeep);
      if (diceDeep >= 0.35 && diceDeep > dice) score += diceDeep * 3;

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
      '',
      '작업명을 포함하여 다시 질문하시면 상세 정보를 드릴 수 있습니다.',
    ].join('\n');
  }

  // 프로젝트 이름 매칭
  const projectMatch = fuzzyMatchProject(question, context.allProjects);
  if (projectMatch) {
    const p = projectMatch.project;
    return `"${p.name}" 프로젝트를 찾았습니다.\n상태: ${PROJECT_STATUS_LABELS[p.status]} | ${p.startDate ? formatDate(p.startDate) : '일정 미정'} ~ ${p.endDate ? formatDate(p.endDate) : '미정'}\n이 프로젝트에 대해 더 자세히 질문해 보세요.`;
  }

  return null;
}

// ─── Fallback: Supabase DB search ────────────────────────────

async function searchSupabaseForAnswer(question: string): Promise<string | null> {
  if (!supabase) return null;

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
          `- ${p.name} | ${PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS] || p.status} | ${p.start_date || '미정'} ~ ${p.end_date || '미정'}`
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

// ─── Follow-up handler ───────────────────────────────────────

function handleFollowUp(followUp: FollowUpResult, lastBotMessage: string, context: ChatbotContext): string | null {
  if (followUp.type === 'more') {
    // "더 보여줘" → 직전 답변에서 잘린 항목 감지
    const taskNames = extractTaskNamesFromReply(lastBotMessage);
    if (taskNames.length === 0) return null;

    // 직전 답변의 작업들을 찾아서 전체 목록 반환
    const leafTasks = getLeafTasks(context.tasks);
    const matchedTasks = leafTasks.filter((t) =>
      taskNames.some((name) => t.name.includes(name) || name.includes(t.name))
    );

    if (matchedTasks.length === 0) return null;

    // 직전 답변이 특정 카테고리였는지 감지
    if (lastBotMessage.includes('지연')) {
      const baseDate = getBaseDate(context.project);
      const delayed = getDelayedTasks(leafTasks, baseDate)
        .sort((a, b) => getDelayDays(b, baseDate) - getDelayDays(a, baseDate));
      if (delayed.length <= 7) return '이미 전체 지연 작업을 모두 표시했습니다.';
      return [
        `전체 지연 작업 ${delayed.length}건`,
        ...delayed.map((t, i) =>
          `${i + 1}. ${t.name} | ${getAssigneeName(t, context.members)} | ${getDelayDays(t, baseDate)}일 지연`
        ),
      ].join('\n');
    }

    // 일반적인 경우: 직전 답변에 표시된 상태와 같은 작업들 전체 표시
    return null;
  }

  if (followUp.type === 'filter_status' && followUp.status) {
    const leafTasks = getLeafTasks(context.tasks);
    const filtered = leafTasks.filter((t) => t.status === followUp.status);
    const label = TASK_STATUS_LABELS[followUp.status];

    if (filtered.length === 0) return `"${label}" 상태의 작업이 없습니다.`;

    return [
      `${label} 작업 ${filtered.length}건`,
      ...filtered.slice(0, 10).map((t, i) =>
        `${i + 1}. ${t.name} | ${getAssigneeName(t, context.members)} | ${Math.round(t.actualProgress)}%`
      ),
      filtered.length > 10 ? `외 ${filtered.length - 10}건` : '',
    ].filter(Boolean).join('\n');
  }

  return null;
}

// ─── Smart not-found message ─────────────────────────────────

function buildSmartNotFound(question: string, context: ChatbotContext): string {
  const lines = ['해당 정보를 찾을 수 없습니다.'];

  // 어떤 종류의 질문인지 추측하여 도움 제공
  const normalized = normalizeText(question);

  if (context.tasks.length === 0 && context.project) {
    lines.push(`현재 프로젝트 "${context.project.name}"에 등록된 작업이 없습니다.`);
    lines.push('WBS 화면에서 작업을 추가한 후 다시 질문해 주세요.');
    return lines.join('\n');
  }

  if (!context.project && context.allProjects.length > 0) {
    lines.push('프로젝트를 선택한 후 질문하시면 더 정확한 답변을 드릴 수 있습니다.');
    const activeProjects = context.allProjects.filter((p) => p.status === 'active');
    if (activeProjects.length > 0) {
      lines.push(`현재 진행 중인 프로젝트: ${activeProjects.map((p) => `"${p.name}"`).join(', ')}`);
    }
    return lines.join('\n');
  }

  // 사람 이름을 질문한 것 같은 경우
  if (context.members.length > 0 && normalized.length >= 2 && normalized.length <= 10) {
    const memberNames = context.members.map((m) => m.name).join(', ');
    lines.push(`현재 프로젝트 멤버: ${memberNames}`);
    lines.push('멤버 이름을 포함하여 질문해 보세요.');
    return lines.join('\n');
  }

  lines.push('');
  lines.push('이렇게 질문해 보세요:');
  lines.push('• "현재 진행률 알려줘"');
  lines.push('• "지연된 작업 있어?"');
  lines.push('• "이번 주 뭐 해야 해?"');
  lines.push('• "도움말" — 전체 질문 예시 보기');

  return lines.join('\n');
}

// ─── Main entry ──────────────────────────────────────────────

export async function createChatbotReply(
  question: string,
  context: ChatbotContext,
  history: ChatbotMessage[] = []
): Promise<ChatbotReply> {
  const trimmed = question.trim();
  if (!trimmed) return { text: '질문을 입력해 주세요.', suggestions: [] };

  const normalized = normalizeText(trimmed);

  // 0단계: 후속 질문 감지 (대화 맥락)
  if (history.length >= 2) {
    const lastBotMsg = [...history].reverse().find((m) => m.role === 'assistant');
    if (lastBotMsg) {
      const followUp = detectFollowUp(trimmed, history);
      if (followUp.type !== 'none') {
        const followUpAnswer = handleFollowUp(followUp, lastBotMsg.text, context);
        if (followUpAnswer) {
          return { text: followUpAnswer, suggestions: ['전체 현황', '지연 작업', '이번 주 일정'] };
        }
      }
    }
  }

  // 0.5단계: RAG 시도 (Supabase 연결 + 프로젝트 컨텍스트가 있을 때만, API 키 불필요)
  const ragAnswer = await tryRagAnswer(trimmed, context);
  if (ragAnswer) {
    return {
      text: ragAnswer,
      suggestions: ['지연된 작업 알려줘', '이번 주 일정은?', '멤버별 업무 현황'],
    };
  }

  // 1단계: 의도 분류 스코어링
  const intents = scoreIntents(trimmed, normalized, context);

  if (intents.length > 0) {
    const topIntent = intents[0];
    const result = await dispatchIntent(topIntent, context);

    if (result.text) {
      // 복합 인텐트: 2번째 인텐트도 호환 가능하면 합산
      let combinedText = result.text;
      const combinedIntentType = result.intentType;

      if (intents.length >= 2 && isComposable(topIntent.type) && isComposable(intents[1].type) && intents[1].type !== topIntent.type) {
        // 2번째 인텐트가 충분히 높은 점수이고 독립적 인텐트일 때만
        if (intents[1].score >= 3 && !intents[1].matchedMember && !intents[1].matchedTask) {
          const secondResult = await dispatchIntent(intents[1], context);
          if (secondResult.text) {
            combinedText = `${result.text}\n\n───\n\n${secondResult.text}`;
          }
        }
      }

      const suggestions = buildContextualSuggestions(combinedIntentType, null);
      return { text: combinedText, suggestions };
    }
  }

  // 2단계: 로컬 퍼지 검색
  const localFallback = buildFallbackFromLocal(trimmed, context);
  if (localFallback) return { text: localFallback, suggestions: ['전체 현황 알려줘', '도움말'] };

  // 3단계: Supabase DB 검색
  const dbResult = await searchSupabaseForAnswer(trimmed);
  if (dbResult) return { text: dbResult, suggestions: ['전체 현황 알려줘', '도움말'] };

  // 4단계: 스마트 not-found
  return { text: buildSmartNotFound(trimmed, context), suggestions: ['도움말', '전체 현황 알려줘', '이번 주 작업'] };
}

export function createChatbotGreeting(context: ChatbotContext): string {
  return buildGreeting(context);
}

// ─── Legacy adapter (string-only reply) ──────────────────────
// 기존 호환을 위한 래퍼 — ChatbotWidget이 ChatbotReply로 전환 후 제거 가능

export async function createChatbotReplyLegacy(question: string, context: ChatbotContext): Promise<string> {
  const result = await createChatbotReply(question, context);
  return result.text;
}
