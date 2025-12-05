import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type TableRootProps = {
  children: ReactNode;
  // Optional wrapper classnames.
  className?: string;
  // Controls the min-width utility so every table can decide how much horizontal space it needs.
  minWidthClass?: string;
};

export const Table = ({ children, className, minWidthClass = 'min-w-[960px]' }: TableRootProps) => (
  <div className={cn('w-full max-w-full overflow-x-auto', className)}>
    <div className="inline-block min-w-full align-middle">
      <div className="rounded-xl border border-border-subtle bg-surface shadow-card">
        <table className={cn('w-full table-auto divide-y divide-border-subtle text-xs sm:text-sm', minWidthClass)}>
          {children}
        </table>
      </div>
    </div>
  </div>
);

type TableSectionProps = {
  children: ReactNode;
  className?: string;
};

export const TableHeader = ({ children, className }: TableSectionProps) => (
  <thead
    className={cn(
      'bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-content-subtle',
      className,
    )}
  >
    {children}
  </thead>
);

export const TableBody = ({ children, className }: TableSectionProps) => (
  <tbody className={cn('divide-y divide-border-subtle', className)}>{children}</tbody>
);

type TableRowProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export const TableRow = ({ children, className, onClick }: TableRowProps) => (
  <tr
    onClick={onClick}
    className={cn(
      'transition hover:bg-surface-muted',
      onClick && 'cursor-pointer',
      className,
    )}
  >
    {children}
  </tr>
);

type CellProps = {
  children: ReactNode;
  className?: string;
};

export const TableHead = ({ children, className }: CellProps) => (
  <th
    scope="col"
    className={cn(
      'whitespace-nowrap px-4 py-3 text-xs font-semibold text-content-muted first:pl-6 last:pr-6',
      className,
    )}
  >
    {children}
  </th>
);

export const TableCell = ({ children, className }: CellProps) => (
  <td className={cn('whitespace-nowrap px-4 py-3 text-sm text-content first:pl-6 last:pr-6', className)}>
    {children}
  </td>
);
