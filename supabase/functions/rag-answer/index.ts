// Supabase Edge Function: RAG search results -> grounded chatbot answer
// 배포: `supabase functions deploy rag-answer`
//
// Required secrets:
// - AI_PROVIDER=claude|openai|gemini
// - AI_API_KEY=<provider api key>
// Optional:
// - AI_MODEL=<provider model>

type AIProvider = 'claude' | 'openai' | 'gemini';

interface DenoRuntime {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare const Deno: DenoRuntime;

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RagHistoryMessage {
  role: 'assistant' | 'user';
  text: string;
}

interface RagAnswerHit {
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  similarity: number;
}

interface RagAnswerRequest {
  question?: unknown;
  projectName?: unknown;
  history?: unknown;
  hits?: unknown;
}

interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TIMEOUT_MS = 60_000;
const MAX_GENERATED_HITS = 5;
const MAX_CONTEXT_CHARS = 1400;
const MAX_HISTORY_MESSAGES = 6;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) || Deno.env.get(`VITE_${name}`) || null;
}

function getDefaultModel(provider: AIProvider): string {
  if (provider === 'claude') return 'claude-sonnet-4-5-20250929';
  if (provider === 'gemini') return 'gemini-2.0-flash';
  return 'gpt-4o';
}

function loadAISettings(): AISettings | null {
  const provider = getEnv('AI_PROVIDER');
  const apiKey =
    getEnv('AI_API_KEY') ||
    Deno.env.get('ANTHROPIC_API_KEY') ||
    Deno.env.get('OPENAI_API_KEY') ||
    Deno.env.get('GEMINI_API_KEY') ||
    null;

  if (provider !== 'claude' && provider !== 'openai' && provider !== 'gemini') return null;
  if (!apiKey) return null;

  return {
    provider,
    apiKey,
    model: getEnv('AI_MODEL') || getDefaultModel(provider),
  };
}

function sourceLabel(type: string): string {
  if (type === 'project') return '프로젝트';
  if (type === 'task') return '작업';
  if (type === 'member') return '멤버';
  return '문서';
}

function truncateForPrompt(value: string): string {
  if (value.length <= MAX_CONTEXT_CHARS) return value;
  return `${value.slice(0, MAX_CONTEXT_CHARS).trimEnd()}\n...`;
}

function formatContextBlock(hit: RagAnswerHit, index: number): string {
  return [
    `[S${index + 1}] ${sourceLabel(hit.sourceType)} · ${hit.title || hit.sourceId} · 유사도 ${Math.round(hit.similarity * 100)}%`,
    truncateForPrompt(hit.content),
  ].join('\n');
}

function formatHistory(history: RagHistoryMessage[]): string {
  if (history.length === 0) return '없음';
  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => `${message.role === 'user' ? '사용자' : 'DK Bot'}: ${message.text}`)
    .join('\n');
}

