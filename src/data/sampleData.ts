import type { Project, ProjectMember, Task } from '../types';

interface MemberSeed {
  key: string;
  name: string;
  role: ProjectMember['role'];
  userId: string;
}

interface TaskSeed {
  id: string;
  name: string;
  description: string;
  level: number;
  parentId: string | null;
  orderIndex: number;
  assigneeKey?: string;
  weight: number;
  planStart?: string | null;
  planEnd?: string | null;
  planProgress: number;
  actualStart?: string | null;
  actualEnd?: string | null;
  actualProgress: number;
  status: Task['status'];
  output?: string;
}

const DEFAULT_CREATED_AT = '2026-03-19T09:00:00Z';

function buildMembers(projectId: string, prefix: string, seeds: MemberSeed[]) {
  const members = seeds.map((seed, index) => ({
    id: `${prefix}-member-${String(index + 1).padStart(2, '0')}`,
    projectId,
    userId: seed.userId,
    name: seed.name,
    role: seed.role,
    createdAt: DEFAULT_CREATED_AT,
  }));

  const memberIds = seeds.reduce<Record<string, string>>((acc, seed, index) => {
    acc[seed.key] = `${prefix}-member-${String(index + 1).padStart(2, '0')}`;
    return acc;
  }, {});

  return { members, memberIds };
}

function buildTasks(projectId: string, prefix: string, memberIds: Record<string, string>, seeds: TaskSeed[]) {
  return seeds.map((seed) => ({
    id: `${prefix}-${seed.id}`,
    projectId,
    parentId: seed.parentId ? `${prefix}-${seed.parentId}` : null,
    level: seed.level,
    orderIndex: seed.orderIndex,
    name: seed.name,
    description: seed.description,
    output: seed.output,
    assigneeId: seed.assigneeKey ? memberIds[seed.assigneeKey] : null,
    weight: seed.weight,
    planStart: seed.planStart ?? null,
    planEnd: seed.planEnd ?? null,
    planProgress: seed.planProgress,
    actualStart: seed.actualStart ?? null,
    actualEnd: seed.actualEnd ?? null,
    actualProgress: seed.actualProgress,
    status: seed.status,
    isExpanded: true,
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_CREATED_AT,
  }));
}

// ============================================================
// 프로젝트 1: 스마트 계량 프로젝트 (진행중 — 다양한 상태)
// ============================================================
const smartMeteringProject: Project = {
  id: 'proj-smart-001',
  ownerId: 'user-smart-pm-01',
  name: '스마트 계량 프로젝트',
  description: '기간 2026.01~2026.08 / PM 1명 / 개발자 4명 — 현장 계량 자동화 및 모니터링 시스템 구축',
  startDate: '2026-01-05',
  endDate: '2026-08-31',
  baseDate: '2026-03-19',
  status: 'active',
  createdAt: DEFAULT_CREATED_AT,
  updatedAt: DEFAULT_CREATED_AT,
};

const smartMeteringMemberSeeds: MemberSeed[] = [
  { key: 'pm', name: 'PM 한지훈', role: 'owner', userId: 'user-smart-pm-01' },
  { key: 'dev1', name: '개발 이도현', role: 'member', userId: 'user-smart-dev-01' },
  { key: 'dev2', name: '개발 김민서', role: 'member', userId: 'user-smart-dev-02' },
  { key: 'dev3', name: '개발 박준호', role: 'member', userId: 'user-smart-dev-03' },
  { key: 'dev4', name: '개발 윤가은', role: 'member', userId: 'user-smart-dev-04' },
];

const { members: smartMeteringMembers, memberIds: smartMeteringMemberIds } = buildMembers(
  smartMeteringProject.id,
  'sm',
  smartMeteringMemberSeeds
);

