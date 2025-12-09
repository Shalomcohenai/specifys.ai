'use client';

/**
 * Firestore Utilities
 * Wrappers for common Firestore operations
 */

import { 
  collection,
  doc,
  getDoc,
  onSnapshot,
  Unsubscribe,
  DocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { getFirebaseFirestore } from './init';

/**
 * Get user document
 */
export async function getUserDocument(userId: string): Promise<DocumentSnapshot<DocumentData> | null> {
  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', userId);
  return getDoc(userRef);
}

/**
 * Get entitlements document
 */
export async function getEntitlementsDocument(userId: string): Promise<DocumentSnapshot<DocumentData> | null> {
  const db = getFirebaseFirestore();
  const entitlementsRef = doc(db, 'entitlements', userId);
  return getDoc(entitlementsRef);
}

/**
 * Listen to user document changes
 */
export function listenToUserDocument(
  userId: string,
  callback: (snapshot: DocumentSnapshot<DocumentData>) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, callback);
}

/**
 * Listen to entitlements document changes
 */
export function listenToEntitlementsDocument(
  userId: string,
  callback: (snapshot: DocumentSnapshot<DocumentData>) => void
): Unsubscribe {
  const db = getFirebaseFirestore();
  const entitlementsRef = doc(db, 'entitlements', userId);
  return onSnapshot(entitlementsRef, callback);
}

