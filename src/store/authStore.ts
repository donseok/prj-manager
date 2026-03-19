import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Computed-like
  isAdmin: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: { id: 'default', email: 'admin@dkflow.com', name: '관리자', systemRole: 'admin' as const, createdAt: new Date().toISOString() },
      isAuthenticated: true,
      isLoading: false,
      isAdmin: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isAdmin: user?.systemRole === 'admin',
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isAdmin: false,
          isLoading: false,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
