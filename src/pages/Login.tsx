import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LogIn, UserPlus, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import DKFlowLogo from '../components/common/DKFlowLogo';
import { useAuthStore } from '../store/authStore';
import { signInWithEmail, signUpWithEmail, isSupabaseConfigured, createLocalFallbackUser } from '../lib/supabase';
import { loadInitialProjects } from '../lib/dataRepository';
import { useProjectStore } from '../store/projectStore';

export default function Login() {
  const { isAuthenticated, setUser } = useAuthStore();
  const { setProjects } = useProjectStore();
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
      if (!isSupabaseConfigured) {
        // 로컬 모드: Supabase 없이 로컬 사용자로 로그인
        const localUser = createLocalFallbackUser();
        setUser(localUser);
        const projects = await loadInitialProjects();
        setProjects(projects);
        return;
      }

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
    <div className="relative flex min-h-screen items-center justify-center px-4 text-[color:var(--text-primary)]">
      {/* 배경 효과 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.22),transparent_68%)] blur-3xl" />
        <div className="absolute right-[-10rem] top-[2rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(203,109,55,0.18),transparent_72%)] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(18,61,100,0.12),transparent_72%)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* 로고 */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="shadow-[0_24px_45px_-26px_rgba(15,118,110,0.82)] rounded-2xl">
            <DKFlowLogo size={56} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-[-0.02em]">DK Flow</h1>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">업무의 흐름을 설계하다</p>
          </div>
        </div>

        {/* 로그인/회원가입 카드 */}
        <div className="rounded-[28px] border border-white/20 bg-[rgba(255,250,244,0.56)] p-6 shadow-[0_28px_72px_-40px_rgba(17,24,39,0.42)] backdrop-blur-2xl dark:border-[var(--border-color)] dark:bg-[rgba(15,18,23,0.6)] sm:p-8">
          {/* 탭 */}
          <div className="mb-6 flex rounded-2xl border border-[var(--border-color)] bg-black/5 p-1 dark:bg-white/5">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white shadow-sm text-[color:var(--text-primary)] dark:bg-white/10'
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
                  ? 'bg-white shadow-sm text-[color:var(--text-primary)] dark:bg-white/10'
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
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                  이름
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full rounded-xl border border-[var(--border-color)] bg-white/60 py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:bg-white/5"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="w-full rounded-xl border border-[var(--border-color)] bg-white/60 py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:bg-white/5"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-white/60 py-3 pl-10 pr-11 text-sm outline-none transition-all placeholder:text-[color:var(--text-muted)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:bg-white/5"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(15,118,110,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-20px_rgba(15,118,110,0.9)] disabled:opacity-60 disabled:hover:translate-y-0"
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

          {!isSupabaseConfigured && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
              Supabase가 설정되지 않았습니다. 로컬 모드로 접속합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
