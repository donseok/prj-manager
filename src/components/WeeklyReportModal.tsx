/**
 * WeeklyReportModal.tsx
 * 주간보고 미리보기 및 내보내기 모달
 */

import { useState, useMemo } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Save,
} from 'lucide-react';
import Modal from './common/Modal';
import Button from './common/Button';
import { cn } from '../lib/utils';
import {
  generateWeeklyReport,
  type WeeklyReportSection,
} from '../lib/weeklyReport';
import { exportWeeklyReportExcel } from '../lib/exportWeeklyReport';
import {
  saveSnapshot,
  getSnapshots,
  compareSnapshots,
  getSnapshotByWeek,
} from '../lib/weeklySnapshot';
import { addWeeks, startOfWeek, format } from 'date-fns';
import type { Task, ProjectMember } from '../types';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  tasks: Task[];
  members: ProjectMember[];
}

export default function WeeklyReportModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  tasks,
  members,
}: WeeklyReportModalProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const baseDate = useMemo(() => {
    return addWeeks(new Date(), weekOffset);
  }, [weekOffset]);

  const report = useMemo(() => {
    return generateWeeklyReport({ projectName, tasks, members, baseDate });
  }, [projectName, tasks, members, baseDate]);

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

  const snapshots = useMemo(() => getSnapshots(projectId), [projectId]);

  const handleExport = () => {
    exportWeeklyReportExcel(report);
  };

  const handleSaveSnapshot = () => {
    saveSnapshot(projectId, report);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="주간보고" size="xl">
      <div className="p-6">
        {/* 주차 네비게이션 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[200px] text-center text-sm font-semibold text-[color:var(--text-primary)]">
              {report.weekLabel}
            </span>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-tertiary)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="ml-1 text-xs text-[color:var(--accent-primary)] hover:underline"
              >
                이번 주로
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveSnapshot}>
              <Save className="h-4 w-4" />
              스냅샷 저장
            </Button>
            <Button size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              엑셀 내보내기
            </Button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard
            label="전체 작업"
            value={`${report.summary.totalLeafTasks}건`}
            icon={<Clock className="h-4 w-4" />}
            accent="primary"
          />
          <SummaryCard
            label="완료"
            value={`${report.summary.completedTasks}건`}
            delta={comparison.completedDelta}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="success"
          />
          <SummaryCard
            label="실적 공정율"
            value={`${Math.round(report.summary.overallActualProgress)}%`}
            delta={comparison.progressDelta}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="primary"
            deltaUnit="%p"
          />
          <SummaryCard
            label="지연"
            value={`${report.summary.delayedTasks}건`}
            delta={comparison.delayedDelta}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="danger"
            inverseDelta
          />
        </div>

        {/* 이슈/리스크 */}
        {report.issues.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[rgba(203,109,55,0.22)] bg-[rgba(203,109,55,0.06)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-warning)]">
              이슈 / 리스크
            </p>
            <ul className="mt-2 space-y-1">
              {report.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--text-primary)]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[color:var(--accent-warning)]" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 섹션들 */}
        <div className="space-y-4">
          <ReportSection section={report.thisWeekActual} accentColor="var(--accent-primary)" />
          <ReportSection section={report.completedThisWeek} accentColor="var(--accent-success)" />
          <ReportSection section={report.nextWeekPlan} accentColor="#6366f1" />
          <ReportSection section={report.delayed} accentColor="var(--accent-danger)" />
        </div>

        {/* 스냅샷 히스토리 */}
        {snapshots.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              저장된 스냅샷
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {snapshots.map((snap) => (
                <span
                  key={snap.id}
                  className="surface-badge text-xs"
                >
                  {snap.weekLabel}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Sub Components ───────────────────────────────────────────

function SummaryCard({
  label,
  value,
  delta,
  icon,
  accent,
  deltaUnit = '건',
  inverseDelta = false,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: React.ReactNode;
  accent: 'primary' | 'success' | 'danger';
  deltaUnit?: string;
  inverseDelta?: boolean;
}) {
  const accentVar = {
    primary: 'var(--accent-primary)',
    success: 'var(--accent-success)',
    danger: 'var(--accent-danger)',
  }[accent];

  const hasDelta = delta !== undefined && delta !== 0;
  const isPositive = inverseDelta ? (delta ?? 0) < 0 : (delta ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
      <div className="flex items-center gap-2 text-[color:var(--text-secondary)]">
        <span style={{ color: accentVar }}>{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
        {value}
      </p>
      {hasDelta && (
        <div className={cn(
          'mt-1 flex items-center gap-1 text-xs font-medium',
          isPositive ? 'text-[color:var(--accent-success)]' : 'text-[color:var(--accent-danger)]'
        )}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta! > 0 ? '+' : ''}{delta}{deltaUnit} vs 전주
        </div>
      )}
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
    <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[color:var(--bg-tertiary)]"
      >
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
            {section.title}
          </span>
          <span className="surface-badge text-xs">{section.tasks.length}건</span>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-[color:var(--text-secondary)] transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--border-color)]">
          {section.tasks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[color:var(--text-muted)]">해당 작업 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[color:var(--bg-tertiary)]">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                      작업명
                    </th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                      담당자
                    </th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                      상태
                    </th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                      실적
                    </th>
                    <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                      지연
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section.tasks.map((task) => (
                    <tr key={task.id} className="border-t border-[var(--border-color)] hover:bg-[color:var(--bg-tertiary)]">
                      <td className="px-3 py-2">
                        <div>
                          <p className="font-medium text-[color:var(--text-primary)]">{task.name}</p>
                          {task.parentName && (
                            <p className="text-xs text-[color:var(--text-muted)]">{task.parentName}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-[color:var(--text-secondary)]">
                        {task.assigneeName}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                            task.status === 'completed' && 'bg-[rgba(31,163,122,0.12)] text-[color:var(--accent-success)]',
                            task.status === 'in_progress' && 'bg-[rgba(15,118,110,0.1)] text-[color:var(--accent-primary)]',
                            task.status === 'pending' && 'bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]',
                            task.status === 'on_hold' && 'bg-[rgba(203,109,55,0.12)] text-[color:var(--accent-warning)]',
                          )}
                        >
                          {task.statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[rgba(15,118,110,0.08)]">
                            <div
                              className="h-full rounded-full bg-[image:linear-gradient(135deg,#1fa37a,#34c997)]"
                              style={{ width: `${task.actualProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-[color:var(--text-secondary)]">{task.actualProgress}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {task.delayDays > 0 ? (
                          <span className="text-xs font-semibold text-[color:var(--accent-danger)]">
                            {task.delayDays}일
                          </span>
                        ) : (
                          <span className="text-xs text-[color:var(--text-muted)]">-</span>
                        )}
                      </td>
                    </tr>
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
