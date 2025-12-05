import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

// Variantes alineadas a la paleta definida en index.css
const variants = {
  default: 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200',
  secondary: 'bg-surface-muted text-content dark:bg-surface dark:text-content',
  outline: 'border border-border text-content-muted',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100',
  neutral: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-100',
  'role-admin': 'bg-sky-100 text-sky-800 dark:bg-sky-500/25 dark:text-sky-100',
  'role-supervisor': 'bg-purple-100 text-purple-800 dark:bg-purple-500/25 dark:text-purple-100',
  'role-vendedor': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
  'role-analista': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100',
  'role-pending': 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
  'status-active': 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-100',
  'status-inactive': 'border border-red-200 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-100',
  'status-pending': 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100',
  'status-archived': 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200',
} as const;

export type BadgeVariant = keyof typeof variants;

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export const Badge = ({ children, variant = 'default', className }: BadgeProps) => (
  <span
    className={cn(
      /* Badge con soporte para variantes de color y tokens de diseño y superficie y tipografa y espaciado */
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
      variants[variant],
      className,
    )}
  >
    {children}
  </span>
);

export default Badge;
