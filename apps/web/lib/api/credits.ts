/**
 * Credits API
 * Handles credit transactions and history
 */

import { apiClient } from './client';
import { getCurrentUser, getUserToken } from '@/lib/firebase/auth';

export interface Transaction {
  id: string;
  userId: string;
  amount: number; // חיובי ל-grant, שלילי ל-consume
  type: 'grant' | 'consume' | 'refund';
  source: string;
  specId?: string;
  orderId?: string;
  transactionId: string;
  metadata?: {
    previousCredits?: number;
    remaining?: number;
    creditType?: 'unlimited' | 'paid' | 'free';
    reason?: string;
    originalTransactionId?: string;
  };
  timestamp: any;
  createdAt?: any;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  count: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Get credit transactions for a user
 * @param userId - Optional user ID (admin only)
 * @param limit - Maximum number of transactions to return (default: 50, max: 100)
 * @returns Transactions response
 */
export async function getTransactions(userId?: string, limit = 50): Promise<TransactionsResponse> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const token = await getUserToken(user);
  const params: any = { limit: Math.min(limit, 100) };
  if (userId) {
    params.userId = userId;
  }

  const queryString = new URLSearchParams(params).toString();
  return apiClient.get<TransactionsResponse>(`/api/credits/transactions?${queryString}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}



