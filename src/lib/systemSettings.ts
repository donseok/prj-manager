import { supabase } from './supabase';

export interface SystemSettings {
  projectCreationPolicy: 'all' | 'admin_only';
}

const DEFAULT_SETTINGS: SystemSettings = {
  projectCreationPolicy: 'all',
};

export async function loadSystemSettings(): Promise<SystemSettings> {
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
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key: 'system_settings', value: settings }, { onConflict: 'key' });

  if (error) {
    console.error('Failed to save system settings:', error);
    throw new Error(`시스템 설정 저장 실패: ${error.message}`);
  }
}
