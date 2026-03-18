import { createClient, type User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { User } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export function createLocalFallbackUser(): User {
  return {
    id: 'local-user',
    email: 'user@local.dev',
    name: '로컬 사용자',
    createdAt: new Date().toISOString(),
  };
}

export async function ensureSupabaseSession(): Promise<User | null> {
  if (!supabase) return null;

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

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error('Failed to create anonymous Supabase session:', error);
    return null;
  }

  return data.user ? toAppUser(data.user) : null;
}

export function subscribeToSupabaseAuthChanges(callback: (user: User | null) => void) {
  if (!supabase) {
    return () => {};
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? toAppUser(session.user) : null);
  });

  return () => subscription.unsubscribe();
}

export async function signOutSupabase() {
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Failed to sign out from Supabase:', error);
  }
}

function toAppUser(user: SupabaseAuthUser): User {
  return {
    id: user.id,
    email: user.email || `${user.id}@anon.local`,
    name:
      String(user.user_metadata?.name || user.user_metadata?.full_name || '').trim() ||
      (user.email ? user.email.split('@')[0] : '익명 사용자'),
    avatarUrl: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : undefined,
    createdAt: user.created_at,
  };
}

// 타입 변환 유틸리티 (snake_case -> camelCase)
export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result as T;
}

// 타입 변환 유틸리티 (camelCase -> snake_case)
export function toSnakeCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result as T;
}
