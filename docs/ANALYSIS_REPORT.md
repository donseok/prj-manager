# DK Flow 프로세스 분석 보고서

**버전**: 1.0
**최종 수정일**: 2026-03-22
**대상 독자**: 개발자, 설계자, 분석가

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [핵심 프로세스 흐름도](#3-핵심-프로세스-흐름도)
4. [계산 수식 상세](#4-계산-수식-상세)
5. [데이터 모델](#5-데이터-모델)
6. [상태 관리 상세](#6-상태-관리-상세)
7. [API 및 데이터 계층](#7-api-및-데이터-계층)
8. [내보내기 시스템](#8-내보내기-시스템)
9. [보안 아키텍처](#9-보안-아키텍처)
10. [성능 최적화 전략](#10-성능-최적화-전략)
11. [모듈 의존 관계도](#11-모듈-의존-관계도)
12. [주요 컴포넌트 명세](#12-주요-컴포넌트-명세)
13. [부록](#13-부록)

---

## 1. 시스템 개요

### 1.1 프로젝트 목적

DK Flow는 WBS(Work Breakdown Structure)와 간트 차트 기반의 웹 프로젝트 관리 시스템이다.
계층적 작업 구조(Phase > Activity > Task)를 통해 프로젝트의 일정, 공정율, 담당자를 체계적으로 관리하고,
주간보고 및 현황보고서를 자동 생성하여 프로젝트 관리 업무의 효율성을 극대화한다.

### 1.2 대상 사용자

| 사용자 유형 | 역할 | 주요 활동 |
|-------------|------|-----------|
| 프로젝트 관리자 (PM) | owner/admin | WBS 편집, 주간보고, 멤버 관리, 설정 |
| 팀원 | member | 작업 진행률 입력, 일정 확인, 근태 기록 |
| 관찰자 | viewer | 대시보드 조회, 보고서 다운로드 |
| 시스템 관리자 | admin (system) | 사용자 계정 관리, 승인/정지 |

### 1.3 핵심 가치

- **자동 집계**: 하위 작업의 일정/공정율/상태가 상위 작업에 자동 반영
- **이중 저장소**: Supabase 클라우드 또는 localStorage 로컬 모드 자동 전환
- **실시간 동기화**: BroadcastChannel을 통한 다중 탭 실시간 동기화
- **내보내기**: Excel, PowerPoint, Word 형식의 보고서 자동 생성
- **자동화**: 작업 템플릿, 빠른 초안, 자동 일정 계산, 자동 가중치 배분

---

## 2. 시스템 아키텍처

### 2.1 전체 아키텍처 다이어그램

```
+------------------------------------------------------------------+
|                        사용자 브라우저                              |
|                                                                    |
|  +------------------------------------------------------------+  |
|  |                    React 19 SPA (Vite 7)                    |  |
|  |                                                              |  |
|  |  +------------------+  +------------------+  +------------+ |  |
|  |  |   Pages (라우트)  |  | Components (공통) |  | Hooks      | |  |
|  |  |  - Dashboard     |  | - Layout/Sidebar |  | - useAuto  | |  |
|  |  |  - WBS           |  | - Button/Modal   |  |   Save     | |  |
|  |  |  - Gantt         |  | - ContextMenu    |  | - usePerm  | |  |
|  |  |  - Members       |  | - WeeklyReport   |  |   ission   | |  |
|  |  |  - Settings      |  | - Chatbot        |  | - useProj  | |  |
|  |  |  - Attendance    |  |                  |  |   Status   | |  |
|  |  +--------+---------+  +--------+---------+  +------+-----+ |  |
|  |           |                      |                    |       |  |
|  |  +--------v----------------------v--------------------v-----+ |  |
|  |  |              Zustand 상태 관리 (6개 스토어)               | |  |
|  |  |  authStore | projectStore | taskStore                     | |  |
|  |  |  attendanceStore | themeStore | uiStore                   | |  |
|  |  +-------------------------+--------------------------------+ |  |
|  |                            |                                  |  |
|  |  +-------------------------v--------------------------------+ |  |
|  |  |                   Lib (비즈니스 로직)                     | |  |
|  |  |  projectTaskSync | taskAnalytics | weeklyReport          | |  |
|  |  |  taskScheduler | taskAutoFill | taskFieldSync            | |  |
|  |  |  taskDraft | taskTemplates | permissions                 | |  |
|  |  |  excel | exportReport | exportWeeklyReport(Pptx)         | |  |
|  |  |  broadcastSync | weeklySnapshot                         | |  |
|  |  +-------------------------+--------------------------------+ |  |
|  |                            |                                  |  |
|  |  +-------------------------v--------------------------------+ |  |
|  |  |                dataRepository.ts                          | |  |
|  |  |           (Supabase / localStorage 추상화)                | |  |
|  |  +----------+---------------------------+-------------------+ |  |
|  +-------------|---------------------------|---------------------+  |
|                |                           |                        |
+----------------|---------------------------|------------------------+
                 |                           |
     +-----------v-----------+   +-----------v-----------+
     |   Supabase Backend    |   |    localStorage       |
     |  - PostgreSQL DB      |   |  - dk_projects        |
     |  - Auth (JWT)         |   |  - dk_tasks_{pid}     |
     |  - RLS Policies       |   |  - dk_members_{pid}   |
     |  - Profiles Table     |   |  - weekly_snapshots_*  |
     +---+---+---+---+------+   +-----------------------+
         |   |   |   |
    +----+   |   |   +----+
    |        |   |        |
 projects  tasks members attendance
```

### 2.2 프론트엔드 구조

```
src/
+-- App.tsx                    # 라우터, ProtectedRoute, AdminRoute, ProjectDetailWrapper
+-- main.tsx                   # React DOM 마운트
+-- types/index.ts             # 전체 타입 정의
+-- store/                     # Zustand 상태 관리
|   +-- authStore.ts           # 인증 (persist: localStorage)
|   +-- projectStore.ts        # 프로젝트 + 멤버
|   +-- taskStore.ts           # 작업 (정규화 파이프라인 내장)
|   +-- attendanceStore.ts     # 근태
|   +-- themeStore.ts          # 테마 (light/dark/system)
|   +-- uiStore.ts             # 사이드바 토글
+-- lib/                       # 비즈니스 로직 (순수 함수)
|   +-- dataRepository.ts      # Supabase/localStorage 추상화
|   +-- supabase.ts            # Supabase 클라이언트, Auth, Migration
|   +-- projectTaskSync.ts     # normalizeTaskHierarchy, deriveProjectStatus
|   +-- taskAnalytics.ts       # 대시보드 통계 계산
|   +-- taskFieldSync.ts       # 상태-진행률-날짜 자동 연동
|   +-- taskScheduler.ts       # 자동 일정 계산 (predecessor 기반)
|   +-- taskAutoFill.ts        # 산출물/담당자/가중치 자동 채움
|   +-- taskDraft.ts           # 빠른 초안 (프롬프트 기반)
|   +-- taskTemplates.ts       # 프로젝트 템플릿 4종
|   +-- weeklyReport.ts        # 주간보고 데이터 생성
|   +-- weeklySnapshot.ts      # 주간보고 스냅샷 관리
|   +-- exportWeeklyReport.ts  # 주간보고 Excel 내보내기
|   +-- exportWeeklyReportPptx.ts # 주간보고 PPT 내보내기
|   +-- excel.ts               # WBS/간트 Excel 내보내기/가져오기
|   +-- exportReport.ts        # Word(docx) 현황보고서
|   +-- broadcastSync.ts       # BroadcastChannel 다중 탭 동기화
|   +-- permissions.ts         # 프로젝트 역할별 권한 매트릭스
|   +-- utils.ts               # 유틸리티 (날짜, 트리, cn, storage)
|   +-- holidays.ts            # 공휴일
|   +-- chatbot.ts             # 챗봇 로직
|   +-- projectClone.ts        # 프로젝트 복제
|   +-- projectVisuals.ts      # 프로젝트 시각화
|   +-- popupWindow.ts         # 팝업 윈도우 관리
+-- hooks/                     # 커스텀 훅
|   +-- useAutoSave.ts         # 디바운스 자동 저장
|   +-- useProjectPermission.ts # 프로젝트 권한 계산
|   +-- useProjectStatus.ts    # 프로젝트 상태 관리
|   +-- usePageFeedback.ts     # 페이지 피드백
+-- pages/                     # 페이지 컴포넌트
|   +-- Home.tsx               # 홈
|   +-- ProjectList.tsx        # 프로젝트 목록
|   +-- Dashboard.tsx          # 대시보드
|   +-- WBS.tsx                # WBS 편집기
|   +-- Gantt.tsx              # 간트 차트
|   +-- Members.tsx            # 멤버 관리
|   +-- Settings.tsx           # 프로젝트 설정
|   +-- Attendance.tsx         # 근태 관리
|   +-- Login.tsx              # 로그인/회원가입
|   +-- PendingApproval.tsx    # 승인 대기
|   +-- UserManagement.tsx     # 사용자 관리 (admin)
|   +-- UserManual.tsx         # 사용 매뉴얼
|   +-- AccountSettings.tsx    # 계정 설정
+-- components/                # 재사용 컴포넌트
    +-- common/                # Button, Modal, ConfirmModal, DKFlowLogo, FeedbackNotice
    +-- layout/                # Layout, Header, Sidebar
    +-- wbs/                   # ContextMenu, GanttChart, MemberSelect, QuickProgressModal
    +-- attendance/            # AttendanceModal
    +-- chatbot/               # ChatbotWidget, DKBotAvatar
    +-- WeeklyReportModal.tsx  # 주간보고 모달
```

### 2.3 데이터 계층 (이중 구조)

```
+------------------------------------------+
|          isSupabaseConfigured?            |
|    (VITE_SUPABASE_URL + ANON_KEY)        |
+----------+-------------------+-----------+
           |                   |
     YES (true)          NO (false)
           |                   |
  +--------v--------+  +------v--------+
  | Supabase Client |  | localStorage  |
  | - PostgreSQL    |  | - JSON 직렬화 |
  | - RLS 보안      |  | - 4개 샘플    |
  | - JWT 인증      |  |   프로젝트    |
  | - 실시간 마이그  |  | - 자동 로그인 |
  |   레이션        |  |   (local-user)|
  +-----------------+  +---------------+
```

### 2.4 상태 관리 아키텍처 (6개 Zustand 스토어)

```
+-------------+     +----------------+     +--------------+
| authStore   |     | projectStore   |     | taskStore    |
| (persist)   |     |                |     |              |
|-------------|     |----------------|     |--------------|
| user        |     | projects[]     |     | tasks[]      |
| isAuth      |---->| currentProject |---->| taskTree[]   |
| isAdmin     |     | members[]      |     | flatTasks[]  |
| accountStat |     | membersLoaded  |     | loadedProjId |
| isPending   |     |   ProjectId    |     | expandedIds  |
| isSuspended |     |                |     | history[50]  |
+-------------+     +----------------+     | historyIndex |
                                           | editingCell  |
+-------------+     +----------------+     +--------------+
| attendance  |     | themeStore     |
|   Store     |     |                |     +--------------+
|-------------|     |----------------|     | uiStore      |
| attendances |     | theme          |     |--------------|
| loadedProjId|     | isDark         |     | sidebarCol   |
+-------------+     +----------------+     |   lapsed     |
                                           +--------------+
```

---

## 3. 핵심 프로세스 흐름도

### 3.1 사용자 인증 프로세스

```
[앱 시작 (App.tsx)]
       |
       v
+------------------+
| isSupabaseConf?  |
+--------+---------+
    NO   |    YES
    |    |    |
    v    |    v
[로컬 사용자]  [ensureSupabaseSession()]
[자동 로그인]         |
    |            +----+----+
    |          세션있음   세션없음
    |            |          |
    v            v          v
[setUser()]  [toAppUser()] [setLoading(false)]
    |            |          |
    v            v          v
[loadInitial  [setUser()]  [Login 페이지]
  Projects()]    |              |
    |            v              v
    v       [loadInitial   [이메일+비밀번호 입력]
[setProjects]  Projects()]      |
    |            |          +---+---+
    v            v         로그인  회원가입
[라우트 진입]  [setProjects]   |       |
                    |          v       v
                    v    [signIn  [signUp
               [구독 시작]  WithEmail] WithEmail]
               [onAuth         |       |
                StateChange]   v       v
                          [profiles  [profiles
                           조회]      생성 (pending)]
                              |          |
                              v          v
                          [toAppUser] [PendingApproval
                              |        페이지]
                              v
                          [계정상태 확인]
                              |
                  +-----------+-----------+
               active      pending     suspended
                  |           |            |
                  v           v            v
              [정상 진입]  [대기 페이지]  [대기 페이지]
```

**라우트 가드 체계:**

```
[모든 라우트 요청]
       |
       v
+--ProtectedRoute--+
|  isLoading?      |--YES--> [스피너]
|  isAuthenticated?|--NO---> [/login 리다이렉트]
|  isPending?      |--YES--> [/pending 리다이렉트]
|  isSuspended?    |--YES--> [/pending 리다이렉트]
+--------+---------+
         |
    (인증+활성 통과)
         |
    +----v----+
    | /admin/* |
    +----+----+
         |
  +--AdminRoute--+
  | isAdmin?     |--NO--> [/ 리다이렉트]
  +------+-------+
         |
    (admin 통과)
         v
   [관리 페이지 렌더]
```

### 3.2 프로젝트 생성 및 관리 프로세스

```
[프로젝트 생성 버튼 클릭]
         |
         v
+-------------------+
| 프로젝트명, 설명   |
| 시작일, 종료일 입력 |
+--------+----------+
         |
         v
[Project 객체 생성]
  - id: crypto.randomUUID()
  - ownerId: currentUser.id
  - status: 'preparing'
  - settings: { statusMode: 'auto' }
         |
         v
[upsertProject()] --> [dataRepository]
         |                    |
         v               +----+----+
[addProject()           Supabase  localStorage
  in projectStore]    (INSERT/    (JSON 저장)
         |             UPDATE)
         v
[프로젝트 목록 갱신]
```

**프로젝트 상태 전이:**

```
                    +------------+
            +------>| preparing  |<-------+
            |       +------+-----+        |
            |              |              |
  (작업 삭제→비움)   (작업 추가         (수동 모드
            |        + 진행 시작)        에서 변경)
            |              |              |
            |       +------v-----+        |
            +-------+   active   +--------+
                    +------+-----+
                           |
                  (모든 leaf 완료)
                           |
                    +------v-----+
                    | completed  |
                    +------------+

  statusMode === 'auto': deriveProjectStatus() 자동 결정
  statusMode === 'manual': manualStatus 값 직접 사용
```

### 3.3 작업(Task) 라이프사이클

```
[작업 생성]
    |
    +--[수동 생성]---> addTask() --> setTasks()
    |                                   |
    +--[템플릿에서]---> generateTasksFromTemplate()
    |                      |
    +--[빠른 초안]----> generateTasksFromPrompt()
    |                      |
    +--[Excel 가져오기]-> parseTasksFromWorkbook()
    |                      |
    v                      v
[setTasks() 호출] <--------+
    |
    v
+------------------------------+
| normalizeTaskHierarchy(tasks)|  <--- 핵심 정규화
|------------------------------|
| 1. taskMap 구축              |
| 2. 부모-자식 관계 설정       |
| 3. 역전 날짜 자동 정정       |
| 4. 형제 정렬 (orderIndex)   |
| 5. 리프 planProgress 자동계산|
| 6. buildBranch (재귀)       |
|    - level 재할당            |
|    - orderIndex 재할당       |
|    - 부모 집계               |
|      (applyParentAggregation)|
| 7. 평탄화하여 반환           |
+-------------+----------------+
              |
              v
[buildTaskTree()] --> [flattenTaskTree()]
              |                |
              v                v
        taskTree[]        flatTasks[]
              |
              v
[히스토리 관리]
  - resetHistory (프로젝트 전환)
  - recordHistory (편집)
  - 최대 50개 스냅샷 유지
              |
              v
[broadcastTasks()] --> BroadcastChannel --> 다른 탭
```

**normalizeTaskHierarchy 상세 흐름:**

```
입력: Task[] (평탄 배열)
         |
         v
[1] taskMap = new Map<id, InternalTask>
         |
         v
[2] childrenByParent = new Map<parentId, InternalTask[]>
    - 존재하지 않는 parentId는 null로 보정
         |
         v
[3] 날짜 역전 자동 정정
    - planStart > planEnd → 스왑
    - actualStart > actualEnd → 스왑
         |
         v
[4] 형제 정렬: orderIndex ASC, _sourceIndex ASC
         |
         v
[5] 리프 Task planProgress 자동 계산
    - 자식이 없는 Task만 대상
    - calculateLeafPlanProgress(task, today)
         |
         v
[6] buildBranch(null, level=1) 재귀
    각 노드에 대해:
    - level = 현재 레벨
    - orderIndex = 형제 내 순서
    - 자식 재귀 호출
    - 자식이 있으면: applyParentAggregation()
         |
         v
[7] flatten(roots) → 정규화된 Task[] 반환
```

**자동 저장 (useAutoSave):**

```
[데이터 변경 감지]
       |
       v
[projectId && loadedProjectId 일치 확인]
       |
  불일치 --> [저장 건너뜀 (하이드레이션 안전)]
       |
  일치
       |
       v
[hydratedRef 확인]
       |
  첫 변경 --> [hydratedRef = true, 건너뜀]
       |
  이후 변경
       |
       v
[saveStatus = 'pending']
[setTimeout(700ms)]
       |
  <700ms 이내 재변경> --> [clearTimeout] --> [다시 setTimeout]
       |
  700ms 경과
       |
       v
[saveStatus = 'saving']
[saveFn(latestData) 실행]
       |
  +----+----+
성공        실패
  |          |
  v          v
['saved']  ['error']
[lastSavedAt 갱신]
```

**Undo/Redo:**

```
[history 배열: Task[][] (최대 50개)]
[historyIndex: 현재 위치]

Undo: historyIndex > 0
  --> historyIndex -= 1
  --> setTasks(history[historyIndex])

Redo: historyIndex < history.length - 1
  --> historyIndex += 1
  --> setTasks(history[historyIndex])

새 편집:
  --> history = history.slice(0, historyIndex + 1).concat([newTasks]).slice(-50)
  --> historyIndex = history.length - 1
```

### 3.4 WBS 편집 프로세스

**인라인 셀 편집:**

```
[셀 클릭]
    |
    v
[setEditingCell({ taskId, columnId })]
    |
    v
[편집 모드 진입]
    |
    +-- text: <input> 표시
    +-- date: <input type="date"> 표시
    +-- select (상태): 드롭다운 표시
    +-- select (담당자): MemberSelect 표시
    +-- progress: 슬라이더 표시
    +-- number: <input type="number"> 표시
    |
    v
[값 변경 시]
    |
    v
[isSyncableField 확인]
    |
  YES --> [syncTaskField() 호출]
    |        - status 변경 → 진행률/날짜 연동
    |        - progress 변경 → 상태/날짜 연동
    |        - actualStart 변경 → 상태 연동
    |        - actualEnd 변경 → 상태/진행률 연동
    |
    v
[updateTask(id, updates)]
    |
    v
[setTasks() --> normalizeTaskHierarchy --> 자동 저장]
```

**드래그 앤 드롭:**

```
[작업 행 드래그 시작]
       |
       v
[드롭 대상 위에서 위치 계산]
       |
  +----+----+----+
  |         |    |
상위 25%  중간  하위 25%
  |       50%    |
  v        v     v
[before] [child] [after]
  |        |       |
  v        v       v
[moveTask(taskId, parentId, newIndex)]
  |
  v
[newParentLevel 결정]
[newLevel = parentLevel + 1]
[levelDiff 계산]
  |
  v
[자식들 level 재귀 조정]
[형제 orderIndex 재배열]
  |
  v
[setTasks() --> 정규화 --> 자동 저장]
```

**컨텍스트 메뉴 (우클릭):**

```
[행 우클릭]
    |
    v
[ContextMenu 표시]
    |
    +-- 위에 추가 (같은 레벨)
    +-- 아래에 추가 (같은 레벨)
    +-- 하위 작업 추가 (level + 1)
    +-- 복제
    +-- 삭제 (자식 포함 재귀 삭제)
    +-- 들여쓰기 (부모를 이전 형제로 변경)
    +-- 내어쓰기 (부모를 한 단계 위로)
```

**작업 자동화:**

```
[자동화 옵션]
    |
    +-- [템플릿 적용]
    |     generateTasksFromTemplate()
    |     - 4종: 철강, 웹출시, 모바일앱, 내부시스템
    |     - 계층 구조 자동 생성
    |     - 기간/산출물 기본값 포함
    |
    +-- [빠른 초안]
    |     generateTasksFromPrompt()
    |     - 키워드 분석 → 템플릿 자동 선택
    |     - DRAFT_RULES로 추가 작업 삽입
    |     - 점수 기반 매칭 (templateBoosts)
    |
    +-- [자동 일정 계산]
    |     autoScheduleTasks()
    |     - predecessor 기반 일정 산출
    |     - 순서: predecessor 없음 → projectStartDate부터
    |     -        predecessor 있음 → max(pred.planEnd) + 1일
    |     - planEnd = planStart + durationDays - 1
    |
    +-- [자동 채움]
          autoFillTasks()
          - 산출물 추천 (키워드 → 산출물 매핑)
          - 담당자 배정 (최소 업무량 우선)
          - 가중치 계산 (기간 비례 → 정규화 100)
```

### 3.5 데이터 영속화 프로세스

```
[사용자 작업 (편집/추가/삭제)]
         |
         v
[Zustand Store 즉시 업데이트]
    (taskStore.setTasks / projectStore.updateProject)
         |
         v
[useAutoSave 훅 (700ms 디바운스)]
         |
         v
[saveFn 호출]
    |
    +--작업 저장: syncProjectWorkspace()
    |     |
    |     +-- normalizeTaskHierarchy(tasks)
    |     +-- syncProjectTasks(projectId, normalizedTasks)
    |     +-- deriveProjectStatus() → buildDerivedProject()
    |     +-- upsertProject(derivedProject)
    |
    +--멤버 저장: syncProjectMembers()
    |
    +--근태 저장: upsertAttendance()
         |
         v
+--dataRepository.ts--+
| isSupabaseConfigured |
+--------+--+----------+
    YES  |  |  NO
    |    |  |  |
    v    |  |  v
[Supabase]  [localStorage]
 - upsert   - storage.set()
 - delete   - JSON.stringify
 - select   - storage.get()
         |
         v
[broadcastTasks() / broadcastProjectUpdate()]
         |
         v
[BroadcastChannel: 'dk-flow-sync']
         |
         v
[다른 탭의 onTasksUpdated / onProjectUpdated 콜백]
         |
         v
[해당 탭의 Zustand Store 업데이트 (_fromRemote: true)]
```

**하이드레이션 안전 체크:**

```
useAutoSave 내부:
  if (loadedProjectId !== projectId) --> 저장 건너뜀
  if (!hydratedRef.current) --> hydratedRef = true, 건너뜀 (최초 1회)

이유: ProjectDetailWrapper에서 setTasks(tasks, projectId)로 로드할 때
      loadedProjectId가 설정되기 전의 빈 데이터로 저장하는 것을 방지
```

### 3.6 주간보고 생성 프로세스

```
[주간보고 모달 열기]
         |
         v
[기준 날짜 선택 (기본: 오늘)]
         |
         v
[generateWeeklyReport() 호출]
         |
         v
+-------------------------------------+
| 1. 주간 범위 계산                    |
|    weekStart = startOfWeek(baseDate) |
|    weekEnd = endOfWeek(baseDate)     |
|    nextWeekStart/End = +1주          |
+------------------+------------------+
                   |
                   v
+-------------------------------------+
| 2. 리프 작업 추출                    |
|    getLeafTasks(tasks)               |
+------------------+------------------+
                   |
                   v
+-------------------------------------+
| 3. 섹션별 필터링                     |
|    - 금주 실적: in_progress OR       |
|      actualEnd/Start within week OR  |
|      기간 겹침                       |
|    - 차주 계획: !completed AND       |
|      plan 기간이 다음주 겹침         |
|    - 지연 작업: planEnd < baseDate   |
|      AND !completed AND progress<100 |
|    - 금주 완료: completed AND        |
|      actualEnd within week           |
+------------------+------------------+
                   |
                   v
+-------------------------------------+
| 4. 요약 통계 집계                    |
|    - totalLeafTasks                  |
|    - completedTasks / inProgressTasks|
|    - overallActualProgress (가중치)  |
|    - overallPlanProgress (가중치)    |
+------------------+------------------+
                   |
                   v
+-------------------------------------+
| 5. 이슈 자동생성                     |
|    - 지연 작업 N건 발생              |
|    - 최대 지연일수 >= 7일            |
|    - 계획 대비 실적 > 10%p 미달      |
|    - 담당자 미지정 작업 N건          |
+------------------+------------------+
                   |
                   v
+-------------------------------------+
| 6. 근태 요약 생성 (선택적)           |
|    - 금주 근태: weekStart~weekEnd    |
|    - 차주 근태: nextWeekStart~End    |
|    - 멤버별 그룹핑 + 유형별 통계     |
+------------------+------------------+
                   |
                   v
[WeeklyReportData 반환]
         |
         +--[화면 표시]--> 모달에서 미리보기
         |
         +--[스냅샷 저장]--> saveSnapshot() (최대 12주 보관)
         |
         +--[Excel 내보내기]--> exportWeeklyReportToExcel()
         |     - 요약 시트 (통계 테이블)
         |     - 금주 실적 / 차주 계획 / 지연 작업 / 완료 작업 섹션
         |     - 이슈 섹션
         |     - 근태현황 섹션
         |
         +--[PPT 내보내기]--> exportWeeklyReportPptx()
              - 1페이지: 요약 현황
              - 2페이지~: 상세 작업 (좌: 금주실적, 우: 차주계획)
              - 근태현황 슬라이드
```

### 3.7 근태관리 프로세스

```
[근태 관리 페이지 (Attendance.tsx)]
       |
       v
[프로젝트 진입 시 loadAttendances(projectId)]
       |
       v
[attendanceStore.setAttendances()]
       |
       v
[캘린더 형태로 멤버별 근태 표시]
       |
       +--[추가]
       |    |
       |    v
       |  [AttendanceModal 표시]
       |    - 멤버 선택
       |    - 날짜 선택
       |    - 유형 선택 (9종)
       |    - 비고 입력
       |    |
       |    v
       |  [upsertAttendance()] --> Supabase attendance 테이블
       |    |
       |    v
       |  [attendanceStore.addAttendance()]
       |
       +--[수정]
       |    |
       |    v
       |  [upsertAttendance()] --> Supabase UPDATE
       |    |
       |    v
       |  [attendanceStore.updateAttendance()]
       |
       +--[삭제]
            |
            v
          [deleteAttendanceById()] --> Supabase DELETE
            |
            v
          [attendanceStore.removeAttendance()]

근태 유형 9종:
  present(출근), annual_leave(연차), half_day_am(오전반차),
  half_day_pm(오후반차), sick_leave(병가), business_trip(출장),
  late(지각), early_leave(조퇴), absence(결근)
```

---

## 4. 계산 수식 상세

### 4.1 공정율 계산

**리프 작업 계획공정율 (자동 계산):**

```
함수: calculateLeafPlanProgress(task, today)
위치: projectTaskSync.ts

조건 분기:
  1. status === 'completed' → 100
  2. planStart 또는 planEnd 없음 → 0
  3. totalDays = differenceInCalendarDays(planEnd, planStart)
     - totalDays <= 0 (시작=종료):
         today >= planStart ? 100 : 0
     - totalDays > 0:
         elapsedDays = differenceInCalendarDays(today, planStart)
         progress = (elapsedDays / totalDays) * 100
         결과 = round(clamp(progress, 0, 100) * 100) / 100
```

**부모 작업 공정율 (가중치 기반 집계):**

```
함수: calculateAggregateProgress(children, field)
위치: projectTaskSync.ts

totalWeight = SUM(children[i].weight)

if totalWeight > 0:
  progress = SUM(children[i].weight * children[i][field]) / totalWeight
else:
  progress = SUM(children[i][field]) / children.length

결과 = round(progress * 100) / 100
```

**전체 프로젝트 공정율:**

```
함수: calculateOverallProgress(tasks)
위치: utils.ts

topLevelTasks = tasks.filter(t => !t.parentId || t.level === 1)
totalWeight = SUM(topLevelTasks[i].weight)

if totalWeight > 0:
  progress = SUM(topLevelTasks[i].weight * topLevelTasks[i].actualProgress) / totalWeight
else:
  progress = SUM(topLevelTasks[i].actualProgress) / topLevelTasks.length

결과 = round(progress * 100) / 100
```

### 4.2 부모 작업 속성 집계 (normalizeTaskHierarchy)

```
함수: applyParentAggregation(task, children)
위치: projectTaskSync.ts

날짜 집계:
  planStart  = min(children.planStart)   -- 가장 빠른 계획시작
  planEnd    = max(children.planEnd)     -- 가장 늦은 계획종료
  actualStart = min(children.actualStart) -- 가장 빠른 실적시작
  actualEnd  = allChildrenCompleted
               ? max(children.actualEnd) -- 모든 자식 완료 시에만
               : null

공정율 집계:
  planProgress   = calculateAggregateProgress(children, 'planProgress')
  actualProgress = calculateAggregateProgress(children, 'actualProgress')

상태 결정:
  함수: deriveParentStatus(children)

  if children.length === 0:
    return 'pending'

  if children.every(c => c.status === 'completed' OR c.actualProgress >= 100):
    return 'completed'

  if children.some(c =>
       c.status === 'in_progress' OR
       c.actualProgress > 0 OR
       c.actualStart 존재 OR
       c.actualEnd 존재):
    return 'in_progress'

  if children.every(c => c.status === 'on_hold'):
    return 'on_hold'

  return 'pending'
```

### 4.3 프로젝트 상태 자동 결정 (deriveProjectStatus)

```
함수: deriveProjectStatus(project, tasks)
위치: projectTaskSync.ts

if project.status === 'deleted':
  return 'deleted'

if project.settings.statusMode === 'manual' AND project.settings.manualStatus:
  return manualStatus   -- 수동 모드

-- 자동 모드 (auto):
leafTasks = getLeafTasks(tasks)

if leafTasks.length === 0:
  return 'preparing'

if leafTasks.every(t => t.status === 'completed' OR t.actualProgress >= 100):
  return 'completed'

if leafTasks.some(t =>
     t.status === 'in_progress' OR
     t.actualProgress > 0 OR
     t.actualStart 존재 OR
     t.actualEnd 존재):
  return 'active'

return 'preparing'
```

### 4.4 지연 판단

```
함수: getDelayedTasks(tasks, baseDate)
위치: utils.ts

지연 조건:
  task.status !== 'completed'
  AND planEnd 존재
  AND isBefore(planEnd, baseDate)
  AND task.actualProgress < 100

지연 일수:
  함수: getDelayDays(task, baseDate)
  if status === 'completed' → 0
  if planEnd >= baseDate → 0
  delayDays = differenceInDays(baseDate, planEnd)
```

### 4.5 가중치 분포 (Largest Remainder Method)

```
함수: calculateWeightDistribution(tasks)
위치: taskAnalytics.ts

phases = tasks.filter(t => t.level === 1)
totalWeight = SUM(phases[i].weight)

1단계: 원시 비율 계산
  rawPct[i] = (phases[i].weight / totalWeight) * 100

2단계: 내림 정수
  floored[i] = Math.floor(rawPct[i])

3단계: 잔여분 계산
  remainder[i] = rawPct[i] - floored[i]

4단계: 부족분 계산
  gap = 100 - SUM(floored[i])

5단계: 잔여분이 큰 순서대로 gap개에 +1 배분
  indices = remainder 내림차순 정렬
  for i in indices (gap개까지):
    floored[i] += 1

결과: 합계가 정확히 100%
```

### 4.6 대시보드 통계 수식

```
함수: calculateProjectStats(tasks, baseDate)
위치: taskAnalytics.ts

-- 리프 작업 기준 통계:
leafTasks       = getLeafTasks(tasks)  -- 자식이 없는 작업만
totalTasks      = leafTasks.length
completedTasks  = leafTasks.filter(t => t.status === 'completed').length
inProgressTasks = leafTasks.filter(t => t.status === 'in_progress').length
delayedTasks    = getDelayedTasks(leafTasks, baseDate).length

-- 전체 공정율 (Phase 기준):
overallProgress = calculateOverallProgress(tasks)
  -- Phase(L1) 작업들의 가중치 기반 actualProgress 평균

-- 계획 공정율 (Phase 기준):
phases = tasks.filter(t => t.level === 1)
totalPlanWeight = SUM(phases[i].weight)
if totalPlanWeight > 0:
  planProgress = SUM(phases[i].weight * phases[i].planProgress) / totalPlanWeight
else:
  planProgress = SUM(phases[i].planProgress) / phases.length

-- 담당자별 업무량:
함수: calculateAssigneeWorkloads(tasks, members, baseDate)
leafTasks.filter(t => t.assigneeId)를 담당자별 그룹핑
각 담당자:
  total     = 해당 담당자 작업 수
  completed = completed 상태 작업 수
  remaining = total - completed
  inProgress = in_progress 상태 작업 수
  delayed   = getDelayDays(task, baseDate) > 0인 작업 수

-- Phase별 진행률:
함수: calculatePhaseProgress(tasks)
tasks.filter(t => t.level === 1)
각 Phase:
  계획 = Math.round(phase.planProgress)
  실적 = Math.round(phase.actualProgress)

-- 일정 진행률:
함수: calculateTimeline(startDate, endDate)
totalDays = ceil((end - start) / 86400000)
elapsedDays = ceil((now - start) / 86400000)
remainingDays = totalDays - clamp(elapsedDays, 0, INF)
elapsedPercent = clamp((elapsedDays / totalDays) * 100, 0, 100)
```

### 4.7 주간보고 필터링 수식

```
함수: generateWeeklyReport()
위치: weeklyReport.ts

-- 금주 실적:
thisWeekActualTasks = leafTasks.filter(t =>
  t.status === 'in_progress'
  OR actualEnd within [weekStart, weekEnd]
  OR actualStart within [weekStart, weekEnd]
  OR (actualStart && actualEnd && actualStart <= weekEnd && actualEnd >= weekStart)
)

-- 차주 계획:
nextWeekPlanTasks = leafTasks.filter(t =>
  t.status !== 'completed'
  AND isOverlapping(t.planStart, t.planEnd, nextWeekStart, nextWeekEnd)
)

isOverlapping(start, end, rangeStart, rangeEnd):
  if (start && end): start <= rangeEnd AND end >= rangeStart
  if (start만): isWithinInterval(start, {rangeStart, rangeEnd})
  if (end만): isWithinInterval(end, {rangeStart, rangeEnd})

-- 지연 작업:
delayedTasks = leafTasks.filter(t =>
  t.status !== 'completed'
  AND planEnd < baseDate
  AND t.actualProgress < 100
)

-- 금주 완료:
completedThisWeekTasks = leafTasks.filter(t =>
  t.status === 'completed'
  AND actualEnd within [weekStart, weekEnd]
)

-- 이슈 자동생성:
1. delayedTasks.length > 0:
   "지연 작업 {N}건 발생 -- 조속한 조치 필요"

2. maxDelay = max(delayedTasks.map(delayDays))
   if maxDelay >= 7:
   "최대 지연일수 {N}일 -- 일정 재조정 검토 필요"

3. overallActualProgress < overallPlanProgress - 10:
   "계획 대비 실적 {gap}%p 미달"

4. unassigned = leafTasks.filter(!assigneeId && status !== 'completed')
   if unassigned.length > 0:
   "담당자 미지정 작업 {N}건"
```

### 4.8 자동 일정 계산 (taskScheduler)

```
함수: autoScheduleTasks(tasks, projectStartDate)
위치: taskScheduler.ts

알고리즘:
1. 트리 구조 구축: buildTaskTree(tasks)

2. 리프 작업 순회 (깊이 우선):
   scheduleLeaf(task, fallbackCursor):

   - predecessor 있음:
     predecessorDates = predecessorIds.map(id => completionMap.get(id))
     taskStart = max(predecessorDates) + 1일

   - predecessor 없음:
     taskStart = fallbackCursor (= projectStartDate 또는 이전 작업 종료+1)

   - durationDays = task.durationDays || 기존 기간 역산 || 기본값 2일
   - taskEnd = taskStart + durationDays - 1
   - completionMap.set(task.id, taskEnd)
   - return taskEnd + 1 (다음 작업 커서)

3. 부모 작업: normalizeTaskHierarchy()로 자식 기반 자동 집계
   planStart = min(children.planStart)
   planEnd   = max(children.planEnd)
```

### 4.9 자동 가중치 배분 (taskAutoFill)

```
함수: autoCalculateWeights(tasks)
위치: taskAutoFill.ts

알고리즘 (Bottom-up):
1. 모든 leaf 형제끼리:
   기간 비례 가중치 = (durationDays || 1) / SUM(sibling.durationDays) * 100

2. 부모 작업:
   부모 가중치 = SUM(자식 가중치)

3. Phase 레벨 정규화:
   totalPhaseWeight = SUM(phase.weight)
   scale = 100 / totalPhaseWeight
   모든 task.weight = task.weight * scale

결과: Phase 합계가 100이 되도록 보정
```

---

## 5. 데이터 모델

### 5.1 전체 ERD

```
+------------------+       +--------------------+       +------------------+
|    profiles      |       |     projects       |       | project_members  |
|------------------|       |--------------------|       |------------------|
| id (PK)          |<--+   | id (PK)            |<---+  | id (PK)          |
| email            |   |   | owner_id (FK)  ----+-+  |  | project_id (FK)--+--> projects.id
| name             |   |   | name               |    |  | user_id (FK) ----+--> profiles.id
| system_role      |   +---+ (-> profiles.id)    |    |  | name             |
| account_status   |       | description        |    |  | role             |
| created_at       |       | start_date         |    |  | created_at       |
+------------------+       | end_date           |    |  +--------+---------+
                           | base_date          |    |           |
                           | status             |    |           |
                           | completed_at       |    |           |
                           | settings (JSONB)   |    |           |
                           | created_at         |    |           |
                           | updated_at         |    |           |
                           +----------+---------+    |           |
                                      |              |           |
                           +----------v---------+    |  +--------v---------+
                           |       tasks        |    |  |   attendance     |
                           |--------------------|    |  |------------------|
                           | id (PK)            |    |  | id (PK)          |
                           | project_id (FK) ---+----+  | project_id (FK)--+--> projects.id
                           | parent_id (FK,self)|       | member_id (FK) --+--> project_members.id
                           | level              |       | date             |
                           | order_index        |       | type             |
                           | name               |       | note             |
                           | description        |       | created_at       |
                           | output             |       | updated_at       |
                           | assignee_id (FK) --+-----> project_members.id
                           | weight             |
                           | duration_days      |
                           | predecessor_ids[]  |
                           | task_source        |
                           | plan_start         |
                           | plan_end           |
                           | plan_progress      |
                           | actual_start       |
                           | actual_end         |
                           | actual_progress    |
                           | status             |
                           | created_at         |
                           | updated_at         |
                           +--------------------+
```

### 5.2 엔티티별 필드 상세

**User (profiles)**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string (UUID) | Supabase Auth UID |
| email | string | 이메일 주소 |
| name | string | 사용자 이름 |
| systemRole | 'admin' \| 'user' | 시스템 역할 |
| accountStatus | 'pending' \| 'active' \| 'suspended' | 계정 상태 |
| createdAt | string (ISO 8601) | 생성일시 |

**Project (projects)**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string (UUID) | 프로젝트 ID |
| ownerId | string | 소유자 (profiles.id) |
| name | string | 프로젝트명 |
| description | string? | 설명 |
| startDate | string? (yyyy-MM-dd) | 시작일 (WBS 기반 자동 산출) |
| endDate | string? | 종료일 (WBS 기반 자동 산출) |
| baseDate | string? | 진척 기준일 |
| status | ProjectStatus | 준비/진행/완료/삭제 |
| completedAt | string? | 완료일시 |
| settings | ProjectSettings? | statusMode, weekStartsOn 등 |
| createdAt | string | 생성일시 |
| updatedAt | string | 수정일시 |

**Task (tasks)**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string (UUID) | 작업 ID |
| projectId | string | 소속 프로젝트 |
| parentId | string? | 상위 작업 (self-reference) |
| level | number | 1=Phase, 2=Activity, 3=Task |
| orderIndex | number | 형제 내 순서 |
| name | string | 작업명 |
| description | string? | 설명 |
| output | string? | 산출물 |
| assigneeId | string? | 담당자 (project_members.id) |
| weight | number | 가중치 |
| durationDays | number? | 기간(일) |
| predecessorIds | string[]? | 선행 작업 ID 목록 |
| taskSource | string? | manual/template/quick_draft/imported/cloned |
| planStart | string? | 계획 시작일 |
| planEnd | string? | 계획 종료일 |
| planProgress | number | 계획 공정율 (0~100) |
| actualStart | string? | 실적 시작일 |
| actualEnd | string? | 실적 종료일 |
| actualProgress | number | 실적 공정율 (0~100) |
| status | TaskStatus | pending/in_progress/completed/on_hold |
| createdAt | string | 생성일시 |
| updatedAt | string | 수정일시 |

**ProjectMember (project_members)**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string (UUID) | 멤버 ID |
| projectId | string | 소속 프로젝트 |
| userId | string? | 연결된 사용자 (profiles.id) |
| name | string | 표시 이름 |
| role | string | owner/admin/member/viewer |
| createdAt | string | 생성일시 |

**Attendance (attendance)**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 근태 ID |
| projectId | string | 소속 프로젝트 |
| memberId | string | 대상 멤버 (project_members.id) |
| date | string (yyyy-MM-dd) | 날짜 |
| type | AttendanceType | 근태 유형 (9종) |
| note | string? | 비고 |
| createdAt | string | 생성일시 |
| updatedAt | string | 수정일시 |

### 5.3 관계 설명

```
profiles 1 --- N projects        (owner_id)
profiles 1 --- N project_members (user_id, nullable)
projects 1 --- N project_members (project_id)
projects 1 --- N tasks           (project_id)
projects 1 --- N attendance      (project_id)
project_members 1 --- N tasks    (assignee_id, nullable)
project_members 1 --- N attendance (member_id)
tasks    1 --- N tasks           (parent_id, self-reference)
```

### 5.4 인덱스 전략

```sql
-- attendance 테이블 인덱스
CREATE INDEX idx_attendance_project_id ON attendance (project_id);
CREATE INDEX idx_attendance_member_id ON attendance (member_id);
CREATE INDEX idx_attendance_date ON attendance (date);
CREATE INDEX idx_attendance_project_date ON attendance (project_id, date);

-- tasks 테이블 (Supabase 기본)
-- project_id + level + order_index 조합으로 정렬 조회
ORDER BY level ASC, order_index ASC

-- projects 테이블
-- updated_at DESC 정렬 (최근 수정 프로젝트 우선)
ORDER BY updated_at DESC
```

### 5.5 RLS 정책

```sql
-- attendance 테이블 RLS 정책:
-- SELECT: 프로젝트 멤버이거나 시스템 admin
-- INSERT: 프로젝트 owner/admin이거나, 자신의 근태를 기록하는 멤버이거나, 시스템 admin
-- UPDATE: 프로젝트 owner/admin이거나, 자신의 근태를 수정하는 멤버이거나, 시스템 admin
-- DELETE: 프로젝트 owner/admin이거나 시스템 admin

-- projects 테이블 RLS:
-- SELECT: 인증된 사용자 (프로젝트 멤버 + owner)
-- INSERT: 인증된 사용자 (owner_id = auth.uid())
-- UPDATE: owner 또는 admin
-- DELETE: owner만
```

---

## 6. 상태 관리 상세

### 6.1 authStore

```
위치: src/store/authStore.ts
미들웨어: zustand/persist (localStorage 'auth-storage')

상태:
  user: User | null            -- 현재 로그인 사용자
  isAuthenticated: boolean     -- 로그인 여부
  isLoading: boolean           -- 로딩 상태
  isAdmin: boolean             -- systemRole === 'admin'
  accountStatus: AccountStatus -- pending/active/suspended
  isPending: boolean           -- accountStatus === 'pending'
  isSuspended: boolean         -- accountStatus === 'suspended'

액션:
  setUser(user)    -- user 설정 + 파생 상태 자동 계산
  setLoading(bool) -- 로딩 상태 변경
  logout()         -- 모든 상태 초기화

영속화:
  partialize: user 필드만 저장
  merge: 복원 시 파생 상태(isAdmin, isPending 등) 재계산
```

### 6.2 projectStore

```
위치: src/store/projectStore.ts
미들웨어: 없음

상태:
  projects: Project[]                -- 프로젝트 목록 (updatedAt DESC 정렬)
  currentProject: Project | null     -- 현재 선택 프로젝트
  members: ProjectMember[]           -- 현재 프로젝트 멤버
  membersLoadedProjectId: string?    -- 멤버가 로드된 프로젝트 ID
  isLoading: boolean                 -- 로딩 상태

액션:
  setProjects(projects)              -- 목록 설정 (자동 정렬)
  addProject(project)                -- 프로젝트 추가
  updateProject(id, updates, opts?)  -- 프로젝트 수정 + broadcastProjectUpdate
  deleteProject(id)                  -- 프로젝트 삭제
  setCurrentProject(project)         -- 현재 프로젝트 설정
  setMembers(members, projectId?)    -- 멤버 목록 설정
  addMember(member)                  -- 멤버 추가
  updateMember(id, updates)          -- 멤버 수정
  removeMember(id)                   -- 멤버 삭제

구독:
  onProjectUpdated() -- BroadcastChannel 수신 시 _fromRemote 옵션으로 업데이트
```

### 6.3 taskStore

```
위치: src/store/taskStore.ts
미들웨어: 없음

상태:
  tasks: Task[]                      -- 정규화된 작업 목록
  taskTree: Task[]                   -- 트리 구조
  flatTasks: Task[]                  -- 평탄화된 표시용 목록
  loadedProjectId: string | null     -- 로드된 프로젝트 ID
  selectedTaskId: string | null      -- 선택된 작업
  expandedIds: Set<string>           -- 펼쳐진 작업 ID 집합
  isLoading: boolean                 -- 로딩 상태
  editingCell: {taskId, columnId}?   -- 편집 중인 셀
  history: Task[][]                  -- Undo 히스토리 (최대 50)
  historyIndex: number               -- 현재 히스토리 위치

액션:
  setTasks(tasks, projectId?, opts?) -- 핵심 파이프라인:
    1. normalizeTaskHierarchy(tasks)
    2. buildTaskTree()
    3. flattenTaskTree()
    4. 히스토리 관리 (resetHistory / recordHistory)
    5. broadcastTasks() (원격이 아닌 경우)

  addTask(task)                      -- 작업 추가 (부모 자동 펼침)
  updateTask(id, updates, opts?)     -- 작업 수정
  deleteTask(id)                     -- 작업 삭제 (자식 재귀 삭제)
  moveTask(taskId, parentId, index)  -- 드래그&드롭 이동
  selectTask(id)                     -- 작업 선택
  toggleExpand(id)                   -- 펼침/접힘 토글
  expandAll() / collapseAll()        -- 전체 펼침/접힘
  setEditingCell(cell)               -- 편집 셀 설정
  undo() / redo()                    -- 실행 취소/재실행

셀렉터:
  getTaskById(id)                    -- ID로 작업 조회
  getChildTasks(parentId)            -- 자식 작업 조회 (orderIndex 정렬)
  calculateProgress(taskId)          -- 가중치 기반 공정율 계산

구독:
  onTasksUpdated() -- BroadcastChannel 수신 시 _fromRemote 옵션으로 업데이트
```

### 6.4 attendanceStore

```
위치: src/store/attendanceStore.ts

상태:
  attendances: Attendance[]          -- 근태 목록
  loadedProjectId: string | null     -- 로드된 프로젝트 ID
  isLoading: boolean

액션:
  setAttendances(attendances, projectId)
  addAttendance(attendance)
  updateAttendance(id, updates)
  removeAttendance(id)

셀렉터:
  getByMember(memberId)              -- 멤버별 근태 조회
  getByDateRange(start, end)         -- 날짜 범위 근태 조회
```

### 6.5 themeStore

```
위치: src/store/themeStore.ts

상태:
  theme: 'light' | 'dark' | 'system'
  isDark: boolean (계산값)

액션:
  setTheme(theme) -- localStorage 저장 + document.documentElement.classList 토글
  toggleTheme()   -- light <-> dark 토글

시스템 테마 감지:
  window.matchMedia('(prefers-color-scheme: dark)') 리스너
  theme === 'system'일 때 자동 재계산
```

### 6.6 uiStore

```
위치: src/store/uiStore.ts

상태:
  sidebarCollapsed: boolean

액션:
  toggleSidebar() -- localStorage 저장 + 토글
```

### 6.7 스토어 간 의존 관계

```
authStore --------> ProtectedRoute (isAuthenticated, isPending)
    |                AdminRoute (isAdmin)
    |
    +-----------> useProjectPermission (user.id, user.systemRole)
                        |
projectStore <----------+ (members)
    |
    +---> ProjectDetailWrapper (projects, setCurrentProject)
    |
    +---> useAutoSave (membersLoadedProjectId)
    |
taskStore <--- projectStore (setTasks 시 loadedProjectId 확인)
    |
    +---> useAutoSave (loadedProjectId)
    |
    +---> WBS.tsx (flatTasks, editingCell, history)
    |
    +---> Dashboard.tsx (tasks -> taskAnalytics)
    |
attendanceStore <--- WeeklyReportModal (attendances)
    |
    +---> Attendance.tsx (근태 CRUD)

themeStore -----> Layout (isDark -> CSS class)
uiStore --------> Layout (sidebarCollapsed)
```

---

## 7. API 및 데이터 계층

### 7.1 dataRepository.ts 전체 함수 목록

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `loadInitialProjects` | `() => Promise<Project[]>` | 초기 프로젝트 로드 |
| `loadProjects` | `() => Promise<Project[]>` | 프로젝트 목록 조회 |
| `upsertProject` | `(project: Project) => Promise<Project>` | 프로젝트 생성/수정 |
| `deleteProjectById` | `(projectId: string) => Promise<void>` | 프로젝트 삭제 |
| `loadProjectMembers` | `(projectId: string) => Promise<ProjectMember[]>` | 멤버 목록 조회 |
| `syncProjectMembers` | `(projectId: string, members: ProjectMember[]) => Promise<void>` | 멤버 일괄 동기화 |
| `loadProjectTasks` | `(projectId: string) => Promise<Task[]>` | 작업 목록 조회 |
| `syncProjectTasks` | `(projectId: string, tasks: Task[]) => Promise<void>` | 작업 일괄 동기화 |
| `loadAttendances` | `(projectId: string) => Promise<Attendance[]>` | 근태 목록 조회 |
| `upsertAttendance` | `(attendance: Attendance) => Promise<Attendance>` | 근태 생성/수정 |
| `deleteAttendanceById` | `(projectId: string, id: string) => Promise<void>` | 근태 삭제 |
| `loadOwnedProjectIds` | `(userId: string) => Promise<string[]>` | 소유 프로젝트 ID 조회 |
| `deleteAllOwnedProjects` | `(userId: string) => Promise<void>` | 소유 프로젝트 일괄 삭제 |
| `removeUserFromAllProjects` | `(userId: string) => Promise<void>` | 모든 프로젝트에서 멤버 제거 |

### 7.2 Supabase vs localStorage 분기 로직

```
모든 dataRepository 함수의 첫 줄:

  if (!isSupabaseConfigured) {
    // localStorage 모드
    return storage.get<T>(key, defaultValue);
    // 또는
    storage.set(key, value);
  }

  // Supabase 모드
  const { data, error } = await supabase.from(table)...

isSupabaseConfigured = !!(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)
```

**localStorage 키 규칙:**

```
프로젝트 목록:  'dk_projects'
멤버 목록:     'dk_members_{projectId}'
작업 목록:     'dk_tasks_{projectId}'
주간 스냅샷:   'weekly_snapshots_{projectId}'
인증 상태:     'auth-storage'
테마:          'theme'
사이드바:      'sidebarCollapsed'
```

### 7.3 camelCase <-> snake_case 변환

```
App (camelCase)          DB (snake_case)
-------------------      -------------------
ownerId            <-->  owner_id
projectId          <-->  project_id
parentId           <-->  parent_id
assigneeId         <-->  assignee_id
orderIndex         <-->  order_index
planStart          <-->  plan_start
planEnd            <-->  plan_end
planProgress       <-->  plan_progress
actualStart        <-->  actual_start
actualEnd          <-->  actual_end
actualProgress     <-->  actual_progress
durationDays       <-->  duration_days
predecessorIds     <-->  predecessor_ids
taskSource         <-->  task_source
startDate          <-->  start_date
endDate            <-->  end_date
baseDate           <-->  base_date
completedAt        <-->  completed_at
createdAt          <-->  created_at
updatedAt          <-->  updated_at
systemRole         <-->  system_role
accountStatus      <-->  account_status
memberId           <-->  member_id
userId             <-->  user_id

변환 함수: mapXxxRow() (DB→App), toXxxRow() (App→DB)
```

### 7.4 에러 처리 및 재시도 전략

```
1. Supabase 쿼리 에러:
   - console.error()로 상세 로깅
   - throw new Error()로 상위 전파
   - 사용자에게 한국어 에러 메시지 표시

2. upsertProject 전략:
   - UPDATE 우선 시도 (RLS INSERT 정책 문제 우회)
   - UPDATE 실패(행 없음) 시 INSERT 시도

3. syncProjectTasks 재시도:
   - upsert 실패 시 마이그레이션 미적용 컬럼 제거 후 재시도
   - extraCols: ['duration_days', 'predecessor_ids', 'task_source']

4. ensureMigrations 마이그레이션:
   - account_status 컬럼 존재 확인
   - attendance 테이블 존재 확인 및 자동 생성
   - RPC 함수 호출 → 직접 SQL 실행 → 수동 안내
```

---

## 8. 내보내기 시스템

### 8.1 Excel WBS Export

```
함수: exportWbsWorkbook()
위치: excel.ts

시트 구성:
  Sheet 1: "WBS 보기" (서식 포함)
  Sheet 2: "WBS 데이터" (원시 데이터)

Sheet 1 컬럼 (14개):
  WBS | 구분 | 작업명 | 담당자 | 산출물 | 가중치 |
  계획시작 | 계획종료 | 계획공정율 | 실적시작 | 실적종료 |
  실적공정율 | 상태 | 지연

서식:
  - 타이틀 행: 배경 #0F172A, 폰트 16pt 흰색
  - 헤더 행: 배경 #1E293B, 폰트 10pt 흰색 Bold
  - Phase 행: 배경 #DBEAFE, 폰트 11pt Bold 파란색
  - Activity 행: 배경 #E0E7FF, 폰트 10pt Bold 남색
  - Task 행: 배경 #FFFFFF
  - 상태 셀: 상태별 색상 (완료=#DCFCE7, 진행=#FEF9C3, 보류=#FFE4E6)
  - 지연 셀: 배경 #FEE2E2, 폰트 빨간색 Bold
  - 공정율: 블록 바 (8/10 = ████████░░ 80%)
  - 자동 필터 적용
  - 고정 창: 헤더 행까지 (ySplit: 5)

Sheet 2 컬럼 (19개):
  WBS코드 | 상위WBS코드 | 구분 | 작업명 | 산출물 | 담당자 |
  담당자ID | 가중치 | 기간일수 | 선행작업 | 작업출처 |
  계획시작 | 계획종료 | 계획공정율 | 실적시작 | 실적종료 |
  실적공정율 | 상태 | 상태코드
```

### 8.2 Excel Gantt Export

```
함수: exportGanttWorkbook()
위치: excel.ts

시트 구성:
  Sheet 1: "간트 보기" (타임라인 포함)
  Sheet 2: "간트 데이터" (원시 데이터)

Sheet 1 고정 컬럼 (8개):
  WBS | 구분 | 작업명 | 담당자 | 상태 | 계획기간 | 실적기간 | 지연

타임라인 컬럼:
  주차별 컬럼 (기본 12주)
  형식: "M/d~M/d" (예: "3/17~3/23")

타임라인 마커:
  계획+실적 겹침: 배경 #E0E7FF, "●"
  계획만: 배경 #DBEAFE, "▪"
  실적만: 배경 #D1FAE5, "▪"
  없음: 빈 셀

고정 창: ySplit 6, xSplit 5 (작업명까지 고정)
```

### 8.3 Excel 주간보고

```
함수: exportWeeklyReportToExcel()
위치: exportWeeklyReport.ts

섹션 구성:
  1. 타이틀 블록 (프로젝트명, 주차, 생성일)
  2. 요약 통계 (전체/완료/진행/지연 작업 수, 계획/실적 공정율)
  3. 금주 실적 테이블 (작업명, 담당자, 상태, 진행률 등)
  4. 차주 계획 테이블
  5. 지연 작업 테이블 (지연일 포함)
  6. 금주 완료 테이블
  7. 이슈/리스크 섹션
  8. 근태현황 섹션 (금주/차주)
```

### 8.4 PPT 주간보고

```
함수: exportWeeklyReportPptx()
위치: exportWeeklyReportPptx.ts
라이브러리: PptxGenJS

슬라이드 구성:
  1페이지: 요약 현황
    - 프로젝트명, 주차 라벨
    - 핵심 지표 (작업 수, 공정율, 지연)
    - 이슈 요약

  2페이지~: 상세 작업
    - 좌측: 금주 실적 테이블
    - 우측: 차주 계획 테이블
    - 작업 수에 따라 여러 슬라이드로 분할

  근태 슬라이드: (근태 데이터가 있을 때)
    - 멤버별 근태 현황 테이블

색상 테마: DK Flow 브랜드 (#0F766E 기반)
```

### 8.5 Word 현황보고서

```
함수: generateProjectReport()
위치: exportReport.ts
라이브러리: docx

문서 구성:
  표지: 프로젝트명, "프로젝트 현황 보고서", 보고일
  1. 프로젝트 개요 (기본 정보 테이블)
  2. 공정율 현황 (계획/실적/Gap)
  3. 상태별 작업 분포 (대기/진행/완료/보류)
  4. Phase별 진행률 (차트 이미지 + 테이블)
  5. 담당자별 현황 (차트 이미지 + 테이블)
  6. Phase 가중치 분포 (차트 이미지)
  7. 지연 작업 목록
  8. 금주/차주 주요 작업

차트 캡처:
  - SVG → Canvas → PNG 변환 (svgToPng)
  - Recharts SVG에서 직접 캡처
  - CSS 변수를 실제 값으로 치환 후 렌더링

서식: A4, 헤더/푸터 포함, 페이지 번호
```

### 8.6 Excel Import

```
함수: parseTasksFromWorkbook()
위치: excel.ts
라이브러리: xlsx (SheetJS)

처리 흐름:
  1. "WBS 데이터" 시트 우선 탐색 → 없으면 첫 번째 시트
  2. sheet_to_json으로 행 배열 변환
  3. 각 행에서 필드 매핑:
     - WBS코드 → wbsCode (계층 구조 복원에 사용)
     - 상위WBS코드 → parentId (codeToId 맵으로 변환)
     - 구분 → level (Phase=1, Activity=2, Task=3)
     - 상태/상태코드 → status
     - 날짜: Excel 시리얼 → yyyy-MM-dd 변환
  4. 새 UUID 부여, projectId 설정
```

---

## 9. 보안 아키텍처

### 9.1 인증 흐름 (Supabase Auth)

```
회원가입:
  signUpWithEmail(email, password, name)
  → Supabase Auth signUp
  → profiles 테이블에 자동 생성 (account_status: 'pending')
  → 관리자 승인 대기

로그인:
  signInWithEmail(email, password)
  → Supabase Auth signInWithPassword
  → profiles 조회 (system_role, account_status)
  → toAppUser() 변환
  → authStore.setUser()

세션 복원:
  ensureSupabaseSession()
  → supabase.auth.getSession()
  → session.user → toAppUser()

세션 구독:
  subscribeToSupabaseAuthChanges(callback)
  → supabase.auth.onAuthStateChange()
  → 세션 변경 시 callback 호출
```

### 9.2 인가 (역할 기반 접근 제어)

**시스템 역할 (systemRole):**

| 역할 | 권한 |
|------|------|
| admin | 모든 사용자 관리, 역할 변경, 계정 상태 변경 |
| user | 일반 사용자 (프로젝트 생성/참여) |

**프로젝트 역할 (ProjectMember.role):**

| 권한 | owner | admin | member | viewer |
|------|:-----:|:-----:|:------:|:------:|
| canEditProject | O | O | X | X |
| canDeleteProject | O | X | X | X |
| canManageMembers | O | O | X | X |
| canCreateTask | O | O | O | X |
| canEditTask | O | O | O | X |
| canDeleteTask | O | O | X | X |
| canExport | O | O | O | O |
| canViewAttendance | O | O | O | O |
| canEditOwnAttendance | O | O | O | X |
| canEditAllAttendance | O | O | X | X |

### 9.3 라우트 가드

```
ProtectedRoute:
  - isLoading → 스피너
  - !isAuthenticated → /login 리다이렉트
  - isPending || isSuspended → /pending 리다이렉트

AdminRoute:
  - !isAdmin → / 리다이렉트

useProjectPermission:
  - systemRole === 'admin' → 프로젝트 admin 권한 자동 부여
  - 멤버 목록에서 user.id로 역할 조회
  - 역할 없음 → 모든 권한 false, isReadOnly = true
```

---

## 10. 성능 최적화 전략

### 10.1 useMemo 패턴

```
Dashboard.tsx:
  - 통계 계산 (calculateProjectStats)
  - 상태 분포 (calculateStatusDistribution)
  - 담당자 업무량 (calculateAssigneeWorkloads)
  - Phase 진행률 (calculatePhaseProgress)
  - 가중치 분포 (calculateWeightDistribution)
  → tasks/members 변경 시에만 재계산

useProjectPermission:
  - user, members 변경 시에만 권한 재계산

taskStore:
  - normalizeTaskHierarchy는 setTasks 내부에서만 호출
  - expandedIds 변경 시 정규화 없이 flattenTaskTree만 재실행
```

### 10.2 디바운스 자동 저장

```
useAutoSave:
  - 기본 딜레이: 700ms
  - 디바운스: clearTimeout → setTimeout
  - 프로젝트 전환 시 타이머 취소
  - 페이지 이탈 시 beforeunload 경고
  - 언마운트 시 보류 데이터 즉시 저장
```

### 10.3 BroadcastChannel 동기화

```
채널명: 'dk-flow-sync'
메시지 타입:
  - TASKS_UPDATED: { windowId, projectId, tasks[] }
  - PROJECT_UPDATED: { windowId, projectId, updates }

자기 메시지 무시: windowId 비교
동일 프로젝트만 처리: loadedProjectId 비교
원격 업데이트 표시: _fromRemote: true (재방송 방지)
```

### 10.4 Vite 번들 최적화

```
- Vite 7 기반 빌드
- TypeScript 5.9 strict 모드
- 코드 분할: React.lazy 미사용 (SPA 단일 번들)
- 트리 셰이킹: ExcelJS, docx, PptxGenJS (사용 시에만 로드)
- CSS: Tailwind CSS 4 purge 적용
```

---

## 11. 모듈 의존 관계도

```
+==========================================+
|              Pages (UI Layer)            |
|  Dashboard | WBS | Gantt | Members |     |
|  Settings | Attendance | Login | etc.    |
+====+========+========+========+=========+
     |        |        |        |
     v        v        v        v
+====+========+========+========+=========+
|           Zustand Stores                 |
|  authStore | projectStore | taskStore    |
|  attendanceStore | themeStore | uiStore  |
+====+========+========+=================+
     |        |        |
     v        v        v
+====+========+========+============================+
|              Lib (Business Logic)                  |
|                                                    |
|  +--projectTaskSync--+   +--taskAnalytics--------+ |
|  | normalizeTask     |   | getLeafTasks          | |
|  | Hierarchy         |   | calculateProjectStats | |
|  | deriveProject     |-->| calculateAssignee     | |
|  | Status            |   | Workloads             | |
|  | syncProject       |   | calculatePhase        | |
|  | Workspace         |   | Progress              | |
|  +--------+----------+   +----------+------------+ |
|           |                          |               |
|  +--------v----------+   +----------v------------+ |
|  | taskFieldSync     |   | weeklyReport          | |
|  | syncTaskField     |   | generateWeeklyReport  | |
|  | syncTaskFields    |   +----------+------------+ |
|  +-------------------+              |               |
|                              +------v---------+     |
|  +--taskScheduler----+      | weeklySnapshot  |    |
|  | autoScheduleTasks |      | saveSnapshot    |    |
|  | buildSequential   |      | compareSnapshots|    |
|  | Dependencies      |      +----------------+     |
|  +-------------------+                              |
|                                                     |
|  +--taskAutoFill-----+   +--taskDraft-----------+  |
|  | autoFillOutputs   |   | generateTasksFrom    |  |
|  | autoAssignMembers |   | Prompt               |  |
|  | autoCalculate     |   +------+---------------+  |
|  | Weights           |          |                   |
|  +-------------------+   +------v---------------+  |
|                          | taskTemplates         |  |
|  +--permissions------+   | 4종 프로젝트 템플릿   |  |
|  | getProjectPerms   |   +-----------------------+  |
|  +-------------------+                              |
|                                                     |
|  +--excel.ts---------+   +--exportReport.ts------+  |
|  | exportWbsWorkbook |   | generateProject       |  |
|  | exportGanttWkbook |   | Report (docx)         |  |
|  | parseTasksFrom    |   +-----------------------+  |
|  | Workbook (import) |                              |
|  +-------------------+   +--exportWeekly---------+  |
|                          | ReportPptx.ts         |  |
|  +--broadcastSync----+   | (PPT 내보내기)        |  |
|  | broadcastTasks    |   +-----------------------+  |
|  | broadcastProject  |                              |
|  | Update            |   +--exportWeekly---------+  |
|  | onTasksUpdated    |   | Report.ts             |  |
|  | onProjectUpdated  |   | (Excel 내보내기)      |  |
|  +-------------------+   +-----------------------+  |
+====+=============================================+===+
     |
     v
+====+=============================================+===+
|              dataRepository.ts                       |
|  (Supabase / localStorage 추상화)                    |
+====+========================+========================+
     |                        |
     v                        v
+----+--------+        +------+--------+
| supabase.ts |        | utils.ts      |
| (Auth,      |        | (storage,     |
|  Migrations)|        |  날짜, 트리)  |
+-------------+        +---------------+
```

---

## 12. 주요 컴포넌트 명세

### 12.1 페이지 컴포넌트

**App.tsx**
- 역할: 최상위 라우터, 인증 가드, 프로젝트 상세 래퍼
- 주요 구성: BrowserRouter, ProtectedRoute, AdminRoute, ProjectDetailWrapper, PopupProjectWrapper
- 초기화: ensureMigrations → 인증 확인 → 프로젝트 로드

**Dashboard.tsx**
- 역할: 프로젝트 대시보드 (통계, 차트, 작업 목록)
- 데이터: taskStore.tasks, projectStore.currentProject, projectStore.members
- 차트: Recharts (상태 분포 파이, Phase 진행률 바, 담당자 업무량 바, 가중치 도넛)
- 내보내기: Word 현황보고서 (generateProjectReport)

**WBS.tsx**
- 역할: WBS 테이블 편집기
- 기능: 인라인 셀 편집, 드래그&드롭, 컨텍스트 메뉴, 작업 추가/삭제
- 자동화: 템플릿, 빠른 초안, 자동 일정, 자동 채움
- 내보내기: Excel WBS (exportWbsWorkbook)

**Gantt.tsx**
- 역할: 간트 차트 뷰
- 기능: 주차별 타임라인, 필터링, 검색, 확대/축소
- 내보내기: Excel 간트 (exportGanttWorkbook)

**Members.tsx**
- 역할: 프로젝트 멤버 관리
- 기능: 멤버 추가/삭제/역할 변경, 중복 경고

**Settings.tsx**
- 역할: 프로젝트 설정
- 기능: 이름/설명 변경, 상태 모드 (auto/manual), 주 시작 요일, Excel 가져오기/내보내기, 프로젝트 삭제

**Attendance.tsx**
- 역할: 근태 관리
- 기능: 캘린더 형태, 멤버별 근태 CRUD, 유형 9종

**Login.tsx**
- 역할: 로그인/회원가입
- 모드: Supabase 모드 (이메일+비밀번호), 로컬 모드 (자동 진입)

**UserManagement.tsx**
- 역할: 시스템 관리자 사용자 관리
- 기능: 전체 사용자 목록, 역할 변경, 계정 상태 변경 (승인/정지)

**AccountSettings.tsx**
- 역할: 개인 계정 설정
- 기능: 프로필 수정, 회원 탈퇴

### 12.2 공통 컴포넌트

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| Layout | layout/Layout.tsx | Sidebar + Header + Outlet 레이아웃 |
| Header | layout/Header.tsx | 상단 헤더 (프로젝트명, 저장상태, 테마토글) |
| Sidebar | layout/Sidebar.tsx | 좌측 내비게이션 (프로젝트 메뉴, 관리메뉴) |
| Button | common/Button.tsx | 공통 버튼 (variant, size, loading) |
| Modal | common/Modal.tsx | 공통 모달 (오버레이, 닫기) |
| ConfirmModal | common/ConfirmModal.tsx | 확인/취소 모달 |
| DKFlowLogo | common/DKFlowLogo.tsx | 브랜드 로고 SVG |
| FeedbackNotice | common/FeedbackNotice.tsx | 피드백 알림 |
| ContextMenu | wbs/ContextMenu.tsx | WBS 우클릭 메뉴 |
| GanttChart | wbs/GanttChart.tsx | 간트 차트 렌더링 |
| MemberSelect | wbs/MemberSelect.tsx | 담당자 선택 드롭다운 |
| QuickProgressModal | wbs/QuickProgressModal.tsx | 빠른 진행률 입력 |
| AttendanceModal | attendance/AttendanceModal.tsx | 근태 입력 모달 |
| WeeklyReportModal | WeeklyReportModal.tsx | 주간보고 생성/미리보기/내보내기 |
| ChatbotWidget | chatbot/ChatbotWidget.tsx | 챗봇 위젯 |

---

## 13. 부록

### 13.1 상수 정의

**프로젝트 상태:**

| 코드 | 라벨 | 색상 |
|------|------|------|
| preparing | 준비 | #d88b44 |
| active | 진행 | #0f766e |
| completed | 완료 | #2fa67c |
| deleted | 삭제 | #cb4b5f |

**작업 상태:**

| 코드 | 라벨 | 색상 키 |
|------|------|---------|
| pending | 대기 | gray |
| in_progress | 진행중 | blue |
| completed | 완료 | green |
| on_hold | 보류 | yellow |

**작업 레벨:**

| 레벨 | 라벨 |
|------|------|
| 0 | 프로젝트 |
| 1 | Phase |
| 2 | Activity |
| 3 | Task |

**근태 유형:**

| 코드 | 라벨 | 색상 |
|------|------|------|
| present | 출근 | #22c55e |
| annual_leave | 연차 | #3b82f6 |
| half_day_am | 오전반차 | #06b6d4 |
| half_day_pm | 오후반차 | #06b6d4 |
| sick_leave | 병가 | #ef4444 |
| business_trip | 출장 | #a855f7 |
| late | 지각 | #f97316 |
| early_leave | 조퇴 | #f97316 |
| absence | 결근 | #dc2626 |

**프로젝트 멤버 역할:**

| 역할 | 설명 |
|------|------|
| owner | 프로젝트 소유자 (최고 권한) |
| admin | 프로젝트 관리자 |
| member | 일반 멤버 (작업 편집 가능) |
| viewer | 열람자 (읽기 전용) |

**작업 출처:**

| 코드 | 설명 |
|------|------|
| manual | 수동 생성 |
| template | 템플릿에서 생성 |
| quick_draft | 빠른 초안에서 생성 |
| imported | Excel 가져오기 |
| cloned | 프로젝트 복제 |

### 13.2 프로젝트 템플릿 4종

| ID | 이름 | 대상 | Phase 수 |
|----|------|------|----------|
| steel-project | 철강 프로젝트 | 냉연, 열연, 도금 등 | 5 (분석-설계-개발-테스트-안정화) |
| web-launch | 웹 출시 | 홈페이지, 쇼핑몰 | 표준 웹 개발 |
| mobile-app | 모바일 앱 | iOS/Android 앱 | 앱 개발 라이프사이클 |
| internal-system | 내부 시스템 | ERP, 백오피스 | 내부 시스템 구축 |

### 13.3 환경 변수

| 변수명 | 필수 | 설명 |
|--------|------|------|
| VITE_SUPABASE_URL | 선택 | Supabase 프로젝트 URL |
| VITE_SUPABASE_ANON_KEY | 선택 | Supabase Anonymous Key |

두 값이 모두 설정되면 Supabase 모드, 하나라도 없으면 localStorage 모드로 동작한다.

### 13.4 개발 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite 개발 서버 (http://localhost:5173) |
| `npm run build` | TypeScript 검사 + Vite 프로덕션 빌드 |
| `npm run lint` | ESLint 실행 |
| `npm run preview` | 프로덕션 빌드 미리보기 (http://localhost:4173) |
| `npm run test:e2e` | Playwright E2E 테스트 (빌드 필요, 4173 포트) |

### 13.5 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | React | 19 |
| 언어 | TypeScript | 5.9 |
| 빌드 | Vite | 7 |
| 스타일링 | Tailwind CSS | 4 |
| 상태 관리 | Zustand | 5 |
| 라우팅 | React Router | 7 |
| 차트 | Recharts | 3 |
| 백엔드 | Supabase | (선택) |
| 날짜 | date-fns | 4 (한국어 로케일) |
| Excel | ExcelJS + SheetJS (xlsx) | - |
| Word | docx | - |
| PPT | PptxGenJS | - |
| 아이콘 | Lucide React | - |
| 테스트 | Playwright | - |
| 폰트 | Pretendard Variable | - |

### 13.6 WBS 기본 컬럼 정의

| ID | 헤더 | 너비 | 타입 | 편집 | 고정 |
|----|------|------|------|------|------|
| level | 구분 | 80px | readonly | X | O |
| name | 작업명 | 300px | text | O | O |
| output | 산출물 | 150px | text | O | - |
| assignee | 담당자 | 100px | select | O | - |
| weight | 가중치 | 80px | number | O | - |
| planStart | 계획시작 | 110px | date | O | - |
| planEnd | 계획종료 | 110px | date | O | - |
| planProgress | 계획공정율 | 90px | progress | O | - |
| actualStart | 실적시작 | 110px | date | O | - |
| actualEnd | 실적종료 | 110px | date | O | - |
| actualProgress | 실적공정율 | 90px | progress | O | - |
| status | 상태 | 90px | select | O | - |

### 13.7 필드 자동 연동 규칙 (taskFieldSync)

**상태 변경 시:**

| 변경 전 | 변경 후 | 자동 연동 |
|---------|---------|-----------|
| * | completed | actualProgress=100, actualEnd=오늘, actualStart=planStart또는오늘 |
| * | in_progress | actualStart=오늘, actualEnd=null. progress>=100이면 50으로 |
| * | pending | actualProgress=0, actualStart=null, actualEnd=null |
| * | on_hold | 변경 없음 |

**실적공정율 변경 시:**

| 범위 | 자동 연동 |
|------|-----------|
| >= 100 | status=completed, actualEnd=오늘, actualStart 보정 |
| 1~99 | status=in_progress (on_hold 제외), actualStart=오늘, actualEnd=null |
| 0 | status=pending (in_progress에서만) |

**실적시작 입력 시:**
- status가 pending이면 → in_progress, actualProgress가 0이면 5로 설정

**실적종료 입력 시:**
- status=completed, actualProgress=100, actualStart 보정

---

*이 문서는 DK Flow 소스코드 분석을 기반으로 작성되었습니다.*
*버전 관리: 소스코드 변경 시 해당 섹션을 함께 업데이트해야 합니다.*
