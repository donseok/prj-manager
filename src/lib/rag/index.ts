import { isSupabaseConfigured } from '../supabase';

export {
  embedText,
  embedBatch,
  RAG_EMBEDDING_MODEL,
  RAG_EMBEDDING_DIM,
  RAG_EMBEDDING_PROVIDER,
} from './ragEmbedding';
export {
  buildProjectDoc,
  buildTaskDoc,
  buildMemberDoc,
  buildAllProjectDocs,
  contentHash,
  type RagDocument,
  type RagSourceType,
} from './ragDocumentBuilder';
export {
  reindexProject,
  loadIndexStats,
  loadProjectById,
  type ReindexProgress,
  type ReindexResult,
} from './ragIndexer';
export { searchKnowledgeBase, type RagHit, type SearchOptions } from './ragSearch';
export { answerWithRag } from './ragAnswer';

// API 키 없이 Supabase Edge Function(gte-small) + pgvector만으로 동작한다.
export function isRagReady(): boolean {
  return isSupabaseConfigured;
}
