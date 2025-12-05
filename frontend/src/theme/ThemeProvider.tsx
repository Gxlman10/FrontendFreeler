import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { STORAGE_KEYS } from '@/utils/constants';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  defaultMode?: ThemeMode;
};

const getSystemPreference = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const readStoredMode = (fallback: ThemeMode) => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(STORAGE_KEYS.theme) as ThemeMode | null;
  return stored ?? fallback;
};

export const ThemeProvider = ({
  children,
  defaultMode = 'system',
}: ThemeProviderProps) => {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode(defaultMode));

  const resolvedMode = useMemo<'light' | 'dark'>(() => {
    if (mode === 'system') return getSystemPreference();
    return mode;
  }, [mode]);

  const applyClass = useCallback((target: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', target === 'dark');
  }, []);

  useEffect(() => {
    applyClass(resolvedMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.theme, mode);
    }
  }, [mode, resolvedMode, applyClass]);

  useEffect(() => {
    if (typeof window === 'undefined' || mode !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) =>
      applyClass(event.matches ? 'dark' : 'light');
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, [mode, applyClass]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      setMode,
    }),
    [mode, resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
};
