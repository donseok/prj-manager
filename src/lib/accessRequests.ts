import type {
  ProjectAccessRequest,
  ProjectMember,
  AccessRequestScope,
  AccessRequestStatus,
} from '../types';
import { storage } from './utils';
import { loadProjectMembers, syncProjectMembers } from './dataRepository';

// localStorage 기반 저장. Supabase 테이블을 새로 만들지 않기 위해 현재는 로컬 전용.
// 추후 Supabase 모드가 필요하면 동일 시그니처로 RPC 또는 신규 테이블로 교체 가능.
const STORAGE_KEY = 'dk_access_requests';

function readAll(): ProjectAccessRequest[] {
  return storage.get<ProjectAccessRequest[]>(STORAGE_KEY, []);
}

function writeAll(list: ProjectAccessRequest[]) {
  storage.set(STORAGE_KEY, list);
}

export async function loadAllAccessRequests(): Promise<ProjectAccessRequest[]> {
  return readAll();
}

export async function loadAccessRequestsForRequester(
  requesterId: string,
): Promise<ProjectAccessRequest[]> {
  return readAll().filter((r) => r.requesterId === requesterId);
}

export async function loadPendingAccessRequestCount(): Promise<number> {
  return readAll().filter((r) => r.status === 'pending').length;
}

export interface CreateAccessRequestInput {
  requesterId: string;
  requesterName: string;
  projectId: string;
  projectName: string;
  scope: AccessRequestScope;
  reason: string;
}

export async function createAccessRequest(
  input: CreateAccessRequestInput,
): Promise<ProjectAccessRequest> {
  const list = readAll();
  // 동일 요청자가 동일 프로젝트에 대해 이미 pending 상태의 요청을 가지고 있으면 중복 방지
  const existingPending = list.find(
    (r) =>
      r.requesterId === input.requesterId &&
      r.projectId === input.projectId &&
      r.status === 'pending',
  );
  if (existingPending) return existingPending;

  const req: ProjectAccessRequest = {
    id: `ar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    projectId: input.projectId,
    projectName: input.projectName,
    scope: input.scope,
    reason: input.reason,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  writeAll([req, ...list]);
  return req;
}

function mapStatus(next: AccessRequestStatus, list: ProjectAccessRequest[], id: string, patch: Partial<ProjectAccessRequest>) {
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated: ProjectAccessRequest = {
    ...list[idx],
    ...patch,
    status: next,
    decidedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  writeAll(list);
  return updated;
}

export interface DecideContext {
  decidedBy: string;
  decidedByName: string;
}

/**
 * 요청을 승인하고, 해당 프로젝트의 멤버 목록에 요청자를 scope에 대응하는 역할로 추가한다.
 * - scope='read'   → viewer
 * - scope='manage' → editor
 * 기존에 해당 사용자가 이미 멤버인 경우 **기존 레코드를 건드리지 않는다** (데이터 보존).
 * 이 경우 grantedMemberId는 기록하지 않고, revoke 시에도 기존 멤버십은 유지된다.
 */
export async function approveAccessRequest(
  id: string,
  ctx: DecideContext,
): Promise<ProjectAccessRequest | null> {
  const list = readAll();
  const req = list.find((r) => r.id === id);
  if (!req || req.status !== 'pending') return null;

  const members = await loadProjectMembers(req.projectId);
  const alreadyMember = members.find((m) => m.userId === req.requesterId);

  let grantedMemberId: string | undefined;
  if (!alreadyMember) {
    const newMember: ProjectMember = {
      id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId: req.projectId,
      userId: req.requesterId,
      name: req.requesterName,
      role: req.scope === 'manage' ? 'editor' : 'viewer',
      createdAt: new Date().toISOString(),
    };
    const nextMembers = [...members, newMember];
    await syncProjectMembers(req.projectId, nextMembers);
    grantedMemberId = newMember.id;
  }

  return mapStatus('approved', list, id, {
    decidedBy: ctx.decidedBy,
    decidedByName: ctx.decidedByName,
    grantedMemberId,
  });
}

export async function rejectAccessRequest(
  id: string,
  ctx: DecideContext,
): Promise<ProjectAccessRequest | null> {
  const list = readAll();
  return mapStatus('rejected', list, id, {
    decidedBy: ctx.decidedBy,
    decidedByName: ctx.decidedByName,
  });
}

/**
 * 슈퍼관리자 전용. 승인된 요청을 revoke하고, 승인 당시 추가했던 멤버 레코드만 제거한다.
 * 기존부터 멤버였던 경우(grantedMemberId 없음)에는 멤버십을 건드리지 않는다.
 */
export async function revokeAccessRequest(
  id: string,
  ctx: DecideContext,
): Promise<ProjectAccessRequest | null> {
  const list = readAll();
  const req = list.find((r) => r.id === id);
  if (!req) return null;
  if (req.status !== 'approved') return null;

  if (req.grantedMemberId) {
    const members = await loadProjectMembers(req.projectId);
    const next = members.filter((m) => m.id !== req.grantedMemberId);
    if (next.length !== members.length) {
      await syncProjectMembers(req.projectId, next);
    }
  }

  return mapStatus('revoked', list, id, {
    decidedBy: ctx.decidedBy,
    decidedByName: ctx.decidedByName,
  });
}
