import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Project, Attendance } from '../../types';

// ─── Test scaffolding ────────────────────────────────────────
// isSupabaseConfigured는 모듈 로드 시점에 const로 한 번 계산되므로, 두 분기를
// 모두 검증하려면 vi.mock으로 ../supabase를 대체하고 vi.resetModules로
// dataRepository를 다시 import 한다. (accessRequests.test.ts 패턴 참고)
//
// vitest 기본 환경이 node라 localStorage가 없으므로, ../utils의 storage를
// 인메모리 Map으로 대체해 로컬 모드 round-trip을 결정적으로 검증한다.

const mockState = { isSupabaseConfigured: false };

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return mockState.isSupabaseConfigured;
  },
  // 로컬 모드 경로는 supabase를 참조하지 않지만, dataRepository의
  // `import { supabase }`가 undefined로 남지 않도록 명시적으로 null을 노출한다.
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
      // 실제 storage가 JSON 직렬화를 거치는 것과 동일하게 깊은 복사하여 보관
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

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    ownerId: 'user-1',
    name: '프로젝트',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 'att-1',
    projectId: 'proj-1',
    memberId: 'mem-1',
    date: '2026-05-30',
    type: 'present',
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

describe('M-2: toProjectRow completed_at 매핑', () => {
  beforeEach(() => {
    vi.resetModules();
    memStore.clear();
  });

  it('completedAt이 undefined면 completed_at: null 을 명시적으로 전송한다 (완료 해제 시 stale 값 제거)', async () => {
    const { toProjectRow } = await import('../dataRepository');
    const row = toProjectRow(makeProject({ status: 'active', completedAt: undefined }));
    // 키가 빠지면 안 된다 — UPDATE 경로에서 빠지면 Supabase가 stale 값을 유지함
    expect('completed_at' in row).toBe(true);
    expect(row.completed_at).toBeNull();
  });

  it('completedAt이 있으면 그 값을 그대로 전송한다', async () => {
    const { toProjectRow } = await import('../dataRepository');
    const row = toProjectRow(
      makeProject({ status: 'completed', completedAt: '2026-05-30T12:00:00.000Z' }),
    );
    expect(row.completed_at).toBe('2026-05-30T12:00:00.000Z');
  });
});

describe('M-3: Local Mode 근태 (attendance) 그레이스풀 동작', () => {
  beforeEach(() => {
    vi.resetModules();
    memStore.clear();
    mockState.isSupabaseConfigured = false;
  });

  it('loadAttendances는 저장된 값이 없으면 빈 배열을 반환한다 (null supabase 역참조 없음)', async () => {
    const { loadAttendances } = await import('../dataRepository');
    await expect(loadAttendances('proj-1')).resolves.toEqual([]);
  });

  it('upsertAttendance는 localStorage에 기록하고 그 객체를 반환한다', async () => {
    const { upsertAttendance, loadAttendances } = await import('../dataRepository');
    const a = makeAttendance();
    const returned = await upsertAttendance(a);
    expect(returned).toEqual(a);
    await expect(loadAttendances('proj-1')).resolves.toEqual([a]);
  });

  it('upsertAttendance는 같은 id를 갱신(upsert)한다 (중복 추가 안 함)', async () => {
    const { upsertAttendance, loadAttendances } = await import('../dataRepository');
    await upsertAttendance(makeAttendance({ type: 'present' }));
    await upsertAttendance(makeAttendance({ type: 'sick_leave' }));
    const list = await loadAttendances('proj-1');
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('sick_leave');
  });

  it("'training'(교육) 유형도 저장/로드가 왕복된다", async () => {
    const { upsertAttendance, loadAttendances } = await import('../dataRepository');
    await upsertAttendance(makeAttendance({ type: 'training' }));
    const list = await loadAttendances('proj-1');
    expect(list[0].type).toBe('training');
  });

  it('deleteAttendanceById는 projectId 키로 해당 항목만 제거한다', async () => {
    const { upsertAttendance, deleteAttendanceById, loadAttendances } = await import(
      '../dataRepository'
    );
    await upsertAttendance(makeAttendance({ id: 'att-1' }));
    await upsertAttendance(makeAttendance({ id: 'att-2' }));
    await deleteAttendanceById('proj-1', 'att-1');
    const list = await loadAttendances('proj-1');
    expect(list.map((a) => a.id)).toEqual(['att-2']);
  });

  it('근태는 projectId별로 스코프된다 (다른 프로젝트와 섞이지 않음)', async () => {
    const { upsertAttendance, loadAttendances } = await import('../dataRepository');
    await upsertAttendance(makeAttendance({ id: 'a', projectId: 'proj-1' }));
    await upsertAttendance(makeAttendance({ id: 'b', projectId: 'proj-2' }));
    await expect(loadAttendances('proj-1')).resolves.toHaveLength(1);
    await expect(loadAttendances('proj-2')).resolves.toHaveLength(1);
  });
});

describe('L-1: Local Mode loadOwnedProjectIds', () => {
  beforeEach(() => {
    vi.resetModules();
    memStore.clear();
    mockState.isSupabaseConfigured = false;
  });

  it('Supabase 미설정 시 null supabase를 역참조하지 않고 소유 프로젝트 ID를 반환한다', async () => {
    const { loadOwnedProjectIds } = await import('../dataRepository');
    memStore.set('dk_projects', [
      makeProject({ id: 'p1', ownerId: 'user-1' }),
      makeProject({ id: 'p2', ownerId: 'user-2' }),
      makeProject({ id: 'p3', ownerId: 'user-1', status: 'deleted' }),
    ]);
    const ids = await loadOwnedProjectIds('user-1');
    // p1만 (p2는 타인 소유, p3는 삭제됨)
    expect(ids).toEqual(['p1']);
  });

  it('저장된 프로젝트가 없으면 빈 배열을 반환한다', async () => {
    const { loadOwnedProjectIds } = await import('../dataRepository');
    await expect(loadOwnedProjectIds('user-1')).resolves.toEqual([]);
  });
});
