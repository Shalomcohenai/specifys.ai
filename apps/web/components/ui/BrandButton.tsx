import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

interface BrandButtonProps {
  icon?: ReactNode;
  text: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function BrandButton({ icon, text, href, onClick, className }: BrandButtonProps) {
  const baseClasses = cn(
    'inline-flex items-center gap-2',
    'px-4 py-2',
    'bg-bg-secondary',
    'rounded-full',
    'border-0', // No border
    'text-text-DEFAULT',
    'transition-colors',
    'hover:bg-gray-light',
    onClick || href ? 'cursor-pointer' : '',
    className
  );

  const content = (
    <>
      {icon && (
        <div className="w-8 h-8 rounded-full bg-text-DEFAULT flex items-center justify-center text-white text-sm font-bold">
          {icon}
        </div>
      )}
      <span className="text-sm font-bold">{text}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(baseClasses, 'no-underline')}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={baseClasses} type="button">
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

