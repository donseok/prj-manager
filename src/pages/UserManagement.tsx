import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, Search, Users, UserCheck, UserX, RefreshCw, Clock, Settings, UserCog, Fingerprint, KeyRound, ShieldAlert, Activity, Lock } from 'lucide-react';
import FeedbackNotice from '../components/common/FeedbackNotice';
import { usePageFeedback } from '../hooks/usePageFeedback';
import { loadAllProfiles, updateUserSystemRole, updateAccountStatus } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useSystemSettingsStore } from '../store/systemSettingsStore';
import type { AccountStatus, SystemRole } from '../types';

interface ProfileItem {
  id: string;
  email: string;
  name: string;
  systemRole: SystemRole;
  accountStatus: AccountStatus;
  createdAt: string;
}

type TabFilter = 'all' | AccountStatus;

/* ------------------------------------------------------------------ */
/*  Floating decorative components (hero)                              */
/* ------------------------------------------------------------------ */
function FloatingElement({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-none absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

function FloatingStatBubble({
  value,
  label,
  className = '',
  style = {},
}: {
  value: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`pointer-events-none absolute flex flex-col items-center justify-center rounded-[20px] border border-white/[0.1] bg-white/[0.07] backdrop-blur-md ${className}`}
      style={style}
    >
      <span className="text-2xl font-bold text-white/90">{value}</span>
      {label && <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</span>}
    </div>
  );
}

const STATUS_BADGE: Record<AccountStatus, { label: string; className: string }> = {
  pending: {
    label: '대기',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  active: {
    label: '활성',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  suspended: {
    label: '정지',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

export default function UserManagement() {
  const { user } = useAuthStore();
  const { feedback, showFeedback, clearFeedback } = usePageFeedback();
  const { settings: systemSettings, setSettings: setSystemSettings } = useSystemSettingsStore();
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFilter>('all');
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void loadAllProfiles().then((items) => {
      if (cancelled) return;
      setProfiles(items);

      const hasPending = items.some((p) => p.accountStatus === 'pending');
      if (hasPending) setTab('pending');

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // Counts
  const pendingCount = profiles.filter((p) => p.accountStatus === 'pending').length;
  const activeCount = profiles.filter((p) => p.accountStatus === 'active').length;
  const suspendedCount = profiles.filter((p) => p.accountStatus === 'suspended').length;

  // Filter by search + tab
  const filtered = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === 'all' || p.accountStatus === tab;
    return matchesSearch && matchesTab;
  });

  const handleRoleChange = async (userId: string, newRole: SystemRole) => {
    if (userId === user?.id) return;
    setUpdating(userId);
    const { error } = await updateUserSystemRole(userId, newRole);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, systemRole: newRole } : p))
      );
    } else {
      showFeedback({
        tone: 'error',
        title: '??븷 蹂寃??ㅽ뙣',
        message: error,
      });
    }
    setUpdating(null);
  };

  const handleStatusChange = async (userId: string, newStatus: AccountStatus) => {
    if (userId === user?.id) return;
    setUpdating(userId);
    const { error } = await updateAccountStatus(userId, newStatus);
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, accountStatus: newStatus } : p))
      );
    } else {
      showFeedback({
        tone: 'error',
        title: '怨꾩젙 ?곹깭 蹂寃??ㅽ뙣',
        message: error,
      });
    }
    setUpdating(null);
  };

  const handlePolicyChange = async (policy: 'all' | 'admin_only') => {
    if (savingPolicy || systemSettings.projectCreationPolicy === policy) return;
    setSavingPolicy(true);
    try {
      await setSystemSettings({ ...systemSettings, projectCreationPolicy: policy });
      showFeedback({
        tone: 'success',
        title: '정책 변경 완료',
        message: policy === 'all' ? '모든 사용자가 프로젝트를 생성할 수 있습니다.' : '관리자만 프로젝트를 생성할 수 있습니다.',
      });
    } catch {
      showFeedback({ tone: 'error', title: '정책 변경 실패', message: '프로젝트 생성 정책을 변경하지 못했습니다.' });
    } finally {
      setSavingPolicy(false);
    }
  };

  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: 'all', label: '전체', count: profiles.length },
    { key: 'pending', label: '승인 대기', count: pendingCount },
    { key: 'active', label: '활성', count: activeCount },
    { key: 'suspended', label: '정지', count: suspendedCount },
  ];

  return (
    <div className="space-y-8">
      {/* ── Hero Section ── */}
      <section className="app-panel-dark relative min-h-[320px] overflow-hidden p-6 md:p-8 lg:min-h-[360px]">
        {/* Glow backgrounds */}
        <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(120,180,255,0.16),transparent_72%)] blur-3xl" />
        <div className="pointer-events-none absolute right-[25%] top-[20%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.14),transparent_70%)] blur-3xl" />

        {/* ---- Floating decorative elements (right side) — 사용자 관리 테마 ---- */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          {/* Stat bubbles */}
          <FloatingStatBubble
            value={String(profiles.length)}
            label="사용자"
            className="hero-float-1 h-[76px] w-[76px]"
            style={{ top: '8%', right: '11%' }}
          />
          <FloatingStatBubble
            value={String(pendingCount)}
            label="대기"
            className="hero-float-3 h-[68px] w-[68px]"
            style={{ top: '40%', right: '5%' }}
          />
          <FloatingStatBubble
            value="✓"
            className="hero-float-2 h-[60px] w-[60px]"
            style={{ top: '20%', right: '26%' }}
          />

          {/* Role summary card */}
          <div
            className="hero-float-2 pointer-events-none absolute rounded-2xl border border-white/[0.12] bg-white/[0.08] backdrop-blur-md"
            style={{ top: '65%', right: '6%', width: '140px', padding: '10px 12px' }}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3 text-teal-400/60" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">역할 관리</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-1 w-full rounded-full bg-white/15" />
              <div className="h-1 w-[85%] rounded-full bg-white/10" />
              <div className="h-1 w-[70%] rounded-full bg-white/8" />
            </div>
          </div>

          {/* Icon elements */}
          <FloatingElement className="hero-float-4 h-11 w-11" style={{ top: '5%', right: '22%' }}>
            <UserCog className="h-5 w-5 text-teal-400/50" />
          </FloatingElement>
          <FloatingElement className="hero-float-2 h-10 w-10" style={{ top: '54%', right: '12%' }}>
            <Fingerprint className="h-4.5 w-4.5 text-teal-300/50" />
          </FloatingElement>
          <FloatingElement className="hero-float-1 h-10 w-10" style={{ top: '60%', right: '24%' }}>
            <KeyRound className="h-4.5 w-4.5 text-amber-400/45" />
          </FloatingElement>
          <FloatingElement className="hero-float-3 h-9 w-9" style={{ top: '30%', right: '3%' }}>
            <ShieldAlert className="h-4 w-4 text-orange-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-4 h-10 w-10" style={{ top: '48%', right: '30%' }}>
            <Shield className="h-4.5 w-4.5 text-teal-300/45" />
          </FloatingElement>
          <FloatingElement className="hero-float-1 h-9 w-9" style={{ top: '78%', right: '18%' }}>
            <Activity className="h-4 w-4 text-white/30" />
          </FloatingElement>
          <FloatingElement className="hero-float-2 h-11 w-11" style={{ top: '12%', right: '38%' }}>
            <Users className="h-5 w-5 text-amber-400/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-3 h-9 w-9" style={{ top: '72%', right: '34%' }}>
            <Lock className="h-4 w-4 text-teal-300/40" />
          </FloatingElement>
          <FloatingElement className="hero-float-4 h-10 w-10" style={{ top: '82%', right: '4%' }}>
            <Search className="h-4.5 w-4.5 text-white/30" />
          </FloatingElement>

          {/* Decorative connecting gradient lines */}
          <div
            className="absolute h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent hero-float-2"
            style={{ top: '26%', right: '15%', transform: 'rotate(-20deg)' }}
          />
          <div
            className="absolute h-px w-20 bg-gradient-to-r from-transparent via-teal-400/10 to-transparent hero-float-3"
            style={{ top: '50%', right: '18%', transform: 'rotate(15deg)' }}
          />
          <div
            className="absolute h-px w-14 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent hero-float-1"
            style={{ top: '68%', right: '28%', transform: 'rotate(-10deg)' }}
          />

          {/* Decorative dots */}
          <div className="absolute h-1.5 w-1.5 rounded-full bg-white/20 hero-float-1" style={{ top: '44%', right: '14%' }} />
          <div className="absolute h-1 w-1 rounded-full bg-teal-400/30 hero-float-4" style={{ top: '35%', right: '20%' }} />
          <div className="absolute h-1 w-1 rounded-full bg-amber-400/30 hero-float-2" style={{ top: '58%', right: '8%' }} />
          <div className="absolute h-1.5 w-1.5 rounded-full bg-orange-400/25 hero-float-3" style={{ top: '16%', right: '6%' }} />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="surface-badge border-white/12 bg-white/[0.14] text-white/90">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--accent-primary)]" />
            Admin Console
          </div>
          <h1 className="mt-6 text-[clamp(2rem,4vw,3.8rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
            DK Flow<br />사용자 관리
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 md:text-lg">
            시스템에 등록된 사용자의 역할과 권한을 관리합니다. 가입 승인, 역할 변경, 계정 상태를 한 곳에서 제어하세요.
          </p>
        </div>
      </section>

    <section className="app-panel p-6">
      {feedback && (
        <FeedbackNotice
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={clearFeedback}
        />
      )}

      {/* Search */}
      <div className="mb-6 flex items-center justify-end">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2">
          <Search className="h-4 w-4 text-[color:var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
            className="w-48 bg-transparent text-sm outline-none placeholder:text-[color:var(--text-secondary)]"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-[color:var(--text-secondary)]">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">전체 사용자</span>
          </div>
          <p className="mt-1 text-xl font-bold">{profiles.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">승인 대기</span>
          </div>
          <p className="mt-1 text-xl font-bold">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <UserCheck className="h-4 w-4" />
            <span className="text-xs font-medium">활성</span>
          </div>
          <p className="mt-1 text-xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <UserX className="h-4 w-4" />
            <span className="text-xs font-medium">정지</span>
          </div>
          <p className="mt-1 text-xl font-bold">{suspendedCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-[color:var(--accent-primary)] text-white shadow-sm'
                : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-secondary)] hover:text-[color:var(--text-primary)]'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && tab !== 'pending' && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
            {t.key !== 'pending' && t.count !== undefined && (
              <span className={`text-xs ${tab === t.key ? 'text-white/70' : 'text-[color:var(--text-muted)]'}`}>
                {t.count}
              </span>
            )}
            {t.key === 'pending' && (tab === 'pending' || pendingCount === 0) && (
              <span className={`text-xs ${tab === t.key ? 'text-white/70' : 'text-[color:var(--text-muted)]'}`}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[color:var(--text-muted)]">
          <Users className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">
            {search ? '검색 결과가 없습니다.' : tab !== 'all' ? '해당 상태의 사용자가 없습니다.' : '등록된 사용자가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-color)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[color:var(--bg-elevated)]">
                <th className="px-4 py-3 text-left font-semibold text-[color:var(--text-secondary)]">이름</th>
                <th className="px-4 py-3 text-left font-semibold text-[color:var(--text-secondary)]">이메일</th>
                <th className="px-4 py-3 text-left font-semibold text-[color:var(--text-secondary)]">가입일</th>
                <th className="px-4 py-3 text-center font-semibold text-[color:var(--text-secondary)]">상태</th>
                <th className="px-4 py-3 text-center font-semibold text-[color:var(--text-secondary)]">역할</th>
                <th className="px-4 py-3 text-center font-semibold text-[color:var(--text-secondary)]">계정 관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => {
                const badge = STATUS_BADGE[profile.accountStatus];
                const isSelf = profile.id === user?.id;
                const isUpdatingThis = updating === profile.id;

                return (
                  <tr
                    key={profile.id}
                    className="border-b border-[var(--border-color)] last:border-b-0 transition-colors hover:bg-[color:var(--bg-elevated)]"
                  >
                    {/* Name */}
                    <td className="px-4 py-3 font-medium">
                      {profile.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-[color:var(--text-secondary)]">(나)</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">{profile.email}</td>

                    {/* Created at */}
                    <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                      {new Date(profile.createdAt).toLocaleDateString('ko-KR')}
                    </td>

                    {/* Account status badge */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
                          {profile.accountStatus === 'pending' && <Clock className="h-3 w-3" />}
                          {profile.accountStatus === 'active' && <UserCheck className="h-3 w-3" />}
                          {profile.accountStatus === 'suspended' && <UserX className="h-3 w-3" />}
                          {badge.label}
                        </span>
                      </div>
                    </td>

                    {/* System role toggle */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            관리자
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              void handleRoleChange(
                                profile.id,
                                profile.systemRole === 'admin' ? 'user' : 'admin'
                              )
                            }
                            disabled={isUpdatingThis}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
                              profile.systemRole === 'admin'
                                ? 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800/40 dark:text-gray-400'
                            }`}
                          >
                            {isUpdatingThis ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-current/30 border-t-current" />
                            ) : profile.systemRole === 'admin' ? (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            ) : (
                              <Shield className="h-3.5 w-3.5" />
                            )}
                            {profile.systemRole === 'admin' ? '관리자' : '일반 사용자'}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Account status actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {isSelf ? (
                          <span className="text-xs text-[color:var(--text-muted)]">-</span>
                        ) : profile.accountStatus === 'pending' ? (
                          <>
                            <button
                              onClick={() => void handleStatusChange(profile.id, 'active')}
                              disabled={isUpdatingThis}
                              className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 transition-all hover:-translate-y-0.5 hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                            >
                              {isUpdatingThis ? (
                                <div className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />
                              ) : (
                                <UserCheck className="h-3 w-3" />
                              )}
                              승인
                            </button>
                            <button
                              onClick={() => void handleStatusChange(profile.id, 'suspended')}
                              disabled={isUpdatingThis}
                              className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition-all hover:-translate-y-0.5 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            >
                              {isUpdatingThis ? (
                                <div className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />
                              ) : (
                                <UserX className="h-3 w-3" />
                              )}
                              거부
                            </button>
                          </>
                        ) : profile.accountStatus === 'active' ? (
                          <button
                            onClick={() => void handleStatusChange(profile.id, 'suspended')}
                            disabled={isUpdatingThis}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition-all hover:-translate-y-0.5 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                          >
                            {isUpdatingThis ? (
                              <div className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />
                            ) : (
                              <UserX className="h-3 w-3" />
                            )}
                            정지
                          </button>
                        ) : (
                          <button
                            onClick={() => void handleStatusChange(profile.id, 'active')}
                            disabled={isUpdatingThis}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all hover:-translate-y-0.5 hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                          >
                            {isUpdatingThis ? (
                              <div className="h-3 w-3 animate-spin rounded-full border border-current/30 border-t-current" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            복구
                          </button>
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

      {/* Project creation policy */}
      <div className="mt-8 rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">프로젝트 생성 권한</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">누가 새 프로젝트를 만들 수 있는지 제어합니다.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { key: 'all' as const, title: '모든 사용자', desc: '로그인한 모든 활성 사용자가 프로젝트를 생성할 수 있습니다.' },
            { key: 'admin_only' as const, title: '관리자만', desc: '시스템 관리자만 프로젝트를 생성할 수 있습니다.' },
          ]).map((option) => {
            const isSelected = systemSettings.projectCreationPolicy === option.key;
            return (
              <button
                key={option.key}
                onClick={() => void handlePolicyChange(option.key)}
                disabled={isSelected || savingPolicy}
                className={`rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-[color:var(--accent-primary)] bg-[rgba(15,118,110,0.06)]'
                    : 'border-[var(--border-color)] hover:bg-[color:var(--bg-tertiary)]'
                } disabled:cursor-default`}
              >
                <p className="font-medium text-[color:var(--text-primary)]">
                  {option.title}
                  {isSelected && (
                    <span className="ml-2 text-xs font-semibold text-[color:var(--accent-primary)]">현재 정책</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{option.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
    </div>
  );
}
