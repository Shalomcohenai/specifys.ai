'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { ProcessStep } from './ProcessStep';

export interface ProcessStepData {
  icon: ReactNode;
  label: string;
}

interface ProcessFlowProps {
  steps: ProcessStepData[];
  className?: string;
}

export function ProcessFlow({ steps, className }: ProcessFlowProps) {
  return (
    <div className={cn('flex items-center justify-center gap-4 md:gap-8', className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <ProcessStep icon={step.icon} label={step.label} />
          {/* Arrow between steps */}
          {index < steps.length - 1 && (
            <div className="mx-2 md:mx-4">
              <svg
                className="w-6 h-6 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
