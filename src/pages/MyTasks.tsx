import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Activity,
  CheckCircle2,
  ArrowRight,
  FolderOpen,
  ListTree,
  Loader2,
  Clock3,
} from 'lucide-react';
import { format, parseISO, isBefore, isAfter, isEqual, differenceInCalendarDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { useThemeStore } from '../store/themeStore';
import { loadProjectMembers, loadProjectTasks } from '../lib/dataRepository';
import { getLeafTasks } from '../lib/taskAnalytics';
import type { Project, ProjectMember, Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, LEVEL_LABELS } from '../types';

// ─── Types ───────────────────────────────────────────────────

interface MyTask {
  task: Task;
  project: Project;
  breadcrumb: string;
}

type Section = 'dueToday' | 'dueThisWeek' | 'overdue' | 'inProgress' | 'recentlyCompleted';

// ─── Helpers ─────────────────────────────────────────────────

function toStartOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parsePlanEnd(s?: string | null): Date | null {
  if (!s) return null;
  try {
    return toStartOfDay(parseISO(s));
  } catch {
    return null;
  }
}

function parseActualEnd(s?: string | null): Date | null {
  if (!s) return null;
  try {
    return toStartOfDay(parseISO(s));
  } catch {
    return null;
  }
}

function formatKoreanDate(s?: string | null): string {
  if (!s) return '미정';
  try {
    return format(parseISO(s), 'M월 d일 (EEE)', { locale: ko });
  } catch {
    return s;
  }
}

function buildBreadcrumb(task: Task, taskMap: Map<string, Task>): string {
  const parts: string[] = [];
  let current: Task | undefined = task;
  // 자기 자신 제외, 상위만 수집
  const visited = new Set<string>();
  while (current?.parentId) {
    if (visited.has(current.parentId)) break;
    visited.add(current.parentId);
    const parent = taskMap.get(current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(' › ');
}

const STATUS_COLORS: Record<TaskStatus, { fg: string; bg: string; border: string }> = {
  pending: { fg: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.22)' },
  in_progress: { fg: '#0f766e', bg: 'rgba(15,118,110,0.10)', border: 'rgba(15,118,110,0.22)' },
  completed: { fg: '#2fa67c', bg: 'rgba(47,166,124,0.12)', border: 'rgba(47,166,124,0.24)' },
  on_hold: { fg: '#cb6d37', bg: 'rgba(203,109,55,0.12)', border: 'rgba(203,109,55,0.22)' },
};

const SECTION_CONFIG: Record<Section, { title: string; desc: string; icon: typeof AlertTriangle; accent: string; empty: string }> = {
  overdue: {
    title: '지연',
    desc: '계획 종료일이 지났지만 아직 완료되지 않은 작업',
    icon: AlertTriangle,
    accent: '#cb4b5f',
    empty: '지연된 작업이 없습니다. 훌륭해요!',
  },
  dueToday: {
    title: '오늘 마감',
    desc: '오늘이 계획 종료일인 진행 중 작업',
    icon: CalendarClock,
    accent: '#d88b44',
    empty: '오늘 마감 작업이 없습니다.',
  },
  dueThisWeek: {
    title: '이번 주 마감',
    desc: '7일 이내 계획 종료일이 다가오는 작업',
    icon: CalendarDays,
    accent: '#0f766e',
    empty: '이번 주 마감 작업이 없습니다.',
  },
  inProgress: {
    title: '진행 중',
    desc: '현재 진행 중이면서 마감이 급하지 않은 작업',
    icon: Activity,
    accent: '#123d64',
    empty: '진행 중인 작업이 없습니다.',
  },
  recentlyCompleted: {
    title: '최근 완료',
    desc: '최근 7일간 완료한 작업',
    icon: CheckCircle2,
    accent: '#2fa67c',
    empty: '최근 완료한 작업이 없습니다.',
  },
};

// ─── Component ───────────────────────────────────────────────

export default function MyTasks() {
  const user = useAuthStore((s) => s.user);
  const { projects } = useProjectStore();
  const isDark = useThemeStore((s) => s.isDark);

  const [isLoading, setIsLoading] = useState(true);
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);

  const heroPanelClassName = isDark
    ? 'app-panel-dark relative overflow-hidden p-6 md:p-8'
    : 'app-panel relative overflow-hidden p-6 md:p-8';
  const heroPanelStyle = isDark
    ? {
        backgroundImage:
          'radial-gradient(circle at 86% 16%, rgba(15,118,110,0.32), transparent 28%), radial-gradient(circle at 18% 84%, rgba(203,109,55,0.22), transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))',
      }
    : {
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,243,238,0.94))',
      };
  const heroBadgeClassName = isDark
    ? 'surface-badge border-white/12 bg-white/[0.14] text-white/90'
    : 'surface-badge border-[rgba(15,118,110,0.08)] bg-white/80 text-[color:var(--text-secondary)]';
  const heroMetricClassName = isDark
    ? 'rounded-[22px] border border-white/12 bg-white/[0.1] p-4'
    : 'rounded-[22px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.72)] p-4';
  const heroHeadingClassName = isDark ? 'text-white' : 'text-[color:var(--text-primary)]';
  const heroSubTextClassName = isDark ? 'text-white/80' : 'text-[color:var(--text-secondary)]';
  const heroMetricLabelClassName = isDark ? 'text-white/80' : 'text-[color:var(--text-secondary)]';
  const heroMetricValueClassName = isDark ? 'text-white' : 'text-[color:var(--text-primary)]';

  // ─── Load tasks across all user's projects ────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadAll = async () => {
      setIsLoading(true);
      try {
        const activeProjects = projects.filter((p) => p.status !== 'deleted');
        const perProject = await Promise.all(
          activeProjects.map(async (project) => {
            const [tasks, members] = await Promise.all([
              loadProjectTasks(project.id),
              loadProjectMembers(project.id),
            ]);
            return { project, tasks, members };
          }),
        );

        if (cancelled) return;

        const collected: MyTask[] = [];
        for (const { project, tasks, members } of perProject) {
          const myMemberIds = new Set(
            members.filter((m: ProjectMember) => m.userId === user.id).map((m) => m.id),
          );
          if (myMemberIds.size === 0) continue;

          const taskMap = new Map(tasks.map((t) => [t.id, t]));
          const leafTasks = getLeafTasks(tasks);
          for (const task of leafTasks) {
            if (!task.assigneeId || !myMemberIds.has(task.assigneeId)) continue;
            collected.push({
              task,
              project,
              breadcrumb: buildBreadcrumb(task, taskMap),
            });
          }
        }

        setMyTasks(collected);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [user, projects]);

  // ─── Bucketize ────────────────────────────────────────────
  const buckets = useMemo(() => {
    const today = toStartOfDay(new Date());
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    const days7Ago = new Date(today);
    days7Ago.setDate(days7Ago.getDate() - 7);

    const overdue: MyTask[] = [];
    const dueToday: MyTask[] = [];
    const dueThisWeek: MyTask[] = [];
    const inProgress: MyTask[] = [];
    const recentlyCompleted: MyTask[] = [];

    for (const entry of myTasks) {
      const { task } = entry;
      if (task.status === 'completed') {
        const done = parseActualEnd(task.actualEnd) ?? parsePlanEnd(task.planEnd);
        if (done && !isBefore(done, days7Ago) && !isAfter(done, today)) {
          recentlyCompleted.push(entry);
        }
        continue;
      }

      const planEnd = parsePlanEnd(task.planEnd);

      if (planEnd && isBefore(planEnd, today)) {
        overdue.push(entry);
        continue;
      }
      if (planEnd && isEqual(planEnd, today)) {
        dueToday.push(entry);
        continue;
      }
      if (planEnd && isAfter(planEnd, today) && !isAfter(planEnd, in7Days)) {
        dueThisWeek.push(entry);
        continue;
      }
      if (task.status === 'in_progress') {
        inProgress.push(entry);
      }
    }

    const byEnd = (a: MyTask, b: MyTask) =>
      (a.task.planEnd ?? '9999').localeCompare(b.task.planEnd ?? '9999');
    const byEndDesc = (a: MyTask, b: MyTask) =>
      (b.task.actualEnd ?? b.task.planEnd ?? '').localeCompare(a.task.actualEnd ?? a.task.planEnd ?? '');

    overdue.sort(byEnd);
    dueToday.sort(byEnd);
    dueThisWeek.sort(byEnd);
    inProgress.sort(byEnd);
    recentlyCompleted.sort(byEndDesc);

    return { overdue, dueToday, dueThisWeek, inProgress, recentlyCompleted };
  }, [myTasks]);

  const kpis = useMemo(() => {
    const today = toStartOfDay(new Date());
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    const days7Ago = new Date(today);
    days7Ago.setDate(days7Ago.getDate() - 7);

    const total = myTasks.length;
    const dueTodayCount = buckets.dueToday.length;
    const overdueCount = buckets.overdue.length;
    const completedThisWeek = myTasks.filter(({ task }) => {
      if (task.status !== 'completed') return false;
      const done = parseActualEnd(task.actualEnd) ?? parsePlanEnd(task.planEnd);
      return done ? !isBefore(done, days7Ago) && !isAfter(done, today) : false;
    }).length;

    return { total, dueTodayCount, overdueCount, completedThisWeek };
  }, [myTasks, buckets]);

  // ─── Render ───────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[color:var(--text-secondary)]">
        로그인이 필요합니다.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-8">
      {/* ── Hero ── */}
      <section className={heroPanelClassName} style={heroPanelStyle}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(203,109,55,0.18),transparent_72%)] blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className={heroBadgeClassName}>
              <UserCheck className="h-3.5 w-3.5" />
              나의 업무 허브
            </div>
            <h1 className={`mt-5 text-[clamp(2rem,4.2vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.04em] ${heroHeadingClassName}`}>
              내 작업
            </h1>
            <p className={`mt-3 max-w-xl text-sm leading-6 md:text-base ${heroSubTextClassName}`}>
              {user.name}님에게 배정된 모든 프로젝트의 작업을 한 곳에서 확인하고 우선순위를 빠르게 판단하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/projects"
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                isDark
                  ? 'border-white/14 bg-white/[0.12] text-white hover:bg-white/[0.18]'
                  : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-secondary-solid)]'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              프로젝트 목록
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="relative z-10 mt-8 grid gap-3 md:grid-cols-4">
          <KpiCard
            className={heroMetricClassName}
            labelClass={heroMetricLabelClassName}
            valueClass={heroMetricValueClassName}
            label="할당된 작업"
            value={kpis.total}
            hint="전체 프로젝트 합계"
          />
          <KpiCard
            className={heroMetricClassName}
            labelClass={heroMetricLabelClassName}
            valueClass={heroMetricValueClassName}
            label="오늘 마감"
            value={kpis.dueTodayCount}
            hint="오늘이 계획 종료일"
            accent="#d88b44"
          />
          <KpiCard
            className={heroMetricClassName}
            labelClass={heroMetricLabelClassName}
            valueClass={heroMetricValueClassName}
            label="지연"
            value={kpis.overdueCount}
            hint="종료일이 지난 미완료 작업"
            accent="#cb4b5f"
          />
          <KpiCard
            className={heroMetricClassName}
            labelClass={heroMetricLabelClassName}
            valueClass={heroMetricValueClassName}
            label="이번 주 완료"
            value={kpis.completedThisWeek}
            hint="최근 7일간 마무리"
            accent="#2fa67c"
          />
        </div>
      </section>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--accent-primary)]" />
        </div>
      ) : myTasks.length === 0 ? (
        <section className="app-panel px-6 py-16">
          <div className="empty-state">
            <UserCheck className="h-12 w-12 text-[color:var(--text-muted)]" />
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              배정된 작업이 없습니다
            </h3>
            <p className="max-w-md text-sm leading-6 text-[color:var(--text-secondary)]">
              프로젝트 멤버로 추가되고 WBS 작업의 담당자로 지정되면 이곳에서 확인할 수 있습니다.
            </p>
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              프로젝트 목록으로 이동
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          <TaskSection section="overdue" items={buckets.overdue} />
          <TaskSection section="dueToday" items={buckets.dueToday} />
          <TaskSection section="dueThisWeek" items={buckets.dueThisWeek} />
          <TaskSection section="inProgress" items={buckets.inProgress} />
          <TaskSection section="recentlyCompleted" items={buckets.recentlyCompleted} />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  accent,
  className,
  labelClass,
  valueClass,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: string;
  className: string;
  labelClass: string;
  valueClass: string;
}) {
  return (
    <div className={className}>
      <p className={`text-[11px] uppercase tracking-[0.24em] ${labelClass}`}>{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${valueClass}`} style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      <p className={`mt-1 text-xs ${labelClass}`}>{hint}</p>
    </div>
  );
}

function TaskSection({ section, items }: { section: Section; items: MyTask[] }) {
  const config = SECTION_CONFIG[section];
  const Icon = config.icon;

  return (
    <section className="app-panel overflow-hidden">
      <div className="relative flex flex-col gap-4 border-b border-[var(--border-color)] px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: `${config.accent}16`,
              color: config.accent,
              border: `1px solid ${config.accent}26`,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
              {config.title}
              <span
                className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: `${config.accent}14`,
                  color: config.accent,
                  border: `1px solid ${config.accent}24`,
                }}
              >
                {items.length}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{config.desc}</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-[color:var(--text-secondary)]">
          {config.empty}
        </div>
      ) : (
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((entry) => (
            <TaskCard key={`${entry.project.id}:${entry.task.id}`} entry={entry} sectionAccent={config.accent} />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskCard({ entry, sectionAccent }: { entry: MyTask; sectionAccent: string }) {
  const { task, project, breadcrumb } = entry;
  const statusColor = STATUS_COLORS[task.status];
  const levelLabel = LEVEL_LABELS[task.level] ?? '';

  const today = toStartOfDay(new Date());
  const planEnd = parsePlanEnd(task.planEnd);
  const delayDays =
    planEnd && task.status !== 'completed' && isBefore(planEnd, today)
      ? differenceInCalendarDays(today, planEnd)
      : 0;

  return (
    <Link
      to={`/projects/${project.id}/wbs`}
      className="group relative flex flex-col gap-3 rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[0_24px_48px_-30px_rgba(17,24,39,0.22)]"
    >
      <div
        className="pointer-events-none absolute inset-x-4 top-0 h-px opacity-80"
        style={{ backgroundColor: sectionAccent }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)]">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: `${sectionAccent}26`,
                color: sectionAccent,
                backgroundColor: `${sectionAccent}10`,
              }}
            >
              <FolderOpen className="h-3 w-3" />
              {project.name}
            </span>
            {levelLabel && (
              <span className="inline-flex items-center rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--text-secondary)]">
                {levelLabel}
              </span>
            )}
          </div>
          <h3
            className="mt-2 truncate text-[15px] font-semibold tracking-[-0.02em] text-[color:var(--text-primary)]"
            title={task.name}
          >
            {task.name}
          </h3>
          {breadcrumb && (
            <p
              className="mt-1 flex items-center gap-1 truncate text-[11px] text-[color:var(--text-muted)]"
              title={breadcrumb}
            >
              <ListTree className="h-3 w-3 shrink-0" />
              {breadcrumb}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            borderColor: statusColor.border,
            backgroundColor: statusColor.bg,
            color: statusColor.fg,
          }}
        >
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-[color:var(--text-secondary)]">
          <span>진도</span>
          <span className="font-semibold text-[color:var(--text-primary)]">{task.actualProgress}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--bg-tertiary)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, task.actualProgress))}%`,
              backgroundColor: sectionAccent,
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          <span>
            {task.status === 'completed'
              ? `완료 ${formatKoreanDate(task.actualEnd ?? task.planEnd)}`
              : `마감 ${formatKoreanDate(task.planEnd)}`}
          </span>
        </div>
        {delayDays > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(203,75,95,0.28)] bg-[rgba(203,75,95,0.1)] px-2 py-0.5 font-semibold text-[#cb4b5f]">
            <AlertTriangle className="h-3 w-3" />
            {delayDays}일 지연
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[color:var(--text-muted)]">
            바로가기
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
    </Link>
  );
}
