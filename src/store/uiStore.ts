import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const getInitialCollapsed = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  }
  return false;
};

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: getInitialCollapsed(),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(next));
    set({ sidebarCollapsed: next });
  },
}));
