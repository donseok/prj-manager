import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '../../types';

// ─── Test scaffolding ────────────────────────────────────────
// syncProjectTasks의 데이터 유실 가드(빈 목록 저장이 프로젝트 작업 전체를
// DELETE 하지 못하게 막는 분기)를 Supabase 모드에서 검증한다.
//
// supabase 쿼리 빌더를 체이너블 목으로 대체하고, 어떤 쿼리(upsert / select-count /
// delete.eq('project_id') / delete.in('id'))가 호출됐는지 기록한다.

interface QueryCalls {
  upsert: number;
  selectCountHead: number;
  deleteEqProjectId: number;
  deleteInIds: number;
}

const calls: QueryCalls = { upsert: 0, selectCountHead: 0, deleteEqProjectId: 0, deleteInIds: 0 };
// 정리(cleanup) SELECT가 반환할 원격 행 / count head가 반환할 개수
const remote = { rows: [] as { id: string }[], count: 0 };

function resetMock() {
  calls.upsert = 0;
  calls.selectCountHead = 0;
  calls.deleteEqProjectId = 0;
  calls.deleteInIds = 0;
  remote.rows = [];
  remote.count = 0;
}

const mockState = { isSupabaseConfigured: true };

vi.mock('../supabase', () => ({
  get isSupabaseConfigured() {
    return mockState.isSupabaseConfigured;
  },
  supabase: {
    from() {
      return {
        upsert() {
          calls.upsert++;
          return Promise.resolve({ error: null });
        },
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.head) {
            // 빈 목록 보존 분기의 count 조회
            return {
              eq() {
                calls.selectCountHead++;
                return Promise.resolve({ count: remote.count, error: null });
              },
            };
          }
          // 정리(cleanup)용 기존 행 조회
          return {
            eq() {
              return Promise.resolve({ data: remote.rows, error: null });
            },
          };
        },
        delete() {
          return {
            eq(col: string) {
              if (col === 'project_id') calls.deleteEqProjectId++;
              return Promise.resolve({ error: null, count: 0 });
            },
            in() {
              calls.deleteInIds++;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  },
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'proj-1',
    parentId: null,
    level: 1,
    orderIndex: 0,
    name: '작업',
    weight: 1,
    planStart: null,
    planEnd: null,
    planProgress: 0,
    actualStart: null,
    actualEnd: null,
    actualProgress: 0,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('syncProjectTasks 데이터 유실 가드 (빈 목록 → 전체 삭제 방지)', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMock();
    mockState.isSupabaseConfigured = true;
  });

  it('빈 목록을 옵션 없이 저장하면 프로젝트 작업을 삭제하지 않는다 (기존 원격 작업 보존)', async () => {
    remote.count = 42; // 원격에 작업 42건 존재
    const { syncProjectTasks } = await import('../dataRepository');

    await syncProjectTasks('proj-1', []);

    // 핵심: delete().eq('project_id', ...) 가 절대 호출되지 않아야 한다
    expect(calls.deleteEqProjectId).toBe(0);
    // 보존 분기에서 count만 조회 (경고 로그용)
    expect(calls.selectCountHead).toBe(1);
    expect(calls.upsert).toBe(0);
  });

  it('빈 목록이라도 allowFullClear:true 면 의도적으로 전체 삭제한다', async () => {
    const { syncProjectTasks } = await import('../dataRepository');

    await syncProjectTasks('proj-1', [], { allowFullClear: true });

    expect(calls.deleteEqProjectId).toBe(1);
    // 의도적 전체삭제 경로에서는 count 조회를 하지 않는다
    expect(calls.selectCountHead).toBe(0);
  });

  it('비어있지 않은 목록은 정상적으로 upsert 한다 (전체 삭제 분기로 새지 않음)', async () => {
    const { syncProjectTasks } = await import('../dataRepository');

    await syncProjectTasks('proj-1', [makeTask({ id: 't1' }), makeTask({ id: 't2', level: 2 })]);

    expect(calls.upsert).toBe(1);
    // 정상 저장은 절대 프로젝트 전체 삭제를 호출하지 않는다
    expect(calls.deleteEqProjectId).toBe(0);
  });

  it('비어있지 않은 목록 저장 시 인메모리에 없는 원격 행만 정리(delete.in)한다', async () => {
    remote.rows = [{ id: 't1' }, { id: 't2' }, { id: 'stale' }];
    const { syncProjectTasks } = await import('../dataRepository');

    await syncProjectTasks('proj-1', [makeTask({ id: 't1' }), makeTask({ id: 't2', level: 2 })]);

    // stale 1건만 정리 대상 → delete.in 1회, 전체삭제는 0회
    expect(calls.deleteInIds).toBe(1);
    expect(calls.deleteEqProjectId).toBe(0);
  });
});
