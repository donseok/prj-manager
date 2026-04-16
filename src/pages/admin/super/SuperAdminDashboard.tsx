import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, FolderKanban, KeyRound, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useProjectStore } from '../../../store/projectStore';
import { loadAllProfiles } from '../../../lib/supabase';
import { loadPendingAccessRequestCount } from '../../../lib/accessRequests';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '../../../types';

export default function SuperAdminDashboard() {
  const projects = useProjectStore((s) => s.projects);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [pendingUserCount, setPendingUserCount] = useState<number>(0);
  const [pendingRequestCount, setPendingRequestCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    void loadAllProfiles().then((items) => {
      if (cancelled) return;
      setUserCount(items.length);
      setPendingUserCount(items.filter((p) => p.accountStatus === 'pending').length);
    });
    void loadPendingAccessRequestCount().then((n) => {
      if (!cancelled) setPendingRequestCount(n);
    });
    return () => { cancelled = true; };
  }, []);

  const activeProjectCount = projects.filter((p) => p.status !== 'deleted').length;

  const recentProjects = useMemo(
    () => projects.filter((p) => p.status !== 'deleted').slice(0, 5),
    [projects],
  );

  const cards = [
    {
      key: 'users',
      label: '전체 사용자',
      value: userCount ?? '—',
      sub: pendingUserCount > 0 ? `${pendingUserCount}명 승인 대기` : '대기 없음',
      icon: Users,
      to: '/admin/super/users',
      accent: 'text-teal-600 dark:text-teal-400',
    },
    {
      key: 'projects',
      label: '전체 프로젝트',
      value: activeProjectCount,
      sub: '진행 / 준비 / 완료 포함',
      icon: FolderKanban,
      to: '/admin/super/projects',
      accent: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'requests',
      label: '열람 요청',
      value: pendingRequestCount,
      sub: pendingRequestCount > 0 ? '검토 필요' : '대기 없음',
      icon: KeyRound,
      to: '/admin/super/access-requests',
      accent: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="app-panel-dark relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(120,180,255,0.16),transparent_72%)] blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--accent-primary)]" />
            Super Admin Console
          </div>
          <h1 className="mt-6 text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
            슈퍼관리자 콘솔
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90">
            전사 사용자, 전체 프로젝트, 교차 열람 요청을 한 곳에서 관리합니다.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.key}
            to={c.to}
            className="group rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-secondary)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--bg-elevated)] ${c.accent}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-[color:var(--text-muted)] transition-transform group-hover:translate-x-1" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">{c.label}</p>
            <p className="mt-1 text-3xl font-bold text-[color:var(--text-primary)]">{c.value}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[color:var(--text-secondary)]">
              <Clock className="h-3 w-3" />
              {c.sub}
            </p>
          </Link>
        ))}
      </section>

      {/* 프로젝트 목록 미리보기 */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-secondary)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-[color:var(--text-primary)]">프로젝트 현황</h2>
          </div>
          <Link
            to="/admin/super/projects"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent-primary)] hover:underline"
          >
            전체 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[color:var(--text-muted)]">
            <FolderKanban className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">등록된 프로젝트가 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border-color)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-left text-[color:var(--text-secondary)]">
                  <th className="px-4 py-2.5 font-semibold">프로젝트</th>
                  <th className="px-4 py-2.5 font-semibold">상태</th>
                  <th className="px-4 py-2.5 font-semibold">기간</th>
                  <th className="px-4 py-2.5 text-right font-semibold">진입</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[color:var(--bg-elevated)]">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[color:var(--text-primary)]">{p.name}</p>
                      {p.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[color:var(--text-muted)]">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: `${PROJECT_STATUS_COLORS[p.status]}18`,
                          color: PROJECT_STATUS_COLORS[p.status],
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLORS[p.status] }} />
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[color:var(--text-secondary)]">
                      {p.startDate && p.endDate
                        ? `${p.startDate} ~ ${p.endDate}`
                        : p.startDate || p.endDate || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/projects/${p.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--accent-primary)] px-2.5 py-1 text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
                      >
                        이동 <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeProjectCount > 5 && (
              <div className="border-t border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-4 py-2 text-center">
                <Link
                  to="/admin/super/projects"
                  className="text-xs font-medium text-[color:var(--accent-primary)] hover:underline"
                >
                  +{activeProjectCount - 5}개 더 보기
                </Link>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
