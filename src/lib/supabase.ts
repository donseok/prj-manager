import { createClient } from '@supabase/supabase-js';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { AccountStatus, SystemRole, User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as unknown as ReturnType<typeof createClient>);

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
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, system_role, account_status, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load profiles:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    email: row.email || '',
    name: row.name || '',
    systemRole: row.system_role as SystemRole,
    accountStatus: (row.account_status as AccountStatus) || 'pending',
    createdAt: row.created_at,
  }));
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
  let accountStatus: AccountStatus = 'pending';

  const { data } = await supabase
    .from('profiles')
    .select('system_role, account_status')
    .eq('id', user.id)
    .single();

  if (data?.system_role) {
    systemRole = data.system_role as SystemRole;
  }
  if (data?.account_status) {
    accountStatus = data.account_status as AccountStatus;
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
