import { StatusIcon } from './StatusIcon';
import { cn } from '@/lib/utils/cn';

export interface FeatureItem {
  text: string;
  included: boolean;
}

interface FeatureListProps {
  features: FeatureItem[];
  className?: string;
}

export function FeatureList({ features, className }: FeatureListProps) {
  return (
    <ul className={cn('space-y-3', className)}>
      {features.map((feature, index) => (
        <li key={index} className="flex items-start gap-3">
          <StatusIcon status={feature.included ? 'check' : 'cross'} />
          <span
            className={cn(
              'text-sm',
              feature.included ? 'text-text-DEFAULT' : 'text-text-muted'
            )}
          >
            {feature.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
