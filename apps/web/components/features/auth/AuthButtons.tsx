'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

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
      <Link href="/profile" className="new-user-button">
        <div className="new-user-avatar">{firstLetter}</div>
        <span className="new-user-text">{displayName}</span>
      </Link>
    );
  }

  return (
    <button className="new-login-button" onClick={handleLoginClick}>
      Log in/Sign up
    </button>
  );
}
