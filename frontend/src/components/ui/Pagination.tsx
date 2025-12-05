import { ButtonHTMLAttributes } from 'react';
import { Button } from './Button';
import { cn } from '@/utils/cn';

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasMore?: boolean;
};

export const Pagination = ({
  page,
  totalPages,
  onPageChange,
  hasMore,
}: PaginationProps) => {
  const canPrev = page > 1;
  const canNext = hasMore ?? page < totalPages;

  const goTo = (next: number) => () => {
    if (next === page) return;
    onPageChange(next);
  };

  const renderPages = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  };

  const NavButton = ({
    active = false,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
    <button
      type="button"
      {...props}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        props.disabled
          ? 'cursor-not-allowed opacity-40'
          : 'hover:bg-surface-muted',
        active ? 'bg-primary-600 text-white hover:bg-primary-700' : 'text-content'
      )}
      data-active={active || undefined}
    />
  );

  return (
    <div className="flex items-center justify-between gap-3 text-content">
      {/* Navegacin con tokens de color para estados activos/inactivos */}
      <Button variant="ghost" disabled={!canPrev} onClick={goTo(page - 1)}>
        Anterior
      </Button>
      <div className="flex items-center gap-1">
        {renderPages().map((p) => (
          <NavButton
            key={`page-${p}`}
            onClick={goTo(p)}
            active={p === page}
            disabled={p === page}
          >
            {p}
          </NavButton>
        ))}
      </div>
      <Button variant="ghost" disabled={!canNext} onClick={goTo(page + 1)}>
        Siguiente
      </Button>
    </div>
  );
};
