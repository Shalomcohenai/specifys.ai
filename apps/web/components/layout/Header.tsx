'use client';

import dynamic from 'next/dynamic';
import { Logo } from '@/components/ui/Logo';
import { AuthButtons } from '@/components/AuthButtons';

// Dynamically import CreditsDisplay to avoid build issues
const CreditsDisplay = dynamic(
  () => import('../features/credits/CreditsDisplay').then((mod) => ({ default: mod.CreditsDisplay })),
  { 
    ssr: false,
    loading: () => null // Don't show anything while loading
  }
);

export function Header() {
  return (
    <header 
      role="banner"
      className="sticky top-0 z-header bg-bg-primary border-b border-gray-light"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-header">
          {/* Left: Auth */}
          <div className="flex items-center">
            <AuthButtons />
          </div>

          {/* Center: Logo */}
          <div className="flex items-center justify-center flex-1">
            <Logo href="/" />
          </div>

          {/* Right: Credits Display */}
          <div className="flex items-center">
            <CreditsDisplay />
          </div>
        </div>
      </div>
    </header>
  );
}
