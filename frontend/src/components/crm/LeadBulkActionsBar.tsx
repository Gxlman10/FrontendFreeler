import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/utils/cn';
import { UserPlus, Repeat2 } from 'lucide-react';

export type LeadBulkAction = 'assign' | 'change-status' | null;

export type BulkVendorOption = {
  id: number;
  label: string;
};

export type BulkStatusOption = {
  id: number;
  label: string;
};

type LeadBulkActionsBarProps = {
  selectedCount: number;
  action: LeadBulkAction;
  onActionChange: (action: LeadBulkAction) => void;
  vendors: BulkVendorOption[];
  statuses: BulkStatusOption[];
  selectedVendorId?: number | null;
  onVendorSelect: (id: number | null) => void;
  selectedStatusId?: number | null;
  onStatusSelect: (id: number | null) => void;
  onClear: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  disableChangeStatus?: boolean;
};

const ACTION_BUTTONS: Array<{
  key: Exclude<LeadBulkAction, null>;
  label: string;
  icon: typeof UserPlus;
}> = [
  { key: 'assign', label: 'Asignar', icon: UserPlus },
  { key: 'change-status', label: 'Cambiar estado', icon: Repeat2 },
];

export const LeadBulkActionsBar = ({
  selectedCount,
  action,
  onActionChange,
  vendors,
  statuses,
  selectedVendorId,
  onVendorSelect,
  selectedStatusId,
  onStatusSelect,
  onClear,
  onConfirm,
  disabled = false,
  disableChangeStatus = false,
}: LeadBulkActionsBarProps) => {
  if (!selectedCount) return null;

  const currentAction: Exclude<LeadBulkAction, null> | null = action ?? null;

  const requiresVendor = currentAction === 'assign';
  const requiresStatus = currentAction === 'change-status';
  const confirmDisabled =
    disabled ||
    !currentAction ||
    (requiresVendor && !selectedVendorId) ||
    (requiresStatus && (!selectedStatusId || disableChangeStatus));

  return (
    <div className="fixed bottom-6 left-1/2 z-[var(--z-toast)] w-[94%] max-w-4xl -translate-x-1/2 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-card-strong">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-content">
            {selectedCount} {selectedCount === 1 ? 'lead seleccionado' : 'leads seleccionados'}
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          {ACTION_BUTTONS.map(({ key, label, icon: Icon }) => {
            const isActive = currentAction === key;
            const isChangeStatus = key === 'change-status';
            const isDisabled = disabled || (isChangeStatus && disableChangeStatus);
            return (
              <div key={key} className="flex flex-nowrap items-center gap-2">
                <Button
                  type="button"
                  variant={isActive ? 'primary' : 'outline'}
                  onClick={() => onActionChange(key)}
                  disabled={isDisabled}
                  className={cn(
                    'h-9 border px-3 text-xs font-semibold shadow-none',
                    isActive
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-border-subtle text-content',
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" aria-hidden />
                  {label}
                </Button>
                {isActive && key === 'assign' && (
                  <Select
                    name="bulk-vendor"
                    value={selectedVendorId ? String(selectedVendorId) : ''}
                    onChange={(event) =>
                      onVendorSelect(event.target.value ? Number(event.target.value) : null)
                    }
                    className="w-32 whitespace-nowrap"
                    options={[
                      { value: '', label: 'Selecciona un vendedor' },
                      ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.label })),
                    ]}
                  />
                )}
                {isActive && key === 'change-status' && (
                  <Select
                    name="bulk-status"
                    value={selectedStatusId ? String(selectedStatusId) : ''}
                    onChange={(event) =>
                      onStatusSelect(event.target.value ? Number(event.target.value) : null)
                    }
                    className="w-32 whitespace-nowrap"
                    options={[
                      { value: '', label: 'Selecciona un estado' },
                      ...statuses.map((status) => ({ value: status.id, label: status.label })),
                    ]}
                  />
                )}
              </div>
            );
          })}

          <Button type="button" variant="ghost" onClick={onClear} className="h-9 px-3 text-xs">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="h-9 px-4 text-xs"
          >
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeadBulkActionsBar;
