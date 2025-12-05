import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

type LeadDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export const LeadDetailDrawer = ({ open, onClose, title, children, footer }: LeadDetailDrawerProps) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-drawer)] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      aria-label={title}
    >
      <aside
        className={cn(
          'ml-auto flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-border-subtle bg-surface shadow-card',
          'animate-in slide-in-from-right duration-200',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h2 className="text-lg font-semibold text-content">{title}</h2>
          <Button variant="ghost" onClick={onClose} className="flex items-center gap-2 text-danger-600">
            <X className="h-4 w-4" aria-hidden />
            Cerrar
          </Button>
        </header>
        <div className="px-5 py-4 text-sm text-content">{children}</div>
        {footer && <footer className="border-t border-border-subtle px-5 py-4">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
};
