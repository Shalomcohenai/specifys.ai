import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface InfoCardProps {
  value: string | number;
  label: string;
  description?: string;
  className?: string;
}

export function InfoCard({ value, label, description, className }: InfoCardProps) {
  return (
    <div
      className={cn(
        'bg-bg-primary',
        'rounded-xl',
        'p-6',
        'shadow-sm',
        'text-center',
        className
      )}
    >
      {/* Value */}
      <div className="text-text-DEFAULT font-bold text-4xl md:text-5xl mb-2">
        {value}
      </div>

      {/* Label */}
      <h3 className="font-heading text-text-DEFAULT font-bold text-lg mb-2">{label}</h3>

      {/* Description */}
      {description && (
        <p className="text-text-DEFAULT font-medium text-sm">{description}</p>
      )}
    </div>
  );
}
