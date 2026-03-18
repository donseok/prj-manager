import { Link } from 'react-router-dom';
import { User, LogOut, Settings, Moon, Sun, ChevronRight, Sparkles, CalendarDays } from 'lucide-react';
import DKFlowLogo from '../common/DKFlowLogo';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { useThemeStore } from '../../store/themeStore';
import { useState } from 'react';
import { signOutSupabase } from '../../lib/supabase';

export default function Header() {
  const { user, logout } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const settingsLink = currentProject ? `/projects/${currentProject.id}/settings` : '/projects';
  const todayLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
  const handleLogout = async () => {
    await signOutSupabase();
    logout();
    setShowUserMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 lg:px-6">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 rounded-[28px] border border-white/20 bg-[rgba(255,250,244,0.56)] px-4 py-3 shadow-[0_28px_72px_-40px_rgba(17,24,39,0.42)] backdrop-blur-2xl dark:border-[var(--border-color)] dark:bg-[rgba(15,18,23,0.6)] sm:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.02] shadow-[0_24px_45px_-26px_rgba(15,118,110,0.82)] rounded-2xl">
              <DKFlowLogo size={44} />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-lg font-bold tracking-[-0.02em] text-[color:var(--text-primary)]">
                DK Flow
              </span>
              <p className="text-[11px] font-medium tracking-[0.08em] text-[color:var(--text-muted)]">업무의 흐름을 설계하다</p>
            </div>
          </Link>

          {currentProject && (
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)]" />
              <div className="surface-badge max-w-[24rem]">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-primary)]" />
                <span className="truncate">{currentProject.name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[var(--border-color)] bg-white/40 px-3 py-2 text-sm text-[color:var(--text-secondary)] backdrop-blur-xl dark:bg-white/5 md:flex">
            <CalendarDays className="h-4 w-4 text-[color:var(--accent-secondary)]" />
            <span>{todayLabel}</span>
          </div>

          <button
            onClick={toggleTheme}
            className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-color)] bg-white/45 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10"
            title={isDark ? '라이트 모드' : '다크 모드'}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-300 transition-all duration-300 group-hover:rotate-45 group-hover:text-amber-200" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700 transition-all duration-300 group-hover:-rotate-12 group-hover:text-slate-900" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="group flex items-center gap-3 rounded-full border border-[var(--border-color)] bg-white/45 px-3 py-2 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/82 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] shadow-[0_18px_40px_-24px_rgba(15,118,110,0.8)] transition-all group-hover:scale-[1.03]">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Operator</p>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{user?.name || '사용자'}</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[image:var(--gradient-surface)] p-2 shadow-[0_32px_80px_-42px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in dark:bg-[image:var(--gradient-dark)]">
                <div className="rounded-[20px] border border-white/10 bg-[image:var(--gradient-primary)] p-4 text-white shadow-[0_24px_52px_-28px_rgba(15,118,110,0.82)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">로그인 계정</p>
                  <p className="mt-2 text-base font-semibold tracking-[-0.03em]">{user?.name || '사용자'}</p>
                  <p className="mt-1 truncate text-sm text-white/72">{user?.email || 'user@example.com'}</p>
                </div>
                <Link
                  to={settingsLink}
                  className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-black/5 dark:hover:bg-white/6"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  설정
                </Link>
                <button
                  onClick={() => {
                    void handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--accent-danger)] transition-colors hover:bg-[rgba(203,75,95,0.08)]"
                >
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
