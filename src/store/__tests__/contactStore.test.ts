import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Contact } from '../../types';

const repo = {
  loadContacts: vi.fn(),
  upsertContact: vi.fn(),
  deleteContactById: vi.fn(),
};
vi.mock('../../lib/dataRepository', () => ({
  loadContacts: (...a: unknown[]) => repo.loadContacts(...a),
  upsertContact: (...a: unknown[]) => repo.upsertContact(...a),
  deleteContactById: (...a: unknown[]) => repo.deleteContactById(...a),
}));

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1', name: '홍길동', tags: [], linkedProjectIds: [],
    createdBy: 'u1', createdAt: 't', updatedAt: 't', ...overrides,
  };
}

describe('useContactStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useContactStore } = await import('../contactStore');
    useContactStore.setState({ contacts: [], isLoading: false });
  });

  it('loadContacts가 repository 결과로 상태를 채운다', async () => {
    repo.loadContacts.mockResolvedValue([makeContact()]);
    const { useContactStore } = await import('../contactStore');
    await useContactStore.getState().loadContacts();
    expect(useContactStore.getState().contacts).toHaveLength(1);
    expect(useContactStore.getState().isLoading).toBe(false);
  });

  it('saveContact가 신규 명함을 낙관적으로 추가하고 저장 결과로 교체한다', async () => {
    const saved = makeContact({ name: '저장됨' });
    repo.upsertContact.mockResolvedValue(saved);
    const { useContactStore } = await import('../contactStore');
    await useContactStore.getState().saveContact(makeContact());
    expect(useContactStore.getState().contacts[0].name).toBe('저장됨');
  });

  it('saveContact 실패 시 이전 상태로 롤백하고 에러를 전파한다', async () => {
    repo.upsertContact.mockRejectedValue(new Error('boom'));
    const { useContactStore } = await import('../contactStore');
    await expect(useContactStore.getState().saveContact(makeContact())).rejects.toThrow('boom');
    expect(useContactStore.getState().contacts).toHaveLength(0);
  });

  it('removeContact가 낙관적으로 제거하고 실패 시 롤백한다', async () => {
    const { useContactStore } = await import('../contactStore');
    useContactStore.setState({ contacts: [makeContact()], isLoading: false });
    repo.deleteContactById.mockRejectedValue(new Error('del-fail'));
    await expect(useContactStore.getState().removeContact('c1')).rejects.toThrow('del-fail');
    expect(useContactStore.getState().contacts).toHaveLength(1);
  });
});
