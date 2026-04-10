import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Loader2,
  TrendingUp,
  Play,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PieChart as PieChartIcon,
  Target,
  Activity,
  Layers,
  Shield,
  CheckCircle,
  Globe,
  Zap,
  Settings,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Floating decorative element components                              */
/* ------------------------------------------------------------------ */
function FloatingElement({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function FloatingStatBubble({
  value,
  label,
  className = '',
  style = {},
}: {
  value: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-none absolute flex flex-col items-center justify-center rounded-[20px] border border-white/[0.1] bg-white/[0.07] backdrop-blur-md ${className}`}
      style={style}
    >
      <span className="text-2xl font-bold text-white/90">{value}</span>
      {label && (
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
          {label}
        </span>
      )}
    </div>
  );
}
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useProjectStore } from '../store/projectStore';
import { useThemeStore } from '../store/themeStore';
import { loadProjectTasks, loadProjectMembers } from '../lib/dataRepository';
import { calculateProjectStats } from '../lib/taskAnalytics';
import { getLeafTasks } from '../lib/taskAnalytics';
import { formatDate, formatPercent, getDelayedTasks } from '../lib/utils';
import type { Project, Task, ProjectMember } from '../types';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../types';

// ─── Types ────────────────────────────────────────────────────

interface ProjectPortfolioData {
  project: Project;
  tasks: Task[];
  members: ProjectMember[];
  planProgress: number;
  actualProgress: number;
  gap: number;
  delayedCount: number;
  memberCount: number;
  healthStatus: 'good' | 'warning' | 'danger';
  healthScore: number;
}

type SortField =
  | 'name'
  | 'status'
  | 'startDate'
  | 'endDate'
  | 'planProgress'
  | 'actualProgress'
  | 'gap'
  | 'delayedCount'
  | 'memberCount';

type SortDirection = 'asc' | 'desc';

// ─── Health calculation ───────────────────────────────────────

function calculateHealth(
  gap: number,
  delayedCount: number,
  totalLeafTasks: number,
): { status: 'good' | 'warning' | 'danger'; score: number } {
  const delayRate = totalLeafTasks > 0 ? (delayedCount / totalLeafTasks) * 100 : 0;

  if (gap < -15 || delayRate > 20) {
    return { status: 'danger', score: Math.max(0, 100 + gap * 2 - delayRate * 2) };
  }
  if (gap < -5 || delayRate >= 10) {
    return { status: 'warning', score: Math.max(20, 100 + gap - delayRate) };
  }
  return { status: 'good', score: Math.min(100, 100 + gap - delayRate * 0.5) };
}

const HEALTH_CONFIG = {
  good: { label: '양호', emoji: '\u{1F7E2}', color: '#22c55e', bgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  warning: { label: '주의', emoji: '\u{1F7E1}', color: '#eab308', bgClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  danger: { label: '위험', emoji: '\u{1F534}', color: '#ef4444', bgClass: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

const STATUS_DONUT_COLORS: Record<string, string> = {
  '준비': '#d88b44',
  '진행': '#0f766e',
  '완료': '#2fa67c',
};

// ─── Component ────────────────────────────────────────────────

export default function Portfolio() {
  const navigate = useNavigate();
  const { projects } = useProjectStore();
  const isDark = useThemeStore((s) => s.isDark);

  const [portfolioData, setPortfolioData] = useState<ProjectPortfolioData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Filter out deleted projects
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'deleted'),
    [projects],
  );

  // Load all project data
  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          activeProjects.map(async (project) => {
            const [tasks, members] = await Promise.all([
              loadProjectTasks(project.id),
              loadProjectMembers(project.id),
            ]);
            return { project, tasks, members };
          }),
        );

        if (cancelled) return;

        const data: ProjectPortfolioData[] = results.map(({ project, tasks, members }) => {
          const stats = calculateProjectStats(tasks);
          const leafTasks = getLeafTasks(tasks);
          const delayed = getDelayedTasks(leafTasks);
          const gap = stats.planProgress > 0 ? stats.overallProgress - stats.planProgress : 0;
          const health = calculateHealth(gap, delayed.length, leafTasks.length);

          return {
            project,
            tasks,
            members,
            planProgress: stats.planProgress,
            actualProgress: stats.overallProgress,
            gap,
            delayedCount: delayed.length,
            memberCount: members.length,
            healthStatus: health.status,
            healthScore: health.score,
          };
        });

        setPortfolioData(data);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAll();
    return () => { cancelled = true; };
  }, [activeProjects]);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  // Sorted data
  const sortedData = useMemo(() => {
    const copy = [...portfolioData];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.project.name.localeCompare(b.project.name, 'ko');
          break;
        case 'status':
          cmp = a.project.status.localeCompare(b.project.status);
          break;
        case 'startDate':
          cmp = (a.project.startDate || '').localeCompare(b.project.startDate || '');
          break;
        case 'endDate':
          cmp = (a.project.endDate || '').localeCompare(b.project.endDate || '');
          break;
        case 'planProgress':
          cmp = a.planProgress - b.planProgress;
          break;
        case 'actualProgress':
          cmp = a.actualProgress - b.actualProgress;
          break;
        case 'gap':
          cmp = a.gap - b.gap;
          break;
        case 'delayedCount':
          cmp = a.delayedCount - b.delayedCount;
          break;
        case 'memberCount':
          cmp = a.memberCount - b.memberCount;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [portfolioData, sortField, sortDir]);

  // Summary stats
  const summary = useMemo(() => {
    const total = activeProjects.length;
    const inProgress = activeProjects.filter((p) => p.status === 'active').length;
    const avgProgress =
      portfolioData.length > 0
        ? Math.round(portfolioData.reduce((s, d) => s + d.actualProgress, 0) / portfolioData.length)
        : 0;
    return { total, inProgress, avgProgress };
  }, [activeProjects, portfolioData]);

  // Chart data: plan vs actual bar chart
  const barChartData = useMemo(
    () =>
      sortedData.map((d) => ({
        name: d.project.name.length > 10 ? d.project.name.slice(0, 10) + '\u2026' : d.project.name,
        계획: d.planProgress,
        실적: d.actualProgress,
      })),
    [sortedData],
  );

  // Chart data: status donut
  const donutData = useMemo(() => {
    const counts: Record<string, number> = { '준비': 0, '진행': 0, '완료': 0 };
    activeProjects.forEach((p) => {
      const label = PROJECT_STATUS_LABELS[p.status] || p.status;
      if (label in counts) counts[label]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [activeProjects]);

  // Tooltip style
  const tooltipStyle = {
    backgroundColor: 'var(--bg-secondary-solid)',
    borderColor: 'var(--border-color)',
    borderRadius: '18px',
    boxShadow: '0 24px 56px -28px rgba(17, 24, 39, 0.28)',
    color: 'var(--text-primary)',
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // ─── Render ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-8">
      {/* Hero Section */}
      <section
        className="app-panel-dark relative min-h-[420px] overflow-hidden p-6 md:p-8"
        style={{
          backgroundImage: `radial-gradient(circle at 86% 16%, rgba(15,118,110,0.19), transparent 26%), radial-gradient(circle at 18% 84%, rgba(15,118,110,0.10), transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))`,
        }}
      >
        {/* Background ambient glows */}
        <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.15), transparent 70%)' }} />
        <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.10), transparent 72%)' }} />
        <div className="pointer-events-none absolute right-[20%] top-[30%] h-48 w-48 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(15,118,110,0.12), transparent 70%)' }} />

        {/* ---- Floating decorative elements (right side) ---- */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          {/* Stat bubbles */}
          <FloatingStatBubble
            value="9"
            label="사용자"
            className="hero-float-1 h-[72px] w-[72px]"
            style={{ top: '10%', right: '22%' }}
          />
          <FloatingStatBubble
            value="0"
            label="대기"
            className="hero-float-3 h-[64px] w-[64px]"
            style={{ top: '40%', right: '5%' }}
          />
          <FloatingStatBubble
            value="85"
            label="%"
            className="hero-float-4 h-[76px] w-[76px]"
            style={{ top: '65%', right: '20%' }}
          />

          {/* Special floating card */}
          <div
            className="pointer-events-none absolute hero-float-2 flex items-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.07] px-4 py-2.5 backdrop-blur-md"
            style={{ top: '72%', right: '6%' }}
          >
            <Shield className="h-4 w-4 text-teal-400/70" />
            <span className="text-xs font-medium text-white/70">역할 관리</span>
          </div>

          {/* Icon elements */}
          <FloatingElement className="hero-float-1 h-11 w-11" style={{ top: '8%', right: '12%' }}>
            <PieChartIcon className="h-5 w-5 text-teal-400/50" />
          </FloatingElement>
          <FloatingElement className="hero-float-2 h-10 w-10" style={{ top: '18%', right: '32%' }}>
            <Target className="h-5 w-5 text-white/30" />
          </FloatingElement>
          <FloatingElement className="hero-float-3 h-12 w-12" style={{ top: '35%', right: '14%' }}>
            <Globe className="h-6 w-6 text-amber-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-4 h-9 w-9" style={{ top: '28%', right: '28%' }}>
            <Activity className="h-4 w-4 text-emerald-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-2 h-11 w-11" style={{ top: '52%', right: '35%' }}>
            <Layers className="h-5 w-5 text-cyan-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-1 h-10 w-10" style={{ top: '58%', right: '10%' }}>
            <CheckCircle className="h-5 w-5 text-emerald-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-4 h-10 w-10" style={{ top: '48%', right: '26%' }}>
            <Settings className="h-4.5 w-4.5 text-white/40 hero-spin-slow" />
          </FloatingElement>
          <FloatingElement className="hero-float-3 h-9 w-9" style={{ top: '80%', right: '30%' }}>
            <Zap className="h-4 w-4 text-amber-400/40" />
          </FloatingElement>

          {/* Decorative gradient lines */}
          <div
            className="absolute h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent hero-float-2"
            style={{ top: '22%', right: '12%', transform: 'rotate(-25deg)' }}
          />
          <div
            className="absolute h-px w-20 bg-gradient-to-r from-transparent via-white/8 to-transparent hero-float-3"
            style={{ top: '52%', right: '18%', transform: 'rotate(18deg)' }}
          />
          <div
            className="absolute h-px w-14 bg-gradient-to-r from-transparent via-teal-400/10 to-transparent hero-float-1"
            style={{ top: '75%', right: '15%', transform: 'rotate(-12deg)' }}
          />

          {/* Floating dots */}
          <div className="absolute h-1.5 w-1.5 rounded-full bg-white/20 hero-float-1" style={{ top: '15%', right: '18%' }} />
          <div className="absolute h-1 w-1 rounded-full bg-teal-400/30 hero-float-4" style={{ top: '38%', right: '10%' }} />
          <div className="absolute h-2 w-2 rounded-full bg-white/10 hero-float-2" style={{ top: '60%', right: '32%' }} />
          <div className="absolute h-1 w-1 rounded-full bg-emerald-400/20 hero-float-3" style={{ top: '82%', right: '22%' }} />

          {/* Ring element */}
          <div className="absolute h-6 w-6 rounded-full border border-white/[0.07] hero-float-2" style={{ top: '45%', right: '33%' }} />
        </div>

        {/* ---- Main content ---- */}
        <div className="relative z-10">
          <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
            <Briefcase className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
            Portfolio Overview
          </div>
          <h1 className="mt-6 text-[clamp(2rem,4vw,3.9rem)] font-semibold tracking-[-0.06em] text-white">
            포트폴리오 현황
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
            모든 프로젝트의 진행 현황을 한눈에 비교합니다
          </p>

          <div className="mt-8 grid max-w-2xl gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">전체 프로젝트</p>
              <p className="mt-2 text-3xl font-semibold text-white">{summary.total}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">진행중</p>
              <p className="mt-2 text-3xl font-semibold text-white">{summary.inProgress}</p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/[0.12] p-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/84">평균 공정율</p>
              <p className="mt-2 text-3xl font-semibold text-white">{formatPercent(summary.avgProgress)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="app-panel overflow-hidden p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="page-kicker">Comparison</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              프로젝트 비교
            </h2>
          </div>
          <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_40px_-24px_rgba(15,118,110,0.74)]' : 'flex h-12 w-12 items-center justify-center rounded-[20px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] text-[color:var(--text-primary)] shadow-[0_18px_36px_-26px_rgba(17,24,39,0.16)]'}>
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>

        {sortedData.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  {([
                    ['name', '프로젝트명'],
                    ['status', '상태'],
                    ['startDate', '시작일'],
                    ['endDate', '종료일'],
                    ['planProgress', '계획 공정율'],
                    ['actualProgress', '실적 공정율'],
                    ['gap', 'Gap'],
                    ['delayedCount', '지연 작업'],
                    ['memberCount', '멤버'],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <th
                      key={field}
                      className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                      onClick={() => handleSort(field)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {label}
                        <SortIcon field={field} />
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left font-medium text-[color:var(--text-secondary)]">건강도</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((d, idx) => {
                  const health = HEALTH_CONFIG[d.healthStatus];
                  return (
                    <tr
                      key={d.project.id}
                      className={`cursor-pointer border-b border-[var(--border-color)] transition-colors hover:bg-[color:var(--bg-tertiary)] ${idx % 2 === 1 ? 'bg-[color:var(--bg-secondary)]' : ''}`}
                      onClick={() => navigate(`/projects/${d.project.id}`)}
                    >
                      <td className="px-3 py-3 font-medium text-[color:var(--text-primary)]">
                        {d.project.name}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: `${PROJECT_STATUS_COLORS[d.project.status]}20`,
                            color: PROJECT_STATUS_COLORS[d.project.status],
                          }}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLORS[d.project.status] }} />
                          {PROJECT_STATUS_LABELS[d.project.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[color:var(--text-secondary)]">
                        {formatDate(d.project.startDate)}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--text-secondary)]">
                        {formatDate(d.project.endDate)}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--text-secondary)]">
                        {formatPercent(d.planProgress)}
                      </td>
                      <td className="px-3 py-3 font-medium text-[color:var(--text-primary)]">
                        {formatPercent(d.actualProgress)}
                      </td>
                      <td className={`px-3 py-3 font-medium ${d.gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {d.gap >= 0 ? '+' : ''}{d.gap.toFixed(1)}%
                      </td>
                      <td className={`px-3 py-3 font-medium ${d.delayedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-[color:var(--text-secondary)]'}`}>
                        {d.delayedCount}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--text-secondary)]">
                        {d.memberCount}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${health.bgClass}`}>
                          {health.emoji} {health.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] px-8 py-16 text-center">
            <Briefcase className="mb-4 h-12 w-12 text-[color:var(--text-muted)]" />
            <p className="text-sm text-[color:var(--text-secondary)]">프로젝트가 없습니다</p>
          </div>
        )}
      </section>

      {/* Charts */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Plan vs Actual Bar Chart */}
        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Plan vs Actual</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                계획 vs 실적 공정율
              </h2>
            </div>
            <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_40px_-24px_rgba(15,118,110,0.74)]' : 'flex h-12 w-12 items-center justify-center rounded-[20px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] text-[color:var(--text-primary)] shadow-[0_18px_36px_-26px_rgba(17,24,39,0.16)]'}>
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>

          {barChartData.length > 0 ? (
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid
                    strokeDasharray="4 6"
                    stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(127,111,97,0.14)'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-muted)"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(value: any) => [`${value}%`, undefined]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingBottom: '8px' }}
                  />
                  <Bar dataKey="계획" fill="#5B8DEF" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="실적" fill="#2BAAA0" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-6 flex h-[320px] items-center justify-center">
              <p className="text-sm text-[color:var(--text-secondary)]">데이터 없음</p>
            </div>
          )}
        </div>

        {/* Status Donut */}
        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Status Distribution</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                프로젝트 상태 분포
              </h2>
            </div>
            <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#123d64,#23547b)] text-white shadow-[0_20px_40px_-24px_rgba(18,61,100,0.72)]' : 'flex h-12 w-12 items-center justify-center rounded-[20px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] text-[color:var(--text-primary)] shadow-[0_18px_36px_-26px_rgba(17,24,39,0.16)]'}>
              <Play className="h-5 w-5" />
            </div>
          </div>

          {donutData.length > 0 ? (
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {donutData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_DONUT_COLORS[entry.name] || '#8B95A5'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(value: any, name: any) => [`${value}개`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{ fontSize: '13px', color: 'var(--text-secondary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-6 flex h-[320px] items-center justify-center">
              <p className="text-sm text-[color:var(--text-secondary)]">데이터 없음</p>
            </div>
          )}
        </div>
      </section>

      {/* Health Overview */}
      <section className="app-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="page-kicker">Health Index</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              프로젝트 건강도
            </h2>
          </div>
        </div>

        {sortedData.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedData.map((d) => {
              const health = HEALTH_CONFIG[d.healthStatus];
              const leafCount = getLeafTasks(d.tasks).length;
              const delayRate = leafCount > 0 ? ((d.delayedCount / leafCount) * 100).toFixed(1) : '0.0';
              return (
                <div
                  key={d.project.id}
                  className="cursor-pointer rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5 transition-all hover:shadow-lg hover:-translate-y-0.5"
                  onClick={() => navigate(`/projects/${d.project.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-[color:var(--text-primary)]">
                        {d.project.name}
                      </h3>
                      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        {PROJECT_STATUS_LABELS[d.project.status]}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${health.bgClass}`}>
                      {health.emoji} {health.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">Gap</p>
                      <p className={`mt-0.5 text-lg font-semibold ${d.gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {d.gap >= 0 ? '+' : ''}{d.gap.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">지연율</p>
                      <p className={`mt-0.5 text-lg font-semibold ${Number(delayRate) > 10 ? 'text-red-600 dark:text-red-400' : 'text-[color:var(--text-primary)]'}`}>
                        {delayRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">실적</p>
                      <p className="mt-0.5 text-lg font-semibold text-[color:var(--text-primary)]">
                        {formatPercent(d.actualProgress)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--bg-tertiary)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${d.actualProgress}%`,
                        backgroundColor: health.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] px-8 py-16 text-center">
            <p className="text-sm text-[color:var(--text-secondary)]">프로젝트가 없습니다</p>
          </div>
        )}
      </section>
    </div>
  );
}
