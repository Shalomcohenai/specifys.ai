'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type ToggleOption = {
  value: string;
  label: string;
};

interface ToggleButtonProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ToggleButton({ options, value, onChange, className }: ToggleButtonProps) {
  return (
    <div className={cn('inline-flex rounded-lg overflow-hidden border border-gray-light', className)}>
      {options.map((option, index) => {
        const isActive = option.value === value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'px-4 py-2',
              'text-sm font-bold',
              'border-0', // No border
              'transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              isActive
                ? 'bg-primary text-white'
                : 'bg-bg-primary text-text-DEFAULT hover:bg-bg-secondary',
              isFirst && 'rounded-l-lg',
              isLast && 'rounded-r-lg',
              !isFirst && !isLast && 'border-l-0' // Remove border between buttons
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}


