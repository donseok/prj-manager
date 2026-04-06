import { createClient } from '@supabase/supabase-js';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { AccountStatus, SystemRole, User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as unknown as ReturnType<typeof createClient>);

// ─── DB Migration ───────────────────────────────────────────

let _migrationChecked = false;

/** 앱 시작 시 호출: 필요한 테이블/컬럼이 없으면 자동 추가 */
export async function ensureMigrations(): Promise<void> {
  if (!isSupabaseConfigured || _migrationChecked) return;
  _migrationChecked = true;

  try {
    // 모든 마이그레이션 체크를 병렬로 실행
    await Promise.allSettled([
      ensureAccountStatusColumn(),
      ensureAttendanceTable(),
      ensureAuditLogTable(),
      ensureSystemSettingsTable(),
      ensureMemberWeeklyNotesTable(),
      ensureWeeklyMemberReportsTable(),
    ]);
  } catch (err) {
    console.warn('[migration] 마이그레이션 확인 중 오류:', err);
  }
}

/** account_status 컬럼이 없으면 추가 */
async function ensureAccountStatusColumn(): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('account_status')
      .limit(1);

    if (error && error.message.includes('account_status')) {
      console.log('[migration] account_status 컬럼 없음 — 마이그레이션 실행');
      const { error: rpcError } = await supabase.rpc('run_account_status_migration');
      if (rpcError) {
        console.warn(
          '[migration] ⚠ account_status 컬럼 자동 생성 실패 (기능 사용 시 에러 발생 가능). Supabase SQL Editor에서 수동 실행 필요:',
          `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended'));`
        );
      }
    } else {
      console.log('[migration] account_status 컬럼 확인 완료');
    }
  } catch (err) {
    console.warn('[migration] account_status 마이그레이션 중 예외 발생 (무시):', err);
  }
}

/** attendance 테이블이 없으면 생성 */
async function ensureAttendanceTable(): Promise<void> {
  try {
    const { error } = await supabase.from('attendance').select('id').limit(1);
    if (!error) {
      console.log('[migration] attendance 테이블 확인 완료');
      return;
    }

    console.log('[migration] attendance 테이블 없음 — 생성 시도');

    const createSQL = `
      create table if not exists public.attendance (
        id text primary key,
        project_id text not null references public.projects (id) on delete cascade,
        member_id text not null references public.project_members (id) on delete cascade,
        date date not null,
        type varchar(30) not null,
        note text,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now())
      );
      create index if not exists idx_attendance_project_id on public.attendance (project_id);
      create index if not exists idx_attendance_member_id on public.attendance (member_id);
      create index if not exists idx_attendance_date on public.attendance (date);
      create index if not exists idx_attendance_project_date on public.attendance (project_id, date);
      alter table public.attendance enable row level security;
      create policy "attendance_select" on public.attendance for select to authenticated
        using (exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid()) or is_admin());
      create policy "attendance_insert" on public.attendance for insert to authenticated
        with check (exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin')) or exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.id = attendance.member_id) or is_admin());
      create policy "attendance_update" on public.attendance for update to authenticated
        using (exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin')) or exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.id = attendance.member_id) or is_admin());
      create policy "attendance_delete" on public.attendance for delete to authenticated
        using (exists (select 1 from public.project_members pm where pm.project_id = attendance.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin')) or is_admin());
    `;

    // run_create_attendance_table rpc 시도
    const { error: rpcError } = await supabase.rpc('run_create_attendance_table');
    if (!rpcError) {
      console.log('[migration] attendance 테이블 생성 완료 (rpc)');
      return;
    }

    console.warn(
      '[migration] ⚠ attendance 테이블 자동 생성 실패 (기능 사용 시 에러 발생 가능). Supabase SQL Editor에서 아래 SQL을 실행하세요:\n',
      createSQL
    );
  } catch (err) {
    console.warn('[migration] attendance 마이그레이션 중 예외 발생 (무시):', err);
  }
}

