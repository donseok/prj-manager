import type { AISettings } from '../../types';
import { getDefaultModel } from './aiConfig';

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
}

const TIMEOUT_MS = 60_000;

async function callClaude(settings: AISettings, messages: AIMessage[]): Promise<AIResponse> {
  const model = settings.model || getDefaultModel('claude');
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return { content: text };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOpenAI(settings: AISettings, messages: AIMessage[]): Promise<AIResponse> {
  const model = settings.model || getDefaultModel('openai');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { content: text };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callAI(settings: AISettings, messages: AIMessage[]): Promise<AIResponse> {
  if (settings.provider === 'claude') {
    return callClaude(settings, messages);
  }
  return callOpenAI(settings, messages);
}

export async function testConnection(settings: AISettings): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callAI(settings, [
      { role: 'user', content: 'Reply with exactly "OK" and nothing else.' },
    ]);
    if (result.content.trim().toLowerCase().includes('ok')) {
      return { success: true, message: '연결 성공' };
    }
    return { success: true, message: `응답 수신 확인: ${result.content.slice(0, 50)}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return { success: false, message: `연결 실패: ${msg}` };
  }
}
