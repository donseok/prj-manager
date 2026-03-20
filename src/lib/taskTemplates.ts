import { addDays, format, parseISO } from 'date-fns';
import type { ProjectMember, Task } from '../types';
import { generateId } from './utils';

export interface TaskTemplateSummary {
  id: string;
  name: string;
  description: string;
  audience: string;
  phases: number;
  taskCount: number;
}

interface TemplateNode {
  name: string;
  output?: string;
  durationDays?: number;
  children?: TemplateNode[];
}

interface TaskTemplateDefinition extends TaskTemplateSummary {
  nodes: TemplateNode[];
}

const TASK_TEMPLATES: TaskTemplateDefinition[] = [
  {
    id: 'steel-project',
    name: '철강 프로젝트',
    description: '철강 설비·시스템 도입을 분석부터 안정화까지 5단계로 관리합니다.',
    audience: '냉연, 열연, 도금, 제선, 제강 등 철강 프로젝트',
    phases: 5,
    taskCount: 20,
    nodes: [
      {
        name: '분석',
        children: [
          {
            name: '현황 분석',
            children: [
              { name: '현행 공정·설비 현황 조사', output: 'AS-IS 분석 보고서', durationDays: 5 },
              { name: '개선 요구사항 도출', output: '요구사항 정의서', durationDays: 3 },
            ],
          },
          {
            name: '타당성 검토',
            children: [
              { name: '투자 타당성 분석', output: '투자 검토 보고서', durationDays: 3 },
              { name: '목표 사양 수립', output: '목표 사양서', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: '설계',
        children: [
          {
            name: '기본 설계',
            children: [
              { name: '공정 흐름도(PFD) 작성', output: 'PFD', durationDays: 5 },
              { name: '설비 사양 확정', output: '설비 사양서', durationDays: 4 },
              { name: '배치도(Layout) 작성', output: '배치도', durationDays: 3 },
            ],
          },
          {
            name: '상세 설계',
            children: [
              { name: '계장·전기 설계', output: '계장/전기 도면', durationDays: 5 },
              { name: '제어 로직 설계', output: '제어 사양서', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: '개발',
        children: [
          {
            name: '조달·제작',
            children: [
              { name: '기자재 발주·제작 감리', output: '제작 검사 성적서', durationDays: 10 },
              { name: '부대 자재 구매', output: '자재 입고 대장', durationDays: 5 },
            ],
          },
          {
            name: '시공·설치',
            children: [
              { name: '설비 반입·설치', output: '설치 완료 보고서', durationDays: 12 },
              { name: '전기·계장 시공', output: '결선 체크시트', durationDays: 8 },
              { name: 'PLC·HMI 프로그램 개발', output: '제어 프로그램', durationDays: 6 },
            ],
          },
        ],
      },
      {
        name: '테스트',
        children: [
          {
            name: '통합테스트',
            children: [
              { name: '단위 기능 테스트', output: '단위 테스트 성적서', durationDays: 5 },
              { name: '통합 연동 테스트', output: '통합 테스트 성적서', durationDays: 7 },
              { name: '부하·성능 테스트', output: '성능 테스트 보고서', durationDays: 5 },
            ],
          },
        ],
      },
      {
        name: '적용 및 안정화',
        children: [
          {
            name: '인수·안정화',
            children: [
              { name: '성능 보증 시험(PAT)', output: 'PAT 성적서', durationDays: 5 },
              { name: '운전 매뉴얼·교육', output: '운전 매뉴얼', durationDays: 3 },
              { name: '준공 검사·인수인계', output: '준공 보고서', durationDays: 2 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'web-launch',
    name: '웹사이트 구축',
    description: '기업 홈페이지, 랜딩 페이지, 쇼핑몰 등 웹사이트 오픈 프로젝트입니다.',
    audience: '마케팅 사이트, 리뉴얼 프로젝트',
    phases: 4,
    taskCount: 15,
    nodes: [
      {
        name: '기획·분석',
        children: [
          {
            name: '요구사항 분석',
            children: [
              { name: '이해관계자 인터뷰', output: '요구사항 정리', durationDays: 2 },
              { name: '범위 합의', output: '범위 기준선', durationDays: 2 },
            ],
          },
          {
            name: '정보 구조',
            children: [
              { name: 'IA·사이트맵 설계', output: '사이트맵', durationDays: 2 },
              { name: '콘텐츠 인벤토리', output: '콘텐츠 매트릭스', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: '디자인',
        children: [
          {
            name: 'UX/UI 설계',
            children: [
              { name: '와이어프레임 작성', output: '와이어프레임', durationDays: 3 },
              { name: '시각 디자인', output: '디자인 시스템', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: '개발',
        children: [
          {
            name: '구현',
            children: [
              { name: '프론트엔드 개발', output: '반응형 화면', durationDays: 6 },
              { name: 'CMS·API 연동', output: '통합 빌드', durationDays: 4 },
            ],
          },
          {
            name: '품질 관리',
            children: [
              { name: 'QA 및 버그 수정', output: 'QA 보고서', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: '오픈',
        children: [
          {
            name: '릴리스',
            children: [
              { name: '운영 환경 배포', output: '릴리스 노트', durationDays: 1 },
              { name: '안정화 모니터링', output: '안정화 로그', durationDays: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'mobile-app',
    name: '모바일 앱 개발',
    description: '기획부터 스토어 출시까지 모바일 앱 전체 라이프사이클을 관리합니다.',
    audience: 'iOS, Android, 크로스 플랫폼 앱 팀',
    phases: 5,
    taskCount: 17,
    nodes: [
      {
        name: '기획',
        children: [
          {
            name: '정의',
            children: [
              { name: '유저 스토리 매핑', output: '스토리 맵', durationDays: 3 },
              { name: '릴리스 범위 확정', output: 'MVP 범위', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: '디자인',
        children: [
          {
            name: '사용자 경험',
            children: [
              { name: 'UX 플로우 설계', output: '사용자 흐름도', durationDays: 3 },
              { name: '고해상도 UI 디자인', output: 'UI 화면', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: '개발',
        children: [
          {
            name: '클라이언트',
            children: [
              { name: '앱 기본 구조 셋업', output: '기본 앱', durationDays: 3 },
              { name: '핵심 기능 구현', output: '코어 기능', durationDays: 8 },
            ],
          },
          {
            name: '백엔드',
            children: [
              { name: 'API 연동', output: '연동 완료 엔드포인트', durationDays: 4 },
              { name: '푸시·인증 설정', output: '서비스 통합', durationDays: 3 },
            ],
          },
        ],
      },
      {
        name: '검증',
        children: [
          {
            name: '테스트',
            children: [
              { name: '기능 QA', output: 'QA 체크리스트', durationDays: 4 },
              { name: '스토어 심사 준비', output: '제출 패키지', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: '출시',
        children: [
          {
            name: '릴리스',
            children: [
              { name: '스토어 제출', output: '앱 게시 완료', durationDays: 2 },
              { name: '출시 후 모니터링', output: '모니터링 로그', durationDays: 3 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'internal-system',
    name: '내부 시스템 구축',
    description: '어드민 포털, ERP, 업무 시스템 등 내부 운영 시스템 도입 프로젝트입니다.',
    audience: '백오피스, 운영 시스템',
    phases: 5,
    taskCount: 18,
    nodes: [
      {
        name: '착수',
        children: [
          {
            name: '업무 분석',
            children: [
              { name: '현행 프로세스 분석', output: 'AS-IS 문서', durationDays: 3 },
              { name: '목표 워크플로우 설계', output: 'TO-BE 워크플로우', durationDays: 3 },
            ],
          },
        ],
      },
      {
        name: '설계',
        children: [
          {
            name: '상세 정의',
            children: [
              { name: '기능 명세 작성', output: '기능 명세서', durationDays: 4 },
              { name: '데이터 모델 검토', output: '엔티티 목록', durationDays: 2 },
            ],
          },
        ],
      },
      {
        name: '구현',
        children: [
          {
            name: '핵심 개발',
            children: [
              { name: '관리 화면 개발', output: 'CRUD 화면', durationDays: 6 },
              { name: '권한 모델 구현', output: '역할 매트릭스', durationDays: 3 },
              { name: '리포팅 기능', output: '대시보드·보고서', durationDays: 4 },
            ],
          },
        ],
      },
      {
        name: '데이터 이관',
        children: [
          {
            name: '이관 작업',
            children: [
              { name: '이관 리허설', output: '리허설 결과', durationDays: 2 },
              { name: '운영 데이터 이관', output: '이관 로그', durationDays: 1 },
            ],
          },
        ],
      },
      {
        name: '안정화',
        children: [
          {
            name: '정착 지원',
            children: [
              { name: '사용자 교육', output: '교육 자료', durationDays: 2 },
              { name: '안정화 지원', output: '지원 로그', durationDays: 4 },
            ],
          },
        ],
      },
    ],
  },
];

export function listTaskTemplates(): TaskTemplateSummary[] {
  return TASK_TEMPLATES.map(({ nodes: _nodes, ...summary }) => summary);
}

export function getTaskTemplate(templateId: string): TaskTemplateSummary | undefined {
  return listTaskTemplates().find((template) => template.id === templateId);
}

export function generateTasksFromTemplate(params: {
  templateId: string;
  projectId: string;
  projectStartDate?: string;
  members?: ProjectMember[];
}): Task[] {
  const template = TASK_TEMPLATES.find((item) => item.id === params.templateId);
  if (!template) {
    throw new Error(`Unknown task template: ${params.templateId}`);
  }

  const baseDate = params.projectStartDate ? parseISO(params.projectStartDate) : null;
  let nextStart = baseDate;
  const tasks: Task[] = [];
  const assignableMembers = (params.members ?? []).filter((m) => m.role !== 'viewer');
  let memberIdx = 0;

  const pickMember = (): string | null => {
    if (assignableMembers.length === 0) return null;
    const member = assignableMembers[memberIdx % assignableMembers.length];
    memberIdx++;
    return member.id;
  };

  const createNodes = (
    nodes: TemplateNode[],
    parentId: string | null,
    level: number
  ) => {
    nodes.forEach((node, index) => {
      const taskId = generateId();
      const isLeaf = !node.children || node.children.length === 0;
      const durationDays = Math.max(node.durationDays ?? 2, 1);
      const planStart = isLeaf && nextStart ? format(nextStart, 'yyyy-MM-dd') : null;
      const planEnd =
        isLeaf && nextStart ? format(addDays(nextStart, durationDays - 1), 'yyyy-MM-dd') : null;

      tasks.push({
        id: taskId,
        projectId: params.projectId,
        parentId,
        level,
        orderIndex: index,
        name: node.name,
        output: node.output,
        assigneeId: isLeaf ? pickMember() : null,
        weight: isLeaf ? Number((100 / template.taskCount).toFixed(3)) : 0,
        durationDays: isLeaf ? durationDays : null,
        predecessorIds: [],
        taskSource: 'template',
        planStart,
        planEnd,
        planProgress: 0,
        actualStart: null,
        actualEnd: null,
        actualProgress: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isExpanded: true,
      });

      if (node.children && node.children.length > 0) {
        createNodes(node.children, taskId, level + 1);
        return;
      }

      if (nextStart) {
        nextStart = addDays(nextStart, durationDays);
      }
    });
  };

  createNodes(template.nodes, null, 1);
  return tasks;
}
