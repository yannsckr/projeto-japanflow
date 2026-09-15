import { useCallback, useLayoutEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'hybrid';

const THEME_STORAGE_KEY = 'japanflow-theme';
const THEMES: Theme[] = ['dark', 'light', 'hybrid'];

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'hybrid';
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(savedTheme) ? savedTheme : 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  root.classList.remove(...THEMES);
  root.classList.add(theme);
  root.dataset.theme = theme;

  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}

export function useThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useLayoutEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
  }, []);

  // Mantido por compatibilidade com o AppLayout atual.
  // Por enquanto alterna Light <-> Dark.
  // O modo Hybrid será exposto pelo novo ThemeSwitcher no Bloco 6.2.
  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((currentTheme) => {
      const currentIndex = THEMES.indexOf(currentTheme);
      const nextIndex = (currentIndex + 1) % THEMES.length;
      return THEMES[nextIndex];
    });
  }, []);

  return {
    theme,
    setTheme,
    toggleTheme,
    cycleTheme,
  };
}
