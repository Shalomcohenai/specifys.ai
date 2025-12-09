'use client';

/**
 * Entitlements API
 * Handles fetching user entitlements and credits directly from Firestore
 * No longer depends on backend API server
 */

import { getEntitlementsDocument, getUserDocument } from '@/lib/firebase/firestore';
import { getCurrentUser } from '@/lib/firebase/auth';

export interface Entitlements {
  unlimited?: boolean;
  spec_credits?: number;
}

export interface UserData {
  free_specs_remaining?: number;
}

export interface EntitlementsResponse {
  entitlements: Entitlements;
  user: UserData;
}

/**
 * Get entitlements directly from Firestore
 * This is now the primary method - no API dependency
 */
export async function getEntitlements(): Promise<EntitlementsResponse> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const [entitlementsDoc, userDoc] = await Promise.all([
    getEntitlementsDocument(user.uid),
    getUserDocument(user.uid)
  ]);

  const entitlements = entitlementsDoc?.exists() 
    ? entitlementsDoc.data() 
    : { unlimited: false, spec_credits: 0 };

  const userData = userDoc?.exists() 
    ? userDoc.data() 
    : { free_specs_remaining: 0 };

  return {
    entitlements: {
      unlimited: entitlements.unlimited || false,
      spec_credits: entitlements.spec_credits ?? 0
    },
    user: {
      free_specs_remaining: userData.free_specs_remaining ?? 0
    }
  };
}

