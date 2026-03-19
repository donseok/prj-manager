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
// 프로젝트 1: 스마트 계량 프로젝트
// ============================================================
const smartMeteringProject: Project = {
  id: 'proj-smart-001',
  ownerId: 'user-smart-pm-01',
  name: '스마트 계량 프로젝트',
  description: '기간 2026.04~2026.08 / PM 1명 / 개발자 4명',
  startDate: '2026-04-01',
  endDate: '2026-08-31',
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
  { id: '1', name: '착수 및 분석', description: '프로젝트 킥오프와 요구사항 정리', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm', weight: 20, planStart: '2026-04-01', planEnd: '2026-04-20', planProgress: 15, actualProgress: 0, status: 'pending' },
  { id: '1-1', name: '킥오프 및 역할정의', description: 'PM과 개발자 역할 및 일정 정렬', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'pm', weight: 10, planStart: '2026-04-01', planEnd: '2026-04-05', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-2', name: '계량 요구사항 정의', description: '현장 계량 시나리오 및 인터페이스 요구사항 수집', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'dev1', weight: 10, planStart: '2026-04-06', planEnd: '2026-04-20', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2', name: '핵심 기능 개발', description: '계량 서버, API, 화면 개발', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'dev2', weight: 45, planStart: '2026-04-21', planEnd: '2026-07-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-1', name: '계량 서버 개발', description: '계량 이벤트 처리와 로그 적재 개발', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'dev1', weight: 15, planStart: '2026-04-21', planEnd: '2026-05-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-2', name: '수집 API 개발', description: '현장 장비 연동용 API 및 검증 로직 개발', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'dev2', weight: 10, planStart: '2026-05-01', planEnd: '2026-06-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-3', name: '모니터링 UI 개발', description: '실시간 계량 현황 대시보드 구현', level: 2, parentId: '2', orderIndex: 3, assigneeKey: 'dev3', weight: 10, planStart: '2026-05-16', planEnd: '2026-06-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-4', name: '인프라 및 배포 구성', description: '개발/검증 환경과 배포 자동화 구성', level: 2, parentId: '2', orderIndex: 4, assigneeKey: 'dev4', weight: 10, planStart: '2026-06-01', planEnd: '2026-07-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3', name: '통합 테스트', description: '기능 통합 점검과 현장 검증', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'pm', weight: 20, planStart: '2026-07-16', planEnd: '2026-08-10', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-1', name: '통합 시나리오 테스트', description: '주요 계량 시나리오 검증', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'dev3', weight: 10, planStart: '2026-07-16', planEnd: '2026-07-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-2', name: '현장 시운전', description: '실계량 데이터를 이용한 현장 시운전', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'dev4', weight: 10, planStart: '2026-08-01', planEnd: '2026-08-10', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4', name: '오픈 안정화', description: '교육과 운영 전환 지원', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'pm', weight: 15, planStart: '2026-08-11', planEnd: '2026-08-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '사용자 교육', description: '현업 사용자 교육과 매뉴얼 배포', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'pm', weight: 7, planStart: '2026-08-11', planEnd: '2026-08-20', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-2', name: '운영 전환 지원', description: '운영 이관과 초기 장애 대응', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'dev2', weight: 8, planStart: '2026-08-21', planEnd: '2026-08-31', planProgress: 0, actualProgress: 0, status: 'pending' },
]);

// ============================================================
// 프로젝트 2: 동국씨엠 PI
// ============================================================
const dkCmPiProject: Project = {
  id: 'proj-dkcm-pi-001',
  ownerId: 'user-pi-pm-01',
  name: '동국씨엠 PI',
  description: '기간 2026.07~2026.12 / PM 1명 / 설계자 8명',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  status: 'preparing',
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
  { id: '1', name: '착수 및 현행분석', description: 'PI 범위 확정과 As-Is 분석', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm', weight: 20, planStart: '2026-07-01', planEnd: '2026-08-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-1', name: '업무 프로세스 인터뷰', description: '현업 인터뷰와 Pain Point 정리', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'designer1', weight: 10, planStart: '2026-07-01', planEnd: '2026-07-20', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-2', name: 'As-Is 프로세스 정리', description: '부문별 프로세스 맵과 이슈 정리', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'designer2', weight: 10, planStart: '2026-07-21', planEnd: '2026-08-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2', name: 'To-Be 설계', description: '목표 프로세스와 개선 방향 설계', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'designer3', weight: 35, planStart: '2026-08-16', planEnd: '2026-10-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-1', name: '핵심 프로세스 To-Be 설계', description: '판매/생산/구매 영역 목표 프로세스 정의', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'designer3', weight: 15, planStart: '2026-08-16', planEnd: '2026-09-10', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-2', name: '과제 우선순위 수립', description: '개선과제와 기대효과 우선순위화', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'designer4', weight: 10, planStart: '2026-09-11', planEnd: '2026-09-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-3', name: '조직/제도 개선안', description: '업무체계와 운영 제도 개선 방향 정의', level: 2, parentId: '2', orderIndex: 3, assigneeKey: 'designer5', weight: 10, planStart: '2026-10-01', planEnd: '2026-10-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3', name: '상세 설계 및 실행계획', description: '시스템 요건과 실행 로드맵 작성', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'pm', weight: 25, planStart: '2026-10-16', planEnd: '2026-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-1', name: '시스템 개선요건 정의', description: '업무 시스템 개선 요건 문서화', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'designer6', weight: 12, planStart: '2026-10-16', planEnd: '2026-11-10', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-2', name: 'PI 이행 로드맵 수립', description: '단계별 실행계획 및 일정 수립', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'designer7', weight: 13, planStart: '2026-11-11', planEnd: '2026-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4', name: '최종 보고 및 변화관리', description: '최종안 보고와 변화관리 계획 수립', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'pm', weight: 20, planStart: '2026-12-01', planEnd: '2026-12-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '경영진 보고서 작성', description: 'PI 최종 결과와 투자 우선순위 보고', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'designer8', weight: 10, planStart: '2026-12-01', planEnd: '2026-12-15', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-2', name: '변화관리 계획 수립', description: '현업 안착을 위한 커뮤니케이션 계획 수립', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'designer1', weight: 10, planStart: '2026-12-16', planEnd: '2026-12-31', planProgress: 0, actualProgress: 0, status: 'pending' },
]);

