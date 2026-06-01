import type { ProjectMember } from '../../../types';

/** AssignProjectAdminModal에서 매칭에 사용하는 프로필 최소 형태 */
export interface AssignableProfile {
  id: string;
  email: string;
  name: string;
}

/**
 * 동일 인물의 orphan(user_id 미연결) 멤버 행을 프로필과 매칭한다.
 *
 * memberByUserId 인덱스는 userId가 truthy인 멤버만 담으므로, 같은 사람의
 * orphan 행은 발견되지 않아 관리자 배정 시 중복 행이 생성된다.
 * (NULL은 unique(project_id,user_id) 제약에서 서로 distinct하게 취급됨)
 *
 * Members.tsx의 matchProfile과 동일한 매칭 규칙을 사용한다:
 *  - name 정확 일치, 또는 email 소문자 정확 일치.
 *
 * @returns 매칭되는 orphan 멤버. 없으면 undefined.
 */
export function findOrphanMemberForProfile(
  members: ProjectMember[],
  profile: AssignableProfile,
): ProjectMember | undefined {
  const name = profile.name.trim();
  const email = profile.email.trim().toLowerCase();
  return members.find(
    (m) =>
      !m.userId &&
      ((name.length > 0 && m.name === name) ||
        (email.length > 0 && m.name.trim().toLowerCase() === email)),
  );
}

export type AdminRevokeDecision =
  | { action: 'remove' }
  | { action: 'restore'; role: ProjectMember['role'] };

/**
 * 관리자 배정 해제 시 동작을 결정한다.
 *
 * - 관리자로 신규 추가된 멤버(previousRole 없음) → 멤버십 전체 제거.
 * - 기존 멤버를 관리자로 승격한 경우(previousRole 존재) → 이전 역할 복원.
 *
 * '해제'라는 라벨대로, 승격 전 editor였던 멤버가 관리자 해제로 멤버십을
 * 통째로 잃는 버그(M-6)를 막는다.
 */
export function resolveAdminRevoke(member: ProjectMember): AdminRevokeDecision {
  if (member.previousRole) {
    return { action: 'restore', role: member.previousRole };
  }
  return { action: 'remove' };
}
