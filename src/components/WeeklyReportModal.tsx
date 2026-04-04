/**
 * WeeklyReportModal.tsx
 * 주간보고 미리보기 및 내보내기 모달 — Premium Redesign
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Calendar,
  FileBarChart,
  BarChart3,
  Users,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Presentation,
  Save,
  Loader2,
  UserPen,
} from 'lucide-react';
import Modal from './common/Modal';
import { cn, generateId } from '../lib/utils';
import {
  generateWeeklyReport,
  type WeeklyReportSection,
  type WeeklyReportTask,
} from '../lib/weeklyReport';
import { exportWeeklyReportExcel } from '../lib/exportWeeklyReport';
import { exportWeeklyReportPptx } from '../lib/exportWeeklyReportPptx';
import {
  compareSnapshots,
  getSnapshotByWeek,
} from '../lib/weeklySnapshot';
import { loadWeeklyMemberReports, upsertWeeklyMemberReport } from '../lib/dataRepository';
import { isSupabaseConfigured } from '../lib/supabase';
import { addWeeks, startOfWeek, format } from 'date-fns';
import type { Task, ProjectMember, Attendance } from '../types';
import { ATTENDANCE_TYPE_LABELS, ATTENDANCE_TYPE_COLORS } from '../types';
import type { WeeklyAttendanceSummary, WeeklyMemberReportEntry } from '../lib/weeklyReport';
import { CalendarCheck } from 'lucide-react';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  tasks: Task[];
  members: ProjectMember[];
  attendances?: Attendance[];
}

export default function WeeklyReportModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  tasks,
  members,
  attendances,
}: WeeklyReportModalProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'detail' | 'member-write'>('overview');

  const baseDate = useMemo(() => {
    return addWeeks(new Date(), weekOffset);
  }, [weekOffset]);

  const weekStartStr = useMemo(() => {
    return format(startOfWeek(baseDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  }, [baseDate]);

  // 담당자 작성 데이터
  const [memberDrafts, setMemberDrafts] = useState<Map<string, { thisWeekResult: string; nextWeekPlan: string; reportId?: string }>>(new Map());
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [savedMemberIds, setSavedMemberIds] = useState<Set<string>>(new Set());
  const [memberReportsLoaded, setMemberReportsLoaded] = useState(false);

  // DB에서 담당자 작성 데이터 로드
  useEffect(() => {
    if (!isOpen || !isSupabaseConfigured) return;
    let cancelled = false;
    setMemberReportsLoaded(false);
    loadWeeklyMemberReports(projectId, weekStartStr).then((reports) => {
      if (cancelled) return;
      const drafts = new Map<string, { thisWeekResult: string; nextWeekPlan: string; reportId?: string }>();
      for (const r of reports) {
        drafts.set(r.memberId, {
          thisWeekResult: r.thisWeekResult,
          nextWeekPlan: r.nextWeekPlan,
          reportId: r.id,
        });
      }
      setMemberDrafts(drafts);
      setMemberReportsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [isOpen, projectId, weekStartStr]);

  const handleSaveMemberReport = useCallback(async (memberId: string) => {
    const draft = memberDrafts.get(memberId);
    if (!draft) return;
    setSavingMemberId(memberId);
    try {
      const now = new Date().toISOString();
      const saved = await upsertWeeklyMemberReport({
        id: draft.reportId || generateId(),
        projectId,
        memberId,
        weekStart: weekStartStr,
        thisWeekResult: draft.thisWeekResult,
        nextWeekPlan: draft.nextWeekPlan,
        createdAt: draft.reportId ? now : now,
        updatedAt: now,
      });
      setMemberDrafts((prev) => {
        const next = new Map(prev);
        next.set(memberId, { ...draft, reportId: saved.id });
        return next;
      });
      setSavedMemberIds((prev) => new Set(prev).add(memberId));
      setTimeout(() => setSavedMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      }), 2000);
    } catch (err) {
      console.error('Failed to save member report:', err);
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSavingMemberId(null);
    }
  }, [memberDrafts, projectId, weekStartStr]);

  // memberReports를 report에 주입
  const memberReportEntries: WeeklyMemberReportEntry[] = useMemo(() => {
    const memberMap = new Map(members.map((m) => [m.id, m.name]));
    return Array.from(memberDrafts.entries())
      .filter(([, d]) => d.thisWeekResult.trim() || d.nextWeekPlan.trim())
      .map(([memberId, d]) => ({
        memberName: memberMap.get(memberId) || '알 수 없음',
        thisWeekResult: d.thisWeekResult,
        nextWeekPlan: d.nextWeekPlan,
      }));
  }, [memberDrafts, members]);

  const report = useMemo(() => {
    const r = generateWeeklyReport({ projectName, tasks, members, baseDate, attendances });
    r.memberReports = memberReportEntries.length > 0 ? memberReportEntries : undefined;
    return r;
  }, [projectName, tasks, members, baseDate, attendances, memberReportEntries]);

  const previousSnapshot = useMemo(() => {
    const prevWeek = format(
      startOfWeek(addWeeks(baseDate, -1), { weekStartsOn: 1 }),
      'yyyy-MM-dd'
    );
    return getSnapshotByWeek(projectId, prevWeek);
  }, [projectId, baseDate]);

  const comparison = useMemo(() => {
    return compareSnapshots(report, previousSnapshot?.data ?? null);
  }, [report, previousSnapshot]);

  const handleExport = () => {
    exportWeeklyReportExcel(report);
  };

  const handleExportPptx = async () => {
    await exportWeeklyReportPptx(report);
  };

  // 담당자별 작업 분포 계산
  const assigneeStats = useMemo(() => {
    const allTasks = [
      ...report.thisWeekActual.tasks,
      ...report.nextWeekPlan.tasks,
    ];
    const map = new Map<string, { name: string; count: number; completed: number }>();
    allTasks.forEach((t) => {
      const key = t.assigneeName || '미지정';
      const prev = map.get(key) || { name: key, count: 0, completed: 0 };
      prev.count += 1;
      if (t.status === 'completed') prev.completed += 1;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [report]);

  const progressGap = report.summary.overallPlanProgress - report.summary.overallActualProgress;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="주간보고" size="xl">
      <div className="weekly-report-modal">
        {/* 헤더 + 주차 네비게이션 */}
        <div className="weekly-report-header">
          <div className="weekly-report-header-bg" />
          <div className="weekly-report-header-content">
            <div className="flex items-center gap-3">
              <div className="weekly-report-icon-wrapper">
                <FileBarChart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-white">
                  {report.projectName}
                </h2>
                <p className="mt-0.5 text-xs text-white/70">
                  주간보고 · {report.generatedAt} 기준
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="weekly-report-nav-btn"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="weekly-report-week-label">
                <Calendar className="h-3.5 w-3.5 text-white/60" />
                <span className="text-sm font-semibold text-white">
                  {report.weekLabel}
                </span>
              </div>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="weekly-report-nav-btn"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="ml-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/20 transition-colors"
                >
                  이번 주
                </button>
              )}

              <div className="ml-3 flex items-center gap-1.5">
                <button
                  onClick={handleExportPptx}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
                >
                  <Presentation className="h-3.5 w-3.5" />
                  PPT
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Excel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="weekly-report-tabs">
          <button
            className={cn(
              'weekly-report-tab',
              activeTab === 'overview' && 'weekly-report-tab-active'
            )}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            요약 현황
          </button>
          <button
            className={cn(
              'weekly-report-tab',
              activeTab === 'detail' && 'weekly-report-tab-active'
            )}
            onClick={() => setActiveTab('detail')}
          >
            <Target className="h-3.5 w-3.5" />
            상세 작업
          </button>
          {isSupabaseConfigured && (
            <button
              className={cn(
                'weekly-report-tab',
                activeTab === 'member-write' && 'weekly-report-tab-active'
              )}
              onClick={() => setActiveTab('member-write')}
            >
              <UserPen className="h-3.5 w-3.5" />
              담당자 작성
            </button>
          )}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="weekly-report-body">
          {activeTab === 'overview' ? (
            <OverviewTab
              report={report}
              comparison={comparison}
              progressGap={progressGap}
              assigneeStats={assigneeStats}
              attendanceSummary={report.attendanceSummary}
            />
          ) : activeTab === 'detail' ? (
            <DetailTab report={report} />
          ) : (
            <MemberWriteTab
              members={members}
              drafts={memberDrafts}
              onDraftChange={(memberId, field, value) => {
                setMemberDrafts((prev) => {
                  const next = new Map(prev);
                  const current = next.get(memberId) || { thisWeekResult: '', nextWeekPlan: '' };
                  next.set(memberId, { ...current, [field]: value });
                  return next;
                });
              }}
              onSave={handleSaveMemberReport}
              savingMemberId={savingMemberId}
              savedMemberIds={savedMemberIds}
              loaded={memberReportsLoaded}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Overview Tab ──────────────────────────────────────────────

interface OverviewTabProps {
  report: ReturnType<typeof generateWeeklyReport>;
  comparison: ReturnType<typeof compareSnapshots>;
  progressGap: number;
  assigneeStats: { name: string; count: number; completed: number }[];
  attendanceSummary?: WeeklyAttendanceSummary[];
}

function OverviewTab({
  report,
  comparison,
  progressGap,
  assigneeStats,
  attendanceSummary,
}: OverviewTabProps) {
  return (
    <div className="space-y-5">
      {/* 요약 KPI 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="전체 작업"
          value={report.summary.totalLeafTasks}
          unit="건"
          icon={<Clock className="h-4 w-4" />}
          gradient="from-[#0f766e] to-[#2fa67c]"
        />
        <KpiCard
          label="완료"
          value={report.summary.completedTasks}
          unit="건"
          icon={<CheckCircle2 className="h-4 w-4" />}
          gradient="from-[#1fa37a] to-[#34c997]"
          delta={comparison.completedDelta}
          deltaUnit="건"
        />
        <KpiCard
          label="실적 공정율"
          value={Math.round(report.summary.overallActualProgress)}
          unit="%"
          icon={<TrendingUp className="h-4 w-4" />}
          gradient="from-[#5B8DEF] to-[#A78BFA]"
          delta={comparison.progressDelta}
          deltaUnit="%p"
        />
        <KpiCard
          label="지연"
          value={report.summary.delayedTasks}
          unit="건"
          icon={<AlertTriangle className="h-4 w-4" />}
          gradient="from-[#cb4b5f] to-[#ff738a]"
          delta={comparison.delayedDelta}
          deltaUnit="건"
          inverseDelta
        />
      </div>

      {/* 계획 vs 실적 비교 */}
      <div className="weekly-report-progress-compare">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            계획 vs 실적
          </p>
          <span className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-bold',
            progressGap <= 0
              ? 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]'
              : progressGap <= 5
                ? 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]'
                : 'bg-[rgba(203,75,95,0.12)] text-[color:var(--accent-danger)]'
          )}>
            {progressGap <= 0 ? '정상' : `${Math.round(progressGap)}%p 미달`}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-[color:var(--text-secondary)]">계획 공정율</span>
              <span className="font-semibold text-[color:var(--text-primary)]">
                {Math.round(report.summary.overallPlanProgress)}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[rgba(91,141,239,0.1)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#5B8DEF,#A78BFA)] transition-all duration-700"
                style={{ width: `${report.summary.overallPlanProgress}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-[color:var(--text-secondary)]">실적 공정율</span>
              <span className="font-semibold text-[color:var(--text-primary)]">
                {Math.round(report.summary.overallActualProgress)}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
              <div
                className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all duration-700"
                style={{ width: `${report.summary.overallActualProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 이슈 / 리스크 */}
      {report.issues.length > 0 && (
        <div className="weekly-report-issue-panel">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[color:var(--accent-warning)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-warning)]">
              이슈 / 리스크
            </p>
          </div>
          <ul className="space-y-2">
            {report.issues.map((issue, i) => (
              <li key={i} className="weekly-report-issue-item">
                <span className="weekly-report-issue-number">{i + 1}</span>
                <span className="text-sm text-[color:var(--text-primary)]">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 담당자별 작업 현황 */}
      {assigneeStats.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              담당자별 작업 현황
            </p>
          </div>
          <div className="space-y-2.5">
            {assigneeStats.map((stat) => (
              <div key={stat.name} className="flex items-center gap-3">
                <div className="weekly-report-assignee-avatar">
                  {stat.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[color:var(--text-primary)] truncate" title={stat.name}>
                      {stat.name}
                    </span>
                    <span className="text-xs text-[color:var(--text-secondary)]">
                      {stat.completed}/{stat.count}건
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
                    <div
                      className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all duration-500"
                      style={{ width: `${stat.count > 0 ? (stat.completed / stat.count) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 근태현황 */}
      {attendanceSummary && attendanceSummary.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              금주 근태현황
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="weekly-report-table-header">
                  <th className="px-3 py-2 text-left">담당자</th>
                  {['월', '화', '수', '목', '금'].map((d) => (
                    <th key={d} className="px-3 py-2 text-center">{d}</th>
                  ))}
                  <th className="px-3 py-2 text-left">소계</th>
                </tr>
              </thead>
              <tbody>
                {attendanceSummary.map((s) => {
                  const dayMap = new Map(s.records.map((r) => {
                    const dayOfWeek = new Date(r.date).getDay(); // 1=월 ~ 5=금
                    return [dayOfWeek, r];
                  }));
                  return (
                    <tr key={s.memberName} className="weekly-report-task-row">
                      <td className="px-3 py-2 font-medium text-[color:var(--text-primary)]">{s.memberName}</td>
                      {[1, 2, 3, 4, 5].map((dow) => {
                        const rec = dayMap.get(dow);
                        return (
                          <td key={dow} className="px-3 py-2 text-center">
                            {rec ? (
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: `${ATTENDANCE_TYPE_COLORS[rec.type]}18`,
                                  color: ATTENDANCE_TYPE_COLORS[rec.type],
                                }}
                              >
                                {ATTENDANCE_TYPE_LABELS[rec.type]}
                              </span>
                            ) : (
                              <span className="text-[color:var(--text-muted)]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-xs text-[color:var(--text-secondary)]">
                        {Object.entries(s.stats).map(([k, v]) => `${k}${v}`).join('/')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 섹션 요약 리본 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SectionRibbon
          label="금주 실적"
          count={report.thisWeekActual.tasks.length}
          color="var(--accent-primary)"
        />
        <SectionRibbon
          label="금주 완료"
          count={report.completedThisWeek.tasks.length}
          color="var(--accent-success)"
        />
        <SectionRibbon
          label="차주 계획"
          count={report.nextWeekPlan.tasks.length}
          color="#6366f1"
        />
        <SectionRibbon
          label="지연 작업"
          count={report.delayed.tasks.length}
          color="var(--accent-danger)"
        />
      </div>

    </div>
  );
}

// ── Detail Tab ──────────────────────────────────────────────

function DetailTab({ report }: { report: ReturnType<typeof generateWeeklyReport> }) {
  return (
    <div className="space-y-4">
      <ReportSection section={report.thisWeekActual} accentColor="var(--accent-primary)" />
      <ReportSection section={report.completedThisWeek} accentColor="var(--accent-success)" />
      <ReportSection section={report.nextWeekPlan} accentColor="#6366f1" />
      <ReportSection section={report.delayed} accentColor="var(--accent-danger)" />
    </div>
  );
}

// ── Member Write Tab ────────────────────────────────────────

interface MemberWriteTabProps {
  members: ProjectMember[];
  drafts: Map<string, { thisWeekResult: string; nextWeekPlan: string; reportId?: string }>;
  onDraftChange: (memberId: string, field: 'thisWeekResult' | 'nextWeekPlan', value: string) => void;
  onSave: (memberId: string) => Promise<void>;
  savingMemberId: string | null;
  savedMemberIds: Set<string>;
  loaded: boolean;
}

function MemberWriteTab({
  members,
  drafts,
  onDraftChange,
  onSave,
  savingMemberId,
  savedMemberIds,
  loaded,
}: MemberWriteTabProps) {
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-[color:var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        담당자 보고 데이터 로드 중...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--text-secondary)] leading-5">
        각 담당자별로 금주 실적과 차주 계획을 작성하고 저장하세요. 저장된 내용은 PPT 출력 시 반영됩니다.
      </p>
      {members.map((member) => {
        const draft = drafts.get(member.id) || { thisWeekResult: '', nextWeekPlan: '' };
        const isSaving = savingMemberId === member.id;
        const isSaved = savedMemberIds.has(member.id);

        return (
          <div key={member.id} className="weekly-report-detail-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="weekly-report-assignee-avatar">
                  {member.name.slice(0, 1)}
                </div>
                <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {member.name}
                </span>
                <span className="text-[10px] text-[color:var(--text-muted)] bg-[color:var(--bg-elevated)] rounded-full px-2 py-0.5">
                  {member.role === 'owner' ? '소유자' : member.role === 'admin' ? '관리자' : '멤버'}
                </span>
              </div>
              <button
                onClick={() => void onSave(member.id)}
                disabled={isSaving}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  isSaved
                    ? 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]'
                    : 'bg-[color:var(--accent-primary)] text-white hover:opacity-90',
                  isSaving && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 저장 중...</>
                ) : isSaved ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> 저장됨</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> 저장</>
                )}
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-2">
                  금주 실적
                </label>
                <textarea
                  value={draft.thisWeekResult}
                  onChange={(e) => onDraftChange(member.id, 'thisWeekResult', e.target.value)}
                  placeholder="이번 주 수행한 작업 내용을 작성하세요..."
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-primary)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-2">
                  차주 계획
                </label>
                <textarea
                  value={draft.nextWeekPlan}
                  onChange={(e) => onDraftChange(member.id, 'nextWeekPlan', e.target.value)}
                  placeholder="다음 주 수행할 작업 계획을 작성하세요..."
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-primary)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] resize-none"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub Components ──────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  icon,
  gradient,
  delta,
  deltaUnit = '건',
  inverseDelta = false,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  gradient: string;
  delta?: number;
  deltaUnit?: string;
  inverseDelta?: boolean;
}) {
  const hasDelta = delta !== undefined && delta !== 0;
  const isPositive = inverseDelta ? (delta ?? 0) < 0 : (delta ?? 0) > 0;

  return (
    <div className="weekly-report-kpi">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
          {label}
        </span>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
            gradient
          )}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-[-0.04em] text-[color:var(--text-primary)]">
          {value}
        </span>
        <span className="text-sm text-[color:var(--text-secondary)]">{unit}</span>
      </div>
      {hasDelta && (
        <div
          className={cn(
            'mt-2 flex items-center gap-1 text-[11px] font-semibold',
            isPositive
              ? 'text-[color:var(--accent-success)]'
              : 'text-[color:var(--accent-danger)]'
          )}
        >
          {isPositive ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (delta ?? 0) === 0 ? (
            <Minus className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {delta! > 0 ? '+' : ''}
          {delta}
          {deltaUnit} vs 전주
        </div>
      )}
    </div>
  );
}

function SectionRibbon({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="weekly-report-ribbon">
      <div className="weekly-report-ribbon-indicator" style={{ backgroundColor: color }} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold tracking-[-0.04em] text-[color:var(--text-primary)]">
          {count}<span className="text-xs font-medium text-[color:var(--text-secondary)] ml-0.5">건</span>
        </p>
      </div>
    </div>
  );
}

function ReportSection({
  section,
  accentColor,
}: {
  section: WeeklyReportSection;
  accentColor: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="weekly-report-detail-section">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="weekly-report-detail-section-header"
      >
        <div className="flex items-center gap-3">
          <div
            className="h-2.5 w-2.5 rounded-full shadow-sm"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}40` }}
          />
          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
            {section.title}
          </span>
          <span className="weekly-report-count-badge">{section.tasks.length}건</span>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-[color:var(--text-secondary)] transition-transform duration-200',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--border-color)]">
          {section.tasks.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[color:var(--text-muted)] italic">
              해당 작업 없음
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="weekly-report-table-header">
                    <th className="px-4 py-2.5 text-left">작업명</th>
                    <th className="px-4 py-2.5 text-center">담당자</th>
                    <th className="px-4 py-2.5 text-center">상태</th>
                    <th className="px-4 py-2.5 text-center">실적</th>
                    <th className="px-4 py-2.5 text-center">지연</th>
                  </tr>
                </thead>
                <tbody>
                  {section.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: WeeklyReportTask }) {
  return (
    <tr className="weekly-report-task-row">
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-[color:var(--text-primary)]">{task.name}</p>
          {task.parentName && (
            <p className="mt-0.5 text-[11px] text-[color:var(--text-muted)]">{task.parentName}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center gap-1.5">
          <span className="weekly-report-assignee-dot">
            {task.assigneeName.slice(0, 1)}
          </span>
          <span className="text-[color:var(--text-secondary)]">{task.assigneeName}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold',
            task.status === 'completed' && 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]',
            task.status === 'in_progress' && 'bg-[rgba(15,118,110,0.1)] text-[color:var(--accent-primary)]',
            task.status === 'pending' && 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]',
            task.status === 'on_hold' && 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]'
          )}
        >
          {task.statusLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
            <div
              className="h-full rounded-full bg-[image:linear-gradient(135deg,#1fa37a,#34c997)] transition-all duration-500"
              style={{ width: `${task.actualProgress}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[color:var(--text-secondary)] w-8 text-right">
            {task.actualProgress}%
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        {task.delayDays > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[color:var(--accent-danger)]">
            <AlertTriangle className="h-3 w-3" />
            {task.delayDays}일
          </span>
        ) : (
          <span className="text-xs text-[color:var(--text-muted)]">—</span>
        )}
      </td>
    </tr>
  );
}
