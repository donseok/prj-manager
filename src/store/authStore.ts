import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccountStatus, User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Computed-like
  isAdmin: boolean;
  accountStatus: AccountStatus | null;
  isPending: boolean;
  isSuspended: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isAdmin: false,
      accountStatus: null,
      isPending: false,
      isSuspended: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isAdmin: user?.systemRole === 'admin',
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
          isAdmin: user?.systemRole === 'admin',
          accountStatus: user?.accountStatus ?? null,
          isPending: user?.accountStatus === 'pending',
          isSuspended: user?.accountStatus === 'suspended',
          isLoading: false,
        };
      },
    }
  )
);