const smartMeteringTasks = buildTasks(smartMeteringProject.id, 'sm-task', smartMeteringMemberIds, [
  // Phase 1: 착수 및 분석 — 완료
  { id: '1', name: '착수 및 분석', description: '프로젝트 킥오프와 요구사항 정리', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm', weight: 20, planStart: '2026-01-05', planEnd: '2026-02-10', planProgress: 100, actualStart: '2026-01-05', actualEnd: '2026-02-08', actualProgress: 100, status: 'completed', output: '착수보고서' },
  { id: '1-1', name: '킥오프 및 역할정의', description: 'PM과 개발자 역할 및 일정 정렬', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'pm', weight: 8, planStart: '2026-01-05', planEnd: '2026-01-12', planProgress: 100, actualStart: '2026-01-05', actualEnd: '2026-01-10', actualProgress: 100, status: 'completed', output: '킥오프 회의록' },
  { id: '1-1-1', name: '프로젝트 헌장 작성', description: '목표, 범위, 일정 요약 문서화', level: 3, parentId: '1-1', orderIndex: 1, assigneeKey: 'pm', weight: 4, planStart: '2026-01-05', planEnd: '2026-01-08', planProgress: 100, actualStart: '2026-01-05', actualEnd: '2026-01-07', actualProgress: 100, status: 'completed', output: '프로젝트 헌장' },
  { id: '1-1-2', name: '역할 및 책임 매트릭스(RACI)', description: 'R/A/C/I 정의', level: 3, parentId: '1-1', orderIndex: 2, assigneeKey: 'pm', weight: 4, planStart: '2026-01-09', planEnd: '2026-01-12', planProgress: 100, actualStart: '2026-01-08', actualEnd: '2026-01-10', actualProgress: 100, status: 'completed', output: 'RACI 매트릭스' },
  { id: '1-2', name: '계량 요구사항 정의', description: '현장 계량 시나리오 및 인터페이스 요구사항 수집', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'dev1', weight: 12, planStart: '2026-01-13', planEnd: '2026-02-10', planProgress: 100, actualStart: '2026-01-13', actualEnd: '2026-02-08', actualProgress: 100, status: 'completed', output: '요구사항 정의서' },
  { id: '1-2-1', name: '현장 인터뷰', description: '계량 현장 담당자 인터뷰 5회', level: 3, parentId: '1-2', orderIndex: 1, assigneeKey: 'dev1', weight: 6, planStart: '2026-01-13', planEnd: '2026-01-24', planProgress: 100, actualStart: '2026-01-13', actualEnd: '2026-01-23', actualProgress: 100, status: 'completed', output: '인터뷰 결과 보고서' },
  { id: '1-2-2', name: '요구사항 문서화', description: '기능/비기능 요구사항 정리', level: 3, parentId: '1-2', orderIndex: 2, assigneeKey: 'dev1', weight: 6, planStart: '2026-01-27', planEnd: '2026-02-10', planProgress: 100, actualStart: '2026-01-24', actualEnd: '2026-02-08', actualProgress: 100, status: 'completed', output: '요구사항 명세서 v1.0' },

  // Phase 2: 핵심 기능 개발 — 진행중 (일부 완료, 일부 진행, 일부 지연)
  { id: '2', name: '핵심 기능 개발', description: '계량 서버, API, 화면 개발', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'dev2', weight: 45, planStart: '2026-02-11', planEnd: '2026-06-15', planProgress: 60, actualStart: '2026-02-11', actualProgress: 42, status: 'in_progress' },
  { id: '2-1', name: '계량 서버 개발', description: '계량 이벤트 처리와 로그 적재 개발', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'dev1', weight: 15, planStart: '2026-02-11', planEnd: '2026-03-31', planProgress: 100, actualStart: '2026-02-11', actualEnd: '2026-04-05', actualProgress: 100, status: 'completed', output: '계량 서버 모듈' },
  { id: '2-1-1', name: '이벤트 핸들러 구현', description: '계량 이벤트 수신/처리 로직', level: 3, parentId: '2-1', orderIndex: 1, assigneeKey: 'dev1', weight: 5, planStart: '2026-02-11', planEnd: '2026-02-28', planProgress: 100, actualStart: '2026-02-11', actualEnd: '2026-03-02', actualProgress: 100, status: 'completed', output: '이벤트 핸들러' },
  { id: '2-1-2', name: '로그 적재 모듈', description: '계량 데이터 저장 및 인덱싱', level: 3, parentId: '2-1', orderIndex: 2, assigneeKey: 'dev1', weight: 5, planStart: '2026-03-01', planEnd: '2026-03-15', planProgress: 100, actualStart: '2026-03-03', actualEnd: '2026-03-18', actualProgress: 100, status: 'completed', output: '로그 적재 API' },
  { id: '2-1-3', name: '서버 부하 테스트', description: '동시 접속 1000건 처리 검증', level: 3, parentId: '2-1', orderIndex: 3, assigneeKey: 'dev4', weight: 5, planStart: '2026-03-16', planEnd: '2026-03-31', planProgress: 100, actualStart: '2026-03-19', actualEnd: '2026-04-05', actualProgress: 100, status: 'completed', output: '부하 테스트 보고서' },
  { id: '2-2', name: '수집 API 개발', description: '현장 장비 연동용 API 및 검증 로직 개발', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'dev2', weight: 10, planStart: '2026-03-01', planEnd: '2026-04-15', planProgress: 80, actualStart: '2026-03-05', actualProgress: 65, status: 'in_progress', output: 'REST API 명세서' },
  { id: '2-2-1', name: 'API 설계 및 스웨거 문서', description: 'OpenAPI 스펙 정의', level: 3, parentId: '2-2', orderIndex: 1, assigneeKey: 'dev2', weight: 3, planStart: '2026-03-01', planEnd: '2026-03-10', planProgress: 100, actualStart: '2026-03-05', actualEnd: '2026-03-12', actualProgress: 100, status: 'completed', output: 'Swagger 문서' },
  { id: '2-2-2', name: 'CRUD 엔드포인트 구현', description: '계량 데이터 CRUD API 개발', level: 3, parentId: '2-2', orderIndex: 2, assigneeKey: 'dev2', weight: 4, planStart: '2026-03-11', planEnd: '2026-03-28', planProgress: 80, actualStart: '2026-03-13', actualProgress: 60, status: 'in_progress' },
  { id: '2-2-3', name: '장비 연동 어댑터', description: '현장 장비별 프로토콜 어댑터 구현', level: 3, parentId: '2-2', orderIndex: 3, assigneeKey: 'dev2', weight: 3, planStart: '2026-03-29', planEnd: '2026-04-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-3', name: '모니터링 UI 개발', description: '실시간 계량 현황 대시보드 구현', level: 2, parentId: '2', orderIndex: 3, assigneeKey: 'dev3', weight: 10, planStart: '2026-03-15', planEnd: '2026-05-15', planProgress: 50, actualStart: '2026-03-18', actualProgress: 30, status: 'in_progress' },
  { id: '2-3-1', name: '대시보드 레이아웃', description: 'React 기반 대시보드 골격 구현', level: 3, parentId: '2-3', orderIndex: 1, assigneeKey: 'dev3', weight: 3, planStart: '2026-03-15', planEnd: '2026-03-28', planProgress: 100, actualStart: '2026-03-18', actualEnd: '2026-04-01', actualProgress: 100, status: 'completed', output: '대시보드 프로토타입' },
  { id: '2-3-2', name: '실시간 차트 컴포넌트', description: 'WebSocket 기반 실시간 데이터 시각화', level: 3, parentId: '2-3', orderIndex: 2, assigneeKey: 'dev3', weight: 4, planStart: '2026-03-29', planEnd: '2026-04-20', planProgress: 60, actualStart: '2026-04-02', actualProgress: 35, status: 'in_progress' },
  { id: '2-3-3', name: '알림/경고 화면', description: '임계치 초과 시 알림 UI', level: 3, parentId: '2-3', orderIndex: 3, assigneeKey: 'dev3', weight: 3, planStart: '2026-04-21', planEnd: '2026-05-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-4', name: '인프라 및 배포 구성', description: '개발/검증 환경과 배포 자동화 구성', level: 2, parentId: '2', orderIndex: 4, assigneeKey: 'dev4', weight: 10, planStart: '2026-04-01', planEnd: '2026-05-31', planProgress: 30, actualStart: '2026-04-01', actualProgress: 10, status: 'on_hold' },
  { id: '2-4-1', name: 'Docker 환경 구성', description: '컨테이너 기반 개발 환경 구축', level: 3, parentId: '2-4', orderIndex: 1, assigneeKey: 'dev4', weight: 4, planStart: '2026-04-01', planEnd: '2026-04-15', planProgress: 100, actualStart: '2026-04-01', actualEnd: '2026-04-12', actualProgress: 100, status: 'completed', output: 'Docker Compose 설정' },
  { id: '2-4-2', name: 'CI/CD 파이프라인', description: 'Jenkins/GitLab CI 자동화 구성', level: 3, parentId: '2-4', orderIndex: 2, assigneeKey: 'dev4', weight: 3, planStart: '2026-04-16', planEnd: '2026-05-05', planProgress: 0, actualProgress: 0, status: 'on_hold' },
  { id: '2-4-3', name: '스테이징 서버 구축', description: '검증용 서버 환경 프로비저닝', level: 3, parentId: '2-4', orderIndex: 3, assigneeKey: 'dev4', weight: 3, planStart: '2026-05-06', planEnd: '2026-05-31', planProgress: 0, actualProgress: 0, status: 'pending' },

  // Phase 3: 통합 테스트 — 아직 미착수
  { id: '3', name: '통합 테스트', description: '기능 통합 점검과 현장 검증', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'pm', weight: 20, planStart: '2026-06-16', planEnd: '2026-07-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-1', name: '통합 시나리오 테스트', description: '주요 계량 시나리오 검증', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'dev3', weight: 10, planStart: '2026-06-16', planEnd: '2026-07-10', planProgress: 0, actualProgress: 0, status: 'pending', output: '통합 테스트 결과서' },
  { id: '3-1-1', name: '테스트 시나리오 작성', description: '정상/예외 케이스 시나리오 정의', level: 3, parentId: '3-1', orderIndex: 1, assigneeKey: 'dev3', weight: 4, planStart: '2026-06-16', planEnd: '2026-06-25', planProgress: 0, actualProgress: 0, status: 'pending', output: '테스트 케이스 문서' },
  { id: '3-1-2', name: '시나리오별 테스트 수행', description: '작성된 시나리오 기반 통합 테스트', level: 3, parentId: '3-1', orderIndex: 2, assigneeKey: 'dev1', weight: 6, planStart: '2026-06-26', planEnd: '2026-07-10', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-2', name: '현장 시운전', description: '실계량 데이터를 이용한 현장 시운전', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'dev4', weight: 10, planStart: '2026-07-11', planEnd: '2026-07-31', planProgress: 0, actualProgress: 0, status: 'pending', output: '시운전 보고서' },

  // Phase 4: 오픈 안정화 — 미착수
  { id: '4', name: '오픈 안정화', description: '교육과 운영 전환 지원', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'pm', weight: 15, planStart: '2026-08-01', planEnd: '2026-08-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '사용자 교육', description: '현업 사용자 교육과 매뉴얼 배포', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'pm', weight: 7, planStart: '2026-08-01', planEnd: '2026-08-15', planProgress: 0, actualProgress: 0, status: 'pending', output: '교육 자료' },
  { id: '4-2', name: '운영 전환 지원', description: '운영 이관과 초기 장애 대응', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'dev2', weight: 8, planStart: '2026-08-16', planEnd: '2026-08-31', planProgress: 0, actualProgress: 0, status: 'pending', output: '운영 이관 문서' },
]);

// ============================================================
// 프로젝트 2: 동국씨엠 PI (진행중 — 절반 진행)
// ============================================================
const dkCmPiProject: Project = {
  id: 'proj-dkcm-pi-001',
  ownerId: 'user-pi-pm-01',
  name: '동국씨엠 PI',
  description: '기간 2025.10~2026.06 / PM 1명 / 설계자 8명 — 업무 프로세스 혁신 컨설팅',
  startDate: '2025-10-01',
  endDate: '2026-06-30',
  baseDate: '2026-03-19',
  status: 'active',
  createdAt: DEFAULT_CREATED_AT,
  updatedAt: DEFAULT_CREATED_AT,
};

const dkCmPiMemberSeeds: MemberSeed[] = [
  { key: 'pm', name: 'PM 이수현', role: 'owner', userId: 'user-pi-pm-01' },
  { key: 'designer1', name: '설계 김도윤', role: 'admin', userId: 'user-pi-des-01' },
  { key: 'designer2', name: '설계 박채린', role: 'member', userId: 'user-pi-des-02' },
  { key: 'designer3', name: '설계 최민재', role: 'member', userId: 'user-pi-des-03' },
  { key: 'designer4', name: '설계 정하늘', role: 'member', userId: 'user-pi-des-04' },
  { key: 'designer5', name: '설계 오세진', role: 'member', userId: 'user-pi-des-05' },
  { key: 'designer6', name: '설계 문서윤', role: 'member', userId: 'user-pi-des-06' },
  { key: 'designer7', name: '설계 임재윤', role: 'member', userId: 'user-pi-des-07' },
  { key: 'designer8', name: '설계 강유진', role: 'member', userId: 'user-pi-des-08' },
];

const { members: dkCmPiMembers, memberIds: dkCmPiMemberIds } = buildMembers(
  dkCmPiProject.id,
  'pi',
  dkCmPiMemberSeeds
);

const dkCmPiTasks = buildTasks(dkCmPiProject.id, 'pi-task', dkCmPiMemberIds, [
  // Phase 1: 완료
  { id: '1', name: '착수 및 현행분석', description: 'PI 범위 확정과 As-Is 분석', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm', weight: 20, planStart: '2025-10-01', planEnd: '2025-12-15', planProgress: 100, actualStart: '2025-10-01', actualEnd: '2025-12-12', actualProgress: 100, status: 'completed', output: 'As-Is 분석서' },
  { id: '1-1', name: '업무 프로세스 인터뷰', description: '현업 인터뷰와 Pain Point 정리', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'designer1', weight: 10, planStart: '2025-10-01', planEnd: '2025-11-10', planProgress: 100, actualStart: '2025-10-01', actualEnd: '2025-11-08', actualProgress: 100, status: 'completed', output: '인터뷰 결과서' },
  { id: '1-2', name: 'As-Is 프로세스 정리', description: '부문별 프로세스 맵과 이슈 정리', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'designer2', weight: 10, planStart: '2025-11-11', planEnd: '2025-12-15', planProgress: 100, actualStart: '2025-11-09', actualEnd: '2025-12-12', actualProgress: 100, status: 'completed', output: '프로세스 맵' },

  // Phase 2: 진행중 (일부 완료, 일부 지연)
  { id: '2', name: 'To-Be 설계', description: '목표 프로세스와 개선 방향 설계', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'designer3', weight: 35, planStart: '2025-12-16', planEnd: '2026-03-15', planProgress: 80, actualStart: '2025-12-16', actualProgress: 70, status: 'in_progress' },
  { id: '2-1', name: '핵심 프로세스 To-Be 설계', description: '판매/생산/구매 영역 목표 프로세스 정의', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'designer3', weight: 15, planStart: '2025-12-16', planEnd: '2026-01-31', planProgress: 100, actualStart: '2025-12-16', actualEnd: '2026-02-05', actualProgress: 100, status: 'completed', output: 'To-Be 프로세스 정의서' },
  { id: '2-2', name: '과제 우선순위 수립', description: '개선과제와 기대효과 우선순위화', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'designer4', weight: 10, planStart: '2026-02-01', planEnd: '2026-02-28', planProgress: 100, actualStart: '2026-02-06', actualEnd: '2026-03-10', actualProgress: 100, status: 'completed', output: '과제 우선순위 매트릭스' },
  { id: '2-3', name: '조직/제도 개선안', description: '업무체계와 운영 제도 개선 방향 정의', level: 2, parentId: '2', orderIndex: 3, assigneeKey: 'designer5', weight: 10, planStart: '2026-03-01', planEnd: '2026-03-15', planProgress: 60, actualStart: '2026-03-11', actualProgress: 30, status: 'in_progress', output: '제도 개선안(초안)' },

  // Phase 3: 진행중
  { id: '3', name: '상세 설계 및 실행계획', description: '시스템 요건과 실행 로드맵 작성', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'pm', weight: 25, planStart: '2026-03-16', planEnd: '2026-05-15', planProgress: 10, actualStart: '2026-03-16', actualProgress: 5, status: 'in_progress' },
  { id: '3-1', name: '시스템 개선요건 정의', description: '업무 시스템 개선 요건 문서화', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'designer6', weight: 12, planStart: '2026-03-16', planEnd: '2026-04-15', planProgress: 15, actualStart: '2026-03-16', actualProgress: 10, status: 'in_progress' },
  { id: '3-2', name: 'PI 이행 로드맵 수립', description: '단계별 실행계획 및 일정 수립', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'designer7', weight: 13, planStart: '2026-04-16', planEnd: '2026-05-15', planProgress: 0, actualProgress: 0, status: 'pending', output: '이행 로드맵' },

  // Phase 4: 미착수
  { id: '4', name: '최종 보고 및 변화관리', description: '최종안 보고와 변화관리 계획 수립', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'pm', weight: 20, planStart: '2026-05-16', planEnd: '2026-06-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '경영진 보고서 작성', description: 'PI 최종 결과와 투자 우선순위 보고', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'designer8', weight: 10, planStart: '2026-05-16', planEnd: '2026-06-10', planProgress: 0, actualProgress: 0, status: 'pending', output: '경영진 보고서' },
  { id: '4-2', name: '변화관리 계획 수립', description: '현업 안착을 위한 커뮤니케이션 계획 수립', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'designer1', weight: 10, planStart: '2026-06-11', planEnd: '2026-06-30', planProgress: 0, actualProgress: 0, status: 'pending', output: '변화관리 계획서' },
]);

// ============================================================
// 프로젝트 3: KG스틸 MES 재구축 (준비중)
// ============================================================
const kgSteelMesProject: Project = {
  id: 'proj-kgsteel-mes-001',
  ownerId: 'user-kg-pm-01',
  name: 'KG스틸 MES 재구축',
  description: '기간 2026.07~2027.06 / PM 3명 / 개발자 5명 — 제강/압연 MES 전면 재구축',
  startDate: '2026-07-01',
  endDate: '2027-06-30',
  status: 'preparing',
  createdAt: DEFAULT_CREATED_AT,
  updatedAt: DEFAULT_CREATED_AT,
};

const kgSteelMesMemberSeeds: MemberSeed[] = [
  { key: 'pm1', name: 'PM 김지훈', role: 'owner', userId: 'user-kg-pm-01' },
  { key: 'pm2', name: 'PM 박도윤', role: 'admin', userId: 'user-kg-pm-02' },
  { key: 'pm3', name: 'PM 윤서진', role: 'admin', userId: 'user-kg-pm-03' },
  { key: 'dev1', name: '개발 최현석', role: 'member', userId: 'user-kg-dev-01' },
  { key: 'dev2', name: '개발 배지민', role: 'member', userId: 'user-kg-dev-02' },
  { key: 'dev3', name: '개발 오준서', role: 'member', userId: 'user-kg-dev-03' },
  { key: 'dev4', name: '개발 이채은', role: 'member', userId: 'user-kg-dev-04' },
  { key: 'dev5', name: '개발 정민호', role: 'member', userId: 'user-kg-dev-05' },
];

const { members: kgSteelMesMembers, memberIds: kgSteelMesMemberIds } = buildMembers(
  kgSteelMesProject.id,
  'kg',
  kgSteelMesMemberSeeds
);

const kgSteelMesTasks = buildTasks(kgSteelMesProject.id, 'kg-task', kgSteelMesMemberIds, [
  { id: '1', name: '사업전략 수립', description: 'MES 재구축 목표와 추진 범위 정의', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm1', weight: 15, planStart: '2026-07-01', planEnd: '2026-08-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-1', name: '구축 범위 정의', description: '라인/공정별 포함 범위와 우선순위 확정', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'pm2', weight: 8, planStart: '2026-07-01', planEnd: '2026-07-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-2', name: '추진 조직 구성', description: '의사결정 체계와 운영 조직 정의', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'pm3', weight: 7, planStart: '2026-08-01', planEnd: '2026-08-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2', name: '현행 분석', description: '현행 시스템 분석 및 개선 요건 도출', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'dev1', weight: 20, planStart: '2026-09-01', planEnd: '2026-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-1', name: '인터뷰 및 현장 조사', description: '현업 인터뷰 대상과 질문지 준비', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'dev2', weight: 10, planStart: '2026-09-01', planEnd: '2026-10-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-2', name: '마스터 데이터 정리', description: '품목/설비/공정 기준정보 현황 수집', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'dev3', weight: 10, planStart: '2026-10-16', planEnd: '2026-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3', name: '설계 및 개발', description: '목표 시스템 설계와 핵심 모듈 개발', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'pm1', weight: 40, planStart: '2026-12-01', planEnd: '2027-04-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-1', name: '아키텍처 설계', description: '시스템 구조 및 DB 설계', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'dev1', weight: 10, planStart: '2026-12-01', planEnd: '2027-01-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-2', name: '제강 공정 모듈', description: '제강 MES 핵심 기능 개발', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'dev4', weight: 15, planStart: '2027-01-16', planEnd: '2027-03-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-3', name: '압연 공정 모듈', description: '압연 MES 핵심 기능 개발', level: 2, parentId: '3', orderIndex: 3, assigneeKey: 'dev5', weight: 15, planStart: '2027-02-01', planEnd: '2027-04-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4', name: '테스트 및 오픈', description: '통합 테스트와 Go-Live', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'pm1', weight: 25, planStart: '2027-05-01', planEnd: '2027-06-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '통합 테스트', description: 'End-to-End 시나리오 검증', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'dev2', weight: 12, planStart: '2027-05-01', planEnd: '2027-05-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-2', name: 'Go-Live 및 안정화', description: '오픈 후 2주 안정화 지원', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'dev3', weight: 13, planStart: '2027-06-01', planEnd: '2027-06-30', planProgress: 0, actualProgress: 0, status: 'pending' },
]);

// ============================================================
// 프로젝트 4: 동국씨엠 ERP/MES 재구축 (준비중)
// ============================================================
const dkCmErpProject: Project = {
  id: 'proj-dkcm-erp-001',
  ownerId: 'user-dk-erp-pm-01',
  name: '동국씨엠 ERP/MES 재구축',
  description: '기간 2026.11~2027.11 / ERP PM 1명 / MES PM 1명 / PL 각 1명 / 개발자 20명',
  startDate: '2026-11-01',
  endDate: '2027-11-30',
  status: 'preparing',
  createdAt: DEFAULT_CREATED_AT,
  updatedAt: DEFAULT_CREATED_AT,
};

const dkCmErpMemberSeeds: MemberSeed[] = [
  { key: 'erpPm', name: 'ERP PM 김도윤', role: 'owner', userId: 'user-dk-erp-pm-01' },
  { key: 'mesPm', name: 'MES PM 박세린', role: 'admin', userId: 'user-dk-mes-pm-01' },
  { key: 'erpPl', name: 'ERP PL 이정민', role: 'admin', userId: 'user-dk-erp-pl-01' },
  { key: 'mesPl', name: 'MES PL 윤하준', role: 'admin', userId: 'user-dk-mes-pl-01' },
  { key: 'dev01', name: '개발01 강민우', role: 'member', userId: 'user-dk-dev-01' },
  { key: 'dev02', name: '개발02 김서준', role: 'member', userId: 'user-dk-dev-02' },
  { key: 'dev03', name: '개발03 김지안', role: 'member', userId: 'user-dk-dev-03' },
  { key: 'dev04', name: '개발04 남도현', role: 'member', userId: 'user-dk-dev-04' },
  { key: 'dev05', name: '개발05 박하율', role: 'member', userId: 'user-dk-dev-05' },
  { key: 'dev06', name: '개발06 배윤서', role: 'member', userId: 'user-dk-dev-06' },
  { key: 'dev07', name: '개발07 서민재', role: 'member', userId: 'user-dk-dev-07' },
  { key: 'dev08', name: '개발08 송지후', role: 'member', userId: 'user-dk-dev-08' },
  { key: 'dev09', name: '개발09 신가은', role: 'member', userId: 'user-dk-dev-09' },
  { key: 'dev10', name: '개발10 안지훈', role: 'member', userId: 'user-dk-dev-10' },
  { key: 'dev11', name: '개발11 오서윤', role: 'member', userId: 'user-dk-dev-11' },
  { key: 'dev12', name: '개발12 유민호', role: 'member', userId: 'user-dk-dev-12' },
  { key: 'dev13', name: '개발13 윤도경', role: 'member', userId: 'user-dk-dev-13' },
  { key: 'dev14', name: '개발14 이가은', role: 'member', userId: 'user-dk-dev-14' },
  { key: 'dev15', name: '개발15 이수빈', role: 'member', userId: 'user-dk-dev-15' },
  { key: 'dev16', name: '개발16 임하준', role: 'member', userId: 'user-dk-dev-16' },
  { key: 'dev17', name: '개발17 장민성', role: 'member', userId: 'user-dk-dev-17' },
  { key: 'dev18', name: '개발18 전유진', role: 'member', userId: 'user-dk-dev-18' },
  { key: 'dev19', name: '개발19 조예린', role: 'member', userId: 'user-dk-dev-19' },
  { key: 'dev20', name: '개발20 최현준', role: 'member', userId: 'user-dk-dev-20' },
];

const { members: dkCmErpMembers, memberIds: dkCmErpMemberIds } = buildMembers(
  dkCmErpProject.id,
  'erp',
  dkCmErpMemberSeeds
);

const dkCmErpTasks = buildTasks(dkCmErpProject.id, 'erp-task', dkCmErpMemberIds, [
  { id: '1', name: 'ISP 및 청사진 수립', description: 'ERP/MES 재구축 방향과 목표 모델 정의', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'erpPm', weight: 15, planStart: '2026-11-01', planEnd: '2027-01-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-1', name: '전사 범위 확정', description: 'ERP/MES 단계별 구축 범위와 우선순위 확정', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'mesPm', weight: 8, planStart: '2026-11-01', planEnd: '2026-12-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-2', name: '목표 아키텍처 설계', description: '목표 시스템 구조와 인터페이스 원칙 수립', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'erpPl', weight: 7, planStart: '2026-12-16', planEnd: '2027-01-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2', name: 'ERP 구축', description: 'ERP 핵심 모듈 설계와 개발', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'erpPl', weight: 35, planStart: '2027-02-01', planEnd: '2027-06-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-1', name: '재무/원가 모듈', description: '재무, 결산, 원가 구조 설계와 개발', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'dev01', weight: 12, planStart: '2027-02-01', planEnd: '2027-04-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-2', name: '구매/물류 모듈', description: '구매, 자재, 물류 프로세스 구현', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'dev06', weight: 11, planStart: '2027-03-01', planEnd: '2027-05-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-3', name: '영업/생산관리 모듈', description: '수주부터 생산계획까지 ERP 영역 구현', level: 2, parentId: '2', orderIndex: 3, assigneeKey: 'dev11', weight: 12, planStart: '2027-04-01', planEnd: '2027-06-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3', name: 'MES 구축', description: 'MES 설계와 현장 연계 기능 구축', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'mesPl', weight: 30, planStart: '2027-02-01', planEnd: '2027-07-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-1', name: '현장 데이터 수집', description: '설비/라인 데이터 수집과 표준화', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'dev04', weight: 10, planStart: '2027-02-01', planEnd: '2027-04-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-2', name: '공정 실행 및 실적 관리', description: '공정 진척, 품질, 실적 관리 기능 구축', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'dev09', weight: 10, planStart: '2027-04-01', planEnd: '2027-06-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-3', name: '현장 대시보드/모바일', description: '실적 조회와 경보 화면 개발', level: 2, parentId: '3', orderIndex: 3, assigneeKey: 'dev14', weight: 10, planStart: '2027-05-01', planEnd: '2027-07-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4', name: '통합 테스트 및 오픈', description: 'ERP/MES 통합 검증과 Go-Live', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'erpPm', weight: 20, planStart: '2027-08-01', planEnd: '2027-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '통합 시나리오 검증', description: 'End-to-End 프로세스 검증', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'dev17', weight: 7, planStart: '2027-08-01', planEnd: '2027-09-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-2', name: '데이터 이관', description: '레거시 데이터 정제와 이관', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'dev18', weight: 6, planStart: '2027-09-16', planEnd: '2027-10-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-3', name: 'Go-Live 및 안정화', description: '오픈 후 안정화 지원', level: 2, parentId: '4', orderIndex: 3, assigneeKey: 'dev20', weight: 7, planStart: '2027-11-01', planEnd: '2027-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
]);

// ============================================================
// 프로젝트 5: 통합 물류 시스템 (완료)
// ============================================================
const logisticsProject: Project = {
  id: 'proj-logistics-001',
  ownerId: 'user-log-pm-01',
  name: '통합 물류 시스템 구축',
  description: '기간 2025.03~2025.12 / PM 1명 / 개발자 6명 — 입출고·재고·배송 통합 관리 시스템',
  startDate: '2025-03-01',
  endDate: '2025-12-31',
  baseDate: '2025-12-31',
  status: 'completed',
  completedAt: '2025-12-28T18:00:00Z',
  createdAt: '2025-03-01T09:00:00Z',
  updatedAt: '2025-12-28T18:00:00Z',
};

const logisticsMemberSeeds: MemberSeed[] = [
  { key: 'pm', name: 'PM 장세훈', role: 'owner', userId: 'user-log-pm-01' },
  { key: 'dev1', name: '개발 한소희', role: 'member', userId: 'user-log-dev-01' },
  { key: 'dev2', name: '개발 윤태민', role: 'member', userId: 'user-log-dev-02' },
  { key: 'dev3', name: '개발 서지원', role: 'member', userId: 'user-log-dev-03' },
  { key: 'dev4', name: '개발 이하영', role: 'member', userId: 'user-log-dev-04' },
  { key: 'dev5', name: '개발 김도운', role: 'member', userId: 'user-log-dev-05' },
  { key: 'dev6', name: '개발 박서연', role: 'member', userId: 'user-log-dev-06' },
];

const { members: logisticsMembers, memberIds: logisticsMemberIds } = buildMembers(
  logisticsProject.id,
  'log',
  logisticsMemberSeeds
);

const logisticsTasks = buildTasks(logisticsProject.id, 'log-task', logisticsMemberIds, [
  { id: '1', name: '요구사항 분석', description: '현행 물류 프로세스 분석 및 요구사항 도출', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm', weight: 15, planStart: '2025-03-01', planEnd: '2025-04-30', planProgress: 100, actualStart: '2025-03-01', actualEnd: '2025-04-25', actualProgress: 100, status: 'completed', output: '요구사항 정의서' },
  { id: '1-1', name: '현행 물류 프로세스 조사', description: '입출고/재고/배송 현황 조사', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'dev1', weight: 8, planStart: '2025-03-01', planEnd: '2025-03-31', planProgress: 100, actualStart: '2025-03-01', actualEnd: '2025-03-28', actualProgress: 100, status: 'completed', output: '현행 분석서' },
  { id: '1-2', name: '요구사항 정의 및 확정', description: '기능/비기능 요구사항 확정', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'pm', weight: 7, planStart: '2025-04-01', planEnd: '2025-04-30', planProgress: 100, actualStart: '2025-03-29', actualEnd: '2025-04-25', actualProgress: 100, status: 'completed', output: '요구사항 명세서' },
  { id: '2', name: '설계', description: '시스템 아키텍처 및 DB 설계', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'dev2', weight: 20, planStart: '2025-05-01', planEnd: '2025-06-30', planProgress: 100, actualStart: '2025-04-28', actualEnd: '2025-07-05', actualProgress: 100, status: 'completed', output: '설계서' },
  { id: '2-1', name: 'DB 설계', description: '물류 DB 스키마 설계 (재고/입출고/배송)', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'dev2', weight: 10, planStart: '2025-05-01', planEnd: '2025-05-31', planProgress: 100, actualStart: '2025-04-28', actualEnd: '2025-06-02', actualProgress: 100, status: 'completed', output: 'ERD' },
  { id: '2-2', name: 'API/화면 설계', description: 'REST API 및 UI 와이어프레임', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'dev3', weight: 10, planStart: '2025-06-01', planEnd: '2025-06-30', planProgress: 100, actualStart: '2025-06-03', actualEnd: '2025-07-05', actualProgress: 100, status: 'completed', output: 'API 설계서, 와이어프레임' },
  { id: '3', name: '개발', description: '핵심 모듈 개발', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'dev1', weight: 40, planStart: '2025-07-01', planEnd: '2025-10-31', planProgress: 100, actualStart: '2025-07-07', actualEnd: '2025-11-08', actualProgress: 100, status: 'completed' },
  { id: '3-1', name: '입출고 관리 모듈', description: '입고/출고 등록, 조회, 승인 기능', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'dev1', weight: 12, planStart: '2025-07-01', planEnd: '2025-08-15', planProgress: 100, actualStart: '2025-07-07', actualEnd: '2025-08-20', actualProgress: 100, status: 'completed', output: '입출고 모듈' },
  { id: '3-2', name: '재고 관리 모듈', description: '실시간 재고 현황, 재고 조정, 이력 관리', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'dev4', weight: 12, planStart: '2025-08-01', planEnd: '2025-09-15', planProgress: 100, actualStart: '2025-08-05', actualEnd: '2025-09-22', actualProgress: 100, status: 'completed', output: '재고 모듈' },
  { id: '3-3', name: '배송 관리 모듈', description: '배송 일정, 차량 배정, 추적 기능', level: 2, parentId: '3', orderIndex: 3, assigneeKey: 'dev5', weight: 10, planStart: '2025-09-01', planEnd: '2025-10-15', planProgress: 100, actualStart: '2025-09-08', actualEnd: '2025-10-20', actualProgress: 100, status: 'completed', output: '배송 모듈' },
  { id: '3-4', name: '대시보드 및 리포트', description: '물류 현황 대시보드와 엑셀 리포트', level: 2, parentId: '3', orderIndex: 4, assigneeKey: 'dev6', weight: 6, planStart: '2025-10-01', planEnd: '2025-10-31', planProgress: 100, actualStart: '2025-10-08', actualEnd: '2025-11-08', actualProgress: 100, status: 'completed', output: '대시보드' },
  { id: '4', name: '테스트 및 오픈', description: '통합 테스트와 Go-Live', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'pm', weight: 25, planStart: '2025-11-01', planEnd: '2025-12-31', planProgress: 100, actualStart: '2025-11-10', actualEnd: '2025-12-28', actualProgress: 100, status: 'completed' },
  { id: '4-1', name: '통합 테스트', description: 'End-to-End 물류 시나리오 검증', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'dev3', weight: 10, planStart: '2025-11-01', planEnd: '2025-11-30', planProgress: 100, actualStart: '2025-11-10', actualEnd: '2025-12-05', actualProgress: 100, status: 'completed', output: '테스트 결과서' },
  { id: '4-2', name: '사용자 교육', description: '현업 사용자 교육 3회 진행', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'pm', weight: 8, planStart: '2025-12-01', planEnd: '2025-12-15', planProgress: 100, actualStart: '2025-12-06', actualEnd: '2025-12-18', actualProgress: 100, status: 'completed', output: '교육 자료' },
  { id: '4-3', name: '오픈 및 안정화', description: 'Go-Live 후 안정화 2주', level: 2, parentId: '4', orderIndex: 3, assigneeKey: 'dev1', weight: 7, planStart: '2025-12-16', planEnd: '2025-12-31', planProgress: 100, actualStart: '2025-12-19', actualEnd: '2025-12-28', actualProgress: 100, status: 'completed', output: '안정화 보고서' },
]);

// ============================================================
// 프로젝트 6: 품질 관리 플랫폼 (진행중 — 지연 많음)
// ============================================================
const qualityProject: Project = {
  id: 'proj-quality-001',
  ownerId: 'user-qc-pm-01',
  name: '품질 관리 플랫폼',
  description: '기간 2025.11~2026.07 / PM 1명 / 개발자 5명 — 품질 검사·불량 관리·SPC 시스템',
  startDate: '2025-11-01',
  endDate: '2026-07-31',
  baseDate: '2026-03-19',
  status: 'active',
  createdAt: '2025-11-01T09:00:00Z',
  updatedAt: DEFAULT_CREATED_AT,
};

const qualityMemberSeeds: MemberSeed[] = [
  { key: 'pm', name: 'PM 조은서', role: 'owner', userId: 'user-qc-pm-01' },
  { key: 'dev1', name: '개발 황민재', role: 'member', userId: 'user-qc-dev-01' },
  { key: 'dev2', name: '개발 노서윤', role: 'member', userId: 'user-qc-dev-02' },
  { key: 'dev3', name: '개발 구하늘', role: 'member', userId: 'user-qc-dev-03' },
  { key: 'dev4', name: '개발 송도현', role: 'member', userId: 'user-qc-dev-04' },
  { key: 'dev5', name: '개발 백지민', role: 'member', userId: 'user-qc-dev-05' },
];

const { members: qualityMembers, memberIds: qualityMemberIds } = buildMembers(
  qualityProject.id,
  'qc',
  qualityMemberSeeds
);

const qualityTasks = buildTasks(qualityProject.id, 'qc-task', qualityMemberIds, [
  // Phase 1: 완료
  { id: '1', name: '분석 및 설계', description: '품질 관리 요구사항 분석 및 시스템 설계', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm', weight: 20, planStart: '2025-11-01', planEnd: '2025-12-31', planProgress: 100, actualStart: '2025-11-01', actualEnd: '2026-01-10', actualProgress: 100, status: 'completed', output: '분석/설계서' },
  { id: '1-1', name: '품질 프로세스 분석', description: '현행 검사/불량 프로세스 조사', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'dev1', weight: 10, planStart: '2025-11-01', planEnd: '2025-11-30', planProgress: 100, actualStart: '2025-11-01', actualEnd: '2025-12-05', actualProgress: 100, status: 'completed', output: '프로세스 분석서' },
  { id: '1-2', name: 'DB 및 시스템 설계', description: '품질 데이터 모델 및 시스템 구조 설계', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'dev2', weight: 10, planStart: '2025-12-01', planEnd: '2025-12-31', planProgress: 100, actualStart: '2025-12-08', actualEnd: '2026-01-10', actualProgress: 100, status: 'completed', output: 'ERD, 시스템 구성도' },

  // Phase 2: 진행중 (지연 발생)
  { id: '2', name: '핵심 모듈 개발', description: '검사/불량/SPC 핵심 기능 개발', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'dev1', weight: 45, planStart: '2026-01-01', planEnd: '2026-04-30', planProgress: 75, actualStart: '2026-01-12', actualProgress: 45, status: 'in_progress' },
  { id: '2-1', name: '검사 관리 모듈', description: '수입검사/공정검사/출하검사 기능', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'dev1', weight: 15, planStart: '2026-01-01', planEnd: '2026-02-15', planProgress: 100, actualStart: '2026-01-12', actualEnd: '2026-03-05', actualProgress: 100, status: 'completed', output: '검사 관리 모듈' },
  { id: '2-2', name: '불량 관리 모듈', description: '불량 등록, 원인 분석, 시정조치 관리', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'dev3', weight: 15, planStart: '2026-02-01', planEnd: '2026-03-15', planProgress: 90, actualStart: '2026-02-10', actualProgress: 60, status: 'in_progress' },
  { id: '2-2-1', name: '불량 등록/조회', description: '불량 유형별 등록 및 이력 조회', level: 3, parentId: '2-2', orderIndex: 1, assigneeKey: 'dev3', weight: 7, planStart: '2026-02-01', planEnd: '2026-02-20', planProgress: 100, actualStart: '2026-02-10', actualEnd: '2026-03-01', actualProgress: 100, status: 'completed' },
  { id: '2-2-2', name: '원인 분석(5Why) 기능', description: '근본 원인 분석 워크플로', level: 3, parentId: '2-2', orderIndex: 2, assigneeKey: 'dev3', weight: 4, planStart: '2026-02-21', planEnd: '2026-03-05', planProgress: 80, actualStart: '2026-03-02', actualProgress: 50, status: 'in_progress' },
  { id: '2-2-3', name: '시정조치(CAPA) 관리', description: '시정/예방 조치 등록 및 추적', level: 3, parentId: '2-2', orderIndex: 3, assigneeKey: 'dev3', weight: 4, planStart: '2026-03-06', planEnd: '2026-03-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-3', name: 'SPC 통계 모듈', description: '관리도, Cpk, 공정능력 분석', level: 2, parentId: '2', orderIndex: 3, assigneeKey: 'dev4', weight: 15, planStart: '2026-03-01', planEnd: '2026-04-30', planProgress: 40, actualStart: '2026-03-10', actualProgress: 15, status: 'in_progress' },
  { id: '2-3-1', name: 'X-bar R 관리도', description: '평균-범위 관리도 차트 구현', level: 3, parentId: '2-3', orderIndex: 1, assigneeKey: 'dev4', weight: 5, planStart: '2026-03-01', planEnd: '2026-03-20', planProgress: 100, actualStart: '2026-03-10', actualEnd: '2026-03-28', actualProgress: 100, status: 'completed' },
  { id: '2-3-2', name: 'Cpk/Ppk 분석', description: '공정 능력 지수 계산 및 시각화', level: 3, parentId: '2-3', orderIndex: 2, assigneeKey: 'dev4', weight: 5, planStart: '2026-03-21', planEnd: '2026-04-10', planProgress: 30, actualStart: '2026-03-29', actualProgress: 10, status: 'in_progress' },
  { id: '2-3-3', name: 'SPC 대시보드', description: '품질 지표 통합 대시보드', level: 3, parentId: '2-3', orderIndex: 3, assigneeKey: 'dev5', weight: 5, planStart: '2026-04-11', planEnd: '2026-04-30', planProgress: 0, actualProgress: 0, status: 'pending' },

  // Phase 3: 미착수
  { id: '3', name: '연계 및 통합', description: 'ERP/MES 연계, 데이터 통합', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'dev2', weight: 20, planStart: '2026-05-01', planEnd: '2026-06-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-1', name: 'ERP 연계 인터페이스', description: '구매/수입검사 데이터 연동', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'dev2', weight: 10, planStart: '2026-05-01', planEnd: '2026-05-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-2', name: 'MES 연계 인터페이스', description: '공정 실적/품질 데이터 연동', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'dev5', weight: 10, planStart: '2026-06-01', planEnd: '2026-06-15', planProgress: 0, actualProgress: 0, status: 'pending' },

  // Phase 4: 미착수
  { id: '4', name: '테스트 및 오픈', description: '통합 테스트와 운영 이관', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'pm', weight: 15, planStart: '2026-06-16', planEnd: '2026-07-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '통합 테스트', description: '품질 전 프로세스 E2E 검증', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'dev1', weight: 8, planStart: '2026-06-16', planEnd: '2026-07-10', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-2', name: '오픈 및 안정화', description: 'Go-Live 후 3주 안정화', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'pm', weight: 7, planStart: '2026-07-11', planEnd: '2026-07-31', planProgress: 0, actualProgress: 0, status: 'pending' },
]);

// ============================================================
// 통합 Export
// ============================================================

export interface SampleWorkspace {
  project: Project;
  members: ProjectMember[];
  tasks: Task[];
}

export const sampleProject = smartMeteringProject;
export const sampleMembers = smartMeteringMembers;
export const sampleTasks = smartMeteringTasks;

export const sampleWorkspaces: SampleWorkspace[] = [
  { project: smartMeteringProject, members: smartMeteringMembers, tasks: smartMeteringTasks },
  { project: dkCmPiProject, members: dkCmPiMembers, tasks: dkCmPiTasks },
  { project: kgSteelMesProject, members: kgSteelMesMembers, tasks: kgSteelMesTasks },
  { project: dkCmErpProject, members: dkCmErpMembers, tasks: dkCmErpTasks },
  { project: logisticsProject, members: logisticsMembers, tasks: logisticsTasks },
  { project: qualityProject, members: qualityMembers, tasks: qualityTasks },
];
