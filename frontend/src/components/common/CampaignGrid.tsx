import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type CampaignGridProps = {
  children: ReactNode;
  className?: string;
};

export const CampaignGrid = ({ children, className }: CampaignGridProps) => (
  // Grilla responsiva reutilizable para tarjetas de campania
  <div
    className={cn(
      'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
      className,
    )}
  >
    {children}
  </div>
);
