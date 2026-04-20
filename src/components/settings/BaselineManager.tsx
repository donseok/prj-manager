import { useEffect, useMemo, useState } from 'react';
import { Flag, Milestone, Trash2, CheckCircle2, Plus, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  buildBaselineFromCurrent,
  deleteBaseline,
  loadBaselines,
  saveBaseline,
  setActiveBaseline,
} from '../../lib/baselineRepository';
import type { Project, ProjectBaseline, Task } from '../../types';
import Button from '../common/Button';
import ConfirmModal from '../common/ConfirmModal';
import { cn } from '../../lib/utils';

interface BaselineManagerProps {
  project: Project;
  tasks: Task[];
  currentUserId: string;
  currentUserName?: string;
  canEdit: boolean;
  onFeedback?: (tone: 'success' | 'error' | 'info', title: string, message: string) => void;
}

export default function BaselineManager({
  project,
  tasks,
  currentUserId,
  currentUserName,
  canEdit,
  onFeedback,
}: BaselineManagerProps) {
  const [baselines, setBaselines] = useState<ProjectBaseline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [captureName, setCaptureName] = useState('');
  const [captureNote, setCaptureNote] = useState('');
  const [markActive, setMarkActive] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ProjectBaseline | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void loadBaselines(project.id).then((list) => {
      if (!cancelled) {
        setBaselines(list);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const activeBaseline = useMemo(() => baselines.find((b) => b.isActive), [baselines]);

  const defaultName = useMemo(() => {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()} Q${q} 기준선`;
  }, []);

  const resolvedName = captureName.trim() || defaultName;

  const handleCapture = async () => {
    if (!canEdit) return;
    setIsCapturing(true);
    try {
      const baseline = buildBaselineFromCurrent({
        project,
        tasks,
        name: resolvedName,
        note: captureNote.trim() || undefined,
        capturedBy: currentUserId,
        capturedByName: currentUserName,
        isActive: markActive,
      });
      await saveBaseline(baseline);
      const next = await loadBaselines(project.id);
      setBaselines(next);
      setCaptureName('');
      setCaptureNote('');
      setMarkActive(true);
      setShowCaptureForm(false);
      onFeedback?.(
        'success',
        '기준선 캡처 완료',
        `${baseline.taskSnapshots.length}개 작업의 계획 스냅샷이 저장되었습니다.`,
      );
    } catch (err) {
      console.error('Failed to capture baseline:', err);
      onFeedback?.(
        'error',
        '기준선 캡처 실패',
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const handleActivate = async (baseline: ProjectBaseline) => {
    if (!canEdit) return;
    try {
      await setActiveBaseline(project.id, baseline.id);
      const next = await loadBaselines(project.id);
      setBaselines(next);
      onFeedback?.('success', '활성 기준선 변경', `"${baseline.name}" 을(를) 활성 기준선으로 지정했습니다.`);
    } catch (err) {
      console.error('Failed to activate baseline:', err);
      onFeedback?.('error', '활성화 실패', err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || !canEdit) return;
    try {
      await deleteBaseline(project.id, pendingDelete.id);
      const next = await loadBaselines(project.id);
      setBaselines(next);
      onFeedback?.('success', '기준선 삭제', `"${pendingDelete.name}" 이(가) 삭제되었습니다.`);
    } catch (err) {
      console.error('Failed to delete baseline:', err);
      onFeedback?.('error', '삭제 실패', err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="app-panel p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#0f766e,#2fa67c)] text-white shadow-[0_18px_36px_-22px_rgba(15,118,110,0.7)]">
          <Milestone className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
            기준선 관리
          </h2>
          <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
            현재 계획을 스냅샷으로 저장하고, 이후 실적과 비교할 수 있는 기준선으로 활용합니다.
          </p>
        </div>
        {canEdit && !showCaptureForm && (
          <Button size="sm" onClick={() => setShowCaptureForm(true)}>
            <Plus className="h-4 w-4" />
            새 기준선 캡처
          </Button>
        )}
      </div>

      {showCaptureForm && canEdit && (
        <div className="mt-5 rounded-[20px] border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div>
                <label className="field-label">기준선 이름</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder={defaultName}
                  value={captureName}
                  onChange={(e) => setCaptureName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div>
                <label className="field-label">메모 (선택)</label>
                <textarea
                  className="field-textarea"
                  rows={2}
                  placeholder="예: 킥오프 직후 확정 계획"
                  value={captureNote}
                  onChange={(e) => setCaptureNote(e.target.value)}
                  maxLength={400}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={markActive}
                  onChange={(e) => setMarkActive(e.target.checked)}
                />
                캡처 즉시 활성 기준선으로 지정
              </label>
            </div>
            <button
              type="button"
              onClick={() => setShowCaptureForm(false)}
              className="rounded-full p-1.5 text-[color:var(--text-muted)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => void handleCapture()} isLoading={isCapturing} disabled={isCapturing}>
              <Flag className="h-4 w-4" />
              저장
            </Button>
            <span className="text-xs text-[color:var(--text-muted)]">
              {tasks.length}개 작업의 계획 정보(시작/종료/공정율)가 스냅샷으로 저장됩니다.
            </span>
          </div>
        </div>
      )}

      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-[color:var(--text-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            기준선을 불러오는 중...
          </div>
        ) : baselines.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-8 text-center text-sm text-[color:var(--text-secondary)]">
            저장된 기준선이 없습니다. 계획이 확정되면 "새 기준선 캡처"로 스냅샷을 남겨보세요.
          </div>
        ) : (
          <ul className="space-y-3">
            {baselines.map((b) => {
              const isActive = !!b.isActive;
              return (
                <li
                  key={b.id}
                  className={cn(
                    'rounded-[20px] border p-4 transition-colors',
                    isActive
                      ? 'border-[rgba(15,118,110,0.4)] bg-[rgba(15,118,110,0.08)]'
                      : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)]',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-[color:var(--text-primary)]" title={b.name}>
                          {b.name}
                        </p>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent-primary)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            <CheckCircle2 className="h-3 w-3" />
                            활성
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        캡처일 {format(new Date(b.capturedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                        {' · '}
                        캡처자 {b.capturedByName || b.capturedBy}
                        {' · '}
                        {b.taskSnapshots.length}개 작업
                      </p>
                      {b.note && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--text-secondary)]">
                          {b.note}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-2">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => void handleActivate(b)}
                            className="rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-tertiary)]"
                          >
                            활성화
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingDelete(b)}
                          className="rounded-full border border-[rgba(203,75,95,0.2)] bg-[rgba(203,75,95,0.06)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.12)]"
                        >
                          <Trash2 className="mr-1 inline h-3 w-3" />
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {activeBaseline && (
        <p className="mt-4 text-xs text-[color:var(--text-muted)]">
          대시보드 S-커브와 "기준선 대비 편차" 카드가 활성 기준선 기준으로 표시됩니다.
        </p>
      )}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
        title="기준선 삭제"
        description={`"${pendingDelete?.name ?? ''}" 기준선을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        confirmVariant="danger"
      />
    </div>
  );
}
