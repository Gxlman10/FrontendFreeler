import { useMemo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/theme/useTheme';
import { cn } from '@/utils/cn';

type ThemeSwitchProps = {
  className?: string;
};

export const ThemeSwitch = ({ className }: ThemeSwitchProps) => {
  const { resolvedMode, setMode } = useTheme();

  const isDark = resolvedMode === 'dark';
  const ariaLabel = useMemo(
    () => (isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'),
    [isDark],
  );

  const toggleMode = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  const sunClasses = cn(
    'h-4 w-4 transition',
    isDark ? 'text-content-muted/50' : 'text-amber-400',
  );
  const moonClasses = cn(
    'h-4 w-4 transition',
    isDark ? 'text-indigo-300' : 'text-content-muted/50',
  );

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={ariaLabel}
      onClick={toggleMode}
      className={cn(
        'relative inline-flex h-9 w-16 items-center justify-between rounded-full border border-border-subtle bg-surface px-2 py-1 text-content-muted shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute inset-y-1 left-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-500/20 shadow-sm transition-transform dark:bg-primary-400/30',
          isDark ? 'translate-x-6' : 'translate-x-0',
        )}
        aria-hidden="true"
      />
      <Sun className={cn('relative z-10', sunClasses)} />
      <Moon className={cn('relative z-10', moonClasses)} />
    </button>
  );
};

export default ThemeSwitch;
