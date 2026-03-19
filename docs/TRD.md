# TRD (Technical Requirements Document)
# DK Flow - 프로젝트 관리 시스템 기술 요구사항 정의서

**버전**: 2.0
**최종 수정일**: 2026-03-19

---

## 1. 기술 스택

### 1.1 프론트엔드
| 분류 | 기술 | 버전 | 선정 이유 |
|------|------|------|----------|
| 프레임워크 | React | 19.2 | 컴포넌트 기반, 최신 Concurrent 기능 |
| 빌드 도구 | Vite | 7.3 | 빠른 HMR, ESM 기반 |
| 언어 | TypeScript | 5.9 | 타입 안정성, 최신 데코레이터 |
| 스타일링 | Tailwind CSS | 4.2 | 유틸리티 퍼스트, JIT 컴파일 |
| 상태관리 | Zustand | 5.0 | 간단하고 가벼움, 미들웨어 지원 |
| 테이블 | TanStack Table | 8.21 | 강력한 테이블 기능, 헤드리스 |
| 간트차트 | 직접 구현 | - | 커스터마이징, 인라인 편집 연동 |
| 차트 | Recharts | 3.8 | 대시보드 차트 (파이, 바, 라인) |
| 날짜 | date-fns | 4.1 | 한국어 로케일, 트리쉐이킹 |
| 아이콘 | Lucide React | 0.577 | 모던 아이콘셋, 트리쉐이킹 |
| 라우팅 | React Router | 7.13 | SPA 네스티드 라우팅 |
| 엑셀 | ExcelJS | 4.4 | 서식/스타일 포함 엑셀 생성 |
| 문서 | docx | 9.6 | Word 보고서 생성 |
| 파일 저장 | file-saver | 2.0 | 브라우저 파일 다운로드 |
| UUID | uuid | 13.0 | 고유 ID 생성 |
| 폰트 | Pretendard Variable | - | 한글 최적화 가변 폰트 |

### 1.2 백엔드/데이터베이스
| 분류 | 기술 | 선정 이유 |
|------|------|----------|
| BaaS | Supabase (선택) | PostgreSQL, 실시간, 인증 통합 |
| 인증 | Supabase Auth | 이메일/패스워드 인증 |
| 폴백 저장소 | localStorage | Supabase 미설정 시 로컬 데이터 영속화 |

### 1.3 테스트
| 분류 | 기술 | 버전 | 용도 |
|------|------|------|------|
| E2E 테스트 | Playwright | 1.58 | 브라우저 기반 통합 테스트 |
| CI/CD | GitHub Actions | - | push/PR 시 자동 테스트 |

### 1.4 배포/인프라
| 분류 | 기술 | 선정 이유 |
|------|------|----------|
| 호스팅 | Vercel | SPA 호스팅, SPA 리라이트 |
| 도메인 | Vercel 기본 | 초기 비용 절감 |

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                      사용자 브라우저                       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Vercel (프론트엔드)                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React 19 SPA                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │  Pages   │ │Components│ │  Hooks   │        │   │
│  │  │ (9 pages)│ │(common/  │ │(autoSave │        │   │
│  │  │          │ │ layout/  │ │ feedback │        │   │
│  │  │          │ │ wbs/     │ │ status)  │        │   │
│  │  │          │ │ chatbot/)│ │          │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ Store    │ │   Lib    │ │  Types   │        │   │
│  │  │(5 stores)│ │(9 modules│ │          │        │   │
│  │  │          │ │ utils,   │ │          │        │   │
│  │  │          │ │ excel,   │ │          │        │   │
│  │  │          │ │ chatbot) │ │          │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘        │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────┬──────────────────┘
                       │              │
            ┌──────────┘              └──────────┐
            ▼                                    ▼
