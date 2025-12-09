'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface ProcessStepProps {
  icon: ReactNode;
  label: string;
  className?: string;
}

export function ProcessStep({ icon, label, className }: ProcessStepProps) {
  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* Icon Circle */}
      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white shadow-md mb-3">
        <div className="text-2xl">{icon}</div>
      </div>
      {/* Label */}
      <h4 className="font-heading text-text-DEFAULT font-bold text-base md:text-lg">{label}</h4>
    </div>
  );
}
