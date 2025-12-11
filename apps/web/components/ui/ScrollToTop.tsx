'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface ScrollToTopProps {
  className?: string;
  threshold?: number; // כמה פיקסלים לגלול לפני שהכפתור מופיע
}

export function ScrollToTop({ className, threshold = 400 }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        'fixed bottom-8 right-8',
        'w-12 h-12',
        'bg-bg-primary',
        'rounded-full',
        'border-0', // No border
        'shadow-lg',
        'flex items-center justify-center',
        'text-text-DEFAULT',
        'transition-all',
        'hover:bg-primary hover:text-white',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'z-50',
        className
      )}
      aria-label="Scroll to top"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  );
}



