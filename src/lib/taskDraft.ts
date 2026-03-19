import type { Task } from '../types';
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
  'web-launch': ['웹', '홈페이지', '사이트', '쇼핑몰', '리뉴얼', '랜딩', '브랜드'],
  'mobile-app': ['앱', 'ios', 'android', '모바일', '스토어', '앱출시'],
  'internal-system': ['erp', '백오피스', '내부', '어드민', '관리시스템', '업무시스템', '운영시스템'],
};

const DRAFT_RULES: DraftKeywordRule[] = [
  {
    keywords: ['디자인', 'ux', 'ui', '와이어', '시안'],
    templateBoosts: {
      'web-launch': 2,
      'mobile-app': 2,
    },
    additions: [
      {
        phase: 'Design',
        activity: 'UX/UI',
        name: 'Design review',
        output: 'Review notes',
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
        phase: 'Build',
        activity: 'Implementation',
        name: 'Frontend integration polish',
        output: 'UI refinement list',
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
        phase: 'Development',
        activity: 'Backend',
        name: 'Backend readiness review',
        output: 'API readiness checklist',
      },
      {
        phase: 'Build',
        activity: 'Implementation',
        name: 'Backend contract verification',
        output: 'API contract checklist',
      },
    ],
  },
  {
    keywords: ['qa', '테스트', '검수', '품질'],
    additions: [
      {
        phase: 'Build',
        activity: 'Quality',
        name: 'Acceptance testing',
        output: 'Acceptance checklist',
      },
      {
        phase: 'Validation',
        activity: 'Test',
        name: 'Regression test pass',
        output: 'Regression report',
      },
      {
        phase: 'Implementation',
        activity: 'Core build',
        name: 'Integrated QA support',
        output: 'Defect backlog',
      },
    ],
  },
  {
    keywords: ['배포', '오픈', '런칭', 'release', 'go-live'],
    additions: [
      {
        phase: 'Launch',
        activity: 'Release',
        name: 'Launch checklist review',
        output: 'Go-live checklist',
      },
      {
        phase: 'Release',
        activity: 'Go-live',
        name: 'Launch communication',
        output: 'Release communication',
      },
      {
        phase: 'Adoption',
        activity: 'Enablement',
        name: 'Post-launch support window',
        output: 'Support plan',
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
        phase: 'Migration',
        activity: 'Data cutover',
        name: 'Source data validation',
        output: 'Data validation report',
      },
    ],
  },
  {
    keywords: ['교육', '매뉴얼', '전파'],
    templateBoosts: {
      'internal-system': 2,
    },
    additions: [
      {
        phase: 'Adoption',
        activity: 'Enablement',
        name: 'User manual finalization',
        output: 'User manual',
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
  return ranked[0]?.[1] && ranked[0][1] > 0 ? ranked[0][0] : 'web-launch';
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
    durationDays: params.level >= 3 ? 2 : null,
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
}): TaskDraftResult {
  const normalizedPrompt = normalizePrompt(params.prompt);
  const templateId = scoreTemplates(normalizedPrompt);
  const template = getTaskTemplate(templateId);
  const baseTasks = generateTasksFromTemplate({
    templateId,
    projectId: params.projectId,
    projectStartDate: params.projectStartDate,
  });
  const matchedKeywords = appendDraftAdditions(baseTasks, params.projectId, normalizedPrompt);

  return {
    templateId,
    templateName: template?.name || templateId,
    reason:
      matchedKeywords.length > 0
        ? `키워드 ${matchedKeywords.join(', ')} 기준으로 가장 가까운 템플릿을 선택했습니다.`
        : '입력 문장이 짧아 기본 Website Launch 템플릿을 기준으로 초안을 생성했습니다.',
    matchedKeywords,
    tasks: baseTasks,
  };
}
