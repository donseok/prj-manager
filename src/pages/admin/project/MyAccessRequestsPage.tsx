import { useEffect, useState } from 'react';
import { KeyRound, Clock } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import type { ProjectAccessRequest } from '../../../types';
import { loadAccessRequestsForRequester } from '../../../lib/accessRequests';

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

const SCOPE_LABEL: Record<ProjectAccessRequest['scope'], string> = {
  read: '열람',
  manage: '관리',
};

export default function MyAccessRequestsPage() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<ProjectAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void loadAccessRequestsForRequester(user.id).then((list) => {
      if (!cancelled) {
        setRequests(list);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <section className="app-panel space-y-5 p-6">
      <header>
        <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">내 열람 요청 현황</h2>
        <p className="text-sm text-[color:var(--text-secondary)]">
          내가 제출한 타 프로젝트 열람 요청의 처리 상태를 확인합니다.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[color:var(--text-muted)]">
          <KeyRound className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">제출한 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-color)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-left text-[color:var(--text-secondary)]">
                <th className="px-4 py-3 font-semibold">대상 프로젝트</th>
                <th className="px-4 py-3 font-semibold">범위</th>
                <th className="px-4 py-3 font-semibold">사유</th>
                <th className="px-4 py-3 font-semibold">요청일</th>
                <th className="px-4 py-3 text-center font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[color:var(--bg-elevated)]">
                  <td className="px-4 py-3 font-medium">{r.projectName}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
