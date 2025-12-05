import { ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

export type MobileFiltersModalProps = {
  title?: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply?: () => void;
  children: ReactNode;
};

export const MobileFiltersModal = ({
  title = 'Filtros',
  description = 'Ajusta los filtros para refinar la vista',
  open,
  onOpenChange,
  onApply,
  children,
}: MobileFiltersModalProps) => (
  <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={title}
    description={description}
    size="lg"
    footer={
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
        <Button
          type="button"
          onClick={() => {
            onApply?.();
            onOpenChange(false);
          }}
        >
          Aplicar filtros
        </Button>
      </div>
    }
  >
    <div className="max-h-[65vh] space-y-4 overflow-y-auto">{children}</div>
  </Dialog>
);
