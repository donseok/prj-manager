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
    taskCount: 40,
    nodes: [
      {
        name: '분석',
        children: [
          {
            name: '현황 분석',
            children: [
              {
                name: '현행 공정·설비 현황 조사',
                output: 'AS-IS 분석 보고서',
                children: [
                  { name: '현장 방문 및 데이터 수집', output: '현장 조사 자료', durationDays: 3 },
                  { name: 'AS-IS 분석 보고서 작성', output: 'AS-IS 분석 보고서', durationDays: 2 },
                ],
              },
              {
                name: '개선 요구사항 도출',
                output: '요구사항 정의서',
                children: [
                  { name: '관계자 인터뷰 및 요구사항 수집', output: '인터뷰 결과', durationDays: 2 },
                  { name: '요구사항 정의서 작성', output: '요구사항 정의서', durationDays: 1 },
                ],
              },
            ],
          },
          {
            name: '타당성 검토',
            children: [
              {
                name: '투자 타당성 분석',
                output: '투자 검토 보고서',
                children: [
                  { name: '비용 산정 및 ROI 분석', output: 'ROI 분석 자료', durationDays: 2 },
                  { name: '투자 검토 보고서 작성', output: '투자 검토 보고서', durationDays: 1 },
                ],
              },
              {
                name: '목표 사양 수립',
                output: '목표 사양서',
                children: [
                  { name: '벤치마크 및 기준 사양 조사', output: '벤치마크 자료', durationDays: 1 },
                  { name: '목표 사양서 작성', output: '목표 사양서', durationDays: 1 },
                ],
              },
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
              {
                name: '공정 흐름도(PFD) 작성',
                output: 'PFD',
                children: [
                  { name: '공정 조건 정리', output: '공정 조건표', durationDays: 2 },
                  { name: 'PFD 도면 작성 및 검토', output: 'PFD 도면', durationDays: 3 },
                ],
              },
              {
                name: '설비 사양 확정',
                output: '설비 사양서',
                children: [
                  { name: '벤더 사양 비교 분석', output: '벤더 비교표', durationDays: 2 },
                  { name: '설비 사양서 확정', output: '설비 사양서', durationDays: 2 },
                ],
              },
              {
                name: '배치도(Layout) 작성',
                output: '배치도',
                children: [
                  { name: '현장 실측 및 제약 조건 확인', output: '실측 자료', durationDays: 1 },
                  { name: '배치도 작성 및 승인', output: '배치도', durationDays: 2 },
                ],
              },
            ],
          },
          {
            name: '상세 설계',
            children: [
              {
                name: '계장·전기 설계',
                output: '계장/전기 도면',
                children: [
                  { name: '계장 루프 다이어그램 작성', output: '루프 다이어그램', durationDays: 3 },
                  { name: '전기 단선도 작성', output: '전기 단선도', durationDays: 2 },
                ],
              },
              {
                name: '제어 로직 설계',
                output: '제어 사양서',
                children: [
                  { name: '제어 시퀀스 정의', output: '시퀀스 다이어그램', durationDays: 2 },
                  { name: '제어 사양서 작성', output: '제어 사양서', durationDays: 2 },
                ],
              },
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
              {
                name: '기자재 발주·제작 감리',
                output: '제작 검사 성적서',
                children: [
                  { name: '기자재 발주 및 제작 감리', output: '제작 진도 보고서', durationDays: 5 },
                  { name: '출하 전 검사(FAT) 실시', output: 'FAT 성적서', durationDays: 5 },
                ],
              },
              {
                name: '부대 자재 구매',
                output: '자재 입고 대장',
                children: [
                  { name: '자재 목록 작성 및 견적', output: '자재 견적서', durationDays: 2 },
                  { name: '자재 입고 확인', output: '자재 입고 대장', durationDays: 3 },
                ],
              },
            ],
          },
          {
            name: '시공·설치',
            children: [
              {
                name: '설비 반입·설치',
                output: '설치 완료 보고서',
                children: [
                  { name: '설비 반입 및 거치', output: '반입 기록', durationDays: 7 },
                  { name: '설치 완료 검사', output: '설치 완료 보고서', durationDays: 5 },
                ],
              },
              {
                name: '전기·계장 시공',
                output: '결선 체크시트',
                children: [
                  { name: '케이블 포설 및 결선', output: '결선 체크시트', durationDays: 5 },
                  { name: '절연 및 루프 테스트', output: '루프 테스트 성적서', durationDays: 3 },
                ],
              },
              {
                name: 'PLC·HMI 프로그램 개발',
                output: '제어 프로그램',
                children: [
                  { name: 'PLC 로직 코딩', output: 'PLC 프로그램', durationDays: 4 },
                  { name: 'HMI 화면 개발', output: 'HMI 화면', durationDays: 2 },
                ],
              },
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
              {
                name: '단위 기능 테스트',
                output: '단위 테스트 성적서',
                children: [
                  { name: '개별 설비 동작 확인', output: '동작 확인 기록', durationDays: 3 },
                  { name: '단위 테스트 성적서 작성', output: '단위 테스트 성적서', durationDays: 2 },
                ],
              },
              {
                name: '통합 연동 테스트',
                output: '통합 테스트 성적서',
                children: [
                  { name: '공정간 연동 시험', output: '연동 시험 기록', durationDays: 4 },
                  { name: '통합 테스트 성적서 작성', output: '통합 테스트 성적서', durationDays: 3 },
                ],
              },
              {
                name: '부하·성능 테스트',
                output: '성능 테스트 보고서',
                children: [
                  { name: '부하 운전 실시', output: '부하 운전 기록', durationDays: 3 },
                  { name: '성능 데이터 분석 및 보고서', output: '성능 테스트 보고서', durationDays: 2 },
                ],
              },
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
              {
                name: '성능 보증 시험(PAT)',
                output: 'PAT 성적서',
                children: [
                  { name: '보증 조건 운전 실시', output: '운전 기록', durationDays: 3 },
                  { name: 'PAT 성적서 작성', output: 'PAT 성적서', durationDays: 2 },
                ],
              },
              {
                name: '운전 매뉴얼·교육',
                output: '운전 매뉴얼',
                children: [
                  { name: '운전 매뉴얼 작성', output: '운전 매뉴얼', durationDays: 2 },
                  { name: '운전원 교육 실시', output: '교육 수료 기록', durationDays: 1 },
                ],
              },
              {
                name: '준공 검사·인수인계',
                output: '준공 보고서',
                children: [
                  { name: '준공 서류 정리', output: '준공 서류', durationDays: 1 },
                  { name: '인수인계 및 준공 승인', output: '준공 보고서', durationDays: 1 },
                ],
              },
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
    taskCount: 22,
    nodes: [
      {
        name: '기획·분석',
        children: [
          {
            name: '요구사항 분석',
            children: [
              {
                name: '이해관계자 인터뷰',
                output: '요구사항 정리',
                children: [
                  { name: '인터뷰 일정 수립 및 진행', output: '인터뷰 기록', durationDays: 1 },
                  { name: '요구사항 정리 및 우선순위화', output: '요구사항 정리', durationDays: 1 },
                ],
              },
              {
                name: '범위 합의',
                output: '범위 기준선',
                children: [
                  { name: '범위 기준선 문서 작성', output: '범위 기준선 초안', durationDays: 1 },
                  { name: '이해관계자 승인', output: '범위 기준선', durationDays: 1 },
                ],
              },
            ],
          },
          {
            name: '정보 구조',
            children: [
              {
                name: 'IA·사이트맵 설계',
                output: '사이트맵',
                children: [
                  { name: '메뉴 구조 설계', output: '메뉴 구조안', durationDays: 1 },
                  { name: '사이트맵 문서 작성', output: '사이트맵', durationDays: 1 },
                ],
              },
              {
                name: '콘텐츠 인벤토리',
                output: '콘텐츠 매트릭스',
                children: [
                  { name: '기존 콘텐츠 수집 및 분류', output: '콘텐츠 목록', durationDays: 1 },
                  { name: '콘텐츠 매트릭스 작성', output: '콘텐츠 매트릭스', durationDays: 1 },
                ],
              },
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
              {
                name: '와이어프레임 작성',
                output: '와이어프레임',
                children: [
                  { name: '주요 화면 와이어프레임 설계', output: '와이어프레임 초안', durationDays: 2 },
                  { name: '와이어프레임 리뷰 및 수정', output: '와이어프레임', durationDays: 1 },
                ],
              },
              {
                name: '시각 디자인',
                output: '디자인 시스템',
                children: [
                  { name: '디자인 시스템 구성', output: '디자인 토큰·컴포넌트', durationDays: 2 },
                  { name: '주요 페이지 시각 디자인', output: '페이지 디자인 시안', durationDays: 2 },
                ],
              },
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
              {
                name: '프론트엔드 개발',
                output: '반응형 화면',
                children: [
                  { name: '컴포넌트 개발', output: 'UI 컴포넌트', durationDays: 3 },
                  { name: '반응형 레이아웃 구현', output: '반응형 화면', durationDays: 3 },
                ],
              },
              {
                name: 'CMS·API 연동',
                output: '통합 빌드',
                children: [
                  { name: 'CMS 설정 및 구성', output: 'CMS 구성', durationDays: 2 },
                  { name: 'API 연동 및 데이터 바인딩', output: '통합 빌드', durationDays: 2 },
                ],
              },
            ],
          },
          {
            name: '품질 관리',
            children: [
              {
                name: 'QA 및 버그 수정',
                output: 'QA 보고서',
                children: [
                  { name: '기능 테스트 수행', output: '테스트 결과', durationDays: 2 },
                  { name: '버그 수정 및 재검증', output: 'QA 보고서', durationDays: 2 },
                ],
              },
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
              {
                name: '운영 환경 배포',
                output: '릴리스 노트',
                children: [
                  { name: '배포 체크리스트 점검', output: '배포 체크리스트', durationDays: 1 },
                  { name: '운영 환경 배포 실행', output: '릴리스 노트', durationDays: 1 },
                ],
              },
              {
                name: '안정화 모니터링',
                output: '안정화 로그',
                children: [
                  { name: '오픈 후 모니터링', output: '모니터링 로그', durationDays: 2 },
                  { name: '이슈 대응 및 안정화', output: '안정화 로그', durationDays: 1 },
                ],
              },
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
    taskCount: 24,
    nodes: [
      {
        name: '기획',
        children: [
          {
            name: '정의',
            children: [
              {
                name: '유저 스토리 매핑',
                output: '스토리 맵',
                children: [
                  { name: '사용자 시나리오 정의', output: '시나리오 목록', durationDays: 2 },
                  { name: '스토리 맵 작성', output: '스토리 맵', durationDays: 1 },
                ],
              },
              {
                name: '릴리스 범위 확정',
                output: 'MVP 범위',
                children: [
                  { name: 'MVP 기능 선정', output: 'MVP 기능 목록', durationDays: 1 },
                  { name: '릴리스 계획 수립', output: '릴리스 계획서', durationDays: 1 },
                ],
              },
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
              {
                name: 'UX 플로우 설계',
                output: '사용자 흐름도',
                children: [
                  { name: '사용자 흐름도 작성', output: '흐름도', durationDays: 2 },
                  { name: '프로토타입 제작', output: '프로토타입', durationDays: 1 },
                ],
              },
              {
                name: '고해상도 UI 디자인',
                output: 'UI 화면',
                children: [
                  { name: 'UI 스타일 가이드 작성', output: '스타일 가이드', durationDays: 2 },
                  { name: '주요 화면 디자인', output: 'UI 화면', durationDays: 2 },
                ],
              },
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
              {
                name: '앱 기본 구조 셋업',
                output: '기본 앱',
                children: [
                  { name: '프로젝트 초기화 및 환경설정', output: '프로젝트 설정', durationDays: 1 },
                  { name: '네비게이션 구조 구현', output: '네비게이션 코드', durationDays: 2 },
                ],
              },
              {
                name: '핵심 기능 구현',
                output: '코어 기능',
                children: [
                  { name: '주요 화면 개발', output: '화면 코드', durationDays: 4 },
                  { name: '비즈니스 로직 구현', output: '비즈니스 로직', durationDays: 4 },
                ],
              },
            ],
          },
          {
            name: '백엔드',
            children: [
              {
                name: 'API 연동',
                output: '연동 완료 엔드포인트',
                children: [
                  { name: 'API 클라이언트 구성', output: 'API 클라이언트', durationDays: 2 },
                  { name: '데이터 연동 및 검증', output: '연동 검증 결과', durationDays: 2 },
                ],
              },
              {
                name: '푸시·인증 설정',
                output: '서비스 통합',
                children: [
                  { name: '인증 모듈 구현', output: '인증 모듈', durationDays: 2 },
                  { name: '푸시 알림 설정', output: '푸시 설정', durationDays: 1 },
                ],
              },
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
              {
                name: '기능 QA',
                output: 'QA 체크리스트',
                children: [
                  { name: '기능별 테스트 수행', output: '테스트 결과', durationDays: 2 },
                  { name: '버그 수정 및 재검증', output: 'QA 보고서', durationDays: 2 },
                ],
              },
              {
                name: '스토어 심사 준비',
                output: '제출 패키지',
                children: [
                  { name: '스크린샷 및 설명 작성', output: '스토어 등록 자료', durationDays: 1 },
                  { name: '제출 패키지 구성', output: '제출 패키지', durationDays: 1 },
                ],
              },
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
              {
                name: '스토어 제출',
                output: '앱 게시 완료',
                children: [
                  { name: '앱 빌드 및 서명', output: '빌드 파일', durationDays: 1 },
                  { name: '스토어 등록 및 제출', output: '앱 게시 완료', durationDays: 1 },
                ],
              },
              {
                name: '출시 후 모니터링',
                output: '모니터링 로그',
                children: [
                  { name: '크래시 모니터링', output: '크래시 리포트', durationDays: 2 },
                  { name: '사용자 피드백 수집', output: '피드백 정리', durationDays: 1 },
                ],
              },
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
    taskCount: 24,
    nodes: [
      {
        name: '착수',
        children: [
          {
            name: '업무 분석',
            children: [
              {
                name: '현행 프로세스 분석',
                output: 'AS-IS 문서',
                children: [
                  { name: '업무 흐름 인터뷰', output: '인터뷰 기록', durationDays: 2 },
                  { name: 'AS-IS 프로세스 문서화', output: 'AS-IS 문서', durationDays: 1 },
                ],
              },
              {
                name: '목표 워크플로우 설계',
                output: 'TO-BE 워크플로우',
                children: [
                  { name: 'TO-BE 프로세스 설계', output: 'TO-BE 설계안', durationDays: 2 },
                  { name: '워크플로우 검토 및 승인', output: 'TO-BE 워크플로우', durationDays: 1 },
                ],
              },
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
              {
                name: '기능 명세 작성',
                output: '기능 명세서',
                children: [
                  { name: '화면별 기능 정의', output: '화면 기능 목록', durationDays: 2 },
                  { name: '기능 명세서 작성', output: '기능 명세서', durationDays: 2 },
                ],
              },
              {
                name: '데이터 모델 검토',
                output: '엔티티 목록',
                children: [
                  { name: '엔티티 관계도(ERD) 작성', output: 'ERD', durationDays: 1 },
                  { name: '데이터 사전 정리', output: '데이터 사전', durationDays: 1 },
                ],
              },
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
              {
                name: '관리 화면 개발',
                output: 'CRUD 화면',
                children: [
                  { name: '목록·상세 CRUD 화면 개발', output: 'CRUD 화면', durationDays: 3 },
                  { name: '검색·필터 기능 구현', output: '검색 기능', durationDays: 3 },
                ],
              },
              {
                name: '권한 모델 구현',
                output: '역할 매트릭스',
                children: [
                  { name: '역할 기반 접근제어 구현', output: 'RBAC 코드', durationDays: 2 },
                  { name: '권한 매트릭스 검증', output: '역할 매트릭스', durationDays: 1 },
                ],
              },
              {
                name: '리포팅 기능',
                output: '대시보드·보고서',
                children: [
                  { name: '대시보드 화면 개발', output: '대시보드', durationDays: 2 },
                  { name: '보고서 출력 기능 구현', output: '보고서 기능', durationDays: 2 },
                ],
              },
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
              {
                name: '이관 리허설',
                output: '리허설 결과',
                children: [
                  { name: '이관 스크립트 작성', output: '이관 스크립트', durationDays: 1 },
                  { name: '리허설 실행 및 검증', output: '리허설 결과', durationDays: 1 },
                ],
              },
              {
                name: '운영 데이터 이관',
                output: '이관 로그',
                children: [
                  { name: '운영 데이터 이관 실행', output: '이관 실행 기록', durationDays: 1 },
                  { name: '이관 결과 검증', output: '이관 로그', durationDays: 1 },
                ],
              },
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
              {
                name: '사용자 교육',
                output: '교육 자료',
                children: [
                  { name: '교육 자료 준비', output: '교육 자료', durationDays: 1 },
                  { name: '교육 실시', output: '교육 수료 기록', durationDays: 1 },
                ],
              },
              {
                name: '안정화 지원',
                output: '지원 로그',
                children: [
                  { name: '이슈 대응 및 개선', output: '이슈 대응 기록', durationDays: 2 },
                  { name: '안정화 보고서 작성', output: '안정화 보고서', durationDays: 2 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export function listTaskTemplates(): TaskTemplateSummary[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        weight: isLeaf ? Math.round(100 / template.taskCount) : 0,
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
