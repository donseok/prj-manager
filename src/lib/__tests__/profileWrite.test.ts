import { describe, it, expect, vi, beforeEach } from 'vitest';

// 회귀 테스트: 관리자 승인(계정 상태 변경)이 실제 DB에 반영되지 않았는데도
// 성공으로 보고되어, 재조회 시 '승인대기'로 되돌아가는 버그를 막는다.
//
// supabase 클라이언트는 모듈 로드 시점에 createClient로 한 번 생성되므로,
// @supabase/supabase-js 를 mock 하고 env 를 stub 한 뒤 resetModules + 동적 import 한다.

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  // 직접 .update().eq().select() 폴백 경로가 resolve 하는 값
  update: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (name: string, params: unknown) => mocks.rpc(name, params),
    from: () => ({
      update: () => ({
        eq: () => {
          // 구버전 코드: .eq() 결과를 그대로 await (select 없음)
          // 신버전 코드: .eq().select('id') 로 반영된 행을 회수
          const resolved = Promise.resolve(mocks.update({ withSelect: false }));
          return {
            select: () => mocks.update({ withSelect: true }),
            then: resolved.then.bind(resolved),
            catch: resolved.catch.bind(resolved),
          };
        },
      }),
    }),
  }),
}));

async function loadSupabase() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  vi.resetModules();
  return import('../supabase');
}

const RPC_MISSING = {
  data: null,
  error: { message: 'function public.admin_update_account_status does not exist' },
};

describe('updateAccountStatus — 승인이 실제 반영되지 않으면 실패로 보고', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.update.mockReset();
    vi.unstubAllEnvs();
  });

  it('RPC 미설치 + 직접 업데이트가 0건 반영(RLS 차단)이면 에러를 반환해야 한다', async () => {
    mocks.rpc.mockResolvedValue(RPC_MISSING);
    // RLS 로 행이 걸러져 0건만 매칭 — supabase 는 에러 없이 빈 배열을 돌려준다
    mocks.update.mockResolvedValue({ data: [], error: null });

    const { updateAccountStatus } = await loadSupabase();
    const result = await updateAccountStatus('other-user-id', 'active');

    expect(result.error).not.toBeNull();
  });

  it('admin RPC 가 성공하면 승인 성공으로 보고하고 직접 업데이트는 호출하지 않는다', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    const { updateAccountStatus } = await loadSupabase();
    const result = await updateAccountStatus('other-user-id', 'active');

    expect(result.error).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith(
      'admin_update_account_status',
      expect.objectContaining({ target_user_id: 'other-user-id', new_status: 'active' })
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('RPC 미설치 + 직접 업데이트가 1건 반영되면 성공으로 보고한다', async () => {
    mocks.rpc.mockResolvedValue(RPC_MISSING);
    mocks.update.mockResolvedValue({ data: [{ id: 'other-user-id' }], error: null });

    const { updateAccountStatus } = await loadSupabase();
    const result = await updateAccountStatus('other-user-id', 'active');

    expect(result.error).toBeNull();
  });
});
