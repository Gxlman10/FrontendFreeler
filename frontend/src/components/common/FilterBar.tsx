import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type FilterChip = {
  id: string;
  label: ReactNode;
  isActive?: boolean;
  disabled?: boolean;
};

type FilterBarProps = {
  chips: FilterChip[];
  onSelect: (id: string) => void;
  className?: string;
};

export const FilterBar = ({ chips, onSelect, className }: FilterBarProps) => (
  // Chips de filtrado que respetan los tonos globales
  <div className={cn('flex flex-wrap items-center gap-2', className)}>
    {chips.map((chip) => (
      <button
        key={chip.id}
        type="button"
        onClick={() => onSelect(chip.id)}
        disabled={chip.disabled}
        className={cn(
          'rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
          chip.isActive
            ? 'border-primary-600 bg-primary-50 text-primary-700'
            : 'border-border text-content-muted hover:border-primary-500 hover:text-primary-600',
        )}
      >
        {chip.label}
      </button>
    ))}
  </div>
);
