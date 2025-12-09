import { cn } from '@/lib/utils/cn';

export type StatusType = 'check' | 'cross';

interface StatusIconProps {
  status: StatusType;
  className?: string;
}

export function StatusIcon({ status, className }: StatusIconProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        'w-5 h-5',
        'rounded-full',
        status === 'check' ? 'bg-primary' : 'bg-gray-light',
        className
      )}
    >
      {status === 'check' ? (
        <svg
          className="w-3 h-3 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 20 20"
          style={{ strokeWidth: 2.5 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 10l3 3 7-7"
          />
        </svg>
      ) : (
        <svg
          className="w-3 h-3 text-text-DEFAULT"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
    </div>
  );
}

