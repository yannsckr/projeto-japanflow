import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light' | 'hybrid';

const THEME_STORAGE_KEY = 'japanflow-theme';
const THEME_EVENT = 'japanflow-theme-change';

type ActiveTheme = 'dark' | 'light';

function normalizeTheme(value: Theme | string | null | undefined): ActiveTheme {
  return value === 'light' ? 'light' : 'dark';
}

function getStoredTheme(): ActiveTheme {
  if (typeof window === 'undefined') return 'dark';
  return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

let currentTheme: ActiveTheme = getStoredTheme();
const listeners = new Set<() => void>();

function emitTheme() {
  listeners.forEach((listener) => listener());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: currentTheme }));
  }
}

function applyTheme(theme: ActiveTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.remove('dark', 'light', 'hybrid');
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function commitTheme(theme: ActiveTheme) {
  currentTheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  emitTheme();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    currentTheme = normalizeTheme(event.newValue);
    applyTheme(currentTheme);
    listener();
  };

  const onCustomTheme = (event: Event) => {
    const custom = event as CustomEvent<ActiveTheme>;
    if (!custom.detail || custom.detail === currentTheme) return;
    currentTheme = normalizeTheme(custom.detail);
    applyTheme(currentTheme);
    listener();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_EVENT, onCustomTheme);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_EVENT, onCustomTheme);
  };
}

function getSnapshot() {
  return currentTheme;
}

function getServerSnapshot(): ActiveTheme {
  return 'dark';
}

function changeThemeSmoothly(nextTheme: ActiveTheme) {
  if (typeof document === 'undefined') {
    commitTheme(nextTheme);
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };

  if (!reduceMotion && doc.startViewTransition) {
    doc.startViewTransition(() => commitTheme(nextTheme));
    return;
  }

  document.documentElement.classList.add('jf-theme-fallback');
  commitTheme(nextTheme);

  window.setTimeout(() => {
    document.documentElement.classList.remove('jf-theme-fallback');
  }, 360);
}

applyTheme(currentTheme);

export function useThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((nextTheme: Theme) => {
    changeThemeSmoothly(normalizeTheme(nextTheme));
  }, []);

  const toggleTheme = useCallback(() => {
    changeThemeSmoothly(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    cycleTheme: toggleTheme,
  };
}
