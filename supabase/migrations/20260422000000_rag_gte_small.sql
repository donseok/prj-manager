-- 챗봇 RAG 임베딩을 Supabase Edge Runtime 내장 모델(gte-small, 384차원)로 전환.
-- 기존 1536차원(OpenAI/Gemini) 벡터와 호환되지 않으므로 전체 삭제 후 재인덱싱 필요.
-- 외부 LLM API 키 없이 pgvector만으로 의미 검색이 동작한다.

-- 1) 기존 벡터 인덱스 드롭 (차원 변경 전 필수)
drop index if exists public.idx_chatbot_embeddings_vector;

-- 2) 기존 RPC 드롭 (시그니처의 vector 타입 차원 변경 필요)
drop function if exists public.match_chatbot_embeddings(vector, text, int, float);

-- 3) 기존 행 제거 (벡터 공간이 달라 검색 결과가 무의미해짐)
delete from public.chatbot_embeddings;

-- 4) 컬럼 차원 변경: vector(1536) → vector(384)
alter table public.chatbot_embeddings
  alter column embedding type vector(384);

-- 5) HNSW 인덱스 재생성
create index if not exists idx_chatbot_embeddings_vector
  on public.chatbot_embeddings using hnsw (embedding vector_cosine_ops);

-- 6) 유사도 검색 RPC 재생성 (384차원 기준)
create function public.match_chatbot_embeddings(
  query_embedding vector(384),
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

-- 7) 권한 재부여
grant execute on function public.match_chatbot_embeddings(vector, text, int, float)
  to anon, authenticated, service_role;
