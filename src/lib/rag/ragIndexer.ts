import type { AISettings, Project, ProjectMember, Task } from '../../types';
import { supabase, isSupabaseConfigured } from '../supabase';
import { loadProjectMembers, loadProjectTasks } from '../dataRepository';
import { generateId } from '../utils';
import { embedBatch } from './ragEmbedding';
import { buildAllProjectDocs, type RagDocument } from './ragDocumentBuilder';

export interface ReindexProgress {
  phase: 'loading' | 'diffing' | 'embedding' | 'upserting' | 'cleaning' | 'done';
  current: number;
  total: number;
  message: string;
}

export interface ReindexResult {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
  total: number;
}

interface ExistingRow {
  id: string;
  source_type: string;
  source_id: string;
  content_hash: string;
  metadata: Record<string, unknown> | null;
}

function vectorToLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

async function loadProjectById(projectId: string): Promise<Project | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('projects')
    .select('id, owner_id, name, description, start_date, end_date, base_date, status, completed_at, settings, created_at, updated_at')
    .eq('id', projectId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    description: data.description || undefined,
    startDate: data.start_date || undefined,
    endDate: data.end_date || undefined,
    baseDate: data.base_date || undefined,
    status: data.status,
    completedAt: data.completed_at || undefined,
    settings: data.settings || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function reindexProject(
  project: Project,
  settings: AISettings,
  options?: { onProgress?: (p: ReindexProgress) => void; membersOverride?: ProjectMember[]; tasksOverride?: Task[] },
): Promise<ReindexResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되지 않았습니다.');
  }
  if ((settings.provider !== 'openai' && settings.provider !== 'gemini') || !settings.apiKey) {
    throw new Error('RAG 인덱싱은 OpenAI 또는 Gemini API 키가 필요합니다.');
  }

  const onProgress = options?.onProgress;

  onProgress?.({ phase: 'loading', current: 0, total: 0, message: '프로젝트 데이터 로딩 중…' });
  const [members, tasks] = await Promise.all([
    options?.membersOverride ? Promise.resolve(options.membersOverride) : loadProjectMembers(project.id),
    options?.tasksOverride ? Promise.resolve(options.tasksOverride) : loadProjectTasks(project.id),
  ]);

  const docs = buildAllProjectDocs(project, tasks, members);

  onProgress?.({ phase: 'diffing', current: 0, total: docs.length, message: '기존 인덱스 비교 중…' });
  const { data: existingRaw, error: fetchError } = await supabase
    .from('chatbot_embeddings')
    .select('id, source_type, source_id, content_hash, metadata')
    .eq('project_id', project.id);

  if (fetchError) {
    throw new Error(`기존 인덱스 조회 실패: ${fetchError.message}`);
  }

  const existing = new Map<string, ExistingRow>();
  for (const row of (existingRaw || []) as ExistingRow[]) {
    existing.set(`${row.source_type}:${row.source_id}`, row);
  }

  const toEmbed: RagDocument[] = [];
  const toEmbedIds: string[] = [];
  const toEmbedIsNew: boolean[] = [];
  let unchanged = 0;

  const currentProvider = settings.provider;
  for (const doc of docs) {
    const key = `${doc.sourceType}:${doc.sourceId}`;
    const prior = existing.get(key);
    const priorProvider = (prior?.metadata as { embedding_provider?: string } | null)?.embedding_provider;
    if (prior && prior.content_hash === doc.contentHash && priorProvider === currentProvider) {
      unchanged++;
      existing.delete(key);
      continue;
    }
    toEmbed.push(doc);
    toEmbedIds.push(prior?.id || generateId());
    toEmbedIsNew.push(!prior);
    existing.delete(key);
  }

  const toDeleteIds = Array.from(existing.values()).map((row) => row.id);

  let added = 0;
  let updated = 0;

  if (toEmbed.length > 0) {
    onProgress?.({
      phase: 'embedding',
      current: 0,
      total: toEmbed.length,
      message: `임베딩 생성 중 (0/${toEmbed.length})`,
    });

    const vectors = await embedBatch(
      toEmbed.map((d) => d.content),
      settings,
      (done, total) => {
        onProgress?.({
          phase: 'embedding',
          current: done,
          total,
          message: `임베딩 생성 중 (${done}/${total})`,
        });
      },
    );

    onProgress?.({
      phase: 'upserting',
      current: 0,
      total: toEmbed.length,
      message: 'DB 저장 중…',
    });

    const rows = toEmbed.map((doc, idx) => ({
      id: toEmbedIds[idx],
      project_id: project.id,
      source_type: doc.sourceType,
      source_id: doc.sourceId,
      content: doc.content,
      embedding: vectorToLiteral(vectors[idx]),
      metadata: { ...doc.metadata, embedding_provider: currentProvider },
      content_hash: doc.contentHash,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from('chatbot_embeddings')
      .upsert(rows, { onConflict: 'project_id,source_type,source_id' });

    if (upsertError) {
      throw new Error(`임베딩 저장 실패: ${upsertError.message}`);
    }

    added = toEmbedIsNew.filter(Boolean).length;
    updated = toEmbed.length - added;
  }

  if (toDeleteIds.length > 0) {
    onProgress?.({
      phase: 'cleaning',
      current: 0,
      total: toDeleteIds.length,
      message: `오래된 인덱스 ${toDeleteIds.length}건 삭제 중…`,
    });
    const { error: deleteError } = await supabase
      .from('chatbot_embeddings')
      .delete()
      .in('id', toDeleteIds);
    if (deleteError) {
      throw new Error(`오래된 인덱스 삭제 실패: ${deleteError.message}`);
    }
  }

  const result: ReindexResult = {
    added,
    updated,
    deleted: toDeleteIds.length,
    unchanged,
    total: docs.length,
  };

  onProgress?.({
    phase: 'done',
    current: docs.length,
    total: docs.length,
    message: `완료: 신규 ${added} / 갱신 ${updated} / 삭제 ${result.deleted} / 유지 ${unchanged}`,
  });

  return result;
}

export async function loadIndexStats(projectId: string): Promise<{ count: number; lastUpdatedAt: string | null }> {
  if (!isSupabaseConfigured) return { count: 0, lastUpdatedAt: null };

  const { count, error: countError } = await supabase
    .from('chatbot_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (countError) return { count: 0, lastUpdatedAt: null };

  const { data: latestRow } = await supabase
    .from('chatbot_embeddings')
    .select('updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    count: count ?? 0,
    lastUpdatedAt: (latestRow?.updated_at as string | undefined) || null,
  };
}

export { loadProjectById };
