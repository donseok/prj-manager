import { supabase, isSupabaseConfigured } from './supabase';

export interface SystemSettings {
  projectCreationPolicy: 'all' | 'admin_only';
}

const DEFAULT_SETTINGS: SystemSettings = {
  projectCreationPolicy: 'all',
};

export async function loadSystemSettings(): Promise<SystemSettings> {
  // Local Mode(localStorage): supabase 클라이언트가 null이므로 기본값 반환
  if (!isSupabaseConfigured) {
    return DEFAULT_SETTINGS;
  }

  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'system_settings')
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return { ...DEFAULT_SETTINGS, ...(data.value as Partial<SystemSettings>) };
}

export async function saveSystemSettings(settings: SystemSettings): Promise<void> {
  // Local Mode(localStorage): 저장할 백엔드가 없으므로 no-op
  if (!isSupabaseConfigured) {
    return;
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert({ key: 'system_settings', value: settings }, { onConflict: 'key' });

  if (error) {
    console.error('Failed to save system settings:', error);
    throw new Error(`시스템 설정 저장 실패: ${error.message}`);
  }
}
