import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface IconCardProps {
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function IconCard({ icon, onClick, className }: IconCardProps) {
  const baseClasses = cn(
    'flex items-center justify-center',
    'bg-text-DEFAULT',
    'rounded-xl',
    'border-0', // No border
    'p-6',
    'shadow-md',
    'transition-all',
    onClick && 'cursor-pointer hover:bg-text-DEFAULT/90 active:scale-95',
    className
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseClasses} type="button">
        <div className="text-white text-4xl">{icon}</div>
      </button>
    );
  }

  return (
    <div className={baseClasses}>
      <div className="text-white text-4xl">{icon}</div>
    </div>
  );
}
