-- 챗봇 RAG용 임베딩 저장 테이블 (OpenAI text-embedding-3-small 1536차원)
-- 프로젝트/작업/멤버 데이터를 벡터화하여 의미 기반 검색을 가능하게 함

create extension if not exists vector;

create table if not exists public.chatbot_embeddings (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  source_type text not null check (source_type in ('project', 'task', 'member')),
  source_id text not null,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_chatbot_embeddings_source
  on public.chatbot_embeddings (project_id, source_type, source_id);
create index if not exists idx_chatbot_embeddings_project
  on public.chatbot_embeddings (project_id);
create index if not exists idx_chatbot_embeddings_vector
  on public.chatbot_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.chatbot_embeddings enable row level security;

create policy "chatbot_embeddings_select" on public.chatbot_embeddings
  for select to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = chatbot_embeddings.project_id
        and pm.user_id = auth.uid()
    )
    or is_admin()
  );

create policy "chatbot_embeddings_insert" on public.chatbot_embeddings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = chatbot_embeddings.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or is_admin()
  );

create policy "chatbot_embeddings_update" on public.chatbot_embeddings
  for update to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = chatbot_embeddings.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or is_admin()
  );

create policy "chatbot_embeddings_delete" on public.chatbot_embeddings
  for delete to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = chatbot_embeddings.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or is_admin()
  );

-- 유사도 검색 RPC (project_id 스코프, 코사인 거리)
create or replace function public.match_chatbot_embeddings(
  query_embedding vector(1536),
  p_project_id text,
  match_count int default 5,
  min_similarity float default 0.3
)
returns table (
  id text,
  source_type text,
  source_id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    ce.id,
    ce.source_type,
    ce.source_id,
    ce.content,
    ce.metadata,
    1 - (ce.embedding <=> query_embedding) as similarity
  from public.chatbot_embeddings ce
  where ce.project_id = p_project_id
    and 1 - (ce.embedding <=> query_embedding) >= min_similarity
  order by ce.embedding <=> query_embedding
  limit match_count;
$$;
