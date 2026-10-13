import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_KEY } from '../api/client.js';

const ThemeContext = createContext(null);

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function resolveTheme(preference) {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return preference === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const [resolved, setResolved] = useState(() => resolveTheme(localStorage.getItem(THEME_KEY) || 'light'));

  useEffect(() => {
    const next = resolveTheme(preference);
    setResolved(next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    localStorage.setItem(THEME_KEY, preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolved(media.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [preference]);

  const toggle = useCallback(() => {
    setPreference((current) => (resolveTheme(current) === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
