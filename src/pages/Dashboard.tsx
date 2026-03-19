import { useMemo, useState, type ReactNode } from 'react';
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
  FileDown,
  Loader2,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import Button from '../components/common/Button';
import { generateProjectReport } from '../lib/exportReport';
import {
  calculateOverallProgress,
  getDelayedTasks,
  getWeeklyTasks,
  formatDate,
  formatPercent,
  getDelayDays,
} from '../lib/utils';
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
} from 'recharts';

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const { tasks } = useTaskStore();
  const { currentProject, members } = useProjectStore();

  const stats = useMemo(() => {
    const leafTasks = tasks.filter((task) => !tasks.some((child) => child.parentId === task.id));
    const completedTasks = leafTasks.filter((task) => task.status === 'completed');
    const inProgressTasks = leafTasks.filter((task) => task.status === 'in_progress');
    const delayedTasks = getDelayedTasks(leafTasks);
    const overallProgress = calculateOverallProgress(tasks);

    const totalPlanWeight = tasks
      .filter((task) => task.level === 1)
      .reduce((sum, task) => sum + task.weight, 0);

    const planProgress =
      totalPlanWeight > 0
        ? tasks
            .filter((task) => task.level === 1)
            .reduce((sum, task) => sum + task.weight * task.planProgress, 0) / totalPlanWeight
        : 0;

    return {
      totalTasks: leafTasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      delayedTasks: delayedTasks.length,
      overallProgress,
      planProgress,
    };
  }, [tasks]);

  const statusData = useMemo(() => {
    const leafTasks = tasks.filter((task) => !tasks.some((child) => child.parentId === task.id));

    return [
      { name: '대기', value: leafTasks.filter((task) => task.status === 'pending').length, color: '#b8aaa0' },
      { name: '진행중', value: leafTasks.filter((task) => task.status === 'in_progress').length, color: '#1b8f86' },
      { name: '완료', value: leafTasks.filter((task) => task.status === 'completed').length, color: '#2fa67c' },
      { name: '보류', value: leafTasks.filter((task) => task.status === 'on_hold').length, color: '#d88b44' },
    ].filter((item) => item.value > 0);
  }, [tasks]);

  const assigneeData = useMemo(() => {
    const leafTasks = tasks.filter(
      (task) => !tasks.some((child) => child.parentId === task.id) && task.assigneeId
    );

    const grouped = leafTasks.reduce((acc, task) => {
      const assignee = members.find((member) => member.id === task.assigneeId);
      const name = assignee?.name || '미지정';
      if (!acc[name]) {
        acc[name] = { total: 0, completed: 0 };
      }
      acc[name].total++;
      if (task.status === 'completed') {
        acc[name].completed++;
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    return Object.entries(grouped).map(([name, data]) => ({
      name,
      total: data.total,
      completed: data.completed,
      remaining: data.total - data.completed,
    }));
  }, [tasks, members]);

  const thisWeekTasks = useMemo(() => getWeeklyTasks(tasks, 'this').slice(0, 5), [tasks]);
  const nextWeekTasks = useMemo(() => getWeeklyTasks(tasks, 'next').slice(0, 5), [tasks]);
  const delayedTasks = useMemo(() => getDelayedTasks(tasks).slice(0, 5), [tasks]);

  // Phase별 진행률 데이터
  const phaseData = useMemo(() => {
    return tasks
      .filter((t) => t.level === 1)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((phase) => ({
        name: phase.name.length > 8 ? phase.name.slice(0, 8) + '…' : phase.name,
        계획: Math.round(phase.planProgress),
        실적: Math.round(phase.actualProgress),
      }));
  }, [tasks]);

  // 프로젝트 일정 요약
  const timeline = useMemo(() => {
    if (!currentProject?.startDate || !currentProject?.endDate) return null;
    const start = new Date(currentProject.startDate);
    const end = new Date(currentProject.endDate);
    const now = new Date();
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedPercent = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    return { start, end, totalDays, elapsedDays, remainingDays, elapsedPercent };
  }, [currentProject]);

  // 가중치 분포 데이터
  const WEIGHT_COLORS = ['#0f766e', '#1b8f86', '#2fa67c', '#d88b44', '#cb6d37', '#8b5e3c'];
  const weightData = useMemo(() => {
    const phases = tasks
      .filter((t) => t.level === 1)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);
    if (totalWeight === 0) return [];
    return phases.map((phase) => ({
      name: phase.name,
      value: phase.weight,
      percent: Math.round((phase.weight / totalWeight) * 100),
    }));
  }, [tasks]);

  // 최근 완료 작업
  const recentlyCompleted = useMemo(() => {
    return tasks
      .filter(
        (t) =>
          t.status === 'completed' &&
          t.actualEnd &&
          !tasks.some((child) => child.parentId === t.id)
      )
      .sort((a, b) => (b.actualEnd! > a.actualEnd! ? 1 : -1))
      .slice(0, 5);
  }, [tasks]);

  // 보고서 다운로드
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (!currentProject || isExporting) return;
    setIsExporting(true);
    try {
      await generateProjectReport({ project: currentProject, tasks, members });
    } catch (e) {
      console.error('보고서 생성 실패:', e);
      alert('보고서 생성에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-panel-dark relative overflow-hidden p-7 md:p-8">
          <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.18),transparent_72%)] blur-3xl" />

          <div className="relative">
            <div className="surface-badge border-white/10 bg-white/[0.06] text-white/72">
              <Zap className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              Project Dashboard
            </div>
            <h1 className="mt-6 text-[clamp(2rem,4vw,3.9rem)] font-semibold tracking-[-0.06em] text-white">
              {currentProject?.name || '프로젝트'} 운영 현황
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 md:text-base">
              {currentProject?.description || '프로젝트 진행 현황을 한눈에 확인하고, 이번 주와 다음 주의 흐름까지 빠르게 파악할 수 있도록 대시보드를 재구성했습니다.'}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={`/projects/${projectId}/wbs`}>
                <Button>
                  <ListTree className="w-4 h-4" />
                  WBS 보기
                </Button>
              </Link>
              <Link to={`/projects/${projectId}/gantt`}>
                <Button variant="outline" className="border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]">
                  <Calendar className="w-4 h-4" />
                  간트 차트
                </Button>
              </Link>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                {isExporting ? '생성중...' : '현황 보고서'}
              </Button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">전체 작업</p>
                <p className="mt-2 text-3xl font-semibold text-white">{stats.totalTasks}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">멤버</p>
                <p className="mt-2 text-3xl font-semibold text-white">{members.length}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">지연</p>
                <p className="mt-2 text-3xl font-semibold text-white">{stats.delayedTasks}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="metric-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow-stat">Actual Progress</p>
                <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-[color:var(--text-primary)]">
                  {formatPercent(stats.overallProgress)}
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[image:var(--gradient-primary)] text-white shadow-[0_24px_48px_-28px_rgba(15,118,110,0.78)]">
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
              <span className="text-[color:var(--text-secondary)]">계획 공정율</span>
              <span className="font-semibold text-[color:var(--text-primary)]">{formatPercent(stats.planProgress)}</span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-1">
            <div className="metric-card p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#f2be83,#cb6d37)] text-[color:var(--bg-inverse)] shadow-[0_20px_40px_-26px_rgba(203,109,55,0.7)]">
                <Clock3 className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-[color:var(--text-secondary)]">진행중 작업</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {stats.inProgressTasks}
              </p>
            </div>

            <div className="metric-card p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#1fa37a,#34c997)] text-white shadow-[0_20px_40px_-26px_rgba(31,163,122,0.62)]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-[color:var(--text-secondary)]">완료 작업</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                {stats.completedTasks}
              </p>
            </div>

            <div className="metric-card p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#cb4b5f,#ff738a)] text-white shadow-[0_20px_40px_-26px_rgba(203,75,95,0.62)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm text-[color:var(--text-secondary)]">리스크 작업</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
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
                상태별 분포
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[image:var(--gradient-primary)] text-white shadow-[0_20px_40px_-24px_rgba(15,118,110,0.74)]">
              <Zap className="h-5 w-5" />
            </div>
          </div>

          {statusData.length > 0 ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[24px] border border-[var(--border-color)] bg-white/70 p-5 dark:bg-white/5">
                <p className="eyebrow-stat">Task Pool</p>
                <p className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[color:var(--text-primary)]">
                  {stats.totalTasks}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                  현재 집계된 리프 작업 수를 기준으로 상태 믹스를 구성했습니다.
                </p>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
                  <div
                    className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                    style={{ width: `${stats.overallProgress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">전체 실적 공정율</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{formatPercent(stats.overallProgress)}</span>
                </div>
              </div>

              <div className="space-y-4">
                {statusData.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-[20px] border border-[var(--border-color)] bg-white/70 px-4 py-4 dark:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-[color:var(--text-primary)]">{item.name}</span>
                      </div>
                      <span className="text-sm text-[color:var(--text-secondary)]">{item.value}개</span>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
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
              <p>데이터 없음</p>
            </div>
          )}
        </div>

        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Team Load</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                담당자별 진행률
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#123d64,#23547b)] text-white shadow-[0_20px_40px_-24px_rgba(18,61,100,0.72)]">
              <Users className="h-5 w-5" />
            </div>
          </div>

          {assigneeData.length > 0 ? (
            <div className="mt-6 h-[270px]" id="chart-assignee">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assigneeData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="rgba(127,111,97,0.14)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={82} stroke="var(--text-muted)" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary-solid)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '18px',
                      boxShadow: '0 24px 56px -28px rgba(17, 24, 39, 0.28)',
                    }}
                  />
                  <Bar dataKey="completed" stackId="a" fill="#1b8f86" radius={[0, 10, 10, 0]} name="완료" barSize={16} />
                  <Bar dataKey="remaining" stackId="a" fill="rgba(127,111,97,0.18)" radius={[0, 10, 10, 0]} name="남음" barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <p>데이터 없음</p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <QueueCard
          title="지연 작업"
          subtitle={`${delayedTasks.length}개 지연됨`}
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
                  <p className="truncate font-medium text-[color:var(--text-primary)]">{task.name}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-white/60 px-2.5 py-1 font-semibold text-[color:var(--accent-danger)] dark:bg-white/8">
                      {getDelayDays(task)}일 지연
                    </span>
                    <span className="text-[color:var(--text-secondary)]">종료: {formatDate(task.planEnd)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <CheckCircle2 className="h-10 w-10 text-[color:var(--accent-success)]" />
              <p>지연된 작업이 없습니다</p>
            </div>
          )}
        </QueueCard>

        <QueueCard
          title="금주 작업"
          subtitle={`${thisWeekTasks.length}개 예정`}
          icon={<Clock3 className="h-4 w-4" />}
          tone="primary"
        >
          {thisWeekTasks.length > 0 ? (
            <ul className="space-y-3">
              {thisWeekTasks.map((task) => (
                <li key={task.id} className="rounded-[22px] border border-[var(--border-color)] bg-white/70 p-4 dark:bg-white/5">
                  <p className="truncate font-medium text-[color:var(--text-primary)]">{task.name}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>금주 예정 작업이 없습니다</p>
            </div>
          )}
        </QueueCard>

        <QueueCard
          title="차주 작업"
          subtitle={`${nextWeekTasks.length}개 예정`}
          icon={<ArrowRight className="h-4 w-4" />}
          tone="accent"
        >
          {nextWeekTasks.length > 0 ? (
            <ul className="space-y-3">
              {nextWeekTasks.map((task) => (
                <li key={task.id} className="rounded-[22px] border border-[var(--border-color)] bg-white/70 p-4 dark:bg-white/5">
                  <p className="truncate font-medium text-[color:var(--text-primary)]">{task.name}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>차주 예정 작업이 없습니다</p>
            </div>
          )}
        </QueueCard>
      </section>

      {/* Phase별 진행률 + 프로젝트 일정 요약 */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Phase Progress</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                Phase별 진행률
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#0f766e,#2fa67c)] text-white shadow-[0_20px_40px_-24px_rgba(15,118,110,0.74)]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>

          {phaseData.length > 0 ? (
            <div className="mt-6 h-[300px]" id="chart-phase-progress">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="rgba(127,111,97,0.14)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--text-muted)" axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value) => `${Number(value ?? 0)}%`}
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary-solid)',
                      borderColor: 'var(--border-color)',
                      borderRadius: '18px',
                      boxShadow: '0 24px 56px -28px rgba(17, 24, 39, 0.28)',
                    }}
                  />
                  <Bar dataKey="계획" fill="rgba(127,111,97,0.22)" radius={[8, 8, 0, 0]} barSize={20} />
                  <Bar dataKey="실적" fill="#0f766e" radius={[8, 8, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <p>데이터 없음</p>
            </div>
          )}
        </div>

        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Timeline</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                프로젝트 일정 요약
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#6d28d9,#a78bfa)] text-white shadow-[0_20px_40px_-24px_rgba(109,40,217,0.72)]">
              <CalendarClock className="h-5 w-5" />
            </div>
          </div>

          {timeline ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[20px] border border-[var(--border-color)] bg-white/70 p-4 dark:bg-white/5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-muted)]">시작일</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{formatDate(currentProject?.startDate)}</p>
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-white/70 p-4 dark:bg-white/5">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-muted)]">종료일</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{formatDate(currentProject?.endDate)}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border-color)] bg-white/70 p-5 dark:bg-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">일정 경과율</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{Math.round(timeline.elapsedPercent)}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-[rgba(109,40,217,0.08)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#6d28d9,#a78bfa)]"
                    style={{ width: `${timeline.elapsedPercent}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-[color:var(--text-secondary)]">실적 공정율</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">{formatPercent(stats.overallProgress)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[20px] border border-[var(--border-color)] bg-white/70 p-4 text-center dark:bg-white/5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">총 일수</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{timeline.totalDays}</p>
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-white/70 p-4 text-center dark:bg-white/5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">경과일</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{Math.max(0, timeline.elapsedDays)}</p>
                </div>
                <div className="rounded-[20px] border border-[var(--border-color)] bg-white/70 p-4 text-center dark:bg-white/5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                    {timeline.remainingDays >= 0 ? '잔여일' : '초과일'}
                  </p>
                  <p className={`mt-2 text-2xl font-semibold ${timeline.remainingDays < 0 ? 'text-[color:var(--accent-danger)]' : 'text-[color:var(--text-primary)]'}`}>
                    {timeline.remainingDays >= 0 ? timeline.remainingDays : `+${Math.abs(timeline.remainingDays)}`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>프로젝트 일정이 설정되지 않았습니다</p>
            </div>
          )}
        </div>
      </section>

      {/* 가중치 분포 + 최근 완료 작업 */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="app-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-kicker">Weight Distribution</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                Phase 가중치 분포
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#d88b44,#cb6d37)] text-white shadow-[0_20px_40px_-24px_rgba(203,109,55,0.72)]">
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
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {weightData.map((item, i) => (
                  <div key={item.name} className="rounded-[16px] border border-[var(--border-color)] bg-white/70 px-4 py-3 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-[color:var(--text-primary)] truncate max-w-[120px]">
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
              <p>데이터 없음</p>
            </div>
          )}
        </div>

        <QueueCard
          title="최근 완료 작업"
          subtitle={`${recentlyCompleted.length}개 완료`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="primary"
        >
          {recentlyCompleted.length > 0 ? (
            <ul className="space-y-3">
              {recentlyCompleted.map((task) => (
                <li key={task.id} className="rounded-[22px] border border-[rgba(31,163,122,0.16)] bg-[rgba(31,163,122,0.06)] p-4">
                  <p className="truncate font-medium text-[color:var(--text-primary)]">{task.name}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-white/60 px-2.5 py-1 font-semibold text-[color:var(--accent-success)] dark:bg-white/8">
                      완료
                    </span>
                    <span className="text-[color:var(--text-secondary)]">완료일: {formatDate(task.actualEnd)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state min-h-[14rem]">
              <p>완료된 작업이 없습니다</p>
            </div>
          )}
        </QueueCard>
      </section>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-white/70 text-[color:var(--text-primary)] shadow-[0_18px_36px_-22px_rgba(17,24,39,0.22)] dark:bg-white/8">
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
