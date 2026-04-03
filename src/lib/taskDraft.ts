import type { ProjectMember, Task } from '../types';
import { generateId } from './utils';
import { generateTasksFromTemplate, getTaskTemplate } from './taskTemplates';

interface DraftKeywordRule {
  keywords: string[];
  templateBoosts?: Record<string, number>;
  additions?: Array<{
    phase: string;
    activity: string;
    name: string;
    output?: string;
  }>;
}

export interface TaskDraftResult {
  templateId: string;
  templateName: string;
  reason: string;
  matchedKeywords: string[];
  tasks: Task[];
}

const TEMPLATE_KEYWORDS: Record<string, string[]> = {
  'steel-project': ['철강', '냉연', '열연', '도금', '설비', '플랜트', '제철', '제선', '제강', '압연', '코일', '계량대', '소둔', '조질압연', '정정', '포장', '연주', '전로', '고로'],
  'web-launch': ['웹', '홈페이지', '사이트', '쇼핑몰', '리뉴얼', '랜딩', '브랜드'],
  'mobile-app': ['앱', 'ios', 'android', '모바일', '스토어', '앱출시'],
  'internal-system': ['erp', '백오피스', '내부', '어드민', '관리시스템', '업무시스템', '운영시스템', 'mes', 'scada'],
};

const DRAFT_RULES: DraftKeywordRule[] = [
  {
    keywords: ['시운전', '커미셔닝', '성능시험', '부하운전', '통합테스트'],
    templateBoosts: {
      'steel-project': 3,
    },
    additions: [
      {
        phase: '테스트',
        activity: '통합테스트',
        name: '현장 적용 검증',
        output: '현장 검증 보고서',
      },
    ],
  },
  {
    keywords: ['안전', '환경', '인허가', '허가'],
    templateBoosts: {
      'steel-project': 2,
    },
    additions: [
      {
        phase: '분석',
        activity: '타당성 검토',
        name: '환경·안전 인허가 확인',
        output: '인허가 체크리스트',
      },
    ],
  },
  {
    keywords: ['디자인', 'ux', 'ui', '와이어', '시안'],
    templateBoosts: {
      'web-launch': 2,
      'mobile-app': 2,
    },
    additions: [
      {
        phase: '디자인',
        activity: 'UX/UI 설계',
        name: '디자인 리뷰',
        output: '리뷰 노트',
      },
    ],
  },
  {
    keywords: ['프론트', 'frontend', 'react', '화면'],
    templateBoosts: {
      'web-launch': 2,
      'mobile-app': 1,
    },
    additions: [
      {
        phase: '개발',
        activity: '구현',
        name: '프론트엔드 통합 검증',
        output: 'UI 개선 목록',
      },
    ],
  },
  {
    keywords: ['백엔드', 'backend', 'api', '서버'],
    templateBoosts: {
      'internal-system': 2,
      'mobile-app': 2,
      'web-launch': 1,
    },
    additions: [
      {
        phase: '개발',
        activity: '백엔드',
        name: '백엔드 준비 상태 점검',
        output: 'API 준비 체크리스트',
      },
    ],
  },
  {
    keywords: ['qa', '테스트', '검수', '품질'],
    additions: [
      {
        phase: '개발',
        activity: '품질 관리',
        name: '인수 테스트',
        output: '인수 체크리스트',
      },
      {
        phase: '검증',
        activity: '테스트',
        name: '회귀 테스트',
        output: '회귀 테스트 보고서',
      },
    ],
  },
  {
    keywords: ['배포', '오픈', '런칭', '출시', '릴리스'],
    additions: [
      {
        phase: '오픈',
        activity: '릴리스',
        name: '오픈 체크리스트 점검',
        output: '오픈 체크리스트',
      },
      {
        phase: '출시',
        activity: '릴리스',
        name: '출시 커뮤니케이션',
        output: '출시 안내문',
      },
    ],
  },
  {
    keywords: ['데이터', '마이그레이션', '이관'],
    templateBoosts: {
      'internal-system': 3,
    },
    additions: [
      {
        phase: '데이터 이관',
        activity: '이관 작업',
        name: '원천 데이터 검증',
        output: '데이터 검증 보고서',
      },
    ],
  },
  {
    keywords: ['교육', '매뉴얼', '전파'],
    templateBoosts: {
      'internal-system': 2,
      'steel-project': 1,
    },
    additions: [
      {
        phase: '안정화',
        activity: '정착 지원',
        name: '사용자 매뉴얼 완성',
        output: '사용자 매뉴얼',
      },
    ],
  },
];

