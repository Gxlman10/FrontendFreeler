import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export type MultiSelectOption = {
  label: string;
  value: string;
};

type MultiSelectProps = {
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  helperText?: string;
  values: string[];
  onChange: (nextValues: string[]) => void;
  options: MultiSelectOption[];
  className?: string;
};

export const MultiSelect = ({
  label,
  placeholder = 'Selecciona opciones',
  disabled,
  helperText,
  values,
  onChange,
  options,
  className,
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const controlId = useId();
  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);

  const toggleValue = (value: string) => {
    const exists = values.includes(value);
    if (exists) {
      onChange(values.filter((item) => item !== value));
    } else {
      onChange([...values, value]);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!listRef.current || !triggerRef.current) return;
      if (listRef.current.contains(target) || triggerRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const updateWidth = () => {
      if (triggerRef.current) {
        setDropdownWidth(triggerRef.current.getBoundingClientRect().width);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [open]);

  const displayLabel = useMemo(() => {
    if (!values.length) return placeholder;
    if (values.length === 1) {
      const option = options.find((item) => item.value === values[0]);
      return option?.label ?? placeholder;
    }
    return `${values.length} seleccionados`;
  }, [options, placeholder, values]);

  return (
    <div className={cn('flex w-full flex-col gap-1 text-sm text-content', className)}>
      {label && (
        <span className="font-medium text-content">
          {label}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          ref={triggerRef}
          id={controlId}
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-md border border-border bg-field px-3 py-2 text-left text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-60',
          )}
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={cn('truncate', !values.length && 'text-content-subtle')}>{displayLabel}</span>
          <ChevronDown className="h-4 w-4 text-content-muted" />
        </button>
        {open && (
          <div
            ref={listRef}
            className="absolute left-0 z-30 mt-1 max-h-56 min-w-full overflow-auto rounded-md border border-border bg-surface shadow-lg"
            style={{
              width: 'max-content',
              minWidth: dropdownWidth ?? undefined,
            }}
            role="listbox"
            aria-labelledby={controlId}
          >
            {options.length ? (
              options.map((option) => {
                const checked = values.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface-muted',
                      checked && 'text-primary-600',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleValue(option.value)}
                    />
                    <span>{option.label}</span>
                    {checked && <Check className="h-4 w-4" />}
                  </label>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-content-subtle">Sin opciones disponibles</p>
            )}
          </div>
        )}
      </div>
      {helperText && <span className="text-xs text-content-subtle">{helperText}</span>}
    </div>
  );
};

export default MultiSelect;
