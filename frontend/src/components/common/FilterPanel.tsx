import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type FilterPanelProps = {
  children: ReactNode;
  className?: string;
};

export const FilterPanel = ({ children, className }: FilterPanelProps) => (
  <section className={cn('w-full rounded-2xl border border-border bg-surface/80 p-4 shadow-sm', className)}>
    <div className="flex flex-wrap gap-3">{children}</div>
  </section>
);

type FilterFieldProps = {
  children: ReactNode;
  minWidth?: number;
  className?: string;
};

export const FilterField = ({ children, minWidth = 220, className }: FilterFieldProps) => (
  <div className={cn('flex-1', className)} style={{ minWidth }}>
    {children}
  </div>
);

export default FilterPanel;
