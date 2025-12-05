import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  description?: string;
};

export const TextArea = forwardRef<HTMLTextAreaElement, Props>(({ label, description, className, ...props }, ref) => (
  <label className="flex flex-col gap-2 text-sm font-medium text-content">
    {label}
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-content shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-70',
        className,
      )}
      {...props}
    />
    {description && <span className="text-xs font-normal text-content-muted">{description}</span>}
  </label>
));

TextArea.displayName = 'TextArea';

export default TextArea;
