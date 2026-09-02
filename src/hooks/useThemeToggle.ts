import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

export function useThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('japanflow-theme') as Theme) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('japanflow-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
