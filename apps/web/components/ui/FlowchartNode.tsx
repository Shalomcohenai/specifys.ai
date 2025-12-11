import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface FlowchartNodeProps {
  children: ReactNode;
  className?: string;
}

export function FlowchartNode({ children, className }: FlowchartNodeProps) {
  return (
    <div
      className={cn(
        'px-4 py-3',
        'bg-purple-light',
        'rounded-md',
        'text-white',
        'font-medium',
        'text-center',
        'shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}