/** audit_log 테이블이 없으면 생성 */
async function ensureAuditLogTable(): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').select('id').limit(1);
    if (!error) {
      console.log('[migration] audit_log 테이블 확인 완료');
      return;
    }

    console.log('[migration] audit_log 테이블 없음 — 생성 시도');

    const createSQL = `
      create table if not exists public.audit_log (
        id text primary key,
        project_id text not null,
        user_id text not null,
        user_name text not null,
        action text not null,
        details text not null default '',
        created_at timestamptz not null default timezone('utc', now())
      );
      create index if not exists idx_audit_log_project_id on public.audit_log (project_id);
      create index if not exists idx_audit_log_created_at on public.audit_log (created_at);
    `;

    console.warn(
      '[migration] ⚠ audit_log 테이블 자동 생성 실패 (기능 사용 시 에러 발생 가능). Supabase SQL Editor에서 아래 SQL을 실행하세요:\n',
      createSQL
    );
  } catch (err) {
    console.warn('[migration] audit_log 마이그레이션 중 예외 발생 (무시):', err);
  }
}

/** system_settings 테이블이 없으면 생성 */
async function ensureSystemSettingsTable(): Promise<void> {
  try {
    const { error } = await supabase.from('system_settings').select('key').limit(1);
    if (!error) {
      console.log('[migration] system_settings 테이블 확인 완료');
      return;
    }

    console.log('[migration] system_settings 테이블 없음 — 생성 시도');

    const createSQL = `
      create table if not exists public.system_settings (
        key text primary key,
        value jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default timezone('utc', now())
      );
    `;

    console.warn(
      '[migration] ⚠ system_settings 테이블 자동 생성 실패 (기능 사용 시 에러 발생 가능). Supabase SQL Editor에서 아래 SQL을 실행하세요:\n',
      createSQL
    );
  } catch (err) {
    console.warn('[migration] system_settings 마이그레이션 중 예외 발생 (무시):', err);
  }
}

/** member_weekly_notes 테이블이 없으면 생성 */
async function ensureMemberWeeklyNotesTable(): Promise<void> {
  try {
    const { error } = await supabase.from('member_weekly_notes').select('id').limit(1);
    if (!error) {
      console.log('[migration] member_weekly_notes 테이블 확인 완료');
      return;
    }

    console.log('[migration] member_weekly_notes 테이블 없음 — 생성 시도');

    const createSQL = `
      create table if not exists public.member_weekly_notes (
        id text primary key,
        project_id text not null references public.projects (id) on delete cascade,
        member_id text not null,
        member_name text not null,
        week_start date not null,
        this_week_achievements text not null default '',
        next_week_plans text not null default '',
        updated_at timestamptz not null default timezone('utc', now())
      );
      create index if not exists idx_member_weekly_notes_project_week
        on public.member_weekly_notes (project_id, week_start);
      create unique index if not exists idx_member_weekly_notes_unique
        on public.member_weekly_notes (project_id, member_id, week_start);
      alter table public.member_weekly_notes enable row level security;
      create policy "member_weekly_notes_select" on public.member_weekly_notes for select to authenticated
        using (exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid()) or is_admin());
      create policy "member_weekly_notes_insert" on public.member_weekly_notes for insert to authenticated
        with check (exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid()) or is_admin());
      create policy "member_weekly_notes_update" on public.member_weekly_notes for update to authenticated
        using (exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid()) or is_admin());
      create policy "member_weekly_notes_delete" on public.member_weekly_notes for delete to authenticated
        using (exists (select 1 from public.project_members pm where pm.project_id = member_weekly_notes.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin')) or is_admin());
    `;

    console.warn(
      '[migration] ⚠ member_weekly_notes 테이블 자동 생성 실패 (기능 사용 시 에러 발생 가능). Supabase SQL Editor에서 아래 SQL을 실행하세요:\n',
      createSQL
    );
  } catch (err) {
    console.warn('[migration] member_weekly_notes 마이그레이션 중 예외 발생 (무시):', err);
  }
}

