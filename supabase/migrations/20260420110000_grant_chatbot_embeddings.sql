-- chatbot_embeddings 테이블/RPC에 PostgREST 접근 grant 추가
-- (RLS는 이미 활성화되어 있어 실제 행 접근은 기존 정책이 제어)

grant select, insert, update, delete on public.chatbot_embeddings to anon, authenticated, service_role;

grant execute on function public.match_chatbot_embeddings(vector, text, int, float)
  to anon, authenticated, service_role;
