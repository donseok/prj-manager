import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, Sparkles, Sun, Moon, Settings, Zap, GitBranch, Target, Lightbulb, BarChart3, Clock } from 'lucide-react';
import DKFlowLogo from '../components/common/DKFlowLogo';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { signInWithEmail, signUpWithEmail } from '../lib/supabase';
export default function Login() {
  const { isAuthenticated, setUser, isPending, isSuspended } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && (isPending || isSuspended)) {
    return <Navigate to="/pending" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await signInWithEmail(email, password);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.user) {
          setUser(result.user);
          if (result.user.accountStatus === 'pending' || result.user.accountStatus === 'suspended') {
            navigate('/pending', { replace: true });
            return;
          }
          // 프로젝트 로드는 App.tsx의 onAuthStateChange에서 처리
        }
      } else {
        if (!name.trim()) {
          setError(t('login.nameRequired'));
          return;
        }
        const result = await signUpWithEmail(email, password, name.trim());
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.user) {
          setUser(result.user);
          setSuccessMessage(t('login.signupSuccess'));
          setMode('login');
          setEmail('');
          setPassword('');
          setName('');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen text-[color:var(--text-primary)]">
      {/* 배경 효과 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-10rem] top-[2rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(203,109,55,0.18),transparent_72%)] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(18,61,100,0.12),transparent_72%)] blur-3xl" />
      </div>

      {/* 왼쪽: 브랜드 패널 */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex">
        <div className="relative mx-10 flex h-[calc(100vh-5rem)] w-full max-w-xl flex-col items-center justify-center overflow-hidden rounded-[36px] p-12" style={{ background: 'linear-gradient(135deg, #0f1117 0%, #1a1d2e 100%)' }}>
          {/* Ambient glows */}
          <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.10),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.10),transparent_72%)] blur-3xl" />
          <div className="pointer-events-none absolute left-[30%] top-[40%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.12),transparent_70%)] blur-3xl" />

          {/* ---- Floating decorative elements ---- */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {/* Stat bubbles (large) */}
            <div
              className="absolute flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.05] backdrop-blur-sm hero-float-1"
              style={{ width: 84, height: 84, top: '8%', left: '8%' }}
            >
              <span className="text-[22px] font-bold text-white/85">29</span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-white/40">tasks</span>
            </div>
            <div
              className="absolute flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm hero-float-3"
              style={{ width: 76, height: 76, top: '18%', right: '10%' }}
            >
              <span className="text-[20px] font-bold text-white/80">58</span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-white/40">%</span>
            </div>
            <div
              className="absolute flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-2"
              style={{ width: 72, height: 72, bottom: '14%', right: '14%' }}
            >
              <span className="text-[18px] font-bold text-white/80">11</span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-white/40">done</span>
            </div>

            {/* Icon cards (small) */}
            <div
              className="absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] backdrop-blur-sm hero-float-4"
              style={{ width: 44, height: 44, top: '5%', right: '30%' }}
            >
              <Settings className="h-5 w-5 text-white/35" />
            </div>
            <div
              className="absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm hero-float-2"
              style={{ width: 42, height: 42, top: '32%', left: '5%' }}
            >
              <Zap className="h-4.5 w-4.5 text-amber-400/50" />
            </div>
            <div
              className="absolute flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] backdrop-blur-sm hero-float-1"
              style={{ width: 40, height: 40, top: '52%', right: '6%' }}
            >
              <GitBranch className="h-4 w-4 text-white/30" />
            </div>
            <div
              className="absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-sm hero-float-3"
              style={{ width: 42, height: 42, bottom: '22%', left: '10%' }}
            >
              <Target className="h-4.5 w-4.5 text-orange-400/40" />
            </div>
            <div
              className="absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm hero-float-4"
              style={{ width: 40, height: 40, top: '60%', left: '22%' }}
            >
              <Lightbulb className="h-4.5 w-4.5 text-amber-400/45" />
            </div>
            <div
              className="absolute flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] backdrop-blur-sm hero-float-1"
              style={{ width: 38, height: 38, bottom: '8%', left: '32%' }}
            >
              <BarChart3 className="h-4 w-4 text-teal-400/45" />
            </div>
            <div
              className="absolute flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm hero-float-2"
              style={{ width: 40, height: 40, top: '42%', right: '26%' }}
            >
              <Clock className="h-4.5 w-4.5 text-teal-400/40" />
            </div>

            {/* Decorative dots */}
            <div
              className="absolute h-2 w-2 rounded-full bg-white/20 hero-float-1"
              style={{ top: '28%', left: '20%' }}
            />
            <div
              className="absolute h-1.5 w-1.5 rounded-full bg-teal-400/30 hero-float-4"
              style={{ top: '70%', right: '30%' }}
            />
            <div
              className="absolute h-1.5 w-1.5 rounded-full bg-white/15 hero-float-3"
              style={{ top: '15%', left: '28%' }}
            />
            <div
              className="absolute h-1 w-1 rounded-full bg-amber-400/25 hero-float-2"
              style={{ bottom: '30%', right: '38%' }}
            />

            {/* Decorative gradient lines */}
            <div
              className="absolute h-px w-16 bg-gradient-to-r from-transparent via-white/10 to-transparent hero-float-2"
              style={{ top: '25%', right: '18%', transform: 'rotate(-20deg)' }}
            />
            <div
              className="absolute h-px w-20 bg-gradient-to-r from-transparent via-white/8 to-transparent hero-float-3"
              style={{ top: '48%', left: '14%', transform: 'rotate(15deg)' }}
            />
            <div
              className="absolute h-px w-14 bg-gradient-to-r from-transparent via-white/6 to-transparent hero-float-1"
              style={{ bottom: '35%', right: '10%', transform: 'rotate(-10deg)' }}
            />
          </div>

          {/* ---- Main content (above floating elements) ---- */}
          <div className="relative z-10 text-center">
            <div className="mx-auto mb-8 w-fit rounded-[20px] overflow-hidden relative" style={{ boxShadow: '0 32px 64px -32px rgba(15,118,110,0.9), inset 0 0 0 1px rgba(0,0,0,0.3)' }}>
              <DKFlowLogo size={80} className="block scale-[1.06]" />
            </div>
            <div className="surface-badge mx-auto border-white/12 bg-white/[0.14] text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              Project Management System
            </div>
            <h1 className="mt-6 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-white">
              {t('login.brandTagline')}
            </h1>
            <p className="mx-auto mt-6 max-w-sm text-base leading-7 text-white/88">
              {t('login.brandDescription1')}
              <br />
              {t('login.brandDescription2')}
            </p>

            <div className="mx-auto mt-10 grid max-w-xs grid-cols-3 gap-4">
              <div className="rounded-[20px] border border-white/12 bg-white/[0.12] p-4 text-center">
                <p className="text-2xl font-semibold text-white">WBS</p>
                <p className="mt-1 text-[11px] text-white/84">{t('login.wbsLabel')}</p>
              </div>
              <div className="rounded-[20px] border border-white/12 bg-white/[0.12] p-4 text-center">
                <p className="text-2xl font-semibold text-white">Gantt</p>
                <p className="mt-1 text-[11px] text-white/84">{t('login.scheduleLabel')}</p>
              </div>
              <div className="rounded-[20px] border border-white/12 bg-white/[0.12] p-4 text-center">
                <p className="text-2xl font-semibold text-white">Team</p>
                <p className="mt-1 text-[11px] text-white/84">{t('login.teamLabel')}</p>
              </div>
            </div>
          </div>

          <p className="absolute bottom-6 text-xs text-white/84">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>

      {/* 오른쪽: 로그인 폼 */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        {/* 테마 토글 버튼 */}
        <button
          onClick={toggleTheme}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-secondary-solid)] hover:text-[color:var(--text-primary)]"
          title={isDark ? t('header.lightMode') : t('header.darkMode')}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <div className="w-full max-w-md">
          {/* 모바일 로고 */}
          <div className="mb-10 flex flex-col items-center gap-3 lg:hidden">
            <div className="rounded-[14px] overflow-hidden relative" style={{ boxShadow: '0 24px 45px -26px rgba(15,118,110,0.82), inset 0 0 0 1px rgba(0,0,0,0.3)' }}>
              <DKFlowLogo size={56} className="block scale-[1.06]" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-[-0.02em]">DK Flow</h1>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('login.brandTagline')}</p>
            </div>
          </div>

          {/* 헤더 텍스트 */}
          <div className="mb-8 hidden lg:block">
            <h2 className="text-3xl font-semibold tracking-[-0.04em]">
              {mode === 'login' ? t('login.welcomeBack') : t('login.createAccount')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {mode === 'login'
                ? t('login.loginDescription')
                : t('login.signupDescription')}
            </p>
          </div>

          {/* 로그인/회원가입 카드 */}
          <div className="app-panel-strong rounded-[28px] p-6 sm:p-8">
            {/* 탭 */}
            <div className="mb-6 flex rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-1">
              <button
                onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-[color:var(--bg-secondary-solid)] shadow-sm text-[color:var(--text-primary)]'
                    : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'
                }`}
              >
                <LogIn className="h-4 w-4" />
                {t('login.loginTab')}
              </button>
              <button
                onClick={() => { setMode('signup'); setError(null); setSuccessMessage(null); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  mode === 'signup'
                    ? 'bg-[color:var(--bg-secondary-solid)] shadow-sm text-[color:var(--text-primary)]'
                    : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                {t('login.signupTab')}
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="field-label">{t('login.nameLabel')}</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="홍길동"
                      className="field-input !pl-10"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="field-label">{t('login.emailLabel')}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="field-input !pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">{t('login.passwordLabel')}</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input !pl-10 !pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {successMessage && (
                <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {successMessage}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(15,118,110,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-20px_rgba(15,118,110,0.9)] disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="h-4 w-4" />
                    {t('login.loginButton')}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {t('login.signupButton')}
                  </>
                )}
              </button>
            </form>

          </div>

          <p className="mt-6 text-center text-xs text-[color:var(--text-muted)] lg:hidden">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </div>
  );
}
