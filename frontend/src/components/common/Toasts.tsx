import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

type ToastVariant = 'default' | 'success' | 'warning' | 'danger';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

const variantClasses: Record<ToastVariant, string> = {
  default:
    'border-border bg-surface text-content dark:border-border/60 dark:bg-surface-elevated dark:text-content',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-200',
  danger:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-200',
};

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID();
      const duration = toast.duration ?? 5000;
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      dismiss,
    }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

type ToastViewportProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

const ToastViewport = ({ toasts, onDismiss }: ToastViewportProps) => (
  <div className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex w-full max-w-xs flex-col gap-3">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={cn(
          'pointer-events-auto rounded-lg border px-4 py-3 shadow-lg transition',
          variantClasses[toast.variant ?? 'default'],
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description && (
              <p className="mt-1 text-xs text-content-muted">{toast.description}</p>
            )}
          </div>
          <Button variant="ghost" onClick={() => onDismiss(toast.id)}>
            Cerrar
          </Button>
        </div>
      </div>
    ))}
  </div>
);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
