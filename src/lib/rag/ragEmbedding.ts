import type { AISettings } from '../../types';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const EMBEDDING_ENDPOINT = 'https://api.openai.com/v1/embeddings';
const TIMEOUT_MS = 60_000;
const BATCH_SIZE = 96;

export const RAG_EMBEDDING_MODEL = EMBEDDING_MODEL;
export const RAG_EMBEDDING_DIM = EMBEDDING_DIM;

interface OpenAIEmbeddingResponse {
  data: Array<{ index: number; embedding: number[] }>;
}

async function callEmbedding(apiKey: string, input: string[]): Promise<number[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(EMBEDDING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
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

export async function embedText(text: string, settings: AISettings): Promise<number[]> {
  if (settings.provider !== 'openai') {
    throw new Error('RAG 임베딩은 OpenAI provider 설정이 필요합니다.');
  }
  if (!settings.apiKey) {
    throw new Error('OpenAI API 키가 없습니다.');
  }
  const [vec] = await callEmbedding(settings.apiKey, [text.slice(0, 8000)]);
  return vec;
}

export async function embedBatch(
  texts: string[],
  settings: AISettings,
  onBatchDone?: (done: number, total: number) => void,
): Promise<number[][]> {
  if (settings.provider !== 'openai') {
    throw new Error('RAG 임베딩은 OpenAI provider 설정이 필요합니다.');
  }
  if (!settings.apiKey) {
    throw new Error('OpenAI API 키가 없습니다.');
  }

  const results: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const chunk = texts.slice(start, start + BATCH_SIZE).map((t) => t.slice(0, 8000));
    const chunkVectors = await callEmbedding(settings.apiKey, chunk);
    results.push(...chunkVectors);
    onBatchDone?.(Math.min(start + chunk.length, texts.length), texts.length);
  }
  return results;
}
