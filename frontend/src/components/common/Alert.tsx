import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const variantStyles: Record<AlertVariant, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100',
  danger:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-100',
};

export type AlertProps = {
  title?: string;
  description?: string;
  variant?: AlertVariant;
  onClose?: () => void;
  className?: string;
  icon?: ReactNode;
};

export const Alert = ({
  title,
  description,
  variant = 'info',
  onClose,
  className,
  icon,
}: AlertProps) => (
  <div
    className={cn(
      'flex items-center gap-3 rounded-lg border px-4 pt-2.5 pb-3.5 text-sm shadow-sm transition',
      variantStyles[variant],
      className,
    )}
  >
    {icon ? <span className="shrink-0 text-base">{icon}</span> : null}
    <div className="flex flex-1 flex-wrap items-center gap-2">
      {title ? <strong className="font-semibold">{title}</strong> : null}
      {description ? <span className="text-sm">{description}</span> : null}
    </div>
    {onClose ? (
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-inherit transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:hover:bg-white/10"
        aria-label="Cerrar alerta"
      >
        <X className="h-4 w-4" />
      </button>
    ) : null}
  </div>
);

export default Alert;