// ============================================================
// 프로젝트 3: KG스틸 MES 재구축
// ============================================================
const kgSteelMesProject: Project = {
  id: 'proj-kgsteel-mes-001',
  ownerId: 'user-kg-pm-01',
  name: 'KG스틸 MES 재구축',
  description: '상태: 계획 / PM 3명 / 개발자 5명',
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
  { id: '1', name: '사업전략 수립', description: 'MES 재구축 목표와 추진 범위 정의', level: 1, parentId: null, orderIndex: 1, assigneeKey: 'pm1', weight: 30, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-1', name: '구축 범위 정의', description: '라인/공정별 포함 범위와 우선순위 확정', level: 2, parentId: '1', orderIndex: 1, assigneeKey: 'pm2', weight: 15, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '1-2', name: '추진 조직 구성', description: '의사결정 체계와 운영 조직 정의', level: 2, parentId: '1', orderIndex: 2, assigneeKey: 'pm3', weight: 15, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2', name: '현행 분석 준비', description: '분석 인터뷰와 데이터 조사 준비', level: 1, parentId: null, orderIndex: 2, assigneeKey: 'dev1', weight: 35, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-1', name: '인터뷰 계획 수립', description: '현업 인터뷰 대상과 질문지 준비', level: 2, parentId: '2', orderIndex: 1, assigneeKey: 'dev2', weight: 18, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '2-2', name: '마스터 데이터 정리', description: '품목/설비/공정 기준정보 현황 수집', level: 2, parentId: '2', orderIndex: 2, assigneeKey: 'dev3', weight: 17, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3', name: '예산 및 일정 계획', description: '예산안과 단계별 로드맵 작성', level: 1, parentId: null, orderIndex: 3, assigneeKey: 'pm1', weight: 35, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-1', name: '투자안 작성', description: '예산 규모와 기대효과 산정', level: 2, parentId: '3', orderIndex: 1, assigneeKey: 'dev4', weight: 18, planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '3-2', name: '단계별 구축 로드맵', description: '파일럿부터 전사 확산까지 단계 계획 수립', level: 2, parentId: '3', orderIndex: 2, assigneeKey: 'dev5', weight: 17, planProgress: 0, actualProgress: 0, status: 'pending' },
]);

// ============================================================
// 프로젝트 4: 동국씨엠 ERP/MES 재구축
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
  { id: '4', name: '통합 테스트 및 데이터 이관', description: 'ERP/MES 통합 검증과 데이터 마이그레이션', level: 1, parentId: null, orderIndex: 4, assigneeKey: 'erpPm', weight: 10, planStart: '2027-08-01', planEnd: '2027-09-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-1', name: '통합 시나리오 검증', description: 'End-to-End 프로세스 검증', level: 2, parentId: '4', orderIndex: 1, assigneeKey: 'dev17', weight: 5, planStart: '2027-08-01', planEnd: '2027-08-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '4-2', name: '기준/이력 데이터 이관', description: '레거시 데이터 정제와 이관', level: 2, parentId: '4', orderIndex: 2, assigneeKey: 'dev18', weight: 5, planStart: '2027-09-01', planEnd: '2027-09-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '5', name: 'Cutover 및 안정화', description: 'Go-Live와 초기 운영 안정화', level: 1, parentId: null, orderIndex: 5, assigneeKey: 'mesPm', weight: 10, planStart: '2027-10-01', planEnd: '2027-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '5-1', name: '사용자 교육', description: '업무별 사용자 교육과 매뉴얼 배포', level: 2, parentId: '5', orderIndex: 1, assigneeKey: 'dev19', weight: 5, planStart: '2027-10-01', planEnd: '2027-10-31', planProgress: 0, actualProgress: 0, status: 'pending' },
  { id: '5-2', name: '오픈 후 안정화 지원', description: 'Go-Live 이후 이슈 대응과 안정화 지원', level: 2, parentId: '5', orderIndex: 2, assigneeKey: 'dev20', weight: 5, planStart: '2027-11-01', planEnd: '2027-11-30', planProgress: 0, actualProgress: 0, status: 'pending' },
]);

// ============================================================
// 통합 Export
// ============================================================

export interface SampleWorkspace {
  project: Project;
  members: ProjectMember[];
  tasks: Task[];
}

export const sampleProject = kgSteelMesProject;
export const sampleMembers = kgSteelMesMembers;
export const sampleTasks = kgSteelMesTasks;

export const sampleWorkspaces: SampleWorkspace[] = [
  { project: smartMeteringProject, members: smartMeteringMembers, tasks: smartMeteringTasks },
  { project: dkCmPiProject, members: dkCmPiMembers, tasks: dkCmPiTasks },
  { project: kgSteelMesProject, members: kgSteelMesMembers, tasks: kgSteelMesTasks },
  { project: dkCmErpProject, members: dkCmErpMembers, tasks: dkCmErpTasks },
];
