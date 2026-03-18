import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ListTree,
  Calendar,
  ArrowRight,
  Target,
  Zap,
} from 'lucide-react';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
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

  // 통계 계산
  const stats = useMemo(() => {
    const leafTasks = tasks.filter(
      (t) => !tasks.some((child) => child.parentId === t.id)
    );

    const completedTasks = leafTasks.filter((t) => t.status === 'completed');
    const inProgressTasks = leafTasks.filter((t) => t.status === 'in_progress');
    const delayedTasks = getDelayedTasks(leafTasks);
    const overallProgress = calculateOverallProgress(tasks);

    // 계획 공정율 계산
    const totalPlanWeight = tasks
      .filter((t) => t.level === 1)
      .reduce((sum, t) => sum + t.weight, 0);
    const planProgress =
      totalPlanWeight > 0
        ? tasks
            .filter((t) => t.level === 1)
            .reduce((sum, t) => sum + t.weight * t.planProgress, 0) / totalPlanWeight
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

  // 상태별 분포 데이터
  const statusData = useMemo(() => {
    const leafTasks = tasks.filter(
      (t) => !tasks.some((child) => child.parentId === t.id)
    );
    return [
      { name: '대기', value: leafTasks.filter((t) => t.status === 'pending').length, color: '#94a3b8' },
      { name: '진행중', value: leafTasks.filter((t) => t.status === 'in_progress').length, color: '#3b82f6' },
      { name: '완료', value: leafTasks.filter((t) => t.status === 'completed').length, color: '#10b981' },
      { name: '보류', value: leafTasks.filter((t) => t.status === 'on_hold').length, color: '#f59e0b' },
    ].filter((d) => d.value > 0);
  }, [tasks]);

  // 담당자별 현황 데이터
  const assigneeData = useMemo(() => {
    const leafTasks = tasks.filter(
      (t) => !tasks.some((child) => child.parentId === t.id) && t.assigneeId
    );

    const grouped = leafTasks.reduce((acc, task) => {
      const assignee = members.find((m) => m.id === task.assigneeId);
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

  // 금주/차주 작업
  const thisWeekTasks = useMemo(() => getWeeklyTasks(tasks, 'this').slice(0, 5), [tasks]);
  const nextWeekTasks = useMemo(() => getWeeklyTasks(tasks, 'next').slice(0, 5), [tasks]);
  const delayedTasks = useMemo(() => getDelayedTasks(tasks).slice(0, 5), [tasks]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {currentProject?.name || '프로젝트'} 대시보드
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">프로젝트 진행 현황을 한눈에 확인하세요</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/wbs`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-sm"
          >
            <ListTree className="w-4 h-4" />
            WBS 보기
          </Link>
          <Link
            to={`/projects/${projectId}/gantt`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-sm"
          >
            <Calendar className="w-4 h-4" />
            간트 차트
          </Link>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 전체 공정율 */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl p-6 shadow-xl shadow-blue-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-blue-100">전체 공정율</span>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold text-white">
                {formatPercent(stats.overallProgress)}
              </span>
              <span className="text-sm text-blue-200">
                / 계획 {formatPercent(stats.planProgress)}
              </span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${stats.overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* 진행중 작업 */}
        <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                진행중
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">진행중 작업</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.inProgressTasks}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">/ {stats.totalTasks}</span>
            </div>
          </div>
        </div>

        {/* 완료 작업 */}
        <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                완료
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">완료 작업</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completedTasks}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">/ {stats.totalTasks}</span>
            </div>
          </div>
        </div>

        {/* 지연 작업 */}
        <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              {stats.delayedTasks > 0 && (
                <span className="text-xs font-medium px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full animate-pulse">
                  주의
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">지연 작업</p>
            <span className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.delayedTasks}</span>
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 상태별 분포 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">상태별 분포</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">작업 진행 상태 현황</p>
            </div>
          </div>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              데이터 없음
            </div>
          )}
        </div>

        {/* 담당자별 현황 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">담당자별 현황</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">팀원별 작업 진행률</p>
            </div>
          </div>
          {assigneeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={assigneeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-secondary)" />
                <YAxis type="category" dataKey="name" width={70} stroke="var(--text-secondary)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="completed" stackId="a" fill="#10b981" name="완료" radius={[0, 4, 4, 0]} />
                <Bar dataKey="remaining" stackId="a" fill="#e2e8f0" name="남음" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* 작업 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 지연 작업 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-red-400 to-rose-500 rounded-lg flex items-center justify-center shadow-md shadow-red-500/25">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">지연 작업</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{delayedTasks.length}개 지연됨</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            {delayedTasks.length > 0 ? (
              <ul className="space-y-3">
                {delayedTasks.map((task) => (
                  <li key={task.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/50">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{task.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-red-200 dark:bg-red-800/50 text-red-700 dark:text-red-300 rounded-full font-medium">
                        {getDelayDays(task)}일 지연
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        종료: {formatDate(task.planEnd)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">지연된 작업이 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 금주 작업 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/25">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">금주 작업</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{thisWeekTasks.length}개 예정</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            {thisWeekTasks.length > 0 ? (
              <ul className="space-y-3">
                {thisWeekTasks.map((task) => (
                  <li key={task.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{task.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">금주 예정 작업이 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 차주 작업 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/25">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">차주 작업</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{nextWeekTasks.length}개 예정</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            {nextWeekTasks.length > 0 ? (
              <ul className="space-y-3">
                {nextWeekTasks.map((task) => (
                  <li key={task.id} className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{task.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">차주 예정 작업이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
