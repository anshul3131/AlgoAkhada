import { useCallback, useEffect, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'algoakhada-theme';
const listeners = new Set<() => void>();

const get = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function setTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  try { localStorage.setItem(KEY, t); } catch {}
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, get, () => 'dark' as Theme);
  const toggle = useCallback(() => setTheme(get() === 'dark' ? 'light' : 'dark'), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) setTheme(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { theme, isDark: theme === 'dark', toggle, setTheme };
}
