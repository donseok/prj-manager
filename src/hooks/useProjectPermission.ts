import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { getProjectPermissions, getSystemAdminReadOnlyPermissions, type ProjectPermissions } from '../lib/permissions';

export function useProjectPermission(): ProjectPermissions {
  const user = useAuthStore((state) => state.user);
  const members = useProjectStore((state) => state.members);

  return useMemo(() => {
    if (!user) {
      return getProjectPermissions(null);
    }

    const member = members.find((m) => m.userId === user.id);

    // System admin who is also a project member → use their assigned role (no auto-elevate)
    if (user.systemRole === 'admin') {
      if (member) {
        return { ...getProjectPermissions(member.role), isSystemAdmin: true };
      }
      // System admin who is NOT a member → read-only access
      return getSystemAdminReadOnlyPermissions();
    }

    return getProjectPermissions(member?.role ?? null);
  }, [user, members]);
}

/** Returns the current user's member ID within the current project, or null if not a member. */
export function useCurrentMemberId(): string | null {
  const user = useAuthStore((state) => state.user);
  const members = useProjectStore((state) => state.members);

  return useMemo(() => {
    if (!user) return null;
    const member = members.find((m) => m.userId === user.id);
    return member?.id ?? null;
  }, [user, members]);
}
