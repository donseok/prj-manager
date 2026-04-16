import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccountStatus, User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Computed-like
  isSuperAdmin: boolean;  // systemRole === 'superadmin'
  isAdmin: boolean;       // systemRole === 'superadmin' || 'admin' (하위 호환)
  accountStatus: AccountStatus | null;
  isPending: boolean;
  isSuspended: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

function deriveAdminFlags(user: User | null) {
  const role = user?.systemRole;
  return {
    isSuperAdmin: role === 'superadmin',
    isAdmin: role === 'superadmin' || role === 'admin',
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isSuperAdmin: false,
      isAdmin: false,
      accountStatus: null,
      isPending: false,
      isSuspended: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          ...deriveAdminFlags(user),
          accountStatus: user?.accountStatus ?? null,
          isPending: user?.accountStatus === 'pending',
          isSuspended: user?.accountStatus === 'suspended',
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isSuperAdmin: false,
          isAdmin: false,
          accountStatus: null,
          isPending: false,
          isSuspended: false,
          isLoading: false,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
      merge: (persistedState, currentState) => {
        const nextState = persistedState as Partial<AuthState> | undefined;
        const user = nextState?.user ?? null;
        return {
          ...currentState,
          ...nextState,
          user,
          isAuthenticated: !!user,
          ...deriveAdminFlags(user),
          accountStatus: user?.accountStatus ?? null,
          isPending: user?.accountStatus === 'pending',
          isSuspended: user?.accountStatus === 'suspended',
          isLoading: false,
        };
      },
    }
  )
);
