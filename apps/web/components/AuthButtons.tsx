'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

export function AuthButtons() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLoginClick = () => {
    router.push('/auth');
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (user) {
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const firstLetter = displayName.charAt(0).toUpperCase();

    return (
      <Link href="/profile" className="inline-flex items-center gap-2 no-underline">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-sans font-bold text-sm">
          {firstLetter}
        </div>
        <span className="font-sans font-bold text-text-DEFAULT text-sm hidden sm:inline">{displayName}</span>
      </Link>
    );
  }

  return (
    <Button onClick={handleLoginClick} size="sm" variant="primary">
      Log in
    </Button>
  );
}
