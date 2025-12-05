import { forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

// Todas las variantes consumen los tokens definidos en index.css/tokens.css
const variantStyles = {
  primary:
    'border-transparent bg-primary-600 text-white shadow-card hover:bg-primary-700 hover:border-primary-700 focus-visible:ring-primary-500',
  secondary:
    'border-border-subtle bg-surface-muted text-content shadow-card hover:bg-surface hover:border-border focus-visible:ring-primary-100',
  outline:
    'border-border bg-surface text-content hover:border-primary-500 hover:bg-surface-muted focus-visible:ring-border',
  ghost:
    'border-transparent text-content-muted hover:border-border-subtle hover:bg-surface-muted focus-visible:ring-border',
  destructive:
    'border-transparent bg-red-600 text-white shadow-card hover:bg-red-700 hover:border-red-700 focus-visible:ring-red-500',
  link: 'border-transparent text-primary-600 hover:text-primary-700 hover:underline focus-visible:ring-transparent',
} as const;

export type ButtonVariant = keyof typeof variantStyles;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', isLoading = false, leftIcon, rightIcon, disabled, children, ...props },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        className={cn(
          /* Boton con soporte para iconos y estado de carga */
          'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
          variantStyles[variant],
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        <span className="inline-flex items-center gap-1">{children}</span>
        {rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
