// 사용자 타입
export type SystemRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  systemRole: SystemRole;
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
}

// 프로젝트 멤버 타입
export interface ProjectMember {
  id: string;
  projectId: string;
  userId?: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: string;
}

// 작업 타입
export interface Task {
  id: string;
  projectId: string;
  parentId?: string | null;
  level: number; // 1=Phase, 2=Activity, 3=Task, 4=Function
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
  4: 'Function',
};

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
  { id: 'planStart', header: '계획시작', width: 110, accessor: 'planStart', type: 'date', editable: true },
  { id: 'planEnd', header: '계획종료', width: 110, accessor: 'planEnd', type: 'date', editable: true },
  { id: 'planProgress', header: '계획공정율', width: 90, accessor: 'planProgress', type: 'progress', editable: true },
  { id: 'actualStart', header: '실적시작', width: 110, accessor: 'actualStart', type: 'date', editable: true },
  { id: 'actualEnd', header: '실적종료', width: 110, accessor: 'actualEnd', type: 'date', editable: true },
  { id: 'actualProgress', header: '실적공정율', width: 90, accessor: 'actualProgress', type: 'progress', editable: true },
  { id: 'status', header: '상태', width: 90, accessor: 'status', type: 'select', editable: true },
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
