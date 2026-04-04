import { create } from 'zustand';

type InputMode = 'ai' | 'manual';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
}

const getInitialCollapsed = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  }
  return false;
};

const getInitialInputMode = (): InputMode => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('inputMode');
    if (stored === 'ai' || stored === 'manual') return stored;
  }
  return 'manual';
};

export const useUIStore = create<UIState>((set, get) => ({
  sidebarCollapsed: getInitialCollapsed(),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(next));
    set({ sidebarCollapsed: next });
  },
  inputMode: getInitialInputMode(),
  setInputMode: (mode: InputMode) => {
    localStorage.setItem('inputMode', mode);
    set({ inputMode: mode });
  },
}));
