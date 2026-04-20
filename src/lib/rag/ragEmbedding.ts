import type { AISettings } from '../../types';

const EMBEDDING_DIM = 1536;
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_EMBEDDING_ENDPOINT = 'https://api.openai.com/v1/embeddings';
const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const GEMINI_BATCH_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`;
const TIMEOUT_MS = 60_000;
const BATCH_SIZE = 96;

export const RAG_EMBEDDING_MODEL = OPENAI_EMBEDDING_MODEL;
export const RAG_EMBEDDING_DIM = EMBEDDING_DIM;

interface OpenAIEmbeddingResponse {
  data: Array<{ index: number; embedding: number[] }>;
}

interface GeminiBatchEmbeddingResponse {
  embeddings: Array<{ values: number[] }>;
}

async function callOpenAIEmbedding(apiKey: string, input: string[]): Promise<number[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenAI embedding API error (${response.status}): ${errorText}`);
    }

    const data: OpenAIEmbeddingResponse = await response.json();
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    return ordered.map((item) => item.embedding);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGeminiEmbedding(apiKey: string, input: string[]): Promise<number[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = {
      requests: input.map((text) => ({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIM,
      })),
    };
    const response = await fetch(`${GEMINI_BATCH_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini embedding API error (${response.status}): ${errorText}`);
    }

    const data: GeminiBatchEmbeddingResponse = await response.json();
    if (!data.embeddings || data.embeddings.length !== input.length) {
      throw new Error(`Gemini embedding API returned ${data.embeddings?.length ?? 0} vectors for ${input.length} inputs`);
    }
    return data.embeddings.map((e) => e.values);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callEmbedding(settings: AISettings, input: string[]): Promise<number[][]> {
  if (settings.provider === 'openai') {
    return callOpenAIEmbedding(settings.apiKey, input);
  }
  if (settings.provider === 'gemini') {
    return callGeminiEmbedding(settings.apiKey, input);
  }
  throw new Error('RAG 임베딩은 OpenAI 또는 Gemini provider가 필요합니다.');
}

function ensureProviderSupported(settings: AISettings): void {
  if (settings.provider !== 'openai' && settings.provider !== 'gemini') {
    throw new Error('RAG 임베딩은 OpenAI 또는 Gemini provider가 필요합니다.');
  }
  if (!settings.apiKey) {
    throw new Error(`${settings.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API 키가 없습니다.`);
  }
}

export async function embedText(text: string, settings: AISettings): Promise<number[]> {
  ensureProviderSupported(settings);
  const [vec] = await callEmbedding(settings, [text.slice(0, 8000)]);
  return vec;
}

export async function embedBatch(
  texts: string[],
  settings: AISettings,
  onBatchDone?: (done: number, total: number) => void,
): Promise<number[][]> {
  ensureProviderSupported(settings);

  const results: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const chunk = texts.slice(start, start + BATCH_SIZE).map((t) => t.slice(0, 8000));
    const chunkVectors = await callEmbedding(settings, chunk);
    results.push(...chunkVectors);
    onBatchDone?.(Math.min(start + chunk.length, texts.length), texts.length);
  }
  return results;
}
