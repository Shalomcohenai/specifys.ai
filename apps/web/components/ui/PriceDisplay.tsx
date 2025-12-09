import { cn } from '@/lib/utils/cn';

interface PriceDisplayProps {
  price: string;
  period?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
};

export function PriceDisplay({ price, period, className, size = 'md' }: PriceDisplayProps) {
  return (
    <div className={cn('flex items-baseline gap-1', className)}>
      <span className="text-text-DEFAULT font-bold text-lg">$</span>
      <span className={cn('text-text-DEFAULT font-bold', sizeClasses[size])}>
        {price}
      </span>
      {period && (
        <span className="text-text-DEFAULT font-medium text-base ml-1">{period}</span>
      )}
    </div>
  );
}
