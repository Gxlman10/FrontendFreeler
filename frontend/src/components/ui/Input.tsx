import { forwardRef, ReactNode, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';

/* Props para el componente de entrada */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  leadingElement?: ReactNode;
  trailingElement?: ReactNode;
  withPasswordToggle?: boolean;
  isValid?: boolean;
  trailingInteractive?: boolean;
};

/* Componente de entrada con soporte para etiquetas, errores y texto auxiliar */
/* Utiliza tokens de superficie para asegurar buen contraste en ambos modos */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      id,
      required,
      leadingElement,
      trailingElement,
      withPasswordToggle = false,
      isValid = false,
      type,
      trailingInteractive = false,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? props.name;
    const [isPasswordVisible, setPasswordVisible] = useState(false);

    const showPasswordToggle = withPasswordToggle && (type ?? props.type) === 'password';
    const resolvedType = showPasswordToggle ? (isPasswordVisible ? 'text' : 'password') : type ?? props.type;
    const hasLeading = Boolean(leadingElement);
    const hasTrailing = Boolean(showPasswordToggle || trailingElement);
    // Este input usa superficies neutras para conservar contraste en ambos temas
    return (
      <label className="flex w-full flex-col gap-1 text-sm text-content">
        {label && (
          <span className="font-medium text-content">
            {label}
            {required ? <span className="ml-1 text-red-500">*</span> : null}
          </span>
        )}
        <div className="relative">
          {hasLeading && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-content-muted">
              {leadingElement}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            type={resolvedType}
            className={cn(
              'w-full rounded-md border border-border bg-field px-3 py-2 text-sm text-content shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-60',
              hasLeading && 'pl-10',
              hasTrailing && 'pr-10',
              error && 'border-red-500 focus:ring-red-200',
              isValid && !error && 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200',
              className,
            )}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {showPasswordToggle ? (
            <button
              type="button"
              onClick={() => setPasswordVisible((prev) => !prev)}
              className="absolute inset-y-0 right-2 flex items-center rounded-md px-2 text-content-muted transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              aria-label={isPasswordVisible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : trailingElement ? (
            <div
              className={cn(
                'absolute inset-y-0 right-3 flex items-center text-content-muted',
                trailingInteractive ? 'pointer-events-auto' : 'pointer-events-none',
              )}
            >
              {trailingElement}
            </div>
          ) : null}
        </div>
        {helperText && (
          <span
            id={`${inputId}-helper`}
            className="text-xs text-content-subtle"
          >
            {helperText}
          </span>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </label>
    );
  },
);

Input.displayName = 'Input';
