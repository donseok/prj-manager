import { useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import type { Project, AccessRequestScope } from '../../../types';
import { useAuthStore } from '../../../store/authStore';
import { createAccessRequest } from '../../../lib/accessRequests';

interface Props {
  project: Project;
  onClose: () => void;
}

export default function AccessRequestModal({ project, onClose }: Props) {
  const { user } = useAuthStore();
  const [scope, setScope] = useState<AccessRequestScope>('read');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      await createAccessRequest({
        requesterId: user.id,
        requesterName: user.name,
        projectId: project.id,
        projectName: project.name,
        scope,
        reason: reason.trim(),
      });
      setResult('success');
    } catch (e) {
      setResult('error');
      setErrorMsg(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-secondary)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[color:var(--accent-primary)]" />
            <h3 className="text-base font-semibold text-[color:var(--text-primary)]">열람 요청</h3>
          </div>
          <button onClick={onClose} className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {result === 'success' ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
              요청이 제출되었습니다. 슈퍼관리자가 검토 후 승인/반려합니다.
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">대상 프로젝트</p>
                <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">{project.name}</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">요청 범위</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => setScope('read')}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      scope === 'read'
                        ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.08)]'
                        : 'border-[var(--border-color)] hover:bg-[color:var(--bg-elevated)]'
                    }`}
                  >
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">열람 (viewer)</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">읽기 전용으로 조회</p>
                  </button>
                  <button
                    onClick={() => setScope('manage')}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      scope === 'manage'
                        ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.08)]'
                        : 'border-[var(--border-color)] hover:bg-[color:var(--bg-elevated)]'
                    }`}
                  >
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">관리 (editor)</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">작업 편집 가능</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">사유 (선택)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="예: 의존 관계 파악을 위해 참조 필요"
                  className="mt-1 w-full rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
                />
              </div>

              {result === 'error' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border-color)] bg-[color:var(--bg-secondary)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-tertiary)]"
          >
            {result === 'success' ? '닫기' : '취소'}
          </button>
          {result !== 'success' && (
            <button
              onClick={() => void submit()}
              disabled={submitting}
              className="rounded-lg bg-[color:var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              {submitting ? '제출 중...' : '요청 제출'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
