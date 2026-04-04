import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Users, AlertTriangle, ArrowRightLeft, Activity } from 'lucide-react';
import type { Task, ProjectMember } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { useThemeStore } from '../../store/themeStore';
import {
  analyzeWorkload,
  buildWeeklyHeatmap,
  type OverloadLevel,
  type RebalanceSuggestion,
} from '../../lib/resourceAnalytics';

// ─── Constants ──────────────────────────────────────────────

const OVERLOAD_COLORS: Record<OverloadLevel, string> = {
  normal: '#2FA67C',
  warning: '#D88B44',
  critical: '#CB4B5F',
};

const OVERLOAD_LABELS: Record<OverloadLevel, string> = {
  normal: '정상',
  warning: '주의',
  critical: '과부하',
};

function getHeatmapColor(taskCount: number, isDark: boolean): string {
  if (taskCount === 0) return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(47,166,124,0.08)';
  if (taskCount <= 2) return isDark ? 'rgba(47,166,124,0.3)' : 'rgba(47,166,124,0.25)';
  if (taskCount <= 4) return isDark ? 'rgba(216,139,68,0.4)' : 'rgba(216,139,68,0.35)';
  return isDark ? 'rgba(203,75,95,0.5)' : 'rgba(203,75,95,0.4)';
}

function getHeatmapTextColor(taskCount: number, isDark: boolean): string {
  if (taskCount === 0) return isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
  if (taskCount <= 2) return '#2FA67C';
  if (taskCount <= 4) return '#D88B44';
  return '#CB4B5F';
}

// ─── Props ──────────────────────────────────────────────────

interface ResourceWidgetProps {
  tasks: Task[];
  members: ProjectMember[];
}

// ─── Component ──────────────────────────────────────────────

