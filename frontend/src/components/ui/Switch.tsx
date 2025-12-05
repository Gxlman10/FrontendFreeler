import { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

export type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, checked, defaultChecked, disabled, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(internalRef.current);
        } else {
          ref.current = internalRef.current;
        }
      }
    }, [ref]);

    // Interruptor con tokens de superficie para no depender de colores fijos
    return (
      <label className="inline-flex items-center gap-3 text-sm text-content">
        <span className="relative inline-flex h-6 w-11 items-center">
          <input
            ref={internalRef}
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-500',
              disabled
                ? 'bg-surface-muted'
                : 'bg-border peer-checked:bg-primary-600',
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 peer-disabled:bg-surface-muted peer-disabled:shadow-none',
              className,
            )}
          />
        </span>
        {label && <span>{label}</span>}
      </label>
    );
  },
);

Switch.displayName = 'Switch';
