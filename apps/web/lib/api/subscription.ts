/**
 * Subscription API
 * Handles Pro subscription management
 */

import { apiClient } from './client';
import { getCurrentUser, getUserToken } from '@/lib/firebase/auth';
import { getFirebaseFirestore } from '@/lib/firebase/init';
import { doc, getDoc } from 'firebase/firestore';

export interface Subscription {
  userId: string;
  product_id?: string;
  variant_id?: string;
  status: 'active' | 'cancelled' | 'expired' | 'payment_failed';
  lemon_subscription_id?: string;
  current_period_end?: any;
  cancel_at_period_end?: boolean;
  billing_interval?: 'month' | 'year';
  last_order_id?: string;
  last_order_total?: number;
  currency?: string;
  updated_at?: any;
  cancelled_at?: any;
}

export interface SubscriptionResponse {
  success: boolean;
  subscription?: Subscription;
}

/**
 * Get user subscription details
 * Reads directly from Firestore subscriptions collection
 */
export async function getSubscription(): Promise<Subscription | null> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User must be authenticated');
  }

  try {
    const db = getFirebaseFirestore();
    const subscriptionDoc = await getDoc(doc(db, 'subscriptions', user.uid));
    
    if (subscriptionDoc.exists()) {
      return { userId: user.uid, ...subscriptionDoc.data() } as Subscription;
    }
    
    return null;
  } catch (error: any) {
    console.error('Error getting subscription:', error);
    throw error;
  }
}

/**
 * Cancel Pro subscription
 * @param cancelAtPeriodEnd - If true, cancel at end of billing period; if false, cancel immediately
 */
export async function cancelSubscription(cancelAtPeriodEnd = true): Promise<{ success: boolean; message?: string }> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const token = await getUserToken(user);
  return apiClient.post<{ success: boolean; message?: string }>(
    '/api/lemon/subscription/cancel',
    {
      cancelAtPeriodEnd
    },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}