┌───────────────────────┐          ┌───────────────────────┐
│  Supabase (선택사항)    │          │  localStorage (폴백)   │
│  ┌─────────┐          │          │  ┌─────────────────┐  │
│  │  Auth   │          │          │  │ projects        │  │
│  └─────────┘          │          │  │ tasks           │  │
│  ┌─────────┐          │          │  │ members         │  │
│  │Database │          │          │  │ auth state      │  │
│  │(Postgre)│          │          │  │ theme           │  │
│  └─────────┘          │          │  └─────────────────┘  │
└───────────────────────┘          └───────────────────────┘
```

---

## 3. 데이터베이스 설계

### 3.1 ERD

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   projects   │     │   members    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ email        │◄────│ owner_id(FK) │     │ project_id   │
│ name         │     │ name         │     │ user_id      │
│ avatar_url   │     │ description  │     │ name         │
│ system_role  │     │ start_date   │     │ role         │
│ created_at   │     │ end_date     │     │ created_at   │
└──────────────┘     │ base_date    │     └──────────────┘
                     │ status       │            │
                     │ completed_at │            │
                     │ settings     │ (JSONB)    │
                     │ created_at   │            │
                     │ updated_at   │            │
                     └──────────────┘            │
                            │                    │
                            ▼                    │
                     ┌──────────────┐           │
                     │    tasks     │◄──────────┘
                     ├──────────────┤
                     │ id (PK)      │
                     │ project_id   │
                     │ parent_id    │ (자기참조)
                     │ level        │ (1~4)
                     │ order_index  │
                     │ name         │
                     │ description  │
                     │ output       │ (산출물)
                     │ assignee_id  │
                     │ weight       │
                     │ plan_start   │
                     │ plan_end     │
                     │ plan_progress│
                     │ actual_start │
                     │ actual_end   │
                     │ actual_progress│
                     │ status       │
                     │ created_at   │
                     │ updated_at   │
                     └──────────────┘
```

### 3.2 테이블 정의

#### users (Supabase Auth 사용)
```sql
-- Supabase Auth가 관리, 추가 프로필 정보만 저장
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name VARCHAR(100),
  avatar_url TEXT,
  system_role VARCHAR(20) DEFAULT 'user',  -- admin, user
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### projects
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  base_date DATE,                              -- 진척기준일
  status VARCHAR(20) DEFAULT 'preparing',      -- preparing, active, completed, deleted
  completed_at TIMESTAMP,
  settings JSONB DEFAULT '{}'::jsonb,          -- weekStartsOn, showWeekends, defaultView, statusMode, manualStatus
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### project_members
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(100),                           -- 비회원 담당자 이름
  role VARCHAR(20) DEFAULT 'member',           -- owner, admin, member, viewer
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);
```

