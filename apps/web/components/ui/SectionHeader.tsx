import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={cn('text-center mb-8', className)}>
      <h2 className="font-heading text-text-DEFAULT font-bold text-3xl md:text-4xl mb-2">{title}</h2>
      {subtitle && (
        <p className="text-text-DEFAULT font-medium text-lg">{subtitle}</p>
      )}
    </div>
  );
}



