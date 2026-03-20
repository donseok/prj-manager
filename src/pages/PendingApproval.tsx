import { useEffect, useState } from 'react';
import { Clock, LogOut, Sun, Moon, RefreshCw } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { signOutSupabase, ensureSupabaseSession } from '../lib/supabase';
import DKFlowLogo from '../components/common/DKFlowLogo';

export default function PendingApproval() {
  const { user, isAuthenticated, isPending, isSuspended, logout, setUser } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [checking, setChecking] = useState(false);

  // 10초마다 승인 상태 자동 확인
  useEffect(() => {
    if (!isAuthenticated || isSuspended) return;

    const checkStatus = async () => {
      const freshUser = await ensureSupabaseSession();
      if (freshUser && freshUser.accountStatus === 'active') {
        setUser(freshUser);
      }
    };

    const interval = setInterval(() => void checkStatus(), 10_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isSuspended, setUser]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isPending && !isSuspended) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    logout();
    void signOutSupabase();
  };

  const handleManualCheck = async () => {
    setChecking(true);
    const freshUser = await ensureSupabaseSession();
    if (freshUser && freshUser.accountStatus === 'active') {
      setUser(freshUser);
    }
    setChecking(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center text-[color:var(--text-primary)]">
      {/* 배경 효과 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-10rem] top-[2rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(203,109,55,0.18),transparent_72%)] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(18,61,100,0.12),transparent_72%)] blur-3xl" />
      </div>

      {/* 테마 토글 버튼 */}
      <button
        onClick={toggleTheme}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-secondary-solid)] hover:text-[color:var(--text-primary)]"
        title={isDark ? '라이트 모드' : '다크 모드'}
      >
        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>

      {/* 메인 카드 */}
      <div className="app-panel relative mx-4 w-full max-w-md rounded-[28px] p-8 sm:p-10 text-center">
        {/* 로고 */}
        <div className="mx-auto mb-6 w-fit rounded-2xl shadow-[0_24px_45px_-26px_rgba(15,118,110,0.82)]">
          <DKFlowLogo size={56} />
        </div>

        {/* 아이콘 */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>

        {/* 제목 */}
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">
          {isSuspended ? '계정이 정지되었습니다' : '계정 승인 대기 중'}
        </h1>

        {/* 메시지 */}
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
          {isSuspended
            ? '계정이 관리자에 의해 정지되었습니다. 관리자에게 문의해주세요.'
            : '관리자의 승인을 기다리고 있습니다. 승인이 완료되면 자동으로 이동합니다.'}
        </p>

        {/* 사용자 정보 배지 */}
        {user && (
          <div className="surface-badge mx-auto mt-5">
            {user.email}
          </div>
        )}

        {/* 버튼 그룹 */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {!isSuspended && (
            <button
              onClick={() => void handleManualCheck()}
              disabled={checking}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(15,118,110,0.8)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? '확인 중...' : '승인 상태 확인'}
            </button>
          )}
          <button
            onClick={() => void handleLogout()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-6 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-secondary-solid)] hover:text-[color:var(--text-primary)]"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>

        {!isSuspended && (
          <p className="mt-5 text-xs text-[color:var(--text-muted)]">
            10초마다 자동으로 승인 여부를 확인합니다
          </p>
        )}

        <p className="mt-6 text-xs text-[color:var(--text-muted)]">
          &copy; {new Date().getFullYear()} 동국시스템즈. All rights reserved.
        </p>
      </div>
    </div>
  );
}
