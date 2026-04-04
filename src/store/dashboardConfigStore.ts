import { create } from 'zustand';

export interface DashboardWidget {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

interface DashboardConfigState {
  widgets: DashboardWidget[];
  setWidgetVisibility: (id: string, visible: boolean) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  resetToDefault: () => void;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'kpi-cards', label: 'KPI 현황 카드', visible: true, order: 0 },
  { id: 'status-distribution', label: '상태별 분포', visible: true, order: 1 },
  { id: 'assignee-progress', label: '담당자별 진행률', visible: true, order: 2 },
  { id: 'delayed-tasks', label: '지연 작업', visible: true, order: 3 },
  { id: 'weekly-tasks', label: '금주/차주 작업', visible: true, order: 4 },
  { id: 'phase-progress', label: 'Phase별 진행률', visible: true, order: 5 },
  { id: 'timeline', label: '프로젝트 일정 요약', visible: true, order: 6 },
  { id: 'weight-chart', label: 'Phase 가중치 분포', visible: true, order: 7 },
  { id: 'recent-completed', label: '최근 완료 작업', visible: true, order: 8 },
  { id: 'attendance', label: '금주 근태현황', visible: true, order: 9 },
  { id: 'resource-workload', label: '리소스 워크로드', visible: true, order: 10 },
  { id: 'evm-analysis', label: 'EVM 분석', visible: true, order: 11 },
];

const STORAGE_KEY = 'dk-flow-dashboard-config';

function loadFromStorage(): DashboardWidget[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardWidget[];
    // Merge with defaults to handle newly added widgets
    const storedIds = new Set(parsed.map((w) => w.id));
    const merged = [...parsed];
    for (const dw of DEFAULT_WIDGETS) {
      if (!storedIds.has(dw.id)) {
        merged.push({ ...dw, order: merged.length });
      }
    }
    // Remove widgets that no longer exist in defaults
    const defaultIds = new Set(DEFAULT_WIDGETS.map((w) => w.id));
    return merged.filter((w) => defaultIds.has(w.id));
  } catch {
    return null;
  }
}

function saveToStorage(widgets: DashboardWidget[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    // ignore
  }
}

export const useDashboardConfigStore = create<DashboardConfigState>((set) => ({
  widgets: loadFromStorage() ?? DEFAULT_WIDGETS.map((w) => ({ ...w })),

  setWidgetVisibility: (id, visible) =>
    set((state) => {
      const widgets = state.widgets.map((w) =>
        w.id === id ? { ...w, visible } : w
      );
      saveToStorage(widgets);
      return { widgets };
    }),

  reorderWidgets: (fromIndex, toIndex) =>
    set((state) => {
      const sorted = [...state.widgets].sort((a, b) => a.order - b.order);
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);
      const widgets = sorted.map((w, i) => ({ ...w, order: i }));
      saveToStorage(widgets);
      return { widgets };
    }),

  resetToDefault: () => {
    const widgets = DEFAULT_WIDGETS.map((w) => ({ ...w }));
    saveToStorage(widgets);
    return set({ widgets });
  },
}));
