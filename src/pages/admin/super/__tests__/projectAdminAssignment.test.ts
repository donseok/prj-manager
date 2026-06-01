import { describe, it, expect } from 'vitest';
import {
  findOrphanMemberForProfile,
  resolveAdminRevoke,
  type AssignableProfile,
} from '../projectAdminAssignment';
import type { ProjectMember } from '../../../../types';

function createMember(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: 'm-1',
    projectId: 'proj-1',
    userId: undefined,
    name: '홍길동',
    role: 'member',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const profile: AssignableProfile = {
  id: 'user-1',
  email: 'Gildong@example.com',
  name: '홍길동',
};

describe('findOrphanMemberForProfile (M-4)', () => {
  it('matches an orphan member (userId null) by exact name', () => {
    const members = [createMember({ id: 'm-orphan', name: '홍길동' })];
    const match = findOrphanMemberForProfile(members, profile);
    expect(match?.id).toBe('m-orphan');
  });

  it('matches an orphan member by email (case-insensitive, member.name holds the email)', () => {
    const members = [createMember({ id: 'm-orphan', name: 'gildong@example.com' })];
    const match = findOrphanMemberForProfile(members, { ...profile, name: '다른이름' });
    expect(match?.id).toBe('m-orphan');
  });

  it('does NOT match a member that already has a userId (not an orphan)', () => {
    const members = [createMember({ id: 'm-linked', name: '홍길동', userId: 'other-user' })];
    expect(findOrphanMemberForProfile(members, profile)).toBeUndefined();
  });

  it('returns undefined when no orphan matches by name or email', () => {
    const members = [createMember({ id: 'm-x', name: '김철수' })];
    expect(findOrphanMemberForProfile(members, profile)).toBeUndefined();
  });

  it('ignores empty-name profiles to avoid false positives', () => {
    const members = [createMember({ id: 'm-orphan', name: '' })];
    expect(
      findOrphanMemberForProfile(members, { id: 'u', email: '', name: '' }),
    ).toBeUndefined();
  });
});

describe('resolveAdminRevoke (M-6)', () => {
  it('removes a member that was newly added as admin (no previousRole)', () => {
    const member = createMember({ role: 'admin', userId: 'user-1' });
    expect(resolveAdminRevoke(member)).toEqual({ action: 'remove' });
  });

  it('restores the prior role for a member promoted from editor', () => {
    const member = createMember({ role: 'admin', userId: 'user-1', previousRole: 'editor' });
    expect(resolveAdminRevoke(member)).toEqual({ action: 'restore', role: 'editor' });
  });

  it('restores a viewer who was promoted to admin', () => {
    const member = createMember({ role: 'admin', userId: 'user-1', previousRole: 'viewer' });
    expect(resolveAdminRevoke(member)).toEqual({ action: 'restore', role: 'viewer' });
  });
});