/** weekly_member_reports 테이블이 없으면 생성 */
async function ensureWeeklyMemberReportsTable(): Promise<void> {
  try {
    const { error } = await supabase.from('weekly_member_reports').select('id').limit(1);
    if (!error) {
      console.log('[migration] weekly_member_reports 테이블 확인 완료');
      return;
    }

    console.log('[migration] weekly_member_reports 테이블 없음 — 생성 시도');

    const createSQL = `
      create table if not exists public.weekly_member_reports (
        id text primary key,
        project_id text not null references public.projects (id) on delete cascade,
        member_id text not null references public.project_members (id) on delete cascade,
        week_start date not null,
        this_week_result text not null default '',
        next_week_plan text not null default '',
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now()),
        unique (project_id, member_id, week_start)
      );
      grant select, insert, update, delete on public.weekly_member_reports to anon, authenticated, service_role;
      create index if not exists idx_wmr_project_week on public.weekly_member_reports (project_id, week_start);
      create index if not exists idx_wmr_member on public.weekly_member_reports (member_id);
      alter table public.weekly_member_reports enable row level security;
      create policy "wmr_select" on public.weekly_member_reports for select to authenticated
        using (exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid()) or is_admin());
      create policy "wmr_insert" on public.weekly_member_reports for insert to authenticated
        with check (
          exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
          or exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.id = weekly_member_reports.member_id)
          or is_admin()
        );
      create policy "wmr_update" on public.weekly_member_reports for update to authenticated
        using (
          exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
          or exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.id = weekly_member_reports.member_id)
          or is_admin()
        );
      create policy "wmr_delete" on public.weekly_member_reports for delete to authenticated
        using (
          exists (select 1 from public.project_members pm where pm.project_id = weekly_member_reports.project_id and pm.user_id = auth.uid() and pm.role in ('owner','admin'))
          or is_admin()
        );
    `;

    console.warn(
      '[migration] ⚠ weekly_member_reports 테이블 자동 생성 실패. Supabase SQL Editor에서 아래 SQL을 실행하세요:\n',
      createSQL
    );
  } catch (err) {
    console.warn('[migration] weekly_member_reports 마이그레이션 중 예외 발생 (무시):', err);
  }
}

// ─── Auth ────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured) return { user: null, error: 'Supabase가 설정되지 않았습니다.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { user: null, error: getAuthErrorMessage(error.message) };
  }

  if (!data.user) return { user: null, error: '로그인에 실패했습니다.' };

  const appUser = await toAppUser(data.user);
  return { user: appUser, error: null };
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured) return { user: null, error: 'Supabase가 설정되지 않았습니다.' };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    return { user: null, error: getAuthErrorMessage(error.message) };
  }

  if (!data.user) return { user: null, error: '회원가입에 실패했습니다.' };

  const appUser = await toAppUser(data.user);
  return { user: appUser, error: null };
}

export async function ensureSupabaseSession(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;

  // getSession은 localStorage 캐시만 확인하므로 만료 토큰도 반환할 수 있음.
  // refreshSession을 통해 실제 유효성을 서버에서 검증한다.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    if (sessionError) console.error('Failed to get Supabase session:', sessionError);
    return null;
  }

  // 토큰 만료 여부를 서버에 확인 — 만료 시 갱신 시도
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session?.user) {
    console.warn('세션이 만료되었습니다. 재로그인이 필요합니다.');
    await supabase.auth.signOut().catch(() => {});
    return null;
  }

  return toAppUser(refreshed.session.user);
}

export function subscribeToSupabaseAuthChanges(callback: (user: User | null) => void) {
  if (!isSupabaseConfigured) return () => {};

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const appUser = await toAppUser(session.user);
      callback(appUser);
    } else {
      callback(null);
    }
  });

  return () => subscription.unsubscribe();
}

export async function signOutSupabase() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Failed to sign out from Supabase:', error);
  }
}

// ─── Profiles ────────────────────────────────────────────────

export async function loadAllProfiles(): Promise<Array<{ id: string; email: string; name: string; systemRole: SystemRole; accountStatus: AccountStatus; createdAt: string }>> {
  if (!isSupabaseConfigured) return [];

  // RPC 함수로 RLS 우회하여 빠르게 조회 (관리자 전용)
  const { data, error } = await supabase.rpc('admin_load_all_profiles');

  if (error) {
    // RPC 함수가 없으면 기존 방식으로 폴백
    if (error.message.includes('admin_load_all_profiles')) {
      console.warn('admin_load_all_profiles RPC not found, falling back to direct query');
      return loadAllProfilesFallback();
    }
    console.error('Failed to load profiles:', error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    email: (row.email as string) || '',
    name: (row.name as string) || '',
    systemRole: row.system_role as SystemRole,
    accountStatus: ((row.account_status as AccountStatus) || 'active'),
    createdAt: row.created_at as string,
  }));
}

/** RPC 미설치 시 기존 직접 조회 폴백 */
async function loadAllProfilesFallback(): Promise<Array<{ id: string; email: string; name: string; systemRole: SystemRole; accountStatus: AccountStatus; createdAt: string }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, system_role, account_status, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load profiles (fallback):', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    email: row.email || '',
    name: row.name || '',
    systemRole: row.system_role as SystemRole,
    accountStatus: (row.account_status as AccountStatus) || 'active',
    createdAt: row.created_at,
  }));
}

