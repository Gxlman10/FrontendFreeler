import { ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

type AccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

export const Accordion = ({ title, children, defaultOpen = false, className }: AccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-xl border border-border-subtle bg-surface shadow-sm', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-content"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-content-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? <div className="border-t border-border-subtle px-4 py-4 text-sm text-content">{children}</div> : null}
    </div>
  );
};

export default Accordion;

