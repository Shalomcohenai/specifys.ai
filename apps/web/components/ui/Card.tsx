import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
}

export function Card({
  variant = 'default',
  className,
  children,
  ...props
}: CardProps) {
  const baseStyles = 'bg-bg-primary rounded-lg';
  
  const variants = {
    default: '',
    bordered: 'border border-gray-light',
    elevated: 'shadow-md',
  };
  
  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
