'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEntitlementsCache } from '@/lib/hooks/useEntitlementsCache';
import { Button } from '@/components/ui/Button';

interface CreditsState {
  text: string;
  title: string;
  variant: 'unlimited' | 'credits' | 'loading' | 'free';
}

export function CreditsDisplay() {
  const { user } = useAuth();
  const { entitlements: entitlementsData, loading } = useEntitlementsCache();
  const [creditsState, setCreditsState] = useState<CreditsState | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Update credits state when entitlements data changes
  useEffect(() => {
    if (!user) {
      // Show "Credits: 0" when not logged in
      setIsVisible(true);
      setCreditsState({
        text: 'Credits: 0',
        title: 'Log in to see your credits',
        variant: 'credits'
      });
      return;
    }

    setIsVisible(true);

    if (loading) {
      setCreditsState({
        text: 'Loading credits…',
        title: 'Retrieving latest credits',
        variant: 'loading'
      });
      return;
    }

    if (!entitlementsData) {
      setCreditsState({
        text: 'Credits unavailable',
        title: 'Unable to load credits at the moment',
        variant: 'loading'
      });
      return;
    }

    const entitlements = entitlementsData.entitlements || {};
    const userData = entitlementsData.user || {};

    let newState: CreditsState;

    if (entitlements?.unlimited) {
      newState = {
        text: 'Plan: Pro',
        title: 'Unlimited specifications - Pro plan',
        variant: 'unlimited'
      };
    } else if (typeof entitlements?.spec_credits === 'number' && entitlements.spec_credits > 0) {
      newState = {
        text: `Credits: ${entitlements.spec_credits}`,
        title: `${entitlements.spec_credits} specification credit${entitlements.spec_credits !== 1 ? 's' : ''}`,
        variant: 'credits'
      };
    } else {
      const freeSpecs = typeof userData?.free_specs_remaining === 'number'
        ? Math.max(0, userData.free_specs_remaining)
        : 1;

      if (freeSpecs > 0) {
        newState = {
          text: `Credits: ${freeSpecs}`,
          title: `${freeSpecs} free specification${freeSpecs !== 1 ? 's' : ''} remaining`,
          variant: 'free'
        };
      } else {
        newState = {
          text: 'Credits: 0',
          title: 'No specification credits remaining',
          variant: 'credits'
        };
      }
    }

    setCreditsState(newState);
  }, [user, entitlementsData, loading]);

  const handleClick = () => {
    window.location.href = '/pricing';
  };

  if (!isVisible || !creditsState) return null;

  return (
    <Button
      onClick={handleClick}
      title={creditsState.title}
      size="sm"
      variant="primary"
    >
      {creditsState.text}
    </Button>
  );
}