function normalizePrompt(prompt: string) {
  return prompt.toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreTemplates(prompt: string) {
  const normalized = normalizePrompt(prompt);
  const scores = new Map<string, number>();

  Object.entries(TEMPLATE_KEYWORDS).forEach(([templateId, keywords]) => {
    const score = keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 2 : 0), 0);
    scores.set(templateId, score);
  });

  DRAFT_RULES.forEach((rule) => {
    const matched = rule.keywords.some((keyword) => normalized.includes(keyword));
    if (!matched || !rule.templateBoosts) return;

    Object.entries(rule.templateBoosts).forEach(([templateId, boost]) => {
      scores.set(templateId, (scores.get(templateId) ?? 0) + boost);
    });
  });

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  return ranked[0]?.[1] && ranked[0][1] > 0 ? ranked[0][0] : 'steel-project';
}

function findTaskByName(tasks: Task[], name: string, level?: number, parentId?: string | null) {
  return tasks.find(
    (task) =>
      task.name.toLowerCase() === name.toLowerCase() &&
      (level === undefined || task.level === level) &&
      (parentId === undefined || (task.parentId ?? null) === parentId)
  );
}

function createStructuralTask(params: {
  projectId: string;
  parentId: string | null;
  level: number;
  orderIndex: number;
  name: string;
  output?: string;
  taskSource?: Task['taskSource'];
}): Task {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    projectId: params.projectId,
    parentId: params.parentId,
    level: params.level,
    orderIndex: params.orderIndex,
    name: params.name,
    output: params.output,
    weight: 0,
    durationDays: params.level >= 4 ? 2 : null,
    predecessorIds: [],
    taskSource: params.taskSource ?? 'quick_draft',
    planStart: null,
    planEnd: null,
    planProgress: 0,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    isExpanded: true,
  };
}

function ensureNode(tasks: Task[], params: { projectId: string; parentId: string | null; level: number; name: string }) {
  const existing = findTaskByName(tasks, params.name, params.level, params.parentId);
  if (existing) return existing;

  const siblingCount = tasks.filter((task) => (task.parentId ?? null) === params.parentId).length;
  const created = createStructuralTask({
    projectId: params.projectId,
    parentId: params.parentId,
    level: params.level,
    orderIndex: siblingCount,
    name: params.name,
    taskSource: 'quick_draft',
  });
  tasks.push(created);
  return created;
}

function appendDraftAdditions(tasks: Task[], projectId: string, normalizedPrompt: string) {
  const matchedKeywords = new Set<string>();

  DRAFT_RULES.forEach((rule) => {
    const hasMatch = rule.keywords.some((keyword) => normalizedPrompt.includes(keyword));
    if (!hasMatch || !rule.additions) return;

    rule.keywords.forEach((keyword) => {
      if (normalizedPrompt.includes(keyword)) {
        matchedKeywords.add(keyword);
      }
    });

    rule.additions.forEach((addition) => {
      const phase = ensureNode(tasks, {
        projectId,
        parentId: null,
        level: 1,
        name: addition.phase,
      });
      const activity = ensureNode(tasks, {
        projectId,
        parentId: phase.id,
        level: 2,
        name: addition.activity,
      });

      const exists = findTaskByName(tasks, addition.name, 3, activity.id);
      if (exists) return;

      const siblingCount = tasks.filter((task) => (task.parentId ?? null) === activity.id).length;
      tasks.push(
        createStructuralTask({
          projectId,
          parentId: activity.id,
          level: 3,
          orderIndex: siblingCount,
          name: addition.name,
          output: addition.output,
          taskSource: 'quick_draft',
        })
      );
    });
  });

  return [...matchedKeywords];
}

export function generateTasksFromPrompt(params: {
  prompt: string;
  projectId: string;
  projectStartDate?: string;
  members?: ProjectMember[];
}): TaskDraftResult {
  const normalizedPrompt = normalizePrompt(params.prompt);
  const templateId = scoreTemplates(normalizedPrompt);
  const template = getTaskTemplate(templateId);
  const baseTasks = generateTasksFromTemplate({
    templateId,
    projectId: params.projectId,
    projectStartDate: params.projectStartDate,
    members: params.members,
  });
  const matchedKeywords = appendDraftAdditions(baseTasks, params.projectId, normalizedPrompt);

  return {
    templateId,
    templateName: template?.name || templateId,
    reason:
      matchedKeywords.length > 0
        ? `키워드 ${matchedKeywords.join(', ')} 기준으로 가장 가까운 템플릿을 선택했습니다.`
        : '입력 문장이 짧아 기본 철강 프로젝트 템플릿을 기준으로 초안을 생성했습니다.',
    matchedKeywords,
    tasks: baseTasks,
  };
}
