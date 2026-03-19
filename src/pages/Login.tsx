import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, AlertCircle, Sparkles, Sun, Moon } from 'lucide-react';
import DKFlowLogo from '../components/common/DKFlowLogo';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { signInWithEmail, signUpWithEmail } from '../lib/supabase';
import { loadInitialProjects } from '../lib/dataRepository';
import { useProjectStore } from '../store/projectStore';

export default function Login() {
  const { isAuthenticated, setUser } = useAuthStore();
  const { setProjects } = useProjectStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
          const projects = await loadInitialProjects();
          setProjects(projects);
        }
      } else {
        if (!name.trim()) {
          setError('이름을 입력해주세요.');
          return;
        }
        const result = await signUpWithEmail(email, password, name.trim());
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.user) {
          setUser(result.user);
          const projects = await loadInitialProjects();
          setProjects(projects);
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
        <div className="app-panel-dark relative mx-10 flex h-[calc(100vh-5rem)] w-full max-w-xl flex-col items-center justify-center overflow-hidden rounded-[36px] p-12">
          <div className="pointer-events-none absolute right-[-6rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_70%)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-8rem] left-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,190,120,0.18),transparent_72%)] blur-3xl" />

          <div className="relative text-center">
            <div className="mx-auto mb-8 w-fit shadow-[0_32px_64px_-32px_rgba(15,118,110,0.9)] rounded-3xl">
              <DKFlowLogo size={80} />
            </div>
            <div className="surface-badge mx-auto border-white/12 bg-white/[0.14] text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-secondary)]" />
              Project Management System
            </div>
            <h1 className="mt-6 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-white">
              업무의 흐름을
              <br />
              설계하다
            </h1>
            <p className="mx-auto mt-6 max-w-sm text-base leading-7 text-white/88">
              WBS, 간트 차트, 팀 관리를 하나의 흐름으로.
              <br />
              프로젝트의 시작부터 완료까지 선명하게.
            </p>

            <div className="mx-auto mt-10 grid max-w-xs grid-cols-3 gap-4">
              <div className="rounded-[20px] border border-white/12 bg-white/[0.12] p-4 text-center">
                <p className="text-2xl font-semibold text-white">WBS</p>
                <p className="mt-1 text-[11px] text-white/84">작업분류체계</p>
              </div>
              <div className="rounded-[20px] border border-white/12 bg-white/[0.12] p-4 text-center">
                <p className="text-2xl font-semibold text-white">Gantt</p>
                <p className="mt-1 text-[11px] text-white/84">일정 관리</p>
              </div>
              <div className="rounded-[20px] border border-white/12 bg-white/[0.12] p-4 text-center">
                <p className="text-2xl font-semibold text-white">Team</p>
                <p className="mt-1 text-[11px] text-white/84">팀 협업</p>
              </div>
            </div>
          </div>

          <p className="absolute bottom-6 text-xs text-white/84">
            &copy; {new Date().getFullYear()} 동국시스템즈. All rights reserved.
          </p>
        </div>
      </div>

      {/* 오른쪽: 로그인 폼 */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        {/* 테마 토글 버튼 */}
        <button
          onClick={toggleTheme}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-color)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)] transition-all hover:bg-[color:var(--bg-secondary-solid)] hover:text-[color:var(--text-primary)]"
          title={isDark ? '라이트 모드' : '다크 모드'}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <div className="w-full max-w-md">
          {/* 모바일 로고 */}
          <div className="mb-10 flex flex-col items-center gap-3 lg:hidden">
            <div className="shadow-[0_24px_45px_-26px_rgba(15,118,110,0.82)] rounded-2xl">
              <DKFlowLogo size={56} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-[-0.02em]">DK Flow</h1>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">업무의 흐름을 설계하다</p>
            </div>
          </div>

          {/* 헤더 텍스트 */}
          <div className="mb-8 hidden lg:block">
            <h2 className="text-3xl font-semibold tracking-[-0.04em]">
              {mode === 'login' ? '다시 오신 것을 환영합니다' : '새 계정을 만들어 보세요'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {mode === 'login'
                ? '이메일과 비밀번호로 로그인하세요.'
                : '가입 후 바로 프로젝트 관리를 시작할 수 있습니다.'}
            </p>
          </div>

          {/* 로그인/회원가입 카드 */}
          <div className="app-panel-strong rounded-[28px] p-6 sm:p-8">
            {/* 탭 */}
            <div className="mb-6 flex rounded-2xl border border-[var(--border-color)] bg-[color:var(--bg-elevated)] p-1">
              <button
                onClick={() => { setMode('login'); setError(null); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-[color:var(--bg-secondary-solid)] shadow-sm text-[color:var(--text-primary)]'
                    : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'
                }`}
              >
                <LogIn className="h-4 w-4" />
                로그인
              </button>
              <button
                onClick={() => { setMode('signup'); setError(null); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  mode === 'signup'
                    ? 'bg-[color:var(--bg-secondary-solid)] shadow-sm text-[color:var(--text-primary)]'
                    : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                회원가입
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="field-label">이름</label>
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
                <label className="field-label">이메일</label>
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
                <label className="field-label">비밀번호</label>
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
                    로그인
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    회원가입
                  </>
                )}
              </button>
            </form>

          </div>

          <p className="mt-6 text-center text-xs text-[color:var(--text-muted)] lg:hidden">
            &copy; {new Date().getFullYear()} 동국시스템즈. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
