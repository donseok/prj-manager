import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot,
  CalendarDays,
  ChevronRight,
  Hand,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DKFlowLogo from '../common/DKFlowLogo';
import NotificationBell from './NotificationBell';
import LanguageSelector from '../common/LanguageSelector';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { useThemeStore } from '../../store/themeStore';
import { useUIStore } from '../../store/uiStore';
import { isAIConfigured } from '../../lib/ai';
import { loadPendingCount, signOutSupabase } from '../../lib/supabase';

export default function Header() {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, logout } = useAuthStore();
  const { currentProject } = useProjectStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { inputMode, setInputMode } = useUIStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const aiConfigured = isAIConfigured();

  const settingsLink = currentProject ? `/projects/${currentProject.id}/settings` : '/projects';
  const dateLocale = i18n.language === 'ko' ? 'ko-KR' : i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const todayLabel = new Intl.DateTimeFormat(dateLocale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());

  useEffect(() => {
    if (!isAdmin) return;

    const fetchCount = () => void loadPendingCount().then(setPendingCount);
    fetchCount();

    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/login');
    // Supabase 세션 정리를 지연하여 컴포넌트 언마운트 시
    // 보류 중인 자동 저장이 유효한 세션 토큰으로 완료되도록 보장
    setTimeout(() => void signOutSupabase(), 500);
  };

  useEffect(() => {
    if (!showUserMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showUserMenu]);

  return (
    <header className="shrink-0 z-40 px-4 pt-4 lg:px-6">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 rounded-[28px] border border-[var(--border-strong)] bg-[color:var(--bg-secondary)] px-4 py-3 shadow-[0_28px_72px_-40px_rgba(17,24,39,0.42)] backdrop-blur-2xl sm:px-5">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/" className="group flex items-center gap-3.5">
            <div className="relative rounded-[12px] overflow-hidden shadow-[0_20px_40px_-20px_rgba(15,118,110,0.7)] ring-1 ring-white/10 transition-all duration-500 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_24px_48px_-20px_rgba(15,118,110,0.85)] group-hover:ring-white/20 dark:shadow-[0_20px_40px_-20px_rgba(50,182,171,0.35)] dark:ring-white/5 dark:group-hover:shadow-[0_24px_48px_-20px_rgba(50,182,171,0.5)]">
              <DKFlowLogo size={44} />
            </div>
            <div className="min-w-0">
              <span className="block truncate bg-gradient-to-r from-[var(--text-primary)] via-[var(--text-primary)] to-[color:var(--accent-primary)] bg-clip-text text-lg font-extrabold tracking-[-0.03em] text-transparent transition-all duration-500 group-hover:to-[color:var(--accent-primary)] dark:to-[#32b6ab]">
                DK Flow
              </span>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)] transition-colors duration-300 group-hover:text-[color:var(--text-secondary)]">
                {t('header.slogan')}
              </p>
            </div>
          </Link>

          {currentProject && (
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <ChevronRight className="h-4 w-4 text-[color:var(--text-secondary)]" />
              <div className="surface-badge max-w-[24rem]">
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-primary)]" />
                <span className="truncate" title={currentProject.name}>{currentProject.name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2 text-sm text-[color:var(--text-secondary)] backdrop-blur-xl md:flex">
            <CalendarDays className="h-4 w-4 text-[color:var(--accent-secondary)]" />
            <span>{todayLabel}</span>
          </div>

          <div
            className="relative hidden items-center md:flex"
            title={!aiConfigured ? t('header.aiKeyRequired') : `${t('header.currentMode')}: ${inputMode === 'ai' ? t('header.aiAutoInput') : t('header.manualInput')}`}
          >
            <button
              type="button"
              onClick={() => setInputMode(inputMode === 'ai' ? 'manual' : 'ai')}
              disabled={!aiConfigured}
              className={`group flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-all duration-200 ${
                !aiConfigured
                  ? 'cursor-not-allowed border-[var(--border-color)] bg-[color:var(--bg-elevated)] opacity-50'
                  : inputMode === 'ai'
                    ? 'border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.1)] text-violet-500 hover:-translate-y-0.5 hover:bg-[rgba(139,92,246,0.16)] dark:text-violet-400'
                    : 'border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)]'
              }`}
            >
              {inputMode === 'ai' ? (
                <>
                  <Bot className="h-4 w-4" />
                  <span>AI</span>
                </>
              ) : (
                <>
                  <Hand className="h-4 w-4" />
                  <span>{t('header.manual')}</span>
                </>
              )}
            </button>
          </div>

          <LanguageSelector />

          <button
            type="button"
            onClick={toggleTheme}
            className="group relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)]"
            title={isDark ? t('header.lightMode') : t('header.darkMode')}
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-amber-300 transition-all duration-300 group-hover:rotate-45 group-hover:text-amber-200" />
            ) : (
              <Moon className="h-5 w-5 text-slate-700 transition-all duration-300 group-hover:-rotate-12 group-hover:text-slate-900" />
            )}
          </button>

          <NotificationBell />

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="group flex items-center gap-3 rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] px-3 py-2 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-[color:var(--bg-secondary-solid)]"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] shadow-[0_18px_40px_-24px_rgba(15,118,110,0.8)] transition-all group-hover:scale-[1.03]">
                <User className="h-4 w-4 text-white" />
                {pendingCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--accent-danger)] px-1 text-[10px] font-bold text-white ring-2 ring-[color:var(--bg-elevated)]">
                    {pendingCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--text-secondary)]">
                  {isAdmin ? t('header.roleAdmin', '관리자') : t('header.roleOperator', '운영자')}
                </p>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {user?.name || t('header.userMenu.defaultUser')}
                </p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[image:var(--gradient-surface)] p-2 shadow-[0_32px_80px_-42px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-scale-in dark:bg-[image:var(--gradient-dark)]">
                <div className="rounded-[20px] border border-white/10 bg-[image:var(--gradient-primary)] p-4 text-white shadow-[0_24px_52px_-28px_rgba(15,118,110,0.82)]">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/82">
                      {t('header.userMenu.loginAccount')}
                    </p>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-base font-semibold tracking-[-0.03em]">
                    {user?.name || t('header.userMenu.defaultUser')}
                  </p>
                  <p className="mt-1 truncate text-sm text-white/82" title={user?.email || 'user@example.com'}>
                    {user?.email || 'user@example.com'}
                  </p>
                </div>

                {isAdmin && (
                  <Link
                    to="/admin/users"
                    className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Users className="h-4 w-4" />
                    {t('header.userMenu.userManagement')}
                    {pendingCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--accent-danger)] px-1.5 text-[11px] font-bold text-white">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )}

                <Link
                  to={settingsLink}
                  className="mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="h-4 w-4" />
                  {t('header.userMenu.settings')}
                </Link>

                <div className="my-1 border-t border-[var(--border-color)]" />

                <Link
                  to="/account"
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-elevated)]"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="h-4 w-4" />
                  {t('header.userMenu.accountSettings')}
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[rgba(203,75,95,0.2)] bg-[rgba(203,75,95,0.08)] px-3 text-sm font-semibold text-[color:var(--accent-danger)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[rgba(203,75,95,0.14)]"
            title={t('header.logout')}
          >
            <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">{t('header.logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