#### tasks
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,            -- 1=Phase, 2=Activity, 3=Task, 4=Function
  order_index INTEGER NOT NULL DEFAULT 0,

  -- 기본 정보
  name VARCHAR(500) NOT NULL,
  description TEXT,
  output VARCHAR(500),                         -- 산출물

  -- 담당자
  assignee_id UUID REFERENCES project_members(id),

  -- 가중치/공정율
  weight DECIMAL(10,6) DEFAULT 0,

  -- 계획
  plan_start DATE,
  plan_end DATE,
  plan_progress DECIMAL(5,2) DEFAULT 0,        -- 0~100

  -- 실적
  actual_start DATE,
  actual_end DATE,
  actual_progress DECIMAL(5,2) DEFAULT 0,      -- 0~100

  -- 상태
  status VARCHAR(20) DEFAULT 'pending',        -- pending, in_progress, completed, on_hold

  -- 메타
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
```

### 3.3 RLS (Row Level Security) 정책
```sql
-- projects: 소유자 또는 멤버만 접근
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "프로젝트 접근" ON projects
  FOR ALL USING (
    owner_id = auth.uid() OR
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- tasks: 프로젝트 접근 권한 있으면 접근
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "태스크 접근" ON tasks
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE owner_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );
```

---

## 4. 프론트엔드 구조

### 4.1 디렉토리 구조
```
src/
├── App.tsx                    # 라우팅 정의 (ProtectedRoute, AdminRoute)
├── main.tsx                   # Vite 엔트리포인트
├── index.css                  # 글로벌 CSS 변수, 다크모드, 애니메이션
│
├── components/
│   ├── common/                # 공통 UI 컴포넌트
│   │   ├── Button.tsx         # 5종 변형 (primary, secondary, outline, ghost, danger)
│   │   ├── Modal.tsx          # 모달 다이얼로그
│   │   ├── ConfirmModal.tsx   # 확인/취소 다이얼로그
│   │   ├── FeedbackNotice.tsx # 토스트 알림 (success, error, info, warning)
│   │   └── DKFlowLogo.tsx     # 브랜드 로고
│   ├── layout/                # 레이아웃
│   │   ├── Layout.tsx         # 사이드바 포함 메인 레이아웃
│   │   ├── Header.tsx         # 상단 헤더 (로고, 테마 토글, 사용자 메뉴)
│   │   └── Sidebar.tsx        # 좌측 네비게이션 (프로젝트 스위처, 챗봇)
│   ├── wbs/
│   │   └── GanttChart.tsx     # 간트 차트 컴포넌트
│   └── chatbot/               # AI 챗봇 위젯
│       ├── ChatbotWidget.tsx  # 챗봇 UI
│       └── DKBotAvatar.tsx    # 챗봇 아바타
│
├── pages/                     # 페이지 컴포넌트
│   ├── Home.tsx               # 랜딩/홈 (최근 프로젝트, 히어로)
│   ├── Login.tsx              # 로그인 (Supabase / 로컬 테스트)
│   ├── ProjectList.tsx        # 프로젝트 목록 & CRUD
│   ├── Dashboard.tsx          # 프로젝트 대시보드 (통계, 차트)
│   ├── WBS.tsx                # WBS 계층 편집기
│   ├── Gantt.tsx              # 간트 차트 뷰
│   ├── Members.tsx            # 멤버 관리
│   ├── Settings.tsx           # 프로젝트 설정, 가져오기/내보내기
│   ├── UserManagement.tsx     # 시스템 사용자 관리 (관리자 전용)
│   └── UserManual.tsx         # 사용자 매뉴얼/도움말
│
├── store/                     # Zustand 상태 관리 (5개 스토어)
│   ├── projectStore.ts        # 프로젝트 목록, 현재 프로젝트, 멤버
│   ├── taskStore.ts           # 태스크 트리, Undo/Redo (50건)
│   ├── authStore.ts           # 인증 상태 (localStorage 영속화)
│   ├── themeStore.ts          # 테마 (Light/Dark/System)
│   └── uiStore.ts             # UI 상태
│
├── lib/                       # 비즈니스 로직 & 유틸리티
│   ├── utils.ts               # 날짜 포맷, 트리 조작, 스토리지 래퍼
│   ├── dataRepository.ts      # 데이터 계층 (Supabase 또는 localStorage)
│   ├── supabase.ts            # Supabase 클라이언트 (camelCase ↔ snake_case 변환)
│   ├── taskAnalytics.ts       # 대시보드 통계 계산 (리프 태스크 필터링)
│   ├── projectTaskSync.ts     # 태스크 계층 정규화, 프로젝트 상태 도출
│   ├── excel.ts               # ExcelJS 기반 WBS/간트 엑셀 내보내기
│   ├── exportReport.ts        # PDF/Word 보고서 생성
│   ├── projectVisuals.ts      # 프로젝트 테마/비주얼 메타데이터
│   └── chatbot.ts             # 챗봇 AI 엔진 (의도 스코어링, 퍼지 매칭)
│
├── hooks/                     # 커스텀 React 훅
│   ├── useAutoSave.ts         # 디바운스 자동 저장 (700ms)
│   ├── usePageFeedback.ts     # 피드백 알림 관리
│   └── useProjectStatus.ts    # 프로젝트 상태 변경 로직
│
├── types/
│   └── index.ts               # TypeScript 인터페이스 (User, Project, Task, ProjectMember 등)
│
├── data/
│   └── sampleData.ts          # 4개 샘플 프로젝트 데이터
│
└── assets/                    # 이미지, 아이콘
```

### 4.2 라우팅 구조

```
/login                         → Login.tsx (공개)
/                              → Home.tsx (인증 필요)
├── /projects                  → ProjectList.tsx
├── /projects/new              → ProjectList.tsx (모달)
├── /projects/:projectId       → Layout (중첩 라우트)
│   ├── / (index)              → Dashboard.tsx
│   ├── /wbs                   → WBS.tsx
│   ├── /gantt                 → Gantt.tsx
│   ├── /members               → Members.tsx
│   └── /settings              → Settings.tsx
├── /manual                    → UserManual.tsx
├── /admin/users               → UserManagement.tsx (관리자 전용)
└── /404                       → NotFound (404 페이지)
```

### 4.3 주요 컴포넌트 설계

#### WBS.tsx (783줄)
- 커스텀 테이블 구현 (12개 컬럼 인라인 편집)
- 드래그&드롭 행 정렬
- 계층 구조 접기/펼치기
- Undo/Redo 연동
- 자동 저장 (useAutoSave)

#### GanttChart.tsx
- 6/12/24주 타임라인 뷰
- 계획/실적 바 이중 표시 (색상 구분)
- 작업 필터링 (전체/진행중/지연/완료)
- 행 밀도 조절 (compact/comfortable)
- 주말 배경 표시 토글
- 인라인 산출물/공정율 편집
- 동기화 세로 스크롤

#### Dashboard.tsx (37.5KB)
- Recharts 기반 통계 차트
- 상태별 분포 (PieChart)
- 담당자별 작업량 (BarChart)
- Phase별 진행률 브레이크다운
- 가중치 분포 시각화
- 지연 작업 알림 목록

---

## 5. 상태 관리 (Zustand)

### 5.1 Store 구조

```typescript
// projectStore.ts
interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  members: ProjectMember[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setMembers: (members: ProjectMember[]) => void;
  addMember: (member: ProjectMember) => void;
  updateMember: (id: string, updates: Partial<ProjectMember>) => void;
  removeMember: (id: string) => void;
}

