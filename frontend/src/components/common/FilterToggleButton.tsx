import { Eye, EyeOff, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

type FilterToggleButtonProps = {
  label: string;
  expanded: boolean;
  isMobile?: boolean;
  onToggle: () => void;
  className?: string;
};

export const FilterToggleButton = ({
  label,
  expanded,
  isMobile = false,
  onToggle,
  className,
}: FilterToggleButtonProps) => (
  <Button
    type="button"
    variant="outline"
    onClick={onToggle}
    className={cn('w-full justify-between gap-3 sm:w-auto', className)}
  >
    <span className="flex items-center gap-2">
      <Filter className="h-4 w-4" aria-hidden />
      {label}
    </span>
    {isMobile ? (
      <Eye className="h-4 w-4 text-content-muted" aria-hidden />
    ) : expanded ? (
      <EyeOff className="h-4 w-4 text-content-muted" aria-hidden />
    ) : (
      <Eye className="h-4 w-4 text-content-muted" aria-hidden />
    )}
  </Button>
);

export default FilterToggleButton;