export default function ResourceWidget({ tasks, members }: ResourceWidgetProps) {
  const isDark = useThemeStore((state) => state.isDark);
  const updateTask = useTaskStore((state) => state.updateTask);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const summary = useMemo(() => analyzeWorkload(tasks, members), [tasks, members]);
  const heatmapData = useMemo(() => buildWeeklyHeatmap(tasks, members), [tasks, members]);

  const utilizationChartData = useMemo(
    () =>
      summary.members
        .filter((m) => m.memberId !== '__unassigned__')
        .map((m) => ({
          name: m.memberName,
          활용률: m.utilizationPct,
          overloadLevel: m.overloadLevel,
        })),
    [summary.members]
  );

  // Group heatmap cells by member
  const heatmapMembers = useMemo(() => {
    const memberMap = new Map<string, { name: string; cells: { weekLabel: string; taskCount: number }[] }>();
    for (const cell of heatmapData.cells) {
      let entry = memberMap.get(cell.memberId);
      if (!entry) {
        entry = { name: cell.memberName, cells: [] };
        memberMap.set(cell.memberId, entry);
      }
      entry.cells.push({ weekLabel: cell.weekLabel, taskCount: cell.taskCount });
    }
    return Array.from(memberMap.values());
  }, [heatmapData]);

  const handleApplySuggestion = (suggestion: RebalanceSuggestion) => {
    updateTask(suggestion.taskId, { assigneeId: suggestion.toMemberId });
    setAppliedSuggestions((prev) => new Set(prev).add(suggestion.taskId));
  };

  const quietSectionIconClassName =
    'flex h-12 w-12 items-center justify-center rounded-[20px] border border-[var(--border-color)] bg-[rgba(255,255,255,0.78)] text-[color:var(--text-primary)] shadow-[0_18px_36px_-26px_rgba(17,24,39,0.16)]';

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      {/* Workload Heatmap */}
      <div className="app-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="page-kicker">Resource Heatmap</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              워크로드 히트맵
            </h2>
          </div>
          <div
            className={
              isDark
                ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#6d28d9,#a78bfa)] text-white shadow-[0_20px_40px_-24px_rgba(109,40,217,0.72)]'
                : quietSectionIconClassName
            }
          >
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {heatmapMembers.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            {/* Summary badges */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[rgba(47,166,124,0.12)] px-3 py-1 text-xs font-semibold text-[#2FA67C]">
                평균 활용률 {summary.avgUtilization}%
              </span>
              {summary.overloadedCount > 0 && (
                <span className="rounded-full bg-[rgba(203,75,95,0.12)] px-3 py-1 text-xs font-semibold text-[#CB4B5F]">
                  과부하 {summary.overloadedCount}명
                </span>
              )}
              {summary.underloadedCount > 0 && (
                <span className="rounded-full bg-[rgba(91,141,239,0.12)] px-3 py-1 text-xs font-semibold text-[#5B8DEF]">
                  여유 {summary.underloadedCount}명
                </span>
              )}
            </div>

            <div className="min-w-[400px]">
              {/* Week header */}
              <div className="mb-2 grid gap-2" style={{ gridTemplateColumns: `120px repeat(${heatmapData.weeks.length}, 1fr)` }}>
                <div />
                {heatmapData.weeks.map((w) => (
                  <div
                    key={w.label}
                    className="text-center text-xs font-semibold text-[color:var(--text-secondary)]"
                  >
                    {w.label}
                  </div>
                ))}
              </div>

              {/* Member rows */}
              {heatmapMembers.map((member) => (
                <div
                  key={member.name}
                  className="mb-2 grid gap-2"
                  style={{ gridTemplateColumns: `120px repeat(${heatmapData.weeks.length}, 1fr)` }}
                >
                  <div className="flex items-center text-sm font-medium text-[color:var(--text-primary)] truncate" title={member.name}>
                    {member.name}
                  </div>
                  {member.cells.map((cell) => (
                    <div
                      key={cell.weekLabel}
                      className="flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors"
                      style={{
                        backgroundColor: getHeatmapColor(cell.taskCount, isDark),
                        color: getHeatmapTextColor(cell.taskCount, isDark),
                      }}
                      title={`${member.name} - ${cell.weekLabel}: ${cell.taskCount}개 작업`}
                    >
                      {cell.taskCount}
                    </div>
                  ))}
                </div>
              ))}

              {/* Legend */}
              <div className="mt-4 flex items-center justify-end gap-4 text-[11px] text-[color:var(--text-secondary)]">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: getHeatmapColor(0, isDark) }}
                  />
                  0
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: getHeatmapColor(1, isDark) }}
                  />
                  1-2
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: getHeatmapColor(3, isDark) }}
                  />
                  3-4
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: getHeatmapColor(5, isDark) }}
                  />
                  5+
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state mt-6">
            <p>워크로드 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* Utilization Bar Chart */}
      <div className="app-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="page-kicker">Utilization</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
              멤버별 활용률
            </h2>
          </div>
          <div
            className={
              isDark
                ? 'flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#123d64,#23547b)] text-white shadow-[0_20px_40px_-24px_rgba(18,61,100,0.72)]'
                : quietSectionIconClassName
            }
          >
            <Users className="h-5 w-5" />
          </div>
        </div>

        {utilizationChartData.length > 0 ? (
          <div className="mt-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={utilizationChartData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="4 6"
                  stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(127,111,97,0.14)'}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="var(--text-muted)"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={82}
                  stroke="var(--text-muted)"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, '활용률']}
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
                <Bar dataKey="활용률" radius={[0, 10, 10, 0]} barSize={18}>
                  {utilizationChartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={OVERLOAD_COLORS[entry.overloadLevel as OverloadLevel]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state mt-6">
            <p>데이터 없음</p>
          </div>
        )}

        {/* Overload badges below chart */}
        {summary.members.filter((m) => m.memberId !== '__unassigned__' && m.overloadLevel !== 'normal').length > 0 && (
          <div className="mt-4 space-y-2">
            {summary.members
              .filter((m) => m.memberId !== '__unassigned__' && m.overloadLevel !== 'normal')
              .map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-center gap-2 rounded-[16px] border px-4 py-2.5"
                  style={{
                    borderColor: `${OVERLOAD_COLORS[m.overloadLevel]}30`,
                    backgroundColor: `${OVERLOAD_COLORS[m.overloadLevel]}08`,
                  }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: OVERLOAD_COLORS[m.overloadLevel] }} />
                  <span className="text-sm text-[color:var(--text-primary)]">
                    <span className="font-semibold">{m.memberName}</span>
                    {' — '}
                    <span style={{ color: OVERLOAD_COLORS[m.overloadLevel] }} className="font-semibold">
                      {OVERLOAD_LABELS[m.overloadLevel]}
                    </span>
                    {' '}
                    (활성 {m.activeTasks}개, 금주 {m.weeklyTaskCount}개)
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Rebalance Suggestions */}
      {summary.rebalanceSuggestions.length > 0 && (
        <div className="app-panel overflow-hidden xl:col-span-2">
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] bg-gradient-to-r from-[rgba(203,75,95,0.14)] to-transparent px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-[0_18px_36px_-22px_rgba(17,24,39,0.22)]">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
                재배정 제안
              </h3>
              <p className="text-xs text-[color:var(--text-secondary)]">
                {summary.rebalanceSuggestions.length}개 제안
              </p>
            </div>
          </div>
          <div className="space-y-3 p-5">
            {summary.rebalanceSuggestions.map((suggestion) => {
              const isApplied = appliedSuggestions.has(suggestion.taskId);
              return (
                <div
                  key={suggestion.taskId}
                  className={`rounded-[22px] border p-4 transition-all ${
                    isApplied
                      ? 'border-[rgba(47,166,124,0.2)] bg-[rgba(47,166,124,0.06)]'
                      : 'border-[rgba(203,75,95,0.16)] bg-[rgba(203,75,95,0.04)]'
                  }`}
                >
                  <p className="text-sm leading-6 text-[color:var(--text-primary)]">
                    <span className="font-semibold">{suggestion.fromMemberName}</span>의{' '}
                    &#39;<span className="font-semibold">{suggestion.taskName}</span>&#39;을(를){' '}
                    <span className="font-semibold">{suggestion.toMemberName}</span>에게 재배정을 권장합니다
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    사유: {suggestion.reason}
                  </p>
                  <div className="mt-3">
                    {isApplied ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(47,166,124,0.12)] px-3 py-1.5 text-xs font-semibold text-[#2FA67C]">
                        적용 완료
                      </span>
                    ) : (
                      <button
                        onClick={() => handleApplySuggestion(suggestion)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(203,75,95,0.2)] bg-[rgba(203,75,95,0.08)] px-3 py-1.5 text-xs font-semibold text-[#CB4B5F] transition-colors hover:bg-[rgba(203,75,95,0.16)]"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        적용
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
