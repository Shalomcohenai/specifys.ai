'use client';

/**
 * Firebase Auth Utilities
 * Wrappers for common auth operations
 */

import { 
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  getIdToken
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { getFirebaseAuth } from './init';
import { getFirebaseFirestore } from './init';

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth.currentUser;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

/**
 * Get ID token
 */
export async function getUserToken(user: User): Promise<string> {
  return getIdToken(user);
}

/**
 * Ensure user document exists in Firestore
 * Creates documents directly in Firestore without needing the backend server
 */
export async function ensureUserDocument(user: User, retryCount = 0): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [500, 1000, 2000]; // ms

  try {
    const db = getFirebaseFirestore();
    const userId = user.uid;
    const now = new Date().toISOString();

    const userRef = doc(db, 'users', userId);
    const entitlementsRef = doc(db, 'entitlements', userId);

    // Check if documents exist
    const [userDoc, entitlementsDoc] = await Promise.all([
      getDoc(userRef),
      getDoc(entitlementsRef)
    ]);

    const userExists = userDoc.exists();
    const entitlementsExist = entitlementsDoc.exists();

    // If both exist, nothing to do
    if (userExists && entitlementsExist) {
      return;
    }

    // Create user document if it doesn't exist
    if (!userExists) {
      const userData = {
        email: user.email || '',
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : ''),
        emailVerified: user.emailVerified || false,
        plan: 'free',
        free_specs_remaining: 1,
        createdAt: now,
        lastActive: now
      };
      await setDoc(userRef, userData);
      console.log('✅ Created user document in Firestore');
    }

    // Create entitlements document if it doesn't exist
    if (!entitlementsExist) {
      const entitlementsData = {
        userId: userId,
        spec_credits: 1, // New users get 1 free credit
        unlimited: false,
        can_edit: false,
        updated_at: Timestamp.now()
      };
      await setDoc(entitlementsRef, entitlementsData);
      console.log('✅ Created entitlements document in Firestore');
    }

    console.log('✅ User documents ensured in Firestore');
    
    // Trigger credits refresh
    if (typeof window !== 'undefined' && (window as any).clearEntitlementsCache) {
      (window as any).clearEntitlementsCache();
    }
    
    if (typeof window !== 'undefined' && (window as any).updateCreditsDisplay) {
      setTimeout(() => {
        (window as any).updateCreditsDisplay({ showLoading: true });
      }, 500);
    }
  } catch (error: any) {
    // Retry on failure
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return ensureUserDocument(user, retryCount + 1);
    }

    // Log error but don't throw - allow user to continue
    // The documents might already exist
    console.warn('⚠️ Error ensuring user document after retries:', error);
  }
}

