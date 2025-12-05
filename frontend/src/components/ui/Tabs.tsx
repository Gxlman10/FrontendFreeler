import { ReactNode, useState } from 'react';
import { cn } from '@/utils/cn';

export type TabItem = {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  items: TabItem[];
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
};

export const Tabs = ({ items, defaultValue, onChange, className }: TabsProps) => {
  const firstEnabled = items.find((item) => !item.disabled);
  const [active, setActive] = useState(defaultValue ?? firstEnabled?.id ?? items[0]?.id ?? '');

  const handleChange = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  const activeItem = items.find((item) => item.id === active) ?? firstEnabled;

  return (
    <div className={cn('w-full', className)}>
      {/* Pestaas basadas en superficies claras/oscuras declaradas */}
      <div className="flex flex-wrap gap-2 border-b border-border-subtle">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => handleChange(item.id)}
            className={cn(
              'rounded-t-md px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
              active === item.id
                ? 'bg-surface text-primary-600 shadow-card'
                : 'text-content-muted hover:text-primary-600',
            )}
            role="tab"
            aria-selected={active === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="rounded-b-md border border-t-0 border-border-subtle bg-surface p-4">
        {activeItem?.content}
      </div>
    </div>
  );
};
