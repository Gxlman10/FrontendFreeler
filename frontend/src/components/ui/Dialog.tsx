import {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { cn } from '@/utils/cn';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
};

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  full: 'max-w-full h-full sm:max-w-4xl sm:h-auto',
} as const;

/* Componente Dialog accesible con soporte para diferentes tamaos y cierre mediante fondo o tecla Escape */
export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) => {
  const isFullScreen = size === 'full';
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    /* Evitamos el scroll del body cuando el dilogo est abierto */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, handleClose]);

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);
/* Renderizamos el dialogo en un portal para evitar problemas de z-index y posicionamiento */
  const portalTarget = useMemo(() => document.body, []);
  if (!open || !portalTarget) return null;
  return createPortal(
    <div
    /* Contenedor del dialogo centrado con fondo difuminado */
      className={cn(
        'bg-overlay-blur fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4 py-10',
        isFullScreen && 'items-end px-0 py-0 sm:items-center',
      )}
      /* Fondo del dilogo con cierre al hacer clic fuera del contenido */
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          /* Contenido del dialogo con soporte para superficies traslucidas */
          'w-full border border-border bg-surface-translucent shadow-card-strong outline-none transition',
          isFullScreen ? 'h-full rounded-none sm:h-auto sm:rounded-lg' : 'rounded-lg',
          sizeClasses[size],
        )}
      >
        <header
          className={cn(
            'bg-surface-header flex items-start justify-between border-b border-border-subtle px-6 py-4',
            isFullScreen && 'rounded-none sm:rounded-t-lg',
          )}
        >
          <div>
            {title && (
              <h2 id={titleId} className="text-lg font-semibold text-content">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="mt-1 text-sm text-content-muted">
                {description}
              </p>
            )}
          </div>
          <Button variant="ghost" onClick={handleClose} aria-label="Cerrar dialogo">
            X
          </Button>
        </header>
        <div className={cn('max-h-[70vh] overflow-y-auto px-6 py-4', isFullScreen && 'h-full max-h-none')}>
          {children}
        </div>
        {footer && (
          <footer className={cn('border-t border-border-subtle px-6 py-4', isFullScreen && 'bg-surface')}>
            {footer}
          </footer>
        )}
      </div>
    </div>,
    portalTarget,
  );
};
