import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface SocialIcon {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SocialIconsProps {
  icons: SocialIcon[];
  className?: string;
}

export function SocialIcons({ icons, className }: SocialIconsProps) {
  return (
    <div className={cn('flex items-center gap-3 md:gap-4', className)}>
      {icons.map((icon, index) => (
        <Link
          key={index}
          href={icon.href}
          target={icon.href.startsWith('http') ? '_blank' : undefined}
          rel={icon.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          aria-label={icon.label}
          className="font-sans text-text-DEFAULT hover:text-primary transition-colors no-underline"
        >
          {icon.icon}
        </Link>
      ))}
    </div>
  );
}
