import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import {
  Clock3,
  CheckCircle2,
  AlertTriangle,
  ListTree,
  Calendar,
  ArrowRight,
  Target,
  Zap,
  Users,
  TrendingUp,
  PieChart as PieChartIcon,
  CalendarClock,
  CalendarCheck,
  FileDown,
  Loader2,
  Columns3,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import { useAttendanceStore } from '../store/attendanceStore';
import { useThemeStore } from '../store/themeStore';
import Button from '../components/common/Button';
import FeedbackNotice from '../components/common/FeedbackNotice';
import { generateProjectReport } from '../lib/exportReport';
import { getProjectVisualTone } from '../lib/projectVisuals';
import { autoCalculateWeights } from '../lib/taskAutoFill';
import {
  getDelayedTasks,
  getWeeklyTasks,
  formatDate,
  formatPercent,
  getDelayDays,
} from '../lib/utils';
import {
  calculateProjectStats,
  calculateStatusDistribution,
  calculateAssigneeWorkloads,
  calculatePhaseProgress,
  calculateWeightDistribution,
  calculateTimeline,
  getRecentlyCompleted,
} from '../lib/taskAnalytics';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { loadAttendances } from '../lib/dataRepository';
import { ATTENDANCE_TYPE_LABELS, ATTENDANCE_TYPE_COLORS } from '../types';
import ResourceWidget from '../components/dashboard/ResourceWidget';
import { startOfWeek, endOfWeek, format } from 'date-fns';
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

export default function Dashboard() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const isDark = useThemeStore((state) => state.isDark);
  const { tasks, setTasks } = useTaskStore();
  const { currentProject, members } = useProjectStore();
  const projectTone = currentProject ? getProjectVisualTone(currentProject) : null;
  const ToneIcon = projectTone?.icon;
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const heroPanelClassName = isDark
    ? 'app-panel-dark relative overflow-hidden p-6 md:p-8'
    : 'app-panel relative overflow-hidden p-6 md:p-8';
  const heroPanelStyle = isDark
    ? {
        backgroundImage: `radial-gradient(circle at 86% 16%, ${(projectTone?.accent || '#18a79b')}30, transparent 26%), radial-gradient(circle at 18% 84%, ${(projectTone?.accent || '#18a79b')}18, transparent 32%), linear-gradient(165deg, rgba(17,20,26,0.98), rgba(10,12,16,0.94))`,
      }
    : {
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,243,238,0.94))',
      };
  const heroBadgeClassName = isDark
    ? 'surface-badge border-white/12 bg-white/[0.14] text-white/90'
    : 'surface-badge border-[rgba(15,118,110,0.08)] bg-white/80 text-[color:var(--text-secondary)]';
  const heroOutlineButtonClassName = isDark
    ? 'border-white/12 bg-white/[0.14] text-white hover:bg-white/[0.2]'
    : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-secondary-solid)]';
  const heroMetricClassName = isDark
    ? 'rounded-[24px] border border-white/12 bg-white/[0.12] p-4'
    : 'rounded-[24px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.72)] p-4';
  const quietSectionIconClassName =
    'flex h-12 w-12 items-center justify-center rounded-[20px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] text-[color:var(--text-primary)] shadow-[0_18px_36px_-26px_rgba(17,24,39,0.16)]';
  const progressSectionIconLargeClassName =
    'flex h-14 w-14 items-center justify-center rounded-[22px] border border-[rgba(15,118,110,0.14)] bg-[rgba(15,118,110,0.08)] text-[color:var(--accent-primary)] shadow-[0_18px_36px_-26px_rgba(15,118,110,0.18)]';
  const progressSectionIconClassName =
    'flex h-12 w-12 items-center justify-center rounded-[20px] border border-[rgba(15,118,110,0.14)] bg-[rgba(15,118,110,0.08)] text-[color:var(--accent-primary)] shadow-[0_18px_36px_-26px_rgba(15,118,110,0.18)]';
  const inProgressMetricClassName = isDark
    ? 'metric-card p-5'
    : 'metric-card border-[rgba(15,118,110,0.14)] bg-[linear-gradient(180deg,rgba(242,250,247,0.98),rgba(255,255,255,0.98))] p-5 shadow-[0_24px_48px_-36px_rgba(15,118,110,0.16)]';
  const neutralMetricClassName = isDark
    ? 'metric-card p-5'
    : 'metric-card bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,245,241,0.92))] p-5 shadow-[0_24px_48px_-38px_rgba(17,24,39,0.12)]';

  const stats = useMemo(() => calculateProjectStats(tasks), [tasks]);
  const allWeightsZero = useMemo(() => {
    const phases = tasks.filter((t) => t.level === 1);
    return phases.length > 0 && phases.every((t) => t.weight === 0);
  }, [tasks]);
  const statusData = useMemo(() => calculateStatusDistribution(tasks), [tasks]);
  const assigneeData = useMemo(() => calculateAssigneeWorkloads(tasks, members), [tasks, members]);

  const thisWeekTasks = useMemo(() => getWeeklyTasks(tasks, 'this').slice(0, 5), [tasks]);
  const nextWeekTasks = useMemo(() => getWeeklyTasks(tasks, 'next').slice(0, 5), [tasks]);
  const delayedTasks = useMemo(() => getDelayedTasks(tasks).slice(0, 5), [tasks]);

  const phaseData = useMemo(() => calculatePhaseProgress(tasks), [tasks]);

  const timeline = useMemo(() => {
    if (!currentProject?.startDate || !currentProject?.endDate) return null;
    return calculateTimeline(currentProject.startDate, currentProject.endDate);
  }, [currentProject]);

  const WEIGHT_COLORS = ['#2BAAA0', '#5B8DEF', '#F0A167', '#34C997', '#E87C8A', '#A78BFA'];
  const weightData = useMemo(() => calculateWeightDistribution(tasks), [tasks]);

  const recentlyCompleted = useMemo(() => getRecentlyCompleted(tasks), [tasks]);

  // Load attendance data
  const { attendances, setAttendances } = useAttendanceStore();
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void loadAttendances(projectId).then((data) => {
      if (!cancelled) setAttendances(data, projectId);
    });
    return () => { cancelled = true; };
  }, [projectId, setAttendances]);

  const getWithDefaults = useAttendanceStore((s) => s.getWithDefaults);
  const weekAttendanceSummary = useMemo(() => {
    const now = new Date();
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    const we = endOfWeek(now, { weekStartsOn: 1 });
    const wsStr = format(ws, 'yyyy-MM-dd');
    const weStr = format(we, 'yyyy-MM-dd');
    const weekRecords = getWithDefaults(members, wsStr, weStr);
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayRecords = weekRecords.filter((a) => a.date === todayStr);
    const leaveCount = weekRecords.filter((a) =>
      ['annual_leave', 'half_day_am', 'half_day_pm', 'sick_leave'].includes(a.type)
    ).length;
    const tripCount = weekRecords.filter((a) => a.type === 'business_trip').length;
    return { total: weekRecords.length, todayCount: todayRecords.length, todayRecords, leaveCount, tripCount };
  }, [attendances, members, getWithDefaults]);

  // Report download
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (!currentProject || isExporting) return;
    setIsExporting(true);
    try {
      await generateProjectReport({ project: currentProject, tasks, members });
      showFeedback({
        tone: 'success',
        title: t('dashboard.reportSuccess'),
        message: t('dashboard.reportSuccessMsg'),
      });
    } catch (e) {
      console.error('Report generation failed:', e);
      showFeedback({
        tone: 'error',
        title: t('dashboard.reportFail'),
        message: t('dashboard.reportFailMsg'),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAutoWeights = () => {
    const updated = autoCalculateWeights(tasks);
    setTasks(updated, undefined, { recordHistory: true });
    showFeedback({
      tone: 'success',
      title: t('dashboard.autoWeightSuccess'),
      message: t('dashboard.autoWeightSuccessMsg'),
    });
  };

  return (
    <div className="space-y-8">
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div
          className={heroPanelClassName}
          style={heroPanelStyle}
        >
          {isDark && (
            <>
              <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${(projectTone?.accent || '#18a79b')}26, transparent 70%)` }} />
              <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${(projectTone?.accent || '#18a79b')}16, transparent 72%)` }} />
            </>
          )}

          <div className="relative">
            <div className={heroBadgeClassName}>
              {ToneIcon ? <ToneIcon className="h-3.5 w-3.5" style={{ color: projectTone?.accent }} /> : <Zap className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />}
              {projectTone?.label || 'Project Dashboard'}
            </div>
            <h1 className={`mt-6 text-[clamp(2rem,4vw,3.9rem)] font-semibold tracking-[-0.06em] ${isDark ? 'text-white' : 'text-[color:var(--text-primary)]'}`}>
              {currentProject?.name || t('common.project')} {t('dashboard.operationStatus')}
            </h1>
            {projectTone && (
              <p
                className={`mt-3 text-sm ${isDark ? 'font-semibold tracking-[0.18em] uppercase' : 'leading-6 text-[color:var(--text-secondary)]'}`}
                style={isDark ? { color: projectTone.accent } : undefined}
              >
                {projectTone.note}
              </p>
            )}
            <p className={`mt-4 max-w-2xl text-sm leading-7 md:text-base ${isDark ? 'text-white/90' : 'text-[color:var(--text-secondary)]'}`}>
              {currentProject?.description || t('dashboard.defaultDesc')}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={`/projects/${projectId}/wbs`}>
                <Button>
                  <ListTree className="w-4 h-4" />
                  {t('dashboard.viewWbs')}
                </Button>
              </Link>
              <Link to={`/projects/${projectId}/gantt`}>
                <Button variant="outline" className={heroOutlineButtonClassName}>
                  <Calendar className="w-4 h-4" />
                  {t('dashboard.ganttChart')}
                </Button>
              </Link>
              <Link to={`/projects/${projectId}/kanban`}>
                <Button variant="outline" className={heroOutlineButtonClassName}>
                  <Columns3 className="w-4 h-4" />
                  {t('dashboard.kanbanBoard')}
                </Button>
              </Link>
              <Button
                variant="outline"
                className={heroOutlineButtonClassName}
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {isExporting ? t('dashboard.generating') : t('dashboard.statusReport')}
              </Button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className={heroMetricClassName}>
                <p className={`text-[11px] uppercase tracking-[0.28em] ${isDark ? 'text-white/84' : 'text-[color:var(--text-secondary)]'}`}>{t('dashboard.totalTasks')}</p>
                <p className={`mt-2 text-3xl font-semibold ${isDark ? 'text-white' : 'text-[color:var(--text-primary)]'}`}>{stats.totalTasks}</p>
              </div>
              <div className={heroMetricClassName}>
                <p className={`text-[11px] uppercase tracking-[0.28em] ${isDark ? 'text-white/84' : 'text-[color:var(--text-secondary)]'}`}>{t('dashboard.membersLabel')}</p>
                <p className={`mt-2 text-3xl font-semibold ${isDark ? 'text-white' : 'text-[color:var(--text-primary)]'}`}>{members.length}</p>
              </div>
              <div className={heroMetricClassName}>
                <p className={`text-[11px] uppercase tracking-[0.28em] ${isDark ? 'text-white/84' : 'text-[color:var(--text-secondary)]'}`}>{t('dashboard.delayed')}</p>
                <p className={`mt-2 text-3xl font-semibold ${isDark ? 'text-white' : 'text-[color:var(--text-primary)]'}`}>{stats.delayedTasks}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className={isDark ? 'metric-card p-6' : 'metric-card bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,245,241,0.92))] p-6 shadow-[0_24px_48px_-38px_rgba(17,24,39,0.12)]'}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow-stat">Actual Progress</p>
                <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-[color:var(--text-primary)]">
                  {formatPercent(stats.overallProgress)}
                </p>
              </div>
              <div className={isDark ? 'flex h-14 w-14 items-center justify-center rounded-[22px] bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-28px_rgba(15,118,110,0.78)]' : progressSectionIconLargeClassName}>
                <Target className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
              <div
                className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                style={{ width: `${stats.overallProgress}%` }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-[color:var(--text-secondary)]">{t('dashboard.planProgress')}</span>
              <span className="font-semibold text-[color:var(--text-primary)]">{formatPercent(stats.planProgress)}</span>
            </div>
            {allWeightsZero && stats.totalTasks > 0 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs leading-5 text-[color:var(--accent-warning)]">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                  {t('dashboard.weightWarning')}
                </p>
                <button
                  onClick={handleAutoWeights}
                  className="shrink-0 rounded-full border border-[color:var(--accent-warning)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-warning)] transition-colors hover:bg-[rgba(234,179,8,0.1)]"
                >
                  {t('dashboard.autoWeight')}
                </button>
              </div>
            )}
          </div>

            <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-1">
              <div className={inProgressMetricClassName}>
              <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#f2be83,#cb6d37)] text-[color:var(--bg-inverse)] shadow-[0_20px_40px_-26px_rgba(203,109,55,0.7)]' : progressSectionIconClassName}>
                <Clock3 className="h-5 w-5" />
              </div>
                <p className="mt-4 text-sm text-[color:var(--text-secondary)]">{t('dashboard.inProgressTasks')}</p>
              <p data-testid="dashboard-in-progress-count" className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {stats.inProgressTasks}
              </p>
            </div>

            <div className={neutralMetricClassName}>
              <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#1fa37a,#34c997)] text-white shadow-[0_20px_40px_-26px_rgba(31,163,122,0.62)]' : quietSectionIconClassName}>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-[color:var(--text-secondary)]">{t('dashboard.completedTasks')}</p>
              <p data-testid="dashboard-completed-count" className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {stats.completedTasks}
              </p>
            </div>

            <div className={neutralMetricClassName}>
              <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#cb4b5f,#ff738a)] text-white shadow-[0_20px_40px_-26px_rgba(203,75,95,0.62)]' : quietSectionIconClassName}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-[color:var(--text-secondary)]">{t('dashboard.riskTasks')}</p>
              <p data-testid="dashboard-delayed-count" className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {stats.delayedTasks}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Status Mix</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {t('dashboard.statusDistribution')}
              </h2>
            </div>
            <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_40px_-24px_rgba(15,118,110,0.74)]' : quietSectionIconClassName}>
              <Zap className="h-5 w-5" />
            </div>
          </div>

          {statusData.length > 0 ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[24px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5">
                <p className="eyebrow-stat">Task Pool</p>
                <p className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[color:var(--text-primary)]">
                  {stats.totalTasks}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                  {t('dashboard.statusMixDesc')}
                </p>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
                  <div
                    className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                    style={{ width: `${stats.overallProgress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">{t('dashboard.overallActualProgress')}</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{formatPercent(stats.overallProgress)}</span>
                </div>
              </div>

              <div className="space-y-4">
                {statusData.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-[color:var(--text-primary)]">{item.name}</span>
                      </div>
                      <span className="text-sm text-[color:var(--text-secondary)]">{item.value}{t('dashboard.countUnit')}</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[color:var(--bg-tertiary)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${stats.totalTasks > 0 ? (item.value / stats.totalTasks) * 100 : 0}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>{t('dashboard.noData')}</p>
            </div>
          )}
        </div>

        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Team Load</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {t('dashboard.assigneeWorkload')}
              </h2>
            </div>
            <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#123d64,#23547b)] text-white shadow-[0_20px_40px_-24px_rgba(18,61,100,0.72)]' : quietSectionIconClassName}>
              <Users className="h-5 w-5" />
            </div>
          </div>

          {assigneeData.length > 0 ? (
            <div className="mt-6 h-[270px]" id="chart-assignee">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assigneeData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(127,111,97,0.14)'} horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={82} stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary-solid)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '18px',
                      boxShadow: '0 24px 56px -28px rgba(17, 24, 39, 0.28)',
                      color: 'var(--text-primary)',
                    }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingBottom: '8px' }}
                  />
                  <Bar dataKey="completed" stackId="a" fill="#2BAAA0" radius={[0, 10, 10, 0]} name={t('dashboard.completed')} barSize={16} />
                  <Bar dataKey="remaining" stackId="a" fill={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(127,111,97,0.22)'} radius={[0, 10, 10, 0]} name={t('dashboard.remainingLabel')} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <p>{t('dashboard.noData')}</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <QueueCard
          title={t('dashboard.delayedTasks')}
          subtitle={`${delayedTasks.length}${t('dashboard.countDelayed')}`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="danger"
        >
          {delayedTasks.length > 0 ? (
            <ul className="space-y-3">
              {delayedTasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-[22px] border border-[rgba(203,75,95,0.16)] bg-[rgba(203,75,95,0.06)] p-4"
                >
                  <p className="truncate font-medium text-[color:var(--text-primary)]" title={task.name}>{task.name}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[rgba(203,75,95,0.12)] px-2.5 py-1 font-semibold text-[color:var(--accent-danger)]">
                      {t('dashboard.delayDays', { days: getDelayDays(task) })}
                    </span>
                    <span className="text-[color:var(--text-secondary)]">{t('dashboard.endDate')}: {formatDate(task.planEnd)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <CheckCircle2 className="h-10 w-10 text-[color:var(--accent-success)]" />
              <p>{t('dashboard.noDelayedTasks')}</p>
            </div>
          )}
        </QueueCard>

        <QueueCard
          title={t('dashboard.thisWeekTasks')}
          subtitle={`${thisWeekTasks.length}${t('dashboard.countScheduled')}`}
          icon={<Clock3 className="h-4 w-4" />}
          tone="primary"
        >
          {thisWeekTasks.length > 0 ? (
            <ul className="space-y-3">
              {thisWeekTasks.map((task) => (
                <li key={task.id} className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                  <p className="truncate font-medium text-[color:var(--text-primary)]" title={task.name}>{task.name}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>{t('dashboard.noThisWeekTasks')}</p>
            </div>
          )}
        </QueueCard>

        <QueueCard
          title={t('dashboard.nextWeekTasks')}
          subtitle={`${nextWeekTasks.length}${t('dashboard.countScheduled')}`}
          icon={<ArrowRight className="h-4 w-4" />}
          tone="accent"
        >
          {nextWeekTasks.length > 0 ? (
            <ul className="space-y-3">
              {nextWeekTasks.map((task) => (
                <li key={task.id} className="rounded-[22px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                  <p className="truncate font-medium text-[color:var(--text-primary)]" title={task.name}>{task.name}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>{t('dashboard.noNextWeekTasks')}</p>
            </div>
          )}
        </QueueCard>
      </section>

      {/* Phase progress + Project timeline summary */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Phase Progress</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {t('dashboard.phaseProgress')}
              </h2>
            </div>
            <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#0f766e,#2fa67c)] text-white shadow-[0_20px_40px_-24px_rgba(15,118,110,0.74)]' : quietSectionIconClassName}>
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>

          {phaseData.length > 0 ? (
            <div className="mt-6 h-[300px]" id="chart-phase-progress">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(127,111,97,0.14)'} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value) => `${Number(value ?? 0)}%`}
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary-solid)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '18px',
                      boxShadow: '0 24px 56px -28px rgba(17, 24, 39, 0.28)',
                      color: 'var(--text-primary)',
                    }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingBottom: '8px' }}
                  />
                  <Bar dataKey="계획" fill={isDark ? 'rgba(255,255,255,0.2)' : '#B0BEC5'} radius={[8, 8, 0, 0]} barSize={20} name={t('dashboard.plan')} />
                  <Bar dataKey="실적" fill="#2BAAA0" radius={[8, 8, 0, 0]} barSize={20} name={t('dashboard.actual')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <p>{t('dashboard.noData')}</p>
            </div>
          )}
        </div>

        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Timeline</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {t('dashboard.projectTimeline')}
              </h2>
            </div>
            <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#6d28d9,#a78bfa)] text-white shadow-[0_20px_40px_-24px_rgba(109,40,217,0.72)]' : quietSectionIconClassName}>
              <CalendarClock className="h-5 w-5" />
            </div>
          </div>

          {timeline ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-secondary)]">{t('dashboard.startDate')}</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{formatDate(currentProject?.startDate)}</p>
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-secondary)]">{t('dashboard.endDateLabel')}</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{formatDate(currentProject?.endDate)}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">{t('dashboard.scheduleProgress')}</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{formatPercent(timeline.elapsedPercent)}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(91,141,239,0.12)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#5B8DEF,#A78BFA)]"
                    style={{ width: `${timeline.elapsedPercent}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">{t('dashboard.actualProgress')}</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{formatPercent(stats.overallProgress)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">{t('dashboard.totalDays')}</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{timeline.totalDays}</p>
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">{t('dashboard.elapsed')}</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{Math.max(0, timeline.elapsedDays)}</p>
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
                    {timeline.remainingDays >= 0 ? t('dashboard.remaining') : t('dashboard.overdue')}
                  </p>
                  <p className={`mt-2 text-2xl font-semibold ${timeline.remainingDays < 0 ? 'text-[color:var(--accent-danger)]' : 'text-[color:var(--text-primary)]'}`}>
                    {timeline.remainingDays >= 0 ? timeline.remainingDays : `+${Math.abs(timeline.remainingDays)}`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>{t('dashboard.noTimeline')}</p>
            </div>
          )}
        </div>
      </section>

      {/* Weight distribution + Recently completed tasks */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Weight Distribution</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {t('dashboard.weightDistribution')}
              </h2>
            </div>
            <div className={isDark ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#d88b44,#cb6d37)] text-white shadow-[0_20px_40px_-24px_rgba(203,109,55,0.72)]' : quietSectionIconClassName}>
              <PieChartIcon className="h-5 w-5" />
            </div>
          </div>

          {weightData.length > 0 ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="flex items-center justify-center" id="chart-weight">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={weightData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {weightData.map((_, i) => (
                        <Cell key={i} fill={WEIGHT_COLORS[i % WEIGHT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `${Number(value ?? 0)}`}
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary-solid)',
                        borderColor: 'var(--border-color)',
                        borderRadius: '18px',
                        boxShadow: '0 24px 56px -28px rgba(17, 24, 39, 0.28)',
                        color: 'var(--text-primary)',
                      }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-secondary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {weightData.map((item, i) => (
                  <div key={item.name} className="rounded-[16px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-[color:var(--text-primary)] truncate max-w-[120px]" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-[color:var(--text-primary)]">{item.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>{t('dashboard.noData')}</p>
            </div>
          )}
        </div>

        <QueueCard
          title={t('dashboard.recentlyCompleted')}
          subtitle={`${recentlyCompleted.length}${t('dashboard.countCompleted')}`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="primary"
        >
          {recentlyCompleted.length > 0 ? (
            <ul className="space-y-3">
              {recentlyCompleted.map((task) => (
                <li key={task.id} className="rounded-[22px] border border-[rgba(31,163,122,0.16)] bg-[rgba(31,163,122,0.06)] p-4">
                  <p className="truncate font-medium text-[color:var(--text-primary)]" title={task.name}>{task.name}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[rgba(31,163,122,0.12)] px-2.5 py-1 font-semibold text-[color:var(--accent-success)]">
                      {t('dashboard.completed')}
                    </span>
                    <span className="text-[color:var(--text-secondary)]">{t('dashboard.completedDate')}: {formatDate(task.actualEnd)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>{t('dashboard.noCompletedTasks')}</p>
            </div>
          )}
        </QueueCard>

        {/* Weekly attendance */}
        <QueueCard
          title={t('dashboard.weekAttendance')}
          subtitle={`${weekAttendanceSummary.total}${t('dashboard.countRegistered')}`}
          icon={<CalendarCheck className="h-4 w-4" />}
          tone="accent"
        >
          {weekAttendanceSummary.todayRecords.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-[color:var(--text-secondary)]">{t('dashboard.todayRegistered')}:</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{weekAttendanceSummary.todayCount}{t('dashboard.countUnit')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[color:var(--text-secondary)]">{t('dashboard.weekLeave')}:</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{weekAttendanceSummary.leaveCount}{t('dashboard.countUnit')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[color:var(--text-secondary)]">{t('dashboard.businessTrip')}:</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{weekAttendanceSummary.tripCount}{t('dashboard.countUnit')}</span>
                </div>
              </div>
              <ul className="space-y-2">
                {weekAttendanceSummary.todayRecords.slice(0, 5).map((a) => {
                  const memberName = members.find((m) => m.id === a.memberId)?.name || t('dashboard.unknown');
                  return (
                    <li key={a.id} className="flex items-center gap-3 rounded-[18px] border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-3">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: (ATTENDANCE_TYPE_COLORS as Record<string, string>)[a.type] }} />
                      <span className="flex-1 text-sm font-medium text-[color:var(--text-primary)]">{memberName}</span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: `${(ATTENDANCE_TYPE_COLORS as Record<string, string>)[a.type]}18`, color: (ATTENDANCE_TYPE_COLORS as Record<string, string>)[a.type] }}
                      >
                        {(ATTENDANCE_TYPE_LABELS as Record<string, string>)[a.type]}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Link
                to={`/projects/${projectId}/attendance`}
                className="flex items-center gap-1 text-sm font-medium text-[color:var(--accent-primary)] hover:underline"
              >
                {t('dashboard.viewAllAttendance')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <CalendarCheck className="h-10 w-10 text-[color:var(--text-muted)]" />
              <p className="text-sm text-[color:var(--text-secondary)]">{t('dashboard.noTodayAttendance')}</p>
              <Link
                to={`/projects/${projectId}/attendance`}
                className="mt-2 text-sm font-medium text-[color:var(--accent-primary)] hover:underline"
              >
                {t('dashboard.registerAttendance')}
              </Link>
            </div>
          )}
        </QueueCard>
      </section>

      {/* 리소스 워크로드 */}
      <ResourceWidget tasks={tasks} members={members} />

    </div>
  );
}

interface QueueCardProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: 'danger' | 'primary' | 'accent';
  children: ReactNode;
}

function QueueCard({ title, subtitle, icon, tone, children }: QueueCardProps) {
  const toneClass = {
    danger: 'from-[rgba(203,75,95,0.14)] to-transparent',
    primary: 'from-[rgba(15,118,110,0.14)] to-transparent',
    accent: 'from-[rgba(203,109,55,0.16)] to-transparent',
  };

  return (
    <div className="app-panel overflow-hidden">
      <div className={`bg-gradient-to-r ${toneClass[tone]} border-b border-[var(--border-color)] px-5 py-5`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-[0_18px_36px_-22px_rgba(17,24,39,0.22)]">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">{title}</h3>
            <p className="text-xs text-[color:var(--text-secondary)]">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
