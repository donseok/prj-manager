import { useEffect, useState } from 'react';
import { Check, X, KeyRound, ShieldOff, Clock } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import type { ProjectAccessRequest } from '../../../types';
import {
  loadAllAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  revokeAccessRequest,
} from '../../../lib/accessRequests';
import FeedbackNotice from '../../../components/common/FeedbackNotice';
import { usePageFeedback } from '../../../hooks/usePageFeedback';

type Tab = 'pending' | 'approved' | 'all';

const SCOPE_LABEL: Record<ProjectAccessRequest['scope'], string> = {
  read: '열람 (viewer)',
  manage: '관리 (editor)',
};

const STATUS_BADGE: Record<ProjectAccessRequest['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  revoked: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_LABEL: Record<ProjectAccessRequest['status'], string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
  revoked: '회수',
};

export default function SuperAccessRequestsPage() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<ProjectAccessRequest[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();

  useEffect(() => {
    void reload();
  }, []);

  const reload = async () => {
    const list = await loadAllAccessRequests();
    setRequests(list);
  };

  const filtered = requests.filter((r) => {
    if (tab === 'pending') return r.status === 'pending';
    if (tab === 'approved') return r.status === 'approved';
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  const decide = async (
    id: string,
    action: 'approve' | 'reject' | 'revoke',
  ) => {
    if (!user) return;
    setBusyId(id);
    try {
      const ctx = { decidedBy: user.id, decidedByName: user.name };
      let result: ProjectAccessRequest | null = null;
      if (action === 'approve') result = await approveAccessRequest(id, ctx);
      else if (action === 'reject') result = await rejectAccessRequest(id, ctx);
      else result = await revokeAccessRequest(id, ctx);

      if (!result) {
        showFeedback({ tone: 'error', title: '처리 실패', message: '요청을 찾을 수 없거나 상태가 맞지 않습니다.' });
        return;
      }
      await reload();
      const actionLabel = action === 'approve' ? '승인' : action === 'reject' ? '반려' : '회수';
      showFeedback({ tone: 'success', title: `${actionLabel} 완료`, message: `${result.projectName} (${result.requesterName})` });
    } catch (e) {
      showFeedback({ tone: 'error', title: '처리 실패', message: e instanceof Error ? e.message : '알 수 없는 오류' });
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'pending', label: '대기', count: pendingCount },
    { key: 'approved', label: '승인됨', count: approvedCount },
    { key: 'all', label: '전체', count: requests.length },
  ];

  return (
    <section className="app-panel space-y-5 p-6">
      <header>
        <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">열람 요청 승인</h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          프로젝트 관리자가 타 프로젝트를 열람·관리하려는 요청을 검토합니다.
          승인 시 scope에 따라 viewer 또는 editor로 추가되며, 슈퍼관리자가 회수할 수 있습니다.
        </p>
      </header>

      {feedback && <FeedbackNotice tone={feedback.tone} title={feedback.title} message={feedback.message} onClose={clearFeedback} />}

      <div className="flex gap-1 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[color:var(--accent-primary)] text-white'
                : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)]'
            }`}
          >
            {t.label}
            <span className={`text-xs ${tab === t.key ? 'text-white/70' : 'text-[color:var(--text-muted)]'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)]">
          <KeyRound className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">표시할 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-color)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-left text-[color:var(--text-secondary)]">
                <th className="px-4 py-3 font-semibold">요청자</th>
                <th className="px-4 py-3 font-semibold">대상 프로젝트</th>
                <th className="px-4 py-3 font-semibold">범위</th>
                <th className="px-4 py-3 font-semibold">사유</th>
                <th className="px-4 py-3 font-semibold">요청일</th>
                <th className="px-4 py-3 text-center font-semibold">상태</th>
                <th className="px-4 py-3 text-center font-semibold">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[color:var(--bg-elevated)]">
                    <td className="px-4 py-3 font-medium">{r.requesterName}</td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">{r.projectName}</td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">{SCOPE_LABEL[r.scope]}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-[color:var(--text-secondary)]" title={r.reason}>{r.reason || '—'}</td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.requestedAt).toLocaleDateString('ko-KR')}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {r.status === 'pending' && (
                          <>
                            <button
                              onClick={() => void decide(r.id, 'approve')}
                              disabled={busy}
                              className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 transition-all hover:-translate-y-0.5 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400"
                            >
                              <Check className="h-3 w-3" /> 승인
                            </button>
                            <button
                              onClick={() => void decide(r.id, 'reject')}
                              disabled={busy}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition-all hover:-translate-y-0.5 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400"
                            >
                              <X className="h-3 w-3" /> 반려
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button
                            onClick={() => void decide(r.id, 'revoke')}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:-translate-y-0.5 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-400"
                          >
                            <ShieldOff className="h-3 w-3" /> 회수
                          </button>
                        )}
                        {(r.status === 'rejected' || r.status === 'revoked') && (
                          <span className="text-xs text-[color:var(--text-muted)]">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
