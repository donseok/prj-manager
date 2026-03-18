# TRD (Technical Requirements Document)
# 프로젝트 관리 시스템 - 기술 요구사항 정의서

## 1. 기술 스택

### 1.1 프론트엔드
| 분류 | 기술 | 버전 | 선정 이유 |
|------|------|------|----------|
| 프레임워크 | React | 18.x | 컴포넌트 기반, 생태계 |
| 빌드 도구 | Vite | 5.x | 빠른 개발 환경 |
| 언어 | TypeScript | 5.x | 타입 안정성 |
| 스타일링 | Tailwind CSS | 3.x | 빠른 UI 개발 |
| 상태관리 | Zustand | 4.x | 간단하고 가벼움 |
| 테이블 | TanStack Table | 8.x | 강력한 테이블 기능 |
| 간트차트 | 직접 구현 | - | 커스터마이징 필요 |
| 차트 | Recharts | 2.x | 대시보드 차트 |
| 날짜 | date-fns | 3.x | 날짜 처리 |
| 아이콘 | Lucide React | - | 모던한 아이콘 |
| 라우팅 | React Router | 6.x | SPA 라우팅 |

### 1.2 백엔드/데이터베이스
| 분류 | 기술 | 선정 이유 |
|------|------|----------|
| BaaS | Supabase | 무료, PostgreSQL, 실시간 |
| 인증 | Supabase Auth | 통합 인증 |
| 스토리지 | Supabase Storage | 파일 업로드 |
| 실시간 | Supabase Realtime | 실시간 동기화 |

### 1.3 배포/인프라
| 분류 | 기술 | 선정 이유 |
|------|------|----------|
| 호스팅 | Vercel | 무료, 간편 배포 |
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
│  │              React Application                   │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │  Pages  │ │Components│ │  Hooks  │           │   │
│  │  └─────────┘ └─────────┘ └─────────┘           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │  Store  │ │  Utils  │ │  Types  │           │   │
│  │  └─────────┘ └─────────┘ └─────────┘           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase (백엔드)                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐             │
│  │  Auth     │ │ Database  │ │  Storage  │             │
│  │           │ │(PostgreSQL)│ │           │             │
│  └───────────┘ └───────────┘ └───────────┘             │
│  ┌───────────┐ ┌───────────┐                           │
│  │ Realtime  │ │   Edge    │                           │
│  │           │ │ Functions │                           │
│  └───────────┘ └───────────┘                           │
└─────────────────────────────────────────────────────────┘
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
│ created_at   │     │ description  │     │ role         │
└──────────────┘     │ start_date   │     │ created_at   │
                     │ end_date     │     └──────────────┘
                     │ base_date    │            │
                     │ status       │            │
                     │ created_at   │            │
                     └──────────────┘            │
                            │                    │
                            ▼                    │
                     ┌──────────────┐           │
                     │    tasks     │◄──────────┘
                     ├──────────────┤
                     │ id (PK)      │
                     │ project_id   │
                     │ parent_id    │ (자기참조)
                     │ level        │ (1=Phase, 2=Activity...)
                     │ order_index  │
                     │ name         │
                     │ description  │
                     │ assignee_id  │
                     │ weight       │
                     │ plan_start   │
                     │ plan_end     │
                     │ plan_progress│
                     │ actual_start │
                     │ actual_end   │
                     │ actual_progress│
                     │ status       │
                     │ output       │
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
  base_date DATE,  -- 진척기준일
  status VARCHAR(20) DEFAULT 'active',  -- active, archived, deleted
  settings JSONB DEFAULT '{}',  -- 추가 설정
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
  name VARCHAR(100),  -- 비회원 담당자 이름
  role VARCHAR(20) DEFAULT 'member',  -- owner, admin, member, viewer
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
  level INTEGER NOT NULL DEFAULT 1,  -- 1=Phase, 2=Activity, 3=Task, 4=Function
  order_index INTEGER NOT NULL DEFAULT 0,

  -- 기본 정보
  name VARCHAR(500) NOT NULL,
  description TEXT,
  output VARCHAR(500),  -- 산출물

  -- 담당자
  assignee_id UUID REFERENCES project_members(id),

  -- 가중치/공정율
  weight DECIMAL(10,6) DEFAULT 0,

  -- 계획
  plan_start DATE,
  plan_end DATE,
  plan_progress DECIMAL(5,2) DEFAULT 0,  -- 0~100

  -- 실적
  actual_start DATE,
  actual_end DATE,
  actual_progress DECIMAL(5,2) DEFAULT 0,  -- 0~100

  -- 상태
  status VARCHAR(20) DEFAULT 'pending',  -- pending, in_progress, completed, on_hold

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

