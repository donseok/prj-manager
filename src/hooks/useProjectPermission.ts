import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { getProjectPermissions, type ProjectPermissions } from '../lib/permissions';

export function useProjectPermission(): ProjectPermissions {
  const user = useAuthStore((state) => state.user);
  const members = useProjectStore((state) => state.members);

  return useMemo(() => {
    if (!user) {
      return getProjectPermissions(null);
    }

    // System admins are treated as project 'admin' even if not a member
    if (user.systemRole === 'admin') {
      const member = members.find((m) => m.userId === user.id);
      const effectiveRole = member?.role === 'owner' ? 'owner' : 'admin';
      return getProjectPermissions(effectiveRole);
    }

    const member = members.find((m) => m.userId === user.id);
    return getProjectPermissions(member?.role ?? null);
  }, [user, members]);
}
