import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const getSystemTheme = (): boolean => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      return saved;
    }
  }
  return 'system';
};

const calculateIsDark = (theme: Theme): boolean => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme === 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  isDark: calculateIsDark(getInitialTheme()),

  setTheme: (theme: Theme) => {
    localStorage.setItem('theme', theme);
    const isDark = calculateIsDark(theme);

    // DOM에 dark 클래스 적용
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    set({ theme, isDark });
  },

  toggleTheme: () => {
    const { theme } = get();
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },
}));

// 시스템 테마 변경 감지
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const { theme, setTheme } = useThemeStore.getState();
    if (theme === 'system') {
      setTheme('system'); // 재계산
    }
  });

  // 초기 테마 적용
  const initialTheme = getInitialTheme();
  if (calculateIsDark(initialTheme)) {
    document.documentElement.classList.add('dark');
  }
}
