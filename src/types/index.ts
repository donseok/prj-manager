// 사용자 타입
export type SystemRole = 'superadmin' | 'admin' | 'user';
export type AccountStatus = 'pending' | 'active' | 'suspended';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  systemRole: SystemRole;
  accountStatus: AccountStatus;
  createdAt: string;
}

// 프로젝트 상태 타입
export type ProjectStatus = 'preparing' | 'active' | 'completed' | 'deleted';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  preparing: '준비',
  active: '진행',
  completed: '완료',
  deleted: '삭제',
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  preparing: '#d88b44',
  active: '#0f766e',
  completed: '#2fa67c',
  deleted: '#cb4b5f',
};

// 프로젝트 타입
export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  baseDate?: string; // 진척기준일
  status: ProjectStatus;
  completedAt?: string; // 완료일시
  settings?: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  weekStartsOn?: 0 | 1; // 0: 일요일, 1: 월요일
  showWeekends?: boolean;
  defaultView?: 'week' | 'month';
  statusMode?: 'auto' | 'manual';
  manualStatus?: ProjectStatus;
  ganttSummaryCollapsed?: boolean;
  kanbanSummaryCollapsed?: boolean;
  wbsSummaryCollapsed?: boolean;
  /** 주간보고 엑셀 양식 (프로젝트 수명 동안 고정) */
  reportTemplate?: WeeklyReportTemplate;
}

/**
 * 주간보고 엑셀 양식 메타데이터
 *
 * 최초 다운로드 시점에 프로젝트명/phase 목록을 시드로 생성되어
 * 프로젝트가 완료될 때까지 동일한 양식이 유지된다.
 */
export interface WeeklyReportTemplate {
  /** 양식 버전 (스키마 변경 시 증가) */
  version: number;
  /** 생성/고정 일시 */
  createdAt: string;
  /** 공정보고 제목 접두 (예: "1. 스마트물류시스템 2단계 구축") */
  titlePrefix: string;
  /** 테마 HEX 컬러 (6자, # 제외) */
  themeColor: string;
  /** 공정 진도 항목 — 최초 생성 시 프로젝트 phase 이름들로 고정 */
  progressCategories: Array<{
    /** 구분 */
    section: string;
    /** 항목 */
    item: string;
    /** 점유율 (가중치) */
    weight: number;
  }>;
  /** 고정 섹션 라벨 */
  labels: {
    progressSection: string;
    planSection: string;
    wbsSheet: string;
    devSheet: string;
    reportSheet: string;
  };
}

// 프로젝트 멤버 타입
export interface ProjectMember {
  id: string;
  projectId: string;
  userId?: string;
  name: string;
  role: 'owner' | 'admin' | 'editor' | 'member' | 'viewer';
  avatarUrl?: string;
  createdAt: string;
}

// 작업 타입
export interface Task {
  id: string;
  projectId: string;
  parentId?: string | null;
  level: number; // 1=Phase, 2=Activity, 3=Task, 4=Todo
  orderIndex: number;

  // 기본 정보
  name: string;
  description?: string;
  output?: string; // 산출물

  // 담당자
  assigneeId?: string | null;
  assignee?: ProjectMember | null;

  // 가중치/공정율
  weight: number;
  durationDays?: number | null;
  predecessorIds?: string[];
  taskSource?: 'manual' | 'template' | 'quick_draft' | 'imported' | 'cloned' | 'ai_generated';

  // 계획
  planStart?: string | null;
  planEnd?: string | null;
  planProgress: number; // 0~100

  // 실적
  actualStart?: string | null;
  actualEnd?: string | null;
  actualProgress: number; // 0~100

  // 상태
  status: TaskStatus;

  // 메타
  createdAt: string;
  updatedAt: string;

  // 프론트엔드용 계산 필드
  children?: Task[];
  isExpanded?: boolean;
  depth?: number;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '대기',
  in_progress: '진행중',
  completed: '완료',
  on_hold: '보류',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'gray',
  in_progress: 'blue',
  completed: 'green',
  on_hold: 'yellow',
};

export const LEVEL_LABELS: Record<number, string> = {
  0: '프로젝트',
  1: 'Phase',
  2: 'Activity',
  3: 'Task',
  4: 'Todo',
};

// 근태 타입
export type AttendanceType =
  | 'present'
  | 'annual_leave'
  | 'half_day_am'
  | 'half_day_pm'
  | 'sick_leave'
  | 'business_trip'
  | 'late'
  | 'early_leave'
  | 'absence';

export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  present: '출근',
  annual_leave: '연차',
  half_day_am: '오전반차',
  half_day_pm: '오후반차',
  sick_leave: '병가',
  business_trip: '출장',
  late: '지각',
  early_leave: '조퇴',
  absence: '결근',
};

export const ATTENDANCE_TYPE_COLORS: Record<AttendanceType, string> = {
  present: '#22c55e',
  annual_leave: '#3b82f6',
  half_day_am: '#06b6d4',
  half_day_pm: '#06b6d4',
  sick_leave: '#ef4444',
  business_trip: '#a855f7',
  late: '#f97316',
  early_leave: '#f97316',
  absence: '#dc2626',
};

