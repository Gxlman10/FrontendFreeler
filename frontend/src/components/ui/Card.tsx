import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type CardProps = {
  children: ReactNode;
  className?: string;
};

// Las tarjetas utilizan sombras y bordes declarados en tokens/index
export const Card = ({ children, className }: CardProps) => (
  <div
    className={cn(
      /* Contenedor de la tarjeta con soporte para modos claro y oscuro */
      'rounded-lg border border-border-subtle bg-surface-elevated shadow-card backdrop-blur transition',
      className,
    )}
  >
    {children}
  </div>
);

/* Seccion de header de la tarjeta */
type SectionProps = {
  children: ReactNode;
  className?: string;
};

// El header mantiene divisores suaves para ambos temas
export const CardHeader = ({ children, className }: SectionProps) => (
  <div className={cn('border-b border-border-subtle px-6 py-4', className)}>
    {children}
  </div>
);

/* Seccion de contenido de la tarjeta */
export const CardContent = ({ children, className }: SectionProps) => (
  <div className={cn('px-6 py-4', className)}>{children}</div>
);

/* Seccion de pie de pagina de la tarjeta */
export const CardFooter = ({ children, className }: SectionProps) => (
  <div className={cn('border-t border-border-subtle px-6 py-4', className)}>
    {children}
  </div>
);
