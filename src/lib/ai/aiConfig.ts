import type { AIProvider, AISettings } from '../../types';

const STORAGE_KEY = 'dk_flow_ai_settings';

function getEnvProvider(): AIProvider | null {
  const val = import.meta.env.VITE_AI_PROVIDER as string | undefined;
  if (val === 'claude' || val === 'openai' || val === 'gemini') return val;
  return null;
}

function getEnvApiKey(): string | null {
  return (import.meta.env.VITE_AI_API_KEY as string) || null;
}

export function hasEnvAIConfig(): boolean {
  return !!(getEnvProvider() && getEnvApiKey());
}

export function loadAISettings(): AISettings {
  const envProvider = getEnvProvider();
  const envKey = getEnvApiKey();

  if (envProvider && envKey) {
    return { provider: envProvider, apiKey: envKey };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      return {
        provider: parsed.provider || 'claude',
        apiKey: parsed.apiKey || '',
        model: parsed.model,
      };
    }
  } catch {
    // ignore
  }

  return { provider: 'claude', apiKey: '' };
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isAIConfigured(): boolean {
  const settings = loadAISettings();
  return !!settings.apiKey;
}

export function getDefaultModel(provider: AIProvider): string {
  if (provider === 'claude') return 'claude-sonnet-4-5-20250929';
  if (provider === 'gemini') return 'gemini-2.0-flash';
  return 'gpt-4o';
}
