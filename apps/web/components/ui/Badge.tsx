import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type BadgeVariant = 'primary' | 'secondary';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'primary', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center',
        'px-2 py-1',
        'rounded-md',
        'text-xs font-bold uppercase',
        'border-0', // No border
        'transition-colors',
        variant === 'primary' && 'bg-primary text-white',
        variant === 'secondary' && 'bg-text-DEFAULT text-white',
        className
      )}
    >
      {children}
    </span>
  );
}
