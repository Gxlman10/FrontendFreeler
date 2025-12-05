import { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: ReactNode;
  className?: string;
};

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
  illustration,
  className,
}: EmptyStateProps) => (
  // Estado vacio reutilizable con estilos consistentes
  <div
    className={cn(
      'flex flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle bg-surface px-6 py-12 text-center',
      className,
    )}
  >
    {illustration && <div className="mb-6 text-4xl">{illustration}</div>}
    <h3 className="text-lg font-semibold text-content">{title}</h3>
    {description && (
      <p className="mt-2 max-w-prose text-sm text-content-muted">{description}</p>
    )}
    {actionLabel && onAction && (
      <Button className="mt-6" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);
