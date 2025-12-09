import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  children: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  as?: 'button' | 'a' | typeof Link;
  href?: string;
  className?: string;
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary/95 border-0', // Hover: כתום יותר בהיר, טקסט נשאר לבן, ללא מסגרת
  secondary: 'bg-text-DEFAULT text-white hover:bg-text-DEFAULT/90 active:bg-text-DEFAULT/95 border-0',
  outline: 'bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-white', // Outline variant keeps border
};

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    {
      className,
      children,
      size = 'md',
      variant = 'primary',
      as,
      href,
      disabled,
      ...props
    },
    ref
  ) {
    const baseClasses = cn(
      // Base styles - square with slightly rounded corners
      'inline-flex items-center justify-center',
      'rounded-md', // Slightly rounded corners
      'font-sans font-bold', // Montserrat Bold text
      'border-0', // No border
      'no-underline', // No underline - אין טקסט עם קו
      'transition-all duration-fast',
      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      // Size
      sizeClasses[size],
      // Variant
      variantClasses[variant],
      className
    );

    // Handle Link component
    if (as === Link || (as !== 'button' && href && !props.onClick)) {
      const LinkComponent = as === Link ? Link : 'a';
      return (
        <LinkComponent
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          href={href || '#'}
          className={baseClasses}
          {...(props as any)}
        >
          {children}
        </LinkComponent>
      );
    }

    // Handle anchor tag
    if (as === 'a' || href) {
      return (
        <a
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          href={href}
          className={baseClasses}
          {...(props as any)}
        >
          {children}
        </a>
      );
    }
    
    // Default button
    return (
      <button
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        className={baseClasses}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);
