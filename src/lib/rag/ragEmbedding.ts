import { isSupabaseConfigured, supabase } from '../supabase';

// Supabase Edge Runtime 내장 모델(gte-small)을 사용한다. 외부 API 키는 필요 없다.
const EMBEDDING_DIM = 384;
const MODEL_NAME = 'gte-small';
const BATCH_SIZE = 16;
const MAX_CHARS = 8000;

export const RAG_EMBEDDING_MODEL = MODEL_NAME;
export const RAG_EMBEDDING_DIM = EMBEDDING_DIM;
export const RAG_EMBEDDING_PROVIDER = 'supabase-gte-small';

interface EmbedResponse {
  embeddings?: number[][];
  error?: string;
}

async function callEdgeEmbed(inputs: string[]): Promise<number[][]> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되지 않았습니다.');
  }

  const { data, error } = await supabase.functions.invoke<EmbedResponse>('embed', {
    body: { inputs },
  });

  if (error) {
    throw new Error(`임베딩 Edge Function 호출 실패: ${error.message}`);
  }
  if (!data || !Array.isArray(data.embeddings)) {
    throw new Error(`임베딩 응답 형식 오류: ${data?.error ?? '알 수 없는 오류'}`);
  }
  if (data.embeddings.length !== inputs.length) {
    throw new Error(
      `임베딩 개수 불일치: ${data.embeddings.length}/${inputs.length}`,
    );
  }
  return data.embeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await callEdgeEmbed([text.slice(0, MAX_CHARS)]);
  return vec;
}

export async function embedBatch(
  texts: string[],
  onBatchDone?: (done: number, total: number) => void,
): Promise<number[][]> {
  const results: number[][] = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const chunk = texts
      .slice(start, start + BATCH_SIZE)
      .map((t) => t.slice(0, MAX_CHARS));
    const vectors = await callEdgeEmbed(chunk);
    results.push(...vectors);
    onBatchDone?.(Math.min(start + chunk.length, texts.length), texts.length);
  }
  return results;
}
