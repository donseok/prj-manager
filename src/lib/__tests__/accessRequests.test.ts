import { describe, it, expect, vi, beforeEach } from 'vitest';

// isSupabaseConfigured는 모듈 로드 시점에 env에서 한 번 계산되는 const이므로,
// 두 분기를 모두 검증하려면 vi.mock으로 모듈을 대체하고 vi.resetModules로
// accessRequests를 다시 import 해야 한다.
const mockState = { isSupabaseConfigured: false };

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return mockState.isSupabaseConfigured;
  },
}));

// dataRepository는 이 테스트에서 호출되지 않지만 import 체인에 포함되므로 가볍게 모킹
vi.mock('../dataRepository', () => ({
  loadProjectMembers: vi.fn(),
  syncProjectMembers: vi.fn(),
}));

describe('accessRequestDeliverySupported', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('로컬 모드(Supabase 미설정)에서는 전송이 지원된다', async () => {
    mockState.isSupabaseConfigured = false;
    const { accessRequestDeliverySupported } = await import('../accessRequests');
    expect(accessRequestDeliverySupported()).toBe(true);
  });

  it('Supabase(멀티유저) 모드에서는 전송이 아직 지원되지 않는다', async () => {
    mockState.isSupabaseConfigured = true;
    const { accessRequestDeliverySupported } = await import('../accessRequests');
    expect(accessRequestDeliverySupported()).toBe(false);
  });
});
