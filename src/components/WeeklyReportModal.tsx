/**
 * WeeklyReportModal.tsx
 * 주간보고 미리보기 및 내보내기 모달 — Premium Redesign
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  getSnapshots,
} from '../lib/weeklySnapshot';
import { loadWeeklyMemberReports, upsertWeeklyMemberReport } from '../lib/dataRepository';
import { isSupabaseConfigured } from '../lib/supabase';
import { addWeeks, startOfWeek, format } from 'date-fns';
import type { Task, ProjectMember, Attendance } from '../types';
import { ATTENDANCE_TYPE_LABELS, ATTENDANCE_TYPE_COLORS } from '../types';
import type { WeeklyAttendanceSummary, WeeklyMemberReportEntry } from '../lib/weeklyReport';
import {
  CalendarCheck,
  Layers,
  Flag,
  MessageSquare,
  PenLine,
  ArrowRight,
  Flame,
  Shield,
  Info,
} from 'lucide-react';

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
  const { t } = useTranslation();
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
    if (!isOpen) return;
    if (!isSupabaseConfigured) {
      setMemberReportsLoaded(true);
      return;
    }
    let cancelled = false;
    setMemberReportsLoaded(false);

    // 타임아웃 보호: 10초 내에 응답 없으면 빈 상태로 진행
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('Weekly member reports load timed out');
        setMemberReportsLoaded(true);
      }
    }, 10000);

    loadWeeklyMemberReports(projectId, weekStartStr).then((reports) => {
      clearTimeout(timeout);
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
    }).catch((err) => {
      clearTimeout(timeout);
      console.error('Failed to load member reports:', err);
      if (!cancelled) setMemberReportsLoaded(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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
      alert(err instanceof Error ? err.message : t('weeklyReport.saveFailed'));
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
        memberName: memberMap.get(memberId) || t('weeklyReport.unknown'),
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
    allTasks.forEach((tk) => {
      const key = tk.assigneeName || t('weeklyReport.unassigned');
      const prev = map.get(key) || { name: key, count: 0, completed: 0 };
      prev.count += 1;
      if (tk.status === 'completed') prev.completed += 1;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [report]);

  // 주간 트렌드 데이터 (최근 6주 스냅샷)
  const trendData = useMemo(() => {
    const snapshots = getSnapshots(projectId);
    const recent = snapshots
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .slice(-5);
    const points = recent.map((s) => ({
      weekLabel: s.weekLabel.replace(/\(.*\)/, '').trim(),
      actualProgress: s.data.summary.overallActualProgress,
      planProgress: s.data.summary.overallPlanProgress,
    }));
    // 현재 주 추가
    points.push({
      weekLabel: report.weekLabel.replace(/\(.*\)/, '').trim(),
      actualProgress: report.summary.overallActualProgress,
      planProgress: report.summary.overallPlanProgress,
    });
    return points;
  }, [projectId, report]);

  // 이슈 대응방안 상태
  const [issueResponses, setIssueResponses] = useState<Map<number, string>>(new Map());

  // 핵심 성과/목표 에디터블 상태
  const [keyAchievements, setKeyAchievements] = useState('');
  const [nextKeyGoals, setNextKeyGoals] = useState('');

  const progressGap = report.summary.overallPlanProgress - report.summary.overallActualProgress;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('weeklyReport.title')} size="xl">
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
                  {t('weeklyReport.title')} · {report.generatedAt} {t('weeklyReport.asOf')}
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
                  {t('weeklyReport.thisWeek')}
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
            {t('weeklyReport.overviewTab')}
          </button>
          <button
            className={cn(
              'weekly-report-tab',
              activeTab === 'detail' && 'weekly-report-tab-active'
            )}
            onClick={() => setActiveTab('detail')}
          >
            <Target className="h-3.5 w-3.5" />
            {t('weeklyReport.detailTab')}
          </button>
          <button
            className={cn(
              'weekly-report-tab',
              activeTab === 'member-write' && 'weekly-report-tab-active'
            )}
            onClick={() => setActiveTab('member-write')}
          >
            <UserPen className="h-3.5 w-3.5" />
            {t('weeklyReport.memberWriteTab')}
          </button>
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
              trendData={trendData}
              issueResponses={issueResponses}
              onIssueResponseChange={(idx, val) => {
                setIssueResponses((prev) => {
                  const next = new Map(prev);
                  next.set(idx, val);
                  return next;
                });
              }}
              keyAchievements={keyAchievements}
              onKeyAchievementsChange={setKeyAchievements}
              nextKeyGoals={nextKeyGoals}
              onNextKeyGoalsChange={setNextKeyGoals}
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
  trendData: { weekLabel: string; actualProgress: number; planProgress: number }[];
  issueResponses: Map<number, string>;
  onIssueResponseChange: (idx: number, val: string) => void;
  keyAchievements: string;
  onKeyAchievementsChange: (val: string) => void;
  nextKeyGoals: string;
  onNextKeyGoalsChange: (val: string) => void;
}

function OverviewTab({
  report,
  comparison,
  progressGap,
  assigneeStats,
  attendanceSummary,
  trendData,
  issueResponses,
  onIssueResponseChange,
  keyAchievements,
  onKeyAchievementsChange,
  nextKeyGoals,
  onNextKeyGoalsChange,
}: OverviewTabProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      {/* ── #6 금주 핵심 성과 / 차주 핵심 목표 (에디터블) ── */}
      <div className="weekly-report-section-panel">
        <div className="flex items-center gap-2 mb-4">
          <PenLine className="h-4 w-4 text-[color:var(--accent-primary)]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            {t('weeklyReport.keyAchievements')} / {t('weeklyReport.nextKeyGoals')}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-1.5">
              {t('weeklyReport.keyAchievements')}
            </label>
            <textarea
              value={keyAchievements}
              onChange={(e) => onKeyAchievementsChange(e.target.value)}
              placeholder={t('weeklyReport.keyAchievementsPlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-1.5">
              {t('weeklyReport.nextKeyGoals')}
            </label>
            <textarea
              value={nextKeyGoals}
              onChange={(e) => onNextKeyGoalsChange(e.target.value)}
              placeholder={t('weeklyReport.nextKeyGoalsPlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-primary)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] resize-none"
            />
          </div>
        </div>
      </div>

      {/* 요약 KPI 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label={t('weeklyReport.totalTasks')}
          value={report.summary.totalLeafTasks}
          unit={t('weeklyReport.unitCount')}
          icon={<Clock className="h-4 w-4" />}
          gradient="from-[#0f766e] to-[#2fa67c]"
        />
        <KpiCard
          label={t('weeklyReport.completed')}
          value={report.summary.completedTasks}
          unit={t('weeklyReport.unitCount')}
          icon={<CheckCircle2 className="h-4 w-4" />}
          gradient="from-[#1fa37a] to-[#34c997]"
          delta={comparison.completedDelta}
          deltaUnit={t('weeklyReport.unitCount')}
        />
        <KpiCard
          label={t('weeklyReport.actualProgress')}
          value={Math.round(report.summary.overallActualProgress)}
          unit="%"
          icon={<TrendingUp className="h-4 w-4" />}
          gradient="from-[#5B8DEF] to-[#A78BFA]"
          delta={comparison.progressDelta}
          deltaUnit="%p"
        />
        <KpiCard
          label={t('weeklyReport.delayed')}
          value={report.summary.delayedTasks}
          unit={t('weeklyReport.unitCount')}
          icon={<AlertTriangle className="h-4 w-4" />}
          gradient="from-[#cb4b5f] to-[#ff738a]"
          delta={comparison.delayedDelta}
          deltaUnit={t('weeklyReport.unitCount')}
          inverseDelta
        />
      </div>

      {/* ── #7 완료 vs 신규 추가 비교 ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-success)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.completedVsNew')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-[color:var(--accent-success)]">{report.completedVsNew.completedCount}</p>
              <p className="text-[10px] text-[color:var(--text-muted)] mt-1">{t('weeklyReport.completedLabel')}</p>
            </div>
            <div className="text-[color:var(--text-muted)]">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-[color:var(--accent-primary)]">{report.completedVsNew.newlyAddedCount}</p>
              <p className="text-[10px] text-[color:var(--text-muted)] mt-1">{t('weeklyReport.newlyAdded')}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--bg-elevated)] flex">
            {(report.completedVsNew.completedCount + report.completedVsNew.newlyAddedCount) > 0 && (
              <>
                <div
                  className="h-full bg-[color:var(--accent-success)] transition-all duration-500"
                  style={{
                    width: `${(report.completedVsNew.completedCount / (report.completedVsNew.completedCount + report.completedVsNew.newlyAddedCount)) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-[color:var(--accent-primary)] transition-all duration-500"
                  style={{
                    width: `${(report.completedVsNew.newlyAddedCount / (report.completedVsNew.completedCount + report.completedVsNew.newlyAddedCount)) * 100}%`,
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* 섹션 요약 리본 (2x2로 축소) */}
        <div className="grid grid-cols-2 gap-2">
          <SectionRibbon
            label={t('weeklyReport.thisWeekActual')}
            count={report.thisWeekActual.tasks.length}
            color="var(--accent-primary)"
          />
          <SectionRibbon
            label={t('weeklyReport.thisWeekCompleted')}
            count={report.completedThisWeek.tasks.length}
            color="var(--accent-success)"
          />
          <SectionRibbon
            label={t('weeklyReport.nextWeekPlan')}
            count={report.nextWeekPlan.tasks.length}
            color="#6366f1"
          />
          <SectionRibbon
            label={t('weeklyReport.delayedTasks')}
            count={report.delayed.tasks.length}
            color="var(--accent-danger)"
          />
        </div>
      </div>

      {/* 계획 vs 실적 비교 */}
      <div className="weekly-report-progress-compare">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
            {t('weeklyReport.planVsActual')}
          </p>
          <span className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-bold',
            progressGap <= 0
              ? 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]'
              : progressGap <= 5
                ? 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]'
                : 'bg-[rgba(203,75,95,0.12)] text-[color:var(--accent-danger)]'
          )}>
            {progressGap <= 0 ? t('weeklyReport.onTrack') : `${Math.round(progressGap)}%p ${t('weeklyReport.behind')}`}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-[color:var(--text-secondary)]">{t('weeklyReport.planProgress')}</span>
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
              <span className="text-[color:var(--text-secondary)]">{t('weeklyReport.actualProgressRate')}</span>
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

      {/* ── #1 Phase별 진척률 브레이크다운 ── */}
      {report.phaseBreakdowns.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.phaseBreakdown')}
            </p>
          </div>
          <div className="space-y-3">
            {report.phaseBreakdowns.map((phase) => {
              const gap = phase.planProgress - phase.actualProgress;
              return (
                <div key={phase.phaseId} className="rounded-lg border border-[var(--border-color)] p-3 bg-[color:var(--bg-primary)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[color:var(--text-primary)] truncate flex-1" title={phase.phaseName}>
                      {phase.phaseName}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] shrink-0 ml-2">
                      <span className="text-[color:var(--text-muted)]">
                        {phase.completedTasks}/{phase.totalLeafTasks}{t('weeklyReport.unitCount')}
                      </span>
                      {phase.delayedTasks > 0 && (
                        <span className="text-[color:var(--accent-danger)] font-bold">
                          {phase.delayedTasks}{t('weeklyReport.delayed')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[color:var(--text-muted)] w-7 shrink-0">{t('weeklyReport.plan')}</span>
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-[rgba(91,141,239,0.1)]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#5B8DEF,#A78BFA)] transition-all duration-500"
                          style={{ width: `${phase.planProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-[color:var(--text-secondary)] w-9 text-right">{Math.round(phase.planProgress)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[color:var(--text-muted)] w-7 shrink-0">{t('weeklyReport.actual')}</span>
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
                        <div
                          className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-all duration-500"
                          style={{ width: `${phase.actualProgress}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-[10px] font-semibold w-9 text-right',
                        gap > 5 ? 'text-[color:var(--accent-danger)]' : 'text-[color:var(--text-secondary)]'
                      )}>{Math.round(phase.actualProgress)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── #2 주간 트렌드 차트 (미니 스파크라인) ── */}
      {trendData.length >= 2 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.trendChart')}
            </p>
            <span className="text-[10px] text-[color:var(--text-muted)]">
              ({t('weeklyReport.recentWeeks', { count: trendData.length })})
            </span>
          </div>
          <div className="relative h-32">
            <MiniSparkline data={trendData} />
          </div>
        </div>
      )}

      {/* ── #3 마일스톤 타임라인 ── */}
      {report.milestones.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <Flag className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.milestoneTimeline')}
            </p>
          </div>
          <div className="space-y-2">
            {report.milestones.map((ms) => (
              <div key={ms.taskId} className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] px-4 py-2.5 bg-[color:var(--bg-primary)]">
                <div className={cn(
                  'h-2.5 w-2.5 rounded-full shrink-0',
                  ms.daysUntil < 0 ? 'bg-[color:var(--accent-danger)]' :
                  ms.daysUntil <= 3 ? 'bg-[color:var(--accent-warning)]' :
                  'bg-[color:var(--accent-success)]'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[color:var(--text-primary)] truncate">{ms.taskName}</span>
                    <span className="text-[10px] text-[color:var(--text-muted)] bg-[color:var(--bg-elevated)] rounded-full px-2 py-0.5 shrink-0">
                      {ms.levelLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">
                    {ms.planEnd} · {ms.statusLabel} · {Math.round(ms.actualProgress)}%
                  </p>
                </div>
                <span className={cn(
                  'text-xs font-bold shrink-0',
                  ms.daysUntil < 0 ? 'text-[color:var(--accent-danger)]' :
                  ms.daysUntil === 0 ? 'text-[color:var(--accent-warning)]' :
                  'text-[color:var(--accent-success)]'
                )}>
                  {ms.daysUntil < 0
                    ? t('weeklyReport.daysOverdue', { days: Math.abs(ms.daysUntil) })
                    : ms.daysUntil === 0
                      ? t('weeklyReport.dueToday')
                      : t('weeklyReport.daysRemaining', { days: ms.daysUntil })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── #4 이슈 / 리스크 (등급화 + 대응방안) ── */}
      {report.gradedIssues.length > 0 && (
        <div className="weekly-report-issue-panel">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[color:var(--accent-warning)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-warning)]">
              {t('weeklyReport.riskGrading')}
            </p>
          </div>
          <div className="space-y-3">
            {report.gradedIssues.map((issue, i) => (
              <div key={i} className="rounded-lg border border-[var(--border-color)] p-3 bg-[color:var(--bg-primary)]">
                <div className="flex items-start gap-2">
                  <span className={cn(
                    'mt-0.5 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0',
                    issue.severity === 'high' && 'bg-[rgba(203,75,95,0.15)] text-[color:var(--accent-danger)]',
                    issue.severity === 'medium' && 'bg-[rgba(203,109,55,0.15)] text-[color:var(--accent-warning)]',
                    issue.severity === 'low' && 'bg-[rgba(91,141,239,0.15)] text-[#5B8DEF]',
                  )}>
                    {issue.severity === 'high' ? <Flame className="h-3 w-3 mr-0.5" /> :
                     issue.severity === 'medium' ? <Shield className="h-3 w-3 mr-0.5" /> :
                     <Info className="h-3 w-3 mr-0.5" />}
                    {issue.severity === 'high' ? t('weeklyReport.severityHigh') :
                     issue.severity === 'medium' ? t('weeklyReport.severityMedium') :
                     t('weeklyReport.severityLow')}
                  </span>
                  <span className="text-sm text-[color:var(--text-primary)] flex-1">{issue.message}</span>
                </div>
                <div className="mt-2 ml-0">
                  <label className="block text-[10px] font-semibold text-[color:var(--text-muted)] mb-1">
                    {t('weeklyReport.responseAction')}
                  </label>
                  <input
                    type="text"
                    value={issueResponses.get(i) || ''}
                    onChange={(e) => onIssueResponseChange(i, e.target.value)}
                    placeholder={t('weeklyReport.responsePlaceholder')}
                    className="w-full rounded-md border border-[var(--border-color)] bg-[color:var(--bg-primary)] px-2.5 py-1.5 text-xs text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 담당자별 작업 현황 */}
      {assigneeStats.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.assigneeTaskStatus')}
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
                      {stat.completed}/{stat.count}{t('weeklyReport.unitCount')}
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

      {/* ── #8 담당자별 워크로드 히트맵 ── */}
      {report.workloadHeatmap.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.workloadHeatmap')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="weekly-report-table-header">
                  <th className="px-3 py-2 text-left">{t('weeklyReport.assignee')}</th>
                  {[t('weeklyReport.dayMon'), t('weeklyReport.dayTue'), t('weeklyReport.dayWed'), t('weeklyReport.dayThu'), t('weeklyReport.dayFri')].map((d) => (
                    <th key={d} className="px-3 py-2 text-center">{d}</th>
                  ))}
                  <th className="px-3 py-2 text-center">{t('weeklyReport.subtotal')}</th>
                </tr>
              </thead>
              <tbody>
                {report.workloadHeatmap.map((entry) => {
                  const maxLoad = Math.max(...entry.dailyLoad, 1);
                  return (
                    <tr key={entry.memberName} className="weekly-report-task-row">
                      <td className="px-3 py-2 font-medium text-[color:var(--text-primary)]">{entry.memberName}</td>
                      {entry.dailyLoad.map((load, di) => {
                        const intensity = load / maxLoad;
                        const bg = load === 0
                          ? 'transparent'
                          : `rgba(15, 118, 110, ${0.1 + intensity * 0.4})`;
                        return (
                          <td key={di} className="px-3 py-2 text-center">
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold"
                              style={{ backgroundColor: bg, color: load > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}
                              title={`${load} ${t('weeklyReport.tasks')}`}
                            >
                              {load}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold',
                          entry.totalLoad >= 15 ? 'bg-[rgba(203,75,95,0.12)] text-[color:var(--accent-danger)]' :
                          entry.totalLoad >= 8 ? 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]' :
                          'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]'
                        )}>
                          {entry.totalLoad}{t('weeklyReport.unitCount')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 근태현황 */}
      {attendanceSummary && attendanceSummary.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.weeklyAttendance')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="weekly-report-table-header">
                  <th className="px-3 py-2 text-left">{t('weeklyReport.assignee')}</th>
                  {[t('weeklyReport.dayMon'), t('weeklyReport.dayTue'), t('weeklyReport.dayWed'), t('weeklyReport.dayThu'), t('weeklyReport.dayFri')].map((d) => (
                    <th key={d} className="px-3 py-2 text-center">{d}</th>
                  ))}
                  <th className="px-3 py-2 text-left">{t('weeklyReport.subtotal')}</th>
                </tr>
              </thead>
              <tbody>
                {attendanceSummary.map((s) => {
                  const dayMap = new Map(s.records.map((r) => {
                    const [y, m, d] = r.date.split('-').map(Number);
                    const dayOfWeek = new Date(y, m - 1, d).getDay();
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

      {/* ── #5 팀원 코멘트 통합 표시 ── */}
      {report.memberReports && report.memberReports.length > 0 && (
        <div className="weekly-report-section-panel">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              {t('weeklyReport.memberComments')}
            </p>
          </div>
          <div className="space-y-2.5">
            {report.memberReports.map((mr) => (
              <div key={mr.memberName} className="rounded-lg border border-[var(--border-color)] p-3 bg-[color:var(--bg-primary)]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="weekly-report-assignee-avatar">{mr.memberName.slice(0, 1)}</div>
                  <span className="text-sm font-semibold text-[color:var(--text-primary)]">{mr.memberName}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {mr.thisWeekResult && (
                    <div>
                      <p className="text-[10px] font-semibold text-[color:var(--text-muted)] mb-0.5">{t('weeklyReport.thisWeekResult')}</p>
                      <p className="text-xs text-[color:var(--text-secondary)] leading-5 whitespace-pre-wrap">{mr.thisWeekResult}</p>
                    </div>
                  )}
                  {mr.nextWeekPlan && (
                    <div>
                      <p className="text-[10px] font-semibold text-[color:var(--text-muted)] mb-0.5">{t('weeklyReport.nextWeekPlanLabel')}</p>
                      <p className="text-xs text-[color:var(--text-secondary)] leading-5 whitespace-pre-wrap">{mr.nextWeekPlan}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  const { t } = useTranslation();
  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12 text-[color:var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t('weeklyReport.loadingMemberReports')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[color:var(--text-secondary)] leading-5">
        {t('weeklyReport.memberWriteDesc')}
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
                  {member.role === 'owner' ? t('members.roles.owner') : member.role === 'admin' ? t('members.roles.admin') : t('members.roles.member')}
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
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.saving')}</>
                ) : isSaved ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> {t('weeklyReport.saved')}</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> {t('common.save')}</>
                )}
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-2">
                  {t('weeklyReport.thisWeekResult')}
                </label>
                <textarea
                  value={draft.thisWeekResult}
                  onChange={(e) => onDraftChange(member.id, 'thisWeekResult', e.target.value)}
                  placeholder={t('weeklyReport.thisWeekResultPlaceholder')}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-primary)] px-3 py-2.5 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)] mb-2">
                  {t('weeklyReport.nextWeekPlanLabel')}
                </label>
                <textarea
                  value={draft.nextWeekPlan}
                  onChange={(e) => onDraftChange(member.id, 'nextWeekPlan', e.target.value)}
                  placeholder={t('weeklyReport.nextWeekPlanPlaceholder')}
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
  deltaUnit = '',
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
  const { t } = useTranslation();
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
          {deltaUnit} vs {t('weeklyReport.prevWeek')}
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
  const { t } = useTranslation();
  return (
    <div className="weekly-report-ribbon">
      <div className="weekly-report-ribbon-indicator" style={{ backgroundColor: color }} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold tracking-[-0.04em] text-[color:var(--text-primary)]">
          {count}<span className="text-xs font-medium text-[color:var(--text-secondary)] ml-0.5">{t('weeklyReport.unitCount')}</span>
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
  const { t } = useTranslation();
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
          <span className="weekly-report-count-badge">{section.tasks.length}{t('weeklyReport.unitCount')}</span>
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
                {t('weeklyReport.noTasks')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="weekly-report-table-header">
                    <th className="px-4 py-2.5 text-left">{t('weeklyReport.taskName')}</th>
                    <th className="px-4 py-2.5 text-center">{t('weeklyReport.assignee')}</th>
                    <th className="px-4 py-2.5 text-center">{t('weeklyReport.status')}</th>
                    <th className="px-4 py-2.5 text-center">{t('weeklyReport.progress')}</th>
                    <th className="px-4 py-2.5 text-center">{t('weeklyReport.delay')}</th>
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

// ── Mini Sparkline (SVG) ────────────────────────────────────

function MiniSparkline({ data }: { data: { weekLabel: string; actualProgress: number; planProgress: number }[] }) {
  const { t } = useTranslation();
  if (data.length < 2) return null;

  const w = 100;
  const h = 100;
  const padding = { top: 10, right: 10, bottom: 25, left: 30 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const maxVal = Math.max(100, ...data.map((d) => Math.max(d.actualProgress, d.planProgress)));

  const toX = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const toY = (val: number) => padding.top + chartH - (val / maxVal) * chartH;

  const planPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.planProgress)}`).join(' ');
  const actualPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.actualProgress)}`).join(' ');

  // Y축 눈금
  const yTicks = [0, 25, 50, 75, 100].filter((v) => v <= maxVal);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {/* 그리드 라인 */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={padding.left} y1={toY(v)} x2={w - padding.right} y2={toY(v)}
            stroke="var(--border-color)" strokeWidth="0.3" strokeDasharray="2,2"
          />
          <text x={padding.left - 2} y={toY(v) + 1} textAnchor="end" fontSize="3.5" fill="var(--text-muted)">
            {v}%
          </text>
        </g>
      ))}

      {/* X축 라벨 */}
      {data.map((d, i) => (
        <text key={i} x={toX(i)} y={h - 5} textAnchor="middle" fontSize="2.8" fill="var(--text-muted)">
          {d.weekLabel.replace(/년\s*/, '.').replace('주차', 'W')}
        </text>
      ))}

      {/* 계획 라인 */}
      <path d={planPath} fill="none" stroke="#A78BFA" strokeWidth="0.8" strokeDasharray="2,1" opacity="0.7" />

      {/* 실적 라인 */}
      <path d={actualPath} fill="none" stroke="#0f766e" strokeWidth="1.2" />

      {/* 실적 점 */}
      {data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.actualProgress)} r="1.5" fill="#0f766e" />
      ))}

      {/* 범례 */}
      <line x1={padding.left} y1={h - 1} x2={padding.left + 6} y2={h - 1} stroke="#A78BFA" strokeWidth="0.8" strokeDasharray="2,1" />
      <text x={padding.left + 8} y={h} fontSize="3" fill="var(--text-muted)">{t('weeklyReport.plan')}</text>
      <line x1={padding.left + 22} y1={h - 1} x2={padding.left + 28} y2={h - 1} stroke="#0f766e" strokeWidth="1.2" />
      <text x={padding.left + 30} y={h} fontSize="3" fill="var(--text-muted)">{t('weeklyReport.actual')}</text>
    </svg>
  );
}

function TaskRow({ task }: { task: WeeklyReportTask }) {
  const { t } = useTranslation();
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
            {t('weeklyReport.delayDays', { days: task.delayDays })}
          </span>
        ) : (
          <span className="text-xs text-[color:var(--text-muted)]">—</span>
        )}
      </td>
    </tr>
  );
}
