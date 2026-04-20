import type { AISettings } from '../../types';
import { isSupabaseConfigured } from '../supabase';

export { embedText, embedBatch, RAG_EMBEDDING_MODEL, RAG_EMBEDDING_DIM } from './ragEmbedding';
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

export function isRagReady(settings: AISettings): boolean {
  return isSupabaseConfigured && settings.provider === 'openai' && !!settings.apiKey;
}