function buildMessages(payload: { question: string; projectName: string; history: RagHistoryMessage[]; hits: RagAnswerHit[] }): AIMessage[] {
  const systemPrompt = [
    '당신은 DK Flow 프로젝트 관리 챗봇입니다.',
    '제공된 검색 근거만 사용해서 한국어로 답변하세요.',
    '근거에 없는 사실은 추측하지 말고, 확인 가능한 범위와 부족한 정보를 구분하세요.',
    '프로젝트 관리자가 바로 행동할 수 있도록 핵심 요약, 관련 항목, 다음 액션을 짧게 제안하세요.',
    '중요한 주장에는 [S1], [S2]처럼 검색 근거 번호를 붙이세요.',
    '마크다운 표는 꼭 필요할 때만 사용하고, 답변은 간결하게 유지하세요.',
  ].join('\n');

  const userPrompt = [
    `프로젝트: ${payload.projectName || '현재 프로젝트'}`,
    '',
    `최근 대화:\n${formatHistory(payload.history)}`,
    '',
    `사용자 질문:\n${payload.question}`,
    '',
    `검색 근거:\n${payload.hits.slice(0, MAX_GENERATED_HITS).map(formatContextBlock).join('\n\n')}`,
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`AI provider error (${response.status}): ${errorText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callClaude(settings: AISettings, messages: AIMessage[]): Promise<string> {
  const systemMsg = messages.find((message) => message.role === 'system');
  const nonSystemMessages = messages.filter((message) => message.role !== 'system');

  const body: Record<string, unknown> = {
    model: settings.model,
    max_tokens: 1600,
    messages: nonSystemMessages.map((message) => ({ role: message.role, content: message.content })),
  };
  if (systemMsg) body.system = systemMsg.content;

  const data = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!data || typeof data !== 'object') return '';
  const content = (data as { content?: Array<{ text?: unknown }> }).content;
  const text = content?.[0]?.text;
  return typeof text === 'string' ? text : '';
}

async function callOpenAI(settings: AISettings, messages: AIMessage[]): Promise<string> {
  const data = await fetchJson('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      max_tokens: 1600,
      temperature: 0.3,
    }),
  });

  if (!data || typeof data !== 'object') return '';
  const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const text = choices?.[0]?.message?.content;
  return typeof text === 'string' ? text : '';
}

async function callGemini(settings: AISettings, messages: AIMessage[]): Promise<string> {
  const systemMsg = messages.find((message) => message.role === 'system');
  const nonSystemMessages = messages.filter((message) => message.role !== 'system');

  const body: Record<string, unknown> = {
    contents: nonSystemMessages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    })),
    generationConfig: { maxOutputTokens: 1600, temperature: 0.3 },
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!data || typeof data !== 'object') return '';
  const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : '';
}

async function callAI(settings: AISettings, messages: AIMessage[]): Promise<string> {
  if (settings.provider === 'claude') return callClaude(settings, messages);
  if (settings.provider === 'gemini') return callGemini(settings, messages);
  return callOpenAI(settings, messages);
}

function isHistoryMessage(value: unknown): value is RagHistoryMessage {
  if (!value || typeof value !== 'object') return false;
  const item = value as { role?: unknown; text?: unknown };
  return (item.role === 'assistant' || item.role === 'user') && typeof item.text === 'string';
}

function isRagHit(value: unknown): value is RagAnswerHit {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RagAnswerHit>;
  return (
    typeof item.sourceType === 'string' &&
    typeof item.sourceId === 'string' &&
    typeof item.title === 'string' &&
    typeof item.content === 'string' &&
    typeof item.similarity === 'number'
  );
}

function parsePayload(payload: RagAnswerRequest): { question: string; projectName: string; history: RagHistoryMessage[]; hits: RagAnswerHit[] } | string {
  if (typeof payload.question !== 'string' || payload.question.trim().length < 2) {
    return 'question must be a string with at least 2 characters';
  }

  if (!Array.isArray(payload.hits) || payload.hits.length === 0 || !payload.hits.every(isRagHit)) {
    return 'hits must be a non-empty array of RAG search results';
  }

  const history = Array.isArray(payload.history)
    ? payload.history.filter(isHistoryMessage)
    : [];

  return {
    question: payload.question.trim(),
    projectName: typeof payload.projectName === 'string' ? payload.projectName : '',
    history,
    hits: payload.hits.slice(0, MAX_GENERATED_HITS),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const settings = loadAISettings();
  if (!settings) {
    return jsonResponse({ error: 'AI provider is not configured on the Edge Function' }, 501);
  }

  let payload: RagAnswerRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = parsePayload(payload);
  if (typeof parsed === 'string') {
    return jsonResponse({ error: parsed }, 400);
  }

  try {
    const answer = (await callAI(settings, buildMessages(parsed))).trim();
    if (!answer) {
      return jsonResponse({ error: 'AI provider returned an empty answer' }, 502);
    }
    return jsonResponse({ answer, provider: settings.provider, model: settings.model });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `RAG answer generation failed: ${message}` }, 500);
  }
});