export interface Attendance {
  id: string;
  projectId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  type: AttendanceType;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// 담당자별 주간보고
export interface WeeklyMemberReport {
  id: string;
  projectId: string;
  memberId: string;
  weekStart: string; // YYYY-MM-DD
  thisWeekResult: string;
  nextWeekPlan: string;
  createdAt: string;
  updatedAt: string;
}

// 간트 차트 관련 타입
export interface GanttBarData {
  taskId: string;
  taskName: string;
  planStart?: Date;
  planEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  progress: number;
  level: number;
}

// WBS 테이블 컬럼 정의
export interface WBSColumn {
  id: string;
  header: string;
  width: number;
  minWidth?: number;
  accessor: keyof Task | string;
  type: 'text' | 'number' | 'date' | 'select' | 'progress' | 'readonly';
  editable: boolean;
  fixed?: boolean;
}

export const DEFAULT_WBS_COLUMNS: WBSColumn[] = [
  { id: 'level', header: '구분', width: 80, accessor: 'level', type: 'readonly', editable: false, fixed: true },
  { id: 'name', header: '작업명', width: 300, minWidth: 200, accessor: 'name', type: 'text', editable: true, fixed: true },
  { id: 'output', header: '산출물', width: 150, accessor: 'output', type: 'text', editable: true },
  { id: 'assignee', header: '담당자', width: 100, accessor: 'assigneeId', type: 'select', editable: true },
  { id: 'weight', header: '가중치', width: 80, accessor: 'weight', type: 'number', editable: true },
  { id: 'planStart', header: '계획시작', width: 150, accessor: 'planStart', type: 'date', editable: true },
  { id: 'planEnd', header: '계획종료', width: 150, accessor: 'planEnd', type: 'date', editable: true },
  { id: 'planProgress', header: '계획공정율', width: 90, accessor: 'planProgress', type: 'progress', editable: false },
  { id: 'actualStart', header: '실적시작', width: 150, accessor: 'actualStart', type: 'date', editable: true },
  { id: 'actualEnd', header: '실적종료', width: 150, accessor: 'actualEnd', type: 'date', editable: true },
  { id: 'actualProgress', header: '실적공정율', width: 90, accessor: 'actualProgress', type: 'progress', editable: true },
  { id: 'status', header: '상태', width: 90, accessor: 'status', type: 'select', editable: true },
  { id: 'predecessors', header: '선행 작업', width: 160, accessor: 'predecessorIds', type: 'readonly', editable: false },
];

// 대시보드 관련 타입
export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  delayedTasks: number;
  overallProgress: number;
  plannedProgress: number;
}

export interface WeeklyTask {
  task: Task;
  type: 'thisWeek' | 'nextWeek' | 'delayed';
}

// AI 관련 타입
export type AIProvider = 'claude' | 'openai' | 'gemini';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model?: string; // 예: 'claude-sonnet-4-5-20250929', 'gpt-4o'
}

// 작업 코멘트
export interface TaskComment {
  id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

// 반복 작업 규칙
export interface RecurringRule {
  id: string;
  projectId: string;
  templateTaskName: string;
  parentId?: string;         // 생성할 상위 작업
  level: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number;        // weekly: 0(일)~6(토)
  dayOfMonth?: number;       // monthly: 1~31
  assigneeId?: string;
  output?: string;
  isActive: boolean;
  lastGeneratedAt?: string;
  createdAt: string;
}

export const FREQUENCY_LABELS: Record<RecurringRule['frequency'], string> = {
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
};

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
};

// 커스텀 템플릿
export interface CustomTemplate {
  id: string;
  name: string;
  description?: string;
  phases: number;
  taskCount: number;
  tasks: Omit<Task, 'projectId' | 'createdAt' | 'updatedAt'>[];
  createdAt: string;
}

// 회의록 분석 결과 타입
export interface MeetingTask {
  name: string;              // 업무명
  description?: string;      // 상세 내용 (회의록 원문 발췌)
  assigneeName?: string;     // 담당자명 (텍스트 — 사용자가 수동 매칭)
  startDate?: string;        // YYYY-MM-DD
  endDate?: string;          // YYYY-MM-DD
  level: 1 | 2 | 3 | 4;     // WBS 레벨 (1=Phase, 2=Activity, 3=Task, 4=Todo)
  selected: boolean;         // 등록 여부 (기본 true)
}

// 교차 프로젝트 열람 요청 (프로젝트 관리자가 타 프로젝트를 열람/관리하고 싶을 때 슈퍼관리자 승인 대상)
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type AccessRequestScope = 'read' | 'manage';

export interface ProjectAccessRequest {
  id: string;
  requesterId: string;           // 요청자 user id
  requesterName: string;         // 표시용 (슈퍼관리자가 사용자 프로필 조회 없이 식별 가능하도록)
  projectId: string;             // 대상 프로젝트
  projectName: string;           // 표시용
  scope: AccessRequestScope;     // 'read' → viewer, 'manage' → editor 로 승인 시 부여
  reason: string;
  status: AccessRequestStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;            // 결정한 슈퍼관리자 id
  decidedByName?: string;
  grantedMemberId?: string;      // 승인 시 추가한 ProjectMember.id (revoke 시 제거 대상)
}

// 담당자별 주간보고 메모
export interface MemberWeeklyNote {
  memberId: string;
  memberName: string;
  thisWeekAchievements: string;
  nextWeekPlans: string;
  updatedAt: string;
}
