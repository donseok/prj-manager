import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ListTree,
  Calendar,
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
      { name: '대기', value: leafTasks.filter((t) => t.status === 'pending').length, color: '#9CA3AF' },
      { name: '진행중', value: leafTasks.filter((t) => t.status === 'in_progress').length, color: '#3B82F6' },
      { name: '완료', value: leafTasks.filter((t) => t.status === 'completed').length, color: '#22C55E' },
      { name: '보류', value: leafTasks.filter((t) => t.status === 'on_hold').length, color: '#EAB308' },
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {currentProject?.name || '프로젝트'} 대시보드
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to={`/projects/${projectId}/wbs`}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ListTree className="w-4 h-4" />
            WBS 보기
          </Link>
          <Link
            to={`/projects/${projectId}/gantt`}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Calendar className="w-4 h-4" />
            간트 차트
          </Link>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">전체 공정율</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatPercent(stats.overallProgress)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              / 계획 {formatPercent(stats.planProgress)}
            </span>
          </div>
          <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${stats.overallProgress}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">진행중 작업</span>
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.inProgressTasks}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">/ {stats.totalTasks}</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">완료 작업</span>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completedTasks}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">/ {stats.totalTasks}</span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">지연 작업</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.delayedTasks}</span>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 상태별 분포 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">상태별 분포</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              데이터 없음
            </div>
          )}
        </div>

        {/* 담당자별 현황 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">담당자별 현황</h3>
          {assigneeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={assigneeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" stroke="var(--text-secondary)" />
                <YAxis type="category" dataKey="name" width={60} stroke="var(--text-secondary)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
                <Bar dataKey="completed" stackId="a" fill="#22C55E" name="완료" />
                <Bar dataKey="remaining" stackId="a" fill="#6B7280" name="남음" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* 작업 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 지연 작업 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            지연 작업
          </h3>
          {delayedTasks.length > 0 ? (
            <ul className="space-y-3">
              {delayedTasks.map((task) => (
                <li key={task.id} className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{task.name}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {getDelayDays(task)}일 지연 (계획종료: {formatDate(task.planEnd)})
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm">지연된 작업이 없습니다</p>
          )}
        </div>

        {/* 금주 작업 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            금주 작업
          </h3>
          {thisWeekTasks.length > 0 ? (
            <ul className="space-y-3">
              {thisWeekTasks.map((task) => (
                <li key={task.id} className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{task.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm">금주 예정 작업이 없습니다</p>
          )}
        </div>

        {/* 차주 작업 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-500" />
            차주 작업
          </h3>
          {nextWeekTasks.length > 0 ? (
            <ul className="space-y-3">
              {nextWeekTasks.map((task) => (
                <li key={task.id} className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{task.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(task.planStart)} ~ {formatDate(task.planEnd)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-sm">차주 예정 작업이 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
