import type { Project, Task, ProjectMember } from '../types';

// ============================================================
// 프로젝트 1: 스마트계량대구축 프로젝트
// ============================================================
const smartMeteringProject: Project = {
  id: 'proj-smart-001',
  name: '스마트계량대구축 프로젝트',
  description: '스마트 계량 시스템 구축을 통한 실시간 원료 계량 자동화 및 데이터 관리 체계 확립',
  startDate: '2026-03-01',
  endDate: '2026-12-31',
  status: 'active',
  ownerId: 'user-001',
  createdAt: '2026-02-15T09:00:00Z',
  updatedAt: '2026-03-19T09:00:00Z',
};

const smartMeteringMembers: ProjectMember[] = [
  { id: 'sm-member-001', projectId: 'proj-smart-001', userId: 'user-001', name: '김철수', role: 'owner', createdAt: '2026-02-15T09:00:00Z' },
  { id: 'sm-member-002', projectId: 'proj-smart-001', userId: 'user-002', name: '이영희', role: 'admin', createdAt: '2026-02-15T09:00:00Z' },
  { id: 'sm-member-003', projectId: 'proj-smart-001', userId: 'user-003', name: '박민수', role: 'member', createdAt: '2026-02-20T09:00:00Z' },
  { id: 'sm-member-004', projectId: 'proj-smart-001', userId: 'user-004', name: '정지연', role: 'member', createdAt: '2026-02-20T09:00:00Z' },
  { id: 'sm-member-005', projectId: 'proj-smart-001', userId: 'user-005', name: '최현우', role: 'member', createdAt: '2026-02-25T09:00:00Z' },
];