export async function loadPendingCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    // RPC 함수로 RLS 우회하여 빠르게 카운트 (관리자 전용)
    const { data, error } = await supabase.rpc('admin_pending_count');
    if (!error && data !== null) return data as number;

    // RPC 미설치 시 기존 방식 폴백
    const { count, error: fallbackError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('account_status', 'pending');
    if (fallbackError) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function updateUserSystemRole(userId: string, role: SystemRole): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'Supabase가 설정되지 않았습니다.' };
  const { error } = await supabase
    .from('profiles')
    .update({ system_role: role })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update system role:', error);
    return { error: '역할 변경에 실패했습니다.' };
  }

  return { error: null };
}

export async function updateAccountStatus(userId: string, status: AccountStatus): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'Supabase가 설정되지 않았습니다.' };
  const { error } = await supabase
    .from('profiles')
    .update({ account_status: status })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update account status:', error);
    return { error: '계정 상태 변경에 실패했습니다.' };
  }

  return { error: null };
}

// ─── Account Deletion ────────────────────────────────────────

/**
 * 회원 탈퇴 처리.
 * 1) 비밀번호 재확인 (Supabase 모드)
 * 2) 소유 프로젝트 일괄 삭제
 * 3) 멤버 참여 내역 제거
 * 4) 프로필 삭제
 * 5) Supabase 로그아웃
 */
export async function deleteUserAccount(
  userId: string,
  email: string,
  password: string,
  cascadeFns: {
    deleteAllOwned: (uid: string) => Promise<void>;
    removeFromAll: (uid: string) => Promise<void>;
  }
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase가 설정되지 않았습니다.' };
  }

  // 1) 비밀번호 재확인
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    return { error: '비밀번호가 올바르지 않습니다.' };
  }

  try {
    // 2) 소유 프로젝트 일괄 삭제 (cascade로 멤버/작업/근태 함께 삭제)
    await cascadeFns.deleteAllOwned(userId);

    // 3) 다른 프로젝트에서 멤버 참여 내역 제거
    await cascadeFns.removeFromAll(userId);

    // 4) 프로필 삭제
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to delete profile:', profileError);
    }

    // 5) 로그아웃
    await signOutSupabase();

    return { error: null };
  } catch (err) {
    console.error('Account deletion failed:', err);
    return { error: err instanceof Error ? err.message : '회원 탈퇴 처리 중 오류가 발생했습니다.' };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

// 단기 캐시: 로그인 직후 onAuthStateChange에서 중복 profiles 쿼리 방지
let _userCache: { id: string; user: User; ts: number } | null = null;
const USER_CACHE_TTL = 10_000; // 10초

async function toAppUser(user: SupabaseAuthUser): Promise<User> {
  // 캐시 히트: 같은 유저, TTL 이내
  if (_userCache && _userCache.id === user.id && Date.now() - _userCache.ts < USER_CACHE_TTL) {
    return _userCache.user;
  }

  let systemRole: SystemRole = 'user';
  let accountStatus: AccountStatus = 'active';

  const { data, error } = await supabase
    .from('profiles')
    .select('system_role, account_status')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[toAppUser] profiles 조회 실패:', error.code, error.message);
  } else if (data) {
    systemRole = (data.system_role as SystemRole) || 'user';
    accountStatus = (data.account_status as AccountStatus) || 'active';
  }

  const appUser: User = {
    id: user.id,
    email: user.email || `${user.id}@anon.local`,
    name:
      String(user.user_metadata?.name || user.user_metadata?.full_name || '').trim() ||
      (user.email ? user.email.split('@')[0] : '익명 사용자'),
    avatarUrl: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : undefined,
    systemRole,
    accountStatus,
    createdAt: user.created_at,
  };

  _userCache = { id: user.id, user: appUser, ts: Date.now() };
  return appUser;
}

function getAuthErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (message.includes('User already registered')) return '이미 등록된 이메일입니다.';
  if (message.includes('Password should be at least')) return '비밀번호는 최소 6자 이상이어야 합니다.';
  if (message.includes('Unable to validate email')) return '유효한 이메일 주소를 입력해주세요.';
  if (message.includes('Email rate limit exceeded')) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  return message;
}
