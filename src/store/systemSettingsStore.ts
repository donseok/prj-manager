import { create } from 'zustand';
import type { SystemSettings } from '../lib/systemSettings';
import { loadSystemSettings, saveSystemSettings } from '../lib/systemSettings';

interface SystemSettingsState {
  settings: SystemSettings;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  setSettings: (settings: SystemSettings) => Promise<void>;
}

export const useSystemSettingsStore = create<SystemSettingsState>((set) => ({
  settings: { projectCreationPolicy: 'all' },
  loaded: false,

  loadSettings: async () => {
    const settings = await loadSystemSettings();
    set({ settings, loaded: true });
  },

  setSettings: async (settings: SystemSettings) => {
    await saveSystemSettings(settings);
    set({ settings });
  },
}));