const smartMeteringTasks: Task[] = [
  // Phase 1: 기획 및 설계
  {
    id: 'sm-t-001', projectId: 'proj-smart-001', name: '기획 및 설계', description: '프로젝트 기획, 현장 조사, 시스템 설계',
    level: 1, parentId: null, orderIndex: 1, assigneeId: 'sm-member-001', weight: 20,
    planStart: '2026-03-01', planEnd: '2026-05-31', planProgress: 100,
    actualStart: '2026-03-01', actualEnd: '2026-05-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-05-28T18:00:00Z',
  },
  {
    id: 'sm-t-001-1', projectId: 'proj-smart-001', name: '현장 실태 조사', description: '기존 계량 설비 및 프로세스 현황 조사',
    level: 2, parentId: 'sm-t-001', orderIndex: 1, assigneeId: 'sm-member-003', weight: 7,
    planStart: '2026-03-01', planEnd: '2026-03-31', planProgress: 100,
    actualStart: '2026-03-01', actualEnd: '2026-03-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-28T18:00:00Z',
  },
  {
    id: 'sm-t-001-2', projectId: 'proj-smart-001', name: '시스템 설계', description: 'HW/SW 아키텍처 설계 및 인터페이스 정의',
    level: 2, parentId: 'sm-t-001', orderIndex: 2, assigneeId: 'sm-member-002', weight: 8,
    planStart: '2026-04-01', planEnd: '2026-04-30', planProgress: 100,
    actualStart: '2026-04-01', actualEnd: '2026-04-29', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-04-29T18:00:00Z',
  },
  {
    id: 'sm-t-001-3', projectId: 'proj-smart-001', name: '조달 계획 수립', description: '계량 장비 및 센서 조달 계획',
    level: 2, parentId: 'sm-t-001', orderIndex: 3, assigneeId: 'sm-member-004', weight: 5,
    planStart: '2026-05-01', planEnd: '2026-05-31', planProgress: 100,
    actualStart: '2026-05-01', actualEnd: '2026-05-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-05-28T18:00:00Z',
  },

  // Phase 2: HW 설치 및 구축
  {
    id: 'sm-t-002', projectId: 'proj-smart-001', name: 'HW 설치 및 구축', description: '계량대, 센서, 네트워크 장비 설치',
    level: 1, parentId: null, orderIndex: 2, assigneeId: 'sm-member-003', weight: 30,
    planStart: '2026-05-01', planEnd: '2026-08-31', planProgress: 60,
    actualStart: '2026-05-01', actualEnd: null, actualProgress: 45,
    status: 'in_progress', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'sm-t-002-1', projectId: 'proj-smart-001', name: '계량대 설치', description: '신규 스마트 계량대 설치 및 교정',
    level: 2, parentId: 'sm-t-002', orderIndex: 1, assigneeId: 'sm-member-003', weight: 12,
    planStart: '2026-05-01', planEnd: '2026-06-30', planProgress: 100,
    actualStart: '2026-05-01', actualEnd: '2026-06-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-06-28T18:00:00Z',
  },
  {
    id: 'sm-t-002-2', projectId: 'proj-smart-001', name: '센서/IoT 장비 설치', description: 'IoT 센서 및 데이터 수집 장비 설치',
    level: 2, parentId: 'sm-t-002', orderIndex: 2, assigneeId: 'sm-member-005', weight: 10,
    planStart: '2026-07-01', planEnd: '2026-07-31', planProgress: 50,
    actualStart: '2026-07-01', actualEnd: null, actualProgress: 30,
    status: 'in_progress', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'sm-t-002-3', projectId: 'proj-smart-001', name: '네트워크 인프라 구축', description: '공장 내 무선/유선 네트워크 구축',
    level: 2, parentId: 'sm-t-002', orderIndex: 3, assigneeId: 'sm-member-005', weight: 8,
    planStart: '2026-08-01', planEnd: '2026-08-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },

  // Phase 3: SW 개발
  {
    id: 'sm-t-003', projectId: 'proj-smart-001', name: 'SW 개발', description: '계량 데이터 수집/분석 소프트웨어 개발',
    level: 1, parentId: null, orderIndex: 3, assigneeId: 'sm-member-002', weight: 30,
    planStart: '2026-06-01', planEnd: '2026-10-31', planProgress: 30,
    actualStart: '2026-06-01', actualEnd: null, actualProgress: 20,
    status: 'in_progress', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'sm-t-003-1', projectId: 'proj-smart-001', name: '데이터 수집 모듈', description: '센서 데이터 실시간 수집 및 저장',
    level: 2, parentId: 'sm-t-003', orderIndex: 1, assigneeId: 'sm-member-002', weight: 10,
    planStart: '2026-06-01', planEnd: '2026-07-31', planProgress: 100,
    actualStart: '2026-06-01', actualEnd: '2026-07-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-07-28T18:00:00Z',
  },
  {
    id: 'sm-t-003-2', projectId: 'proj-smart-001', name: '모니터링 대시보드', description: '실시간 계량 현황 모니터링 화면',
    level: 2, parentId: 'sm-t-003', orderIndex: 2, assigneeId: 'sm-member-004', weight: 10,
    planStart: '2026-08-01', planEnd: '2026-09-15', planProgress: 20,
    actualStart: '2026-08-01', actualEnd: null, actualProgress: 10,
    status: 'in_progress', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'sm-t-003-3', projectId: 'proj-smart-001', name: 'ERP 연동 모듈', description: '기존 ERP 시스템과 계량 데이터 연동',
    level: 2, parentId: 'sm-t-003', orderIndex: 3, assigneeId: 'sm-member-002', weight: 10,
    planStart: '2026-09-16', planEnd: '2026-10-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },

  // Phase 4: 시운전 및 안정화
  {
    id: 'sm-t-004', projectId: 'proj-smart-001', name: '시운전 및 안정화', description: '시스템 시운전, 검증, 안정화',
    level: 1, parentId: null, orderIndex: 4, assigneeId: 'sm-member-001', weight: 20,
    planStart: '2026-11-01', planEnd: '2026-12-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'sm-t-004-1', projectId: 'proj-smart-001', name: '시운전', description: '전체 시스템 시운전 및 교정',
    level: 2, parentId: 'sm-t-004', orderIndex: 1, assigneeId: 'sm-member-003', weight: 8,
    planStart: '2026-11-01', planEnd: '2026-11-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'sm-t-004-2', projectId: 'proj-smart-001', name: '사용자 교육 및 안정화', description: '현장 운영자 교육 및 운영 안정화',
    level: 2, parentId: 'sm-t-004', orderIndex: 2, assigneeId: 'sm-member-004', weight: 12,
    planStart: '2026-12-01', planEnd: '2026-12-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-02-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
];

// ============================================================
// 프로젝트 2: 동국씨엠 PI 프로젝트
// ============================================================
const dkCmPiProject: Project = {
  id: 'proj-dkcm-pi-001',
  name: '동국씨엠 PI 프로젝트',
  description: '동국씨엠 프로세스 혁신(PI) - 업무 표준화, BPR, 시스템 고도화를 통한 경영 효율화',
  startDate: '2026-01-15',
  endDate: '2026-09-30',
  status: 'active',
  ownerId: 'user-001',
  createdAt: '2026-01-10T09:00:00Z',
  updatedAt: '2026-03-19T09:00:00Z',
};

const dkCmPiMembers: ProjectMember[] = [
  { id: 'pi-member-001', projectId: 'proj-dkcm-pi-001', userId: 'user-001', name: '김철수', role: 'owner', createdAt: '2026-01-10T09:00:00Z' },
  { id: 'pi-member-002', projectId: 'proj-dkcm-pi-001', userId: 'user-002', name: '이영희', role: 'admin', createdAt: '2026-01-10T09:00:00Z' },
  { id: 'pi-member-003', projectId: 'proj-dkcm-pi-001', userId: 'user-007', name: '송태호', role: 'member', createdAt: '2026-01-15T09:00:00Z' },
  { id: 'pi-member-004', projectId: 'proj-dkcm-pi-001', userId: 'user-008', name: '윤서연', role: 'member', createdAt: '2026-01-15T09:00:00Z' },
  { id: 'pi-member-005', projectId: 'proj-dkcm-pi-001', userId: 'user-009', name: '강민호', role: 'member', createdAt: '2026-01-20T09:00:00Z' },
];

const dkCmPiTasks: Task[] = [
  // Phase 1: 현행 분석 (As-Is)
  {
    id: 'pi-t-001', projectId: 'proj-dkcm-pi-001', name: '현행 분석 (As-Is)', description: '현행 업무 프로세스 및 시스템 분석',
    level: 1, parentId: null, orderIndex: 1, assigneeId: 'pi-member-002', weight: 20,
    planStart: '2026-01-15', planEnd: '2026-03-15', planProgress: 100,
    actualStart: '2026-01-15', actualEnd: '2026-03-14', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-14T18:00:00Z',
  },
  {
    id: 'pi-t-001-1', projectId: 'proj-dkcm-pi-001', name: '업무 프로세스 매핑', description: '부서별 핵심 업무 프로세스 도식화',
    level: 2, parentId: 'pi-t-001', orderIndex: 1, assigneeId: 'pi-member-003', weight: 7,
    planStart: '2026-01-15', planEnd: '2026-02-07', planProgress: 100,
    actualStart: '2026-01-15', actualEnd: '2026-02-06', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-02-06T18:00:00Z',
  },
  {
    id: 'pi-t-001-2', projectId: 'proj-dkcm-pi-001', name: '문제점 도출 및 인터뷰', description: '현업 인터뷰를 통한 문제점 및 개선과제 도출',
    level: 2, parentId: 'pi-t-001', orderIndex: 2, assigneeId: 'pi-member-004', weight: 7,
    planStart: '2026-02-08', planEnd: '2026-02-28', planProgress: 100,
    actualStart: '2026-02-08', actualEnd: '2026-02-27', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-02-27T18:00:00Z',
  },
  {
    id: 'pi-t-001-3', projectId: 'proj-dkcm-pi-001', name: '벤치마킹', description: '동종 업계 Best Practice 조사',
    level: 2, parentId: 'pi-t-001', orderIndex: 3, assigneeId: 'pi-member-005', weight: 6,
    planStart: '2026-03-01', planEnd: '2026-03-15', planProgress: 100,
    actualStart: '2026-03-01', actualEnd: '2026-03-14', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-14T18:00:00Z',
  },

  // Phase 2: 목표 설계 (To-Be)
  {
    id: 'pi-t-002', projectId: 'proj-dkcm-pi-001', name: '목표 설계 (To-Be)', description: '목표 프로세스 설계 및 과제 정의',
    level: 1, parentId: null, orderIndex: 2, assigneeId: 'pi-member-002', weight: 25,
    planStart: '2026-03-16', planEnd: '2026-05-31', planProgress: 50,
    actualStart: '2026-03-16', actualEnd: null, actualProgress: 35,
    status: 'in_progress', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-002-1', projectId: 'proj-dkcm-pi-001', name: 'To-Be 프로세스 설계', description: '개선 목표 프로세스 설계',
    level: 2, parentId: 'pi-t-002', orderIndex: 1, assigneeId: 'pi-member-003', weight: 10,
    planStart: '2026-03-16', planEnd: '2026-04-15', planProgress: 80,
    actualStart: '2026-03-16', actualEnd: null, actualProgress: 70,
    status: 'in_progress', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-002-2', projectId: 'proj-dkcm-pi-001', name: '시스템 개선과제 정의', description: 'IT 시스템 개선 요건 및 과제 정의',
    level: 2, parentId: 'pi-t-002', orderIndex: 2, assigneeId: 'pi-member-004', weight: 8,
    planStart: '2026-04-16', planEnd: '2026-05-15', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-002-3', projectId: 'proj-dkcm-pi-001', name: '조직/제도 개선안', description: '조직 구조 및 업무 제도 개선 방안 수립',
    level: 2, parentId: 'pi-t-002', orderIndex: 3, assigneeId: 'pi-member-005', weight: 7,
    planStart: '2026-05-16', planEnd: '2026-05-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },

  // Phase 3: 실행 및 구현
  {
    id: 'pi-t-003', projectId: 'proj-dkcm-pi-001', name: '실행 및 구현', description: '개선과제 실행 및 시스템 구현',
    level: 1, parentId: null, orderIndex: 3, assigneeId: 'pi-member-002', weight: 35,
    planStart: '2026-06-01', planEnd: '2026-08-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-003-1', projectId: 'proj-dkcm-pi-001', name: '프로세스 개선 실행', description: '핵심 업무 프로세스 변경 적용',
    level: 2, parentId: 'pi-t-003', orderIndex: 1, assigneeId: 'pi-member-003', weight: 12,
    planStart: '2026-06-01', planEnd: '2026-07-15', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-003-2', projectId: 'proj-dkcm-pi-001', name: '시스템 개발/커스터마이징', description: 'ERP/그룹웨어 등 시스템 개선 개발',
    level: 2, parentId: 'pi-t-003', orderIndex: 2, assigneeId: 'pi-member-004', weight: 15,
    planStart: '2026-06-15', planEnd: '2026-08-15', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-003-3', projectId: 'proj-dkcm-pi-001', name: '교육 및 변화관리', description: '직원 교육, 변화관리 프로그램 실행',
    level: 2, parentId: 'pi-t-003', orderIndex: 3, assigneeId: 'pi-member-005', weight: 8,
    planStart: '2026-08-01', planEnd: '2026-08-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },

  // Phase 4: 정착 및 성과측정
  {
    id: 'pi-t-004', projectId: 'proj-dkcm-pi-001', name: '정착 및 성과측정', description: '개선 결과 정착 및 성과 측정',
    level: 1, parentId: null, orderIndex: 4, assigneeId: 'pi-member-001', weight: 20,
    planStart: '2026-09-01', planEnd: '2026-09-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-004-1', projectId: 'proj-dkcm-pi-001', name: 'KPI 측정 및 보고', description: '개선 KPI 측정 및 경영진 보고',
    level: 2, parentId: 'pi-t-004', orderIndex: 1, assigneeId: 'pi-member-003', weight: 10,
    planStart: '2026-09-01', planEnd: '2026-09-15', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'pi-t-004-2', projectId: 'proj-dkcm-pi-001', name: '후속 과제 수립', description: '미완료 과제 및 추가 개선 과제 정리',
    level: 2, parentId: 'pi-t-004', orderIndex: 2, assigneeId: 'pi-member-002', weight: 10,
    planStart: '2026-09-16', planEnd: '2026-09-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
];

// ============================================================
// 프로젝트 3: KG스틸 MES재구축 프로젝트 (기존 샘플 프로젝트 리네이밍)
// ============================================================
const kgSteelMesProject: Project = {
  id: 'proj-mes-001',
  name: 'KG스틸 MES재구축 프로젝트',
  description: 'KG스틸 기존 MES 시스템을 최신 기술 스택으로 재구축하여 생산성 향상 및 실시간 모니터링 강화',
  startDate: '2026-07-01',
  endDate: '2027-06-30',
  status: 'active',
  ownerId: 'user-001',
  createdAt: '2026-06-15T09:00:00Z',
  updatedAt: '2026-06-15T09:00:00Z',
};

const kgSteelMesMembers: ProjectMember[] = [
  { id: 'member-001', projectId: 'proj-mes-001', userId: 'user-001', name: '김철수', role: 'owner', createdAt: '2026-06-15T09:00:00Z' },
  { id: 'member-002', projectId: 'proj-mes-001', userId: 'user-002', name: '이영희', role: 'admin', createdAt: '2026-06-15T09:00:00Z' },
  { id: 'member-003', projectId: 'proj-mes-001', userId: 'user-003', name: '박민수', role: 'member', createdAt: '2026-06-20T09:00:00Z' },
  { id: 'member-004', projectId: 'proj-mes-001', userId: 'user-004', name: '정지연', role: 'member', createdAt: '2026-06-20T09:00:00Z' },
  { id: 'member-005', projectId: 'proj-mes-001', userId: 'user-005', name: '최현우', role: 'member', createdAt: '2026-06-25T09:00:00Z' },
  { id: 'member-006', projectId: 'proj-mes-001', userId: 'user-006', name: '한소영', role: 'member', createdAt: '2026-06-25T09:00:00Z' },
];

const kgSteelMesTasks: Task[] = [
  // ========== 1. 분석 단계 ==========
  {
    id: 'task-001', projectId: 'proj-mes-001', name: '분석', description: '현행 시스템 분석 및 요구사항 정의',
    level: 1, parentId: null, orderIndex: 1, assigneeId: 'member-006', weight: 15,
    planStart: '2026-07-01', planEnd: '2026-09-30', planProgress: 100,
    actualStart: '2026-07-01', actualEnd: '2026-09-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-09-28T18:00:00Z',
  },
  {
    id: 'task-001-1', projectId: 'proj-mes-001', name: '현행 시스템 분석', description: '기존 MES 시스템의 기능 및 데이터 흐름 분석',
    level: 2, parentId: 'task-001', orderIndex: 1, assigneeId: 'member-006', weight: 5,
    planStart: '2026-07-01', planEnd: '2026-07-31', planProgress: 100,
    actualStart: '2026-07-01', actualEnd: '2026-07-30', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-07-30T18:00:00Z',
  },
  {
    id: 'task-001-2', projectId: 'proj-mes-001', name: '요구사항 수집', description: '현업 인터뷰 및 요구사항 문서화',
    level: 2, parentId: 'task-001', orderIndex: 2, assigneeId: 'member-006', weight: 5,
    planStart: '2026-08-01', planEnd: '2026-08-31', planProgress: 100,
    actualStart: '2026-08-01', actualEnd: '2026-08-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-08-28T18:00:00Z',
  },
  {
    id: 'task-001-3', projectId: 'proj-mes-001', name: 'As-Is/To-Be 분석', description: '현행/목표 시스템 Gap 분석',
    level: 2, parentId: 'task-001', orderIndex: 3, assigneeId: 'member-006', weight: 5,
    planStart: '2026-09-01', planEnd: '2026-09-30', planProgress: 100,
    actualStart: '2026-09-01', actualEnd: '2026-09-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-09-28T18:00:00Z',
  },

  // ========== 2. 설계 단계 ==========
  {
    id: 'task-002', projectId: 'proj-mes-001', name: '설계', description: '시스템 아키텍처 및 상세 설계',
    level: 1, parentId: null, orderIndex: 2, assigneeId: 'member-002', weight: 20,
    planStart: '2026-09-15', planEnd: '2026-12-31', planProgress: 100,
    actualStart: '2026-09-15', actualEnd: '2026-12-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-12-28T18:00:00Z',
  },
  {
    id: 'task-002-1', projectId: 'proj-mes-001', name: '시스템 아키텍처 설계', description: '전체 시스템 구조 및 기술 스택 정의',
    level: 2, parentId: 'task-002', orderIndex: 1, assigneeId: 'member-002', weight: 5,
    planStart: '2026-09-15', planEnd: '2026-10-15', planProgress: 100,
    actualStart: '2026-09-15', actualEnd: '2026-10-14', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-10-14T18:00:00Z',
  },
  {
    id: 'task-002-2', projectId: 'proj-mes-001', name: '데이터베이스 설계', description: 'ERD 및 데이터 모델링',
    level: 2, parentId: 'task-002', orderIndex: 2, assigneeId: 'member-002', weight: 5,
    planStart: '2026-10-16', planEnd: '2026-11-15', planProgress: 100,
    actualStart: '2026-10-16', actualEnd: '2026-11-13', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-11-13T18:00:00Z',
  },
  {
    id: 'task-002-3', projectId: 'proj-mes-001', name: 'UI/UX 설계', description: '사용자 인터페이스 및 경험 설계',
    level: 2, parentId: 'task-002', orderIndex: 3, assigneeId: 'member-006', weight: 5,
    planStart: '2026-11-01', planEnd: '2026-11-30', planProgress: 100,
    actualStart: '2026-11-01', actualEnd: '2026-11-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-11-28T18:00:00Z',
  },
  {
    id: 'task-002-4', projectId: 'proj-mes-001', name: '인터페이스 설계', description: '외부 시스템 연동 인터페이스 정의',
    level: 2, parentId: 'task-002', orderIndex: 4, assigneeId: 'member-002', weight: 5,
    planStart: '2026-12-01', planEnd: '2026-12-31', planProgress: 100,
    actualStart: '2026-12-01', actualEnd: '2026-12-28', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-12-28T18:00:00Z',
  },

  // ========== 3. 개발 단계 ==========
  {
    id: 'task-003', projectId: 'proj-mes-001', name: '개발', description: '시스템 개발 및 구현',
    level: 1, parentId: null, orderIndex: 3, assigneeId: 'member-002', weight: 40,
    planStart: '2026-12-15', planEnd: '2027-04-30', planProgress: 100,
    actualStart: '2026-12-15', actualEnd: null, actualProgress: 75,
    status: 'in_progress', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-003-1', projectId: 'proj-mes-001', name: '공통 모듈 개발', description: '인증, 권한, 로깅 등 공통 기능 개발',
    level: 2, parentId: 'task-003', orderIndex: 1, assigneeId: 'member-003', weight: 8,
    planStart: '2026-12-15', planEnd: '2027-01-15', planProgress: 100,
    actualStart: '2026-12-15', actualEnd: '2027-01-14', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-01-14T18:00:00Z',
  },
  {
    id: 'task-003-2', projectId: 'proj-mes-001', name: '생산관리 모듈', description: '작업지시, 생산실적, 공정관리 기능',
    level: 2, parentId: 'task-003', orderIndex: 2, assigneeId: 'member-003', weight: 10,
    planStart: '2027-01-15', planEnd: '2027-02-28', planProgress: 100,
    actualStart: '2027-01-15', actualEnd: '2027-02-26', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-02-26T18:00:00Z',
  },
  {
    id: 'task-003-2-1', projectId: 'proj-mes-001', name: '작업지시 관리', description: '작업지시 생성, 수정, 조회 기능',
    level: 3, parentId: 'task-003-2', orderIndex: 1, assigneeId: 'member-003', weight: 3,
    planStart: '2027-01-15', planEnd: '2027-01-31', planProgress: 100,
    actualStart: '2027-01-15', actualEnd: '2027-01-30', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-01-30T18:00:00Z',
  },
  {
    id: 'task-003-2-2', projectId: 'proj-mes-001', name: '생산실적 관리', description: '생산실적 입력, 조회, 통계',
    level: 3, parentId: 'task-003-2', orderIndex: 2, assigneeId: 'member-003', weight: 4,
    planStart: '2027-02-01', planEnd: '2027-02-15', planProgress: 100,
    actualStart: '2027-02-01', actualEnd: '2027-02-14', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-02-14T18:00:00Z',
  },
  {
    id: 'task-003-2-3', projectId: 'proj-mes-001', name: '공정관리', description: '공정 정의, 라우팅 관리',
    level: 3, parentId: 'task-003-2', orderIndex: 3, assigneeId: 'member-003', weight: 3,
    planStart: '2027-02-16', planEnd: '2027-02-28', planProgress: 100,
    actualStart: '2027-02-16', actualEnd: '2027-02-26', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-02-26T18:00:00Z',
  },
  {
    id: 'task-003-3', projectId: 'proj-mes-001', name: '품질관리 모듈', description: '검사관리, 불량관리, SPC',
    level: 2, parentId: 'task-003', orderIndex: 3, assigneeId: 'member-004', weight: 8,
    planStart: '2027-02-01', planEnd: '2027-03-15', planProgress: 100,
    actualStart: '2027-02-01', actualEnd: null, actualProgress: 80,
    status: 'in_progress', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-003-3-1', projectId: 'proj-mes-001', name: '검사관리', description: '수입검사, 공정검사, 출하검사',
    level: 3, parentId: 'task-003-3', orderIndex: 1, assigneeId: 'member-004', weight: 3,
    planStart: '2027-02-01', planEnd: '2027-02-20', planProgress: 100,
    actualStart: '2027-02-01', actualEnd: '2027-02-19', actualProgress: 100,
    status: 'completed', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-02-19T18:00:00Z',
  },
  {
    id: 'task-003-3-2', projectId: 'proj-mes-001', name: '불량관리', description: '불량유형 관리, 불량분석',
    level: 3, parentId: 'task-003-3', orderIndex: 2, assigneeId: 'member-004', weight: 3,
    planStart: '2027-02-21', planEnd: '2027-03-07', planProgress: 100,
    actualStart: '2027-02-21', actualEnd: null, actualProgress: 70,
    status: 'in_progress', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-003-3-3', projectId: 'proj-mes-001', name: 'SPC 관리', description: '통계적 공정관리 기능',
    level: 3, parentId: 'task-003-3', orderIndex: 3, assigneeId: 'member-004', weight: 2,
    planStart: '2027-03-08', planEnd: '2027-03-15', planProgress: 50,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-003-4', projectId: 'proj-mes-001', name: '설비관리 모듈', description: '설비정보, 가동현황, 예방보전',
    level: 2, parentId: 'task-003', orderIndex: 4, assigneeId: 'member-004', weight: 7,
    planStart: '2027-03-01', planEnd: '2027-04-15', planProgress: 40,
    actualStart: '2027-03-01', actualEnd: null, actualProgress: 30,
    status: 'in_progress', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-003-5', projectId: 'proj-mes-001', name: '재고관리 모듈', description: '입출고, 재고현황, 재고이동',
    level: 2, parentId: 'task-003', orderIndex: 5, assigneeId: 'member-003', weight: 7,
    planStart: '2027-03-15', planEnd: '2027-04-30', planProgress: 20,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },

  // ========== 4. 테스트 단계 ==========
  {
    id: 'task-004', projectId: 'proj-mes-001', name: '테스트', description: '시스템 테스트 및 검증',
    level: 1, parentId: null, orderIndex: 4, assigneeId: 'member-005', weight: 15,
    planStart: '2027-04-01', planEnd: '2027-05-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-004-1', projectId: 'proj-mes-001', name: '단위 테스트', description: '모듈별 단위 테스트',
    level: 2, parentId: 'task-004', orderIndex: 1, assigneeId: 'member-005', weight: 3,
    planStart: '2027-04-01', planEnd: '2027-04-15', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-004-2', projectId: 'proj-mes-001', name: '통합 테스트', description: '시스템 통합 테스트',
    level: 2, parentId: 'task-004', orderIndex: 2, assigneeId: 'member-005', weight: 5,
    planStart: '2027-04-16', planEnd: '2027-05-07', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-004-3', projectId: 'proj-mes-001', name: '성능 테스트', description: '부하 테스트 및 성능 최적화',
    level: 2, parentId: 'task-004', orderIndex: 3, assigneeId: 'member-005', weight: 4,
    planStart: '2027-05-08', planEnd: '2027-05-21', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-004-4', projectId: 'proj-mes-001', name: '사용자 테스트(UAT)', description: '현업 사용자 인수 테스트',
    level: 2, parentId: 'task-004', orderIndex: 4, assigneeId: 'member-006', weight: 3,
    planStart: '2027-05-22', planEnd: '2027-05-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },

  // ========== 5. 배포 및 안정화 ==========
  {
    id: 'task-005', projectId: 'proj-mes-001', name: '배포 및 안정화', description: '시스템 배포 및 안정화 지원',
    level: 1, parentId: null, orderIndex: 5, assigneeId: 'member-001', weight: 10,
    planStart: '2027-05-15', planEnd: '2027-06-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-005-1', projectId: 'proj-mes-001', name: '데이터 마이그레이션', description: '기존 시스템 데이터 이관',
    level: 2, parentId: 'task-005', orderIndex: 1, assigneeId: 'member-002', weight: 3,
    planStart: '2027-05-15', planEnd: '2027-05-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-005-2', projectId: 'proj-mes-001', name: '시스템 배포', description: '운영 환경 배포 및 설정',
    level: 2, parentId: 'task-005', orderIndex: 2, assigneeId: 'member-003', weight: 2,
    planStart: '2027-06-01', planEnd: '2027-06-07', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-005-3', projectId: 'proj-mes-001', name: '사용자 교육', description: '시스템 사용 교육 및 매뉴얼 배포',
    level: 2, parentId: 'task-005', orderIndex: 3, assigneeId: 'member-006', weight: 2,
    planStart: '2027-06-08', planEnd: '2027-06-15', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
  {
    id: 'task-005-4', projectId: 'proj-mes-001', name: '안정화 지원', description: '운영 초기 안정화 및 이슈 대응',
    level: 2, parentId: 'task-005', orderIndex: 4, assigneeId: 'member-004', weight: 3,
    planStart: '2027-06-16', planEnd: '2027-06-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2027-03-18T18:00:00Z',
  },
];

// ============================================================
// 프로젝트 4: 동국씨엠 전사 재구축 프로젝트
// ============================================================
const dkCmErpProject: Project = {
  id: 'proj-dkcm-erp-001',
  name: '동국씨엠 전사 재구축 프로젝트',
  description: '동국씨엠 전사 시스템(ERP, SCM, HR, 그룹웨어) 통합 재구축 프로젝트',
  startDate: '2026-04-01',
  endDate: '2027-03-31',
  status: 'active',
  ownerId: 'user-001',
  createdAt: '2026-03-15T09:00:00Z',
  updatedAt: '2026-03-19T09:00:00Z',
};

const dkCmErpMembers: ProjectMember[] = [
  { id: 'erp-member-001', projectId: 'proj-dkcm-erp-001', userId: 'user-001', name: '김철수', role: 'owner', createdAt: '2026-03-15T09:00:00Z' },
  { id: 'erp-member-002', projectId: 'proj-dkcm-erp-001', userId: 'user-002', name: '이영희', role: 'admin', createdAt: '2026-03-15T09:00:00Z' },
  { id: 'erp-member-003', projectId: 'proj-dkcm-erp-001', userId: 'user-010', name: '오정민', role: 'member', createdAt: '2026-03-20T09:00:00Z' },
  { id: 'erp-member-004', projectId: 'proj-dkcm-erp-001', userId: 'user-011', name: '배수진', role: 'member', createdAt: '2026-03-20T09:00:00Z' },
  { id: 'erp-member-005', projectId: 'proj-dkcm-erp-001', userId: 'user-012', name: '임도현', role: 'member', createdAt: '2026-03-20T09:00:00Z' },
  { id: 'erp-member-006', projectId: 'proj-dkcm-erp-001', userId: 'user-013', name: '조은비', role: 'member', createdAt: '2026-03-25T09:00:00Z' },
  { id: 'erp-member-007', projectId: 'proj-dkcm-erp-001', userId: 'user-003', name: '박민수', role: 'member', createdAt: '2026-03-25T09:00:00Z' },
];

const dkCmErpTasks: Task[] = [
  // Phase 1: ISP (정보화전략계획)
  {
    id: 'erp-t-001', projectId: 'proj-dkcm-erp-001', name: 'ISP (정보화전략계획)', description: '전사 정보화 전략 수립 및 범위 확정',
    level: 1, parentId: null, orderIndex: 1, assigneeId: 'erp-member-001', weight: 15,
    planStart: '2026-04-01', planEnd: '2026-06-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-001-1', projectId: 'proj-dkcm-erp-001', name: '현행 시스템 진단', description: '전사 IT 시스템 현황 진단 및 문제점 분석',
    level: 2, parentId: 'erp-t-001', orderIndex: 1, assigneeId: 'erp-member-003', weight: 5,
    planStart: '2026-04-01', planEnd: '2026-04-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-001-2', projectId: 'proj-dkcm-erp-001', name: '목표 아키텍처 수립', description: '전사 목표 IT 아키텍처 및 솔루션 선정',
    level: 2, parentId: 'erp-t-001', orderIndex: 2, assigneeId: 'erp-member-002', weight: 5,
    planStart: '2026-05-01', planEnd: '2026-05-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-001-3', projectId: 'proj-dkcm-erp-001', name: '실행 로드맵 수립', description: '단계별 구축 계획 및 투자 계획 수립',
    level: 2, parentId: 'erp-t-001', orderIndex: 3, assigneeId: 'erp-member-001', weight: 5,
    planStart: '2026-06-01', planEnd: '2026-06-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },

  // Phase 2: ERP 구축
  {
    id: 'erp-t-002', projectId: 'proj-dkcm-erp-001', name: 'ERP 구축', description: '재무/회계, 구매, 영업, 생산 ERP 모듈 구축',
    level: 1, parentId: null, orderIndex: 2, assigneeId: 'erp-member-002', weight: 30,
    planStart: '2026-07-01', planEnd: '2026-12-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-002-1', projectId: 'proj-dkcm-erp-001', name: '재무/회계 모듈', description: 'GL, AP, AR, 원가 등 재무회계 시스템',
    level: 2, parentId: 'erp-t-002', orderIndex: 1, assigneeId: 'erp-member-003', weight: 8,
    planStart: '2026-07-01', planEnd: '2026-08-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-002-2', projectId: 'proj-dkcm-erp-001', name: '구매/자재 모듈', description: '구매 발주, 입고, 자재 관리',
    level: 2, parentId: 'erp-t-002', orderIndex: 2, assigneeId: 'erp-member-004', weight: 7,
    planStart: '2026-08-01', planEnd: '2026-09-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-002-3', projectId: 'proj-dkcm-erp-001', name: '영업/물류 모듈', description: '수주, 출하, 매출 관리',
    level: 2, parentId: 'erp-t-002', orderIndex: 3, assigneeId: 'erp-member-005', weight: 7,
    planStart: '2026-09-01', planEnd: '2026-10-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-002-4', projectId: 'proj-dkcm-erp-001', name: '생산관리 모듈', description: '생산계획, 작업지시, 실적 관리',
    level: 2, parentId: 'erp-t-002', orderIndex: 4, assigneeId: 'erp-member-007', weight: 8,
    planStart: '2026-10-01', planEnd: '2026-12-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },

  // Phase 3: SCM/HR/그룹웨어 구축
  {
    id: 'erp-t-003', projectId: 'proj-dkcm-erp-001', name: 'SCM/HR/그룹웨어', description: 'SCM, 인사/급여, 그룹웨어 시스템 구축',
    level: 1, parentId: null, orderIndex: 3, assigneeId: 'erp-member-002', weight: 25,
    planStart: '2026-10-01', planEnd: '2027-01-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-003-1', projectId: 'proj-dkcm-erp-001', name: 'SCM 구축', description: '공급망 관리, 협력사 포탈',
    level: 2, parentId: 'erp-t-003', orderIndex: 1, assigneeId: 'erp-member-005', weight: 10,
    planStart: '2026-10-01', planEnd: '2026-11-30', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-003-2', projectId: 'proj-dkcm-erp-001', name: 'HR/급여 시스템', description: '인사관리, 급여, 근태 시스템',
    level: 2, parentId: 'erp-t-003', orderIndex: 2, assigneeId: 'erp-member-006', weight: 8,
    planStart: '2026-11-01', planEnd: '2026-12-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-003-3', projectId: 'proj-dkcm-erp-001', name: '그룹웨어/전자결재', description: '전자결재, 게시판, 일정 관리',
    level: 2, parentId: 'erp-t-003', orderIndex: 3, assigneeId: 'erp-member-004', weight: 7,
    planStart: '2026-12-01', planEnd: '2027-01-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },

  // Phase 4: 통합 테스트 및 오픈
  {
    id: 'erp-t-004', projectId: 'proj-dkcm-erp-001', name: '통합 테스트 및 오픈', description: '전사 시스템 통합 테스트, 데이터 이관, Go-Live',
    level: 1, parentId: null, orderIndex: 4, assigneeId: 'erp-member-001', weight: 30,
    planStart: '2027-01-15', planEnd: '2027-03-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-004-1', projectId: 'proj-dkcm-erp-001', name: '통합 테스트', description: '전사 시스템 End-to-End 통합 테스트',
    level: 2, parentId: 'erp-t-004', orderIndex: 1, assigneeId: 'erp-member-003', weight: 8,
    planStart: '2027-01-15', planEnd: '2027-02-15', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-004-2', projectId: 'proj-dkcm-erp-001', name: '데이터 이관', description: '레거시 시스템 데이터 마이그레이션',
    level: 2, parentId: 'erp-t-004', orderIndex: 2, assigneeId: 'erp-member-007', weight: 7,
    planStart: '2027-02-01', planEnd: '2027-02-28', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-004-3', projectId: 'proj-dkcm-erp-001', name: '사용자 교육', description: '부서별 시스템 교육 및 매뉴얼 배포',
    level: 2, parentId: 'erp-t-004', orderIndex: 3, assigneeId: 'erp-member-006', weight: 5,
    planStart: '2027-02-15', planEnd: '2027-03-07', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
  {
    id: 'erp-t-004-4', projectId: 'proj-dkcm-erp-001', name: 'Go-Live 및 안정화', description: '시스템 오픈 및 1개월 안정화 지원',
    level: 2, parentId: 'erp-t-004', orderIndex: 4, assigneeId: 'erp-member-002', weight: 10,
    planStart: '2027-03-01', planEnd: '2027-03-31', planProgress: 0,
    actualStart: null, actualEnd: null, actualProgress: 0,
    status: 'pending', isExpanded: true, createdAt: '2026-03-15T09:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
];

// ============================================================
// 통합 Export
// ============================================================

export interface SampleWorkspace {
  project: Project;
  members: ProjectMember[];
  tasks: Task[];
}

// 기존 export 유지 (하위 호환)
export const sampleProject = kgSteelMesProject;
export const sampleMembers = kgSteelMesMembers;
export const sampleTasks = kgSteelMesTasks;

// 전체 샘플 프로젝트 목록
export const sampleWorkspaces: SampleWorkspace[] = [
  { project: smartMeteringProject, members: smartMeteringMembers, tasks: smartMeteringTasks },
  { project: dkCmPiProject, members: dkCmPiMembers, tasks: dkCmPiTasks },
  { project: kgSteelMesProject, members: kgSteelMesMembers, tasks: kgSteelMesTasks },
  { project: dkCmErpProject, members: dkCmErpMembers, tasks: dkCmErpTasks },
];
