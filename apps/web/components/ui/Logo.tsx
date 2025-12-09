import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface LogoProps {
  href?: string;
  className?: string;
  showDot?: boolean;
}

export function Logo({ href = '/', className, showDot = true }: LogoProps) {
  const logoContent = (
    <span className={cn('font-sans font-bold text-black text-xl md:text-2xl tracking-tight', className)}>
      Specify{showDot && <span className="text-primary">.</span>}AI
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label="Specify.AI homepage" className="inline-block no-underline">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
