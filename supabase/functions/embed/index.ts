// Supabase Edge Function: gte-small 임베딩 생성 (384차원)
// 외부 API 키 없이 Edge Runtime 내장 AI 세션을 사용한다.
// 배포: `supabase functions deploy embed`

// deno-lint-ignore-file no-explicit-any
declare const Deno: any;
declare const Supabase: any;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const session = new Supabase.ai.Session('gte-small');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let payload: { inputs?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const inputs = payload.inputs;
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return jsonResponse({ error: 'inputs must be a non-empty array of strings' }, 400);
  }
  if (inputs.some((v) => typeof v !== 'string')) {
    return jsonResponse({ error: 'inputs must contain only strings' }, 400);
  }

  try {
    const embeddings: number[][] = [];
    for (const text of inputs as string[]) {
      const vec = await session.run(text, { mean_pool: true, normalize: true });
      embeddings.push(vec as number[]);
    }
    return jsonResponse({ embeddings, model: 'gte-small', dim: 384 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Embedding failed: ${message}` }, 500);
  }
});
