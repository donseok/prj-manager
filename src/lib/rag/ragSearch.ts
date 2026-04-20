import { isSupabaseConfigured, supabase } from '../supabase';
import { embedText } from './ragEmbedding';
import type { RagSourceType } from './ragDocumentBuilder';

export interface RagHit {
  id: string;
  sourceType: RagSourceType;
  sourceId: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  topK?: number;
  minSimilarity?: number;
}

export async function searchKnowledgeBase(
  question: string,
  projectId: string,
  options: SearchOptions = {},
): Promise<RagHit[]> {
  if (!isSupabaseConfigured) return [];

  const { topK = 5, minSimilarity = 0.3 } = options;
  const vec = await embedText(question);

  const { data, error } = await supabase.rpc('match_chatbot_embeddings', {
    query_embedding: vec,
    p_project_id: projectId,
    match_count: topK,
    min_similarity: minSimilarity,
  });

  if (error) {
    throw new Error(`지식베이스 검색 실패: ${error.message}`);
  }

  return ((data || []) as Array<{
    id: string;
    source_type: string;
    source_id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>).map((row) => ({
    id: row.id,
    sourceType: row.source_type as RagSourceType,
    sourceId: row.source_id,
    content: row.content,
    similarity: row.similarity,
    metadata: row.metadata || {},
  }));
}