// taskStore.ts
interface TaskState {
  tasks: Task[];
  taskTree: Task[];           // 계층 트리
  flatTasks: Task[];          // 평탄화된 목록 (표시용)
  expandedIds: Set<string>;   // 펼침 상태
  history: Task[][];          // Undo/Redo 히스토리 (50건)
  historyIndex: number;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newParentId: string | null, newIndex: number) => void;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  undo: () => void;
  redo: () => void;
}

// authStore.ts (localStorage 영속화)
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;           // systemRole === 'admin'
  isLoading: boolean;
  setUser: (user: User) => void;
  logout: () => void;
}

// themeStore.ts
interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  isDark: boolean;            // 시스템 설정 반영 계산값
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
}
```

---

## 6. 데이터 흐름

### 6.1 데이터 영속화 전략
```
사용자 액션
  → Zustand Store 업데이트
    → useAutoSave 훅 (700ms 디바운스)
      → dataRepository.ts
        ├─ Supabase 설정됨 → Supabase API 호출
        └─ 미설정 → localStorage 저장
```

### 6.2 태스크 계층 관리
```
태스크 변경
  → taskStore.setTasks()
    → buildTaskTree() — 평탄 목록 → 트리 구조
    → flattenTaskTree() — 트리 → 표시용 평탄 목록
    → calculateParentProgress() — 하위 → 상위 자동 집계
    → projectTaskSync — 날짜/상태/진행률 롤업
```

---

## 7. 보안

### 7.1 인증
- Supabase Auth (이메일/패스워드) — Supabase 설정 시
- 로컬 테스트 로그인 — Supabase 미설정 시
- ProtectedRoute 컴포넌트로 인증 가드
- AdminRoute 컴포넌트로 관리자 라우트 보호

### 7.2 인가
- RLS 정책으로 DB 레벨 접근 제어 (Supabase)
- 프론트엔드 라우트 가드 (ProtectedRoute, AdminRoute)
- 시스템 역할: admin / user

### 7.3 데이터 보호
- HTTPS 필수 (Vercel 기본)
- 민감 정보 환경 변수 관리

---

## 8. 성능 최적화

### 8.1 프론트엔드
- 디바운스 자동 저장 (700ms)
- 트리 구조 온디맨드 빌드
- CSS 변수 기반 테마 전환 (리렌더 최소화)
- Vite 코드 스플리팅

### 8.2 번들 최적화
- Tailwind CSS JIT (사용 클래스만 포함)
- Lucide/date-fns 트리쉐이킹
- Vite 청크 분리

---

## 9. 스타일링 아키텍처

### 9.1 CSS 구조
- Tailwind CSS 유틸리티 클래스 (기본)
- `src/index.css` 글로벌 스타일 (CSS 변수, 글래스모피즘, 그라디언트, 애니메이션)
- 다크모드: `dark` 클래스 기반 토글 (document.documentElement)

### 9.2 색상 팔레트
| 용도 | 색상 |
|------|------|
| Primary Accent | `#0f766e` (teal) |
| Secondary | `#d88b44` (orange) |
| Success | `#31a37a` |
| Danger | `#cb4b5f` |

### 9.3 커스텀 컴포넌트 클래스
- `.app-panel` — 메인 콘텐츠 카드
- `.metric-card` — 대시보드 메트릭 표시
- `.surface-badge` — 라벨/뱃지

---

## 10. 개발 환경

### 10.1 필수 도구
- Node.js 20+
- npm
- Git

### 10.2 개발 명령어
```bash
npm run dev          # Vite 개발 서버 (localhost:5173)
npm run build        # TypeScript 체크 + Vite 프로덕션 빌드
npm run preview      # 프로덕션 빌드 미리보기 (localhost:4173)
npm run lint         # ESLint 검사
npm run test:e2e     # Playwright E2E 테스트
```

### 10.3 환경 변수
```env
VITE_SUPABASE_URL=your_supabase_url          # 선택 — 미설정 시 localStorage 폴백
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key  # 선택
```

### 10.4 CI/CD
- GitHub Actions: push/PR → Node 20 설치 → Playwright 설치 → 빌드 → E2E 테스트
- Vercel: main 브랜치 자동 배포

### 10.5 테스트 구성
```
tests/
└── app.e2e.spec.ts       # 3개 E2E 테스트 시나리오
    ├── 로그인 → 주요 페이지 네비게이션
    ├── WBS 저장 → 대시보드 진행률 동기화
    └── 간트 인라인 편집 → 새로고침 후 영속화
```
- Playwright 설정: Chromium, preview 서버(4173) 대상
