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
    // account_status 컬럼 존재 여부 확인 (한 행만 조회)
    const { error } = await supabase
      .from('profiles')
      .select('account_status')
      .limit(1);

    if (error && error.message.includes('account_status')) {
      console.log('[migration] account_status 컬럼 없음 — 마이그레이션 실행');
      // rpc로 마이그레이션 함수 호출 시도
      const { error: rpcError } = await supabase.rpc('run_account_status_migration');
      if (rpcError) {
        console.warn('[migration] RPC 실패 — SQL 직접 실행 시도:', rpcError.message);
        // RPC 함수가 없으면 직접 SQL 실행 (service_role 필요할 수 있음)
        const { error: sqlError } = await supabase.rpc('exec_sql', {
          query: `
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
              CHECK (account_status IN ('pending', 'active', 'suspended'));
          `,
        });
        if (sqlError) {
          console.error('[migration] 자동 마이그레이션 실패. Supabase SQL Editor에서 수동 실행 필요:', sqlError.message);
        }
      }
    } else {
      console.log('[migration] account_status 컬럼 확인 완료');
    }

    // attendance 테이블 존재 여부 확인 및 자동 생성
    await ensureAttendanceTable();
  } catch (err) {
    console.error('[migration] 마이그레이션 확인 중 오류:', err);
  }
}

/** attendance 테이블이 없으면 생성 */
async function ensureAttendanceTable(): Promise<void> {
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

  // 1차: exec_sql rpc 시도
  const { error: rpcError } = await supabase.rpc('exec_sql', { query: createSQL });
  if (!rpcError) {
    console.log('[migration] attendance 테이블 생성 완료 (exec_sql)');
    return;
  }
  console.warn('[migration] exec_sql 실패:', rpcError.message);

  // 2차: run_create_attendance_table rpc 시도
  const { error: rpc2Error } = await supabase.rpc('run_create_attendance_table');
  if (!rpc2Error) {
    console.log('[migration] attendance 테이블 생성 완료 (rpc)');
    return;
  }

  console.error(
    '[migration] attendance 테이블 자동 생성 실패. Supabase SQL Editor에서 아래 SQL을 실행하세요:\n',
    createSQL
  );
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

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Failed to get Supabase session:', sessionError);
    return null;
  }

  if (session?.user) {
    return toAppUser(session.user);
  }

  return null;
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

  // account_status 포함 조회 시도
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, system_role, account_status, created_at')
    .order('created_at', { ascending: true });

  if (error && error.message.includes('account_status')) {
    // 컬럼 없음 → account_status 없이 조회
    const { data: fallback, error: fallbackError } = await supabase
      .from('profiles')
      .select('id, email, name, system_role, created_at')
      .order('created_at', { ascending: true });

    if (fallbackError) {
      console.error('Failed to load profiles:', fallbackError);
      return [];
    }

    return (fallback || []).map((row) => ({
      id: row.id,
      email: row.email || '',
      name: row.name || '',
      systemRole: row.system_role as SystemRole,
      accountStatus: 'active' as AccountStatus,
      createdAt: row.created_at,
    }));
  }

  if (error) {
    console.error('Failed to load profiles:', error);
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
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('account_status', 'pending');
    if (error) return 0; // 컬럼 없으면 0
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

// ─── Helpers ─────────────────────────────────────────────────

async function toAppUser(user: SupabaseAuthUser): Promise<User> {
  let systemRole: SystemRole = 'user';
  let accountStatus: AccountStatus = 'active';

  const { data, error } = await supabase
    .from('profiles')
    .select('system_role, account_status')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[toAppUser] profiles 조회 실패:', error.code, error.message);
    // 폴백: system_role만 조회
    const { data: fallback, error: fallbackErr } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single();
    console.log('[toAppUser] 폴백 결과:', fallback, fallbackErr?.message);
    if (fallback?.system_role) {
      systemRole = fallback.system_role as SystemRole;
    }
  } else if (data) {
    systemRole = (data.system_role as SystemRole) || 'user';
    accountStatus = (data.account_status as AccountStatus) || 'active';
    console.log('[toAppUser] profiles 조회 성공:', { systemRole, accountStatus });
  } else {
    console.warn('[toAppUser] profiles 데이터 없음 (user.id:', user.id, ')');
  }

  return {
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
}

function getAuthErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (message.includes('User already registered')) return '이미 등록된 이메일입니다.';
  if (message.includes('Password should be at least')) return '비밀번호는 최소 6자 이상이어야 합니다.';
  if (message.includes('Unable to validate email')) return '유효한 이메일 주소를 입력해주세요.';
  if (message.includes('Email rate limit exceeded')) return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  return message;
}
