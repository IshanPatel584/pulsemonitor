import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useMediaQuery } from '../hooks/useMediaQuery';

const PreferencesContext = createContext(null);

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

/** UI preferences that persist per browser: theme, sidebar state, motion. */
export function PreferencesProvider({ children }) {
  const [theme, setTheme] = useLocalStorage('pm.theme', 'dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('pm.sidebarCollapsed', false);
  const [reduceMotion, setReduceMotion] = useLocalStorage('pm.reduceMotion', false);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);
  const systemReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  // JS-driven animations (Recharts) can't be stopped by CSS, so expose one flag for them.
  const motionReduced = reduceMotion || systemReducedMotion;

  useEffect(() => {
    const mq = darkQuery();
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  }, [reduceMotion]);

  const toggleTheme = useCallback(
    () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
    [resolvedTheme, setTheme],
  );

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      sidebarCollapsed,
      setSidebarCollapsed,
      reduceMotion,
      setReduceMotion,
      motionReduced,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme, sidebarCollapsed, setSidebarCollapsed, reduceMotion, setReduceMotion, motionReduced],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
