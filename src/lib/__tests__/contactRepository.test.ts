import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Contact } from '../../types';

// ─── Test scaffolding ────────────────────────────────────────
// dataRepository.test.ts 패턴 복제: isSupabaseConfigured는 모듈 로드 시점에
// 계산되므로 ../supabase를 vi.mock으로 대체하고, vitest 기본 환경이 node라
// localStorage가 없으므로 ../utils의 storage를 인메모리 Map으로 대체한다.

const mockState = { isSupabaseConfigured: false };

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return mockState.isSupabaseConfigured;
  },
  supabase: null,
}));

// 인메모리 localStorage 대체
const memStore = new Map<string, unknown>();
vi.mock('../utils', () => ({
  storage: {
    get<T>(key: string, def: T): T {
      return memStore.has(key) ? (memStore.get(key) as T) : def;
    },
    set<T>(key: string, value: T): void {
      memStore.set(key, JSON.parse(JSON.stringify(value)));
    },
    remove(key: string): void {
      memStore.delete(key);
    },
    has(key: string): boolean {
      return memStore.has(key);
    },
  },
}));

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1',
    name: '홍길동',
    company: '대광',
    tags: ['고객'],
    linkedProjectIds: ['p1'],
    createdBy: 'u1',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('contact Row 매핑', () => {
  beforeEach(() => {
    vi.resetModules();
    memStore.clear();
  });

  it('toContactRow → mapContactRow 라운드트립이 값을 보존한다', async () => {
    const { toContactRow, mapContactRow } = await import('../dataRepository');
    const contact = makeContact({ email: 'a@b.com', memo: undefined, title: '' });
    const restored = mapContactRow(toContactRow(contact));
    expect(restored.name).toBe('홍길동');
    expect(restored.email).toBe('a@b.com');
    expect(restored.tags).toEqual(['고객']);
    expect(restored.linkedProjectIds).toEqual(['p1']);
    // 빈 문자열/undefined 선택 필드는 undefined로 정규화된다
    expect(restored.title).toBeUndefined();
    expect(restored.memo).toBeUndefined();
  });

  it('null 배열 컬럼은 빈 배열로 매핑된다', async () => {
    const { mapContactRow } = await import('../dataRepository');
    const restored = mapContactRow({
      id: 'c2', name: 'A', company: null, department: null, title: null,
      mobile: null, phone: null, fax: null, email: null, address: null,
      website: null, tags: null, memo: null, card_image: null,
      linked_project_ids: null, created_by: null,
      created_at: 'x', updated_at: 'y',
    });
    expect(restored.tags).toEqual([]);
    expect(restored.linkedProjectIds).toEqual([]);
    expect(restored.createdBy).toBe('');
  });
});

describe('contact 로컬 폴백 CRUD', () => {
  beforeEach(() => {
    vi.resetModules();
    memStore.clear();
    mockState.isSupabaseConfigured = false;
  });

  it('upsert → load → delete 가 로컬스토리지에서 동작한다', async () => {
    const { upsertContact, loadContacts, deleteContactById } = await import('../dataRepository');
    await upsertContact(makeContact());
    let list = await loadContacts();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('홍길동');

    await upsertContact(makeContact({ name: '김철수' }));
    list = await loadContacts();
    expect(list).toHaveLength(1); // 같은 id면 교체
    expect(list[0].name).toBe('김철수');

    await deleteContactById('c1');
    list = await loadContacts();
    expect(list).toHaveLength(0);
  });
});