## 4. API 설계

### 4.1 Supabase Client 직접 사용
REST API 대신 Supabase JS Client를 직접 사용하여 CRUD 수행

```typescript
// 프로젝트 목록 조회
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .order('created_at', { ascending: false });

// 작업 계층 조회
const { data, error } = await supabase
  .from('tasks')
  .select('*, assignee:project_members(*)')
  .eq('project_id', projectId)
  .order('order_index');
```

### 4.2 실시간 구독
```typescript
// 작업 변경 실시간 구독
const channel = supabase
  .channel('tasks-changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'tasks' },
    (payload) => {
      // 상태 업데이트
    }
  )
  .subscribe();
```

---

## 5. 프론트엔드 구조

### 5.1 디렉토리 구조
```
src/
├── components/
│   ├── common/           # 공통 컴포넌트
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   ├── layout/           # 레이아웃
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Layout.tsx
│   ├── wbs/              # WBS 관련
│   │   ├── WBSTable.tsx
│   │   ├── WBSRow.tsx
│   │   ├── WBSCell.tsx
│   │   ├── GanttChart.tsx
│   │   └── GanttBar.tsx
│   ├── dashboard/        # 대시보드
│   │   ├── ProgressChart.tsx
│   │   ├── TaskSummary.tsx
│   │   └── DelayedTasks.tsx
│   └── project/          # 프로젝트
│       ├── ProjectList.tsx
│       ├── ProjectCard.tsx
│       └── ProjectSettings.tsx
├── pages/
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── ProjectList.tsx
│   ├── ProjectDetail.tsx
│   └── WBS.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useProject.ts
│   ├── useTasks.ts
│   └── useRealtime.ts
├── store/
│   ├── authStore.ts
│   ├── projectStore.ts
│   └── taskStore.ts
├── lib/
│   ├── supabase.ts
│   └── utils.ts
├── types/
│   └── index.ts
├── App.tsx
└── main.tsx
```

### 5.2 주요 컴포넌트 설계

#### WBSTable
- TanStack Table 기반
- 가상화 스크롤 (대용량 데이터)
- 인라인 편집
- 드래그&드롭 정렬
- 컬럼 고정 (작업명, 담당자 등)

#### GanttChart
- 주간 단위 표시
- 가로 스크롤 동기화
- 계획/실적 바 표시
- 드래그로 일정 조정

---

## 6. 상태 관리

### 6.1 Zustand Store

```typescript
// taskStore.ts
interface TaskState {
  tasks: Task[];
  selectedTaskId: string | null;
  isLoading: boolean;

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newParentId: string | null, newIndex: number) => void;

  // Computed
  getTaskTree: () => TaskTreeNode[];
  getTaskById: (id: string) => Task | undefined;
  calculateProgress: (taskId: string) => number;
}
```

---

## 7. 보안

### 7.1 인증
- Supabase Auth (이메일/패스워드)
- 소셜 로그인 (Google) - 추후

### 7.2 인가
- RLS 정책으로 데이터 접근 제어
- 프론트엔드 라우트 가드

### 7.3 데이터 보호
- HTTPS 필수
- 민감 정보 암호화

---

## 8. 성능 최적화

### 8.1 프론트엔드
- React.memo 활용
- 가상화 스크롤
- 디바운스/쓰로틀링
- 코드 스플리팅

### 8.2 데이터베이스
- 적절한 인덱스
- 쿼리 최적화
- 페이지네이션

---

## 9. 개발 환경

### 9.1 필수 도구
- Node.js 20+
- npm 또는 pnpm
- Git

### 9.2 개발 명령어
```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 빌드
npm run build

# 린트
npm run lint

# 타입 체크
npm run type-check
```

### 9.3 환경 변수
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
