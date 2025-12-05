import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
/* Tipo para las opciones del select */
export type Option = {
  label: string;
  value: string | number;
};
/* Props para el componente Select */

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  options?: Option[];
  autoFit?: boolean;
};
/* Componente Select con soporte para etiquetas, errores y texto auxiliar */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options,
      id,
      required,
      children,
      style,
      autoFit = true,
      ...props
    },
    ref,
  ) => {
    const selectId = id ?? props.name;
    const internalRef = useRef<HTMLSelectElement | null>(null);
    const [dynamicWidth, setDynamicWidth] = useState<number | null>(null);

    const mergeRefs = useCallback(
      (node: HTMLSelectElement | null) => {
        internalRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
        }
      },
      [ref],
    );

    useEffect(() => {
      if (!autoFit) return;
      const selectEl = internalRef.current;
      if (!selectEl) return;
      const computedStyle = window.getComputedStyle(selectEl);
      const font = computedStyle.font || `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
      const paddingX =
        parseFloat(computedStyle.paddingLeft || '0') + parseFloat(computedStyle.paddingRight || '0');
      const borderX =
        parseFloat(computedStyle.borderLeftWidth || '0') +
        parseFloat(computedStyle.borderRightWidth || '0');
      const extraIconSpace = 28; // espacio para caret / icono
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = font;

      const optionLabels =
        options?.map((option) => option.label) ??
        Array.from(selectEl.options).map((option) => option.text ?? '');

      const widest = optionLabels.reduce((max, labelText) => {
        const metrics = ctx.measureText(labelText);
        return Math.max(max, metrics.width);
      }, 0);

      const computedWidth = Math.ceil(widest + paddingX + borderX + extraIconSpace);
      setDynamicWidth(computedWidth > 0 ? computedWidth : null);
    }, [autoFit, options, children]);

    const mergedStyle =
      autoFit && dynamicWidth
        ? {
            minWidth: `${dynamicWidth}px`,
            ...style,
          }
        : style;

    // El select comparte la misma base visual que los inputs
    return (
      <label className="flex w-full flex-col gap-1 text-sm text-content">
        {label && (
          <span className="font-medium text-content">
            {label}
            {required ? <span className="ml-1 text-red-500">*</span> : null}
          </span>
        )}
        <select
          id={selectId}
          ref={mergeRefs}
          className={cn(
            'w-full rounded-md border border-border bg-field px-3 py-2 text-sm text-content shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-60',
            error && 'border-red-500 focus:ring-red-200',
            className,
          )}
          aria-invalid={Boolean(error) || undefined}
          style={mergedStyle}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        {helperText && (
          <span className="text-xs text-content-subtle">
            {helperText}
          </span>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </label>
    );
  },
);

Select.displayName = 'Select';
