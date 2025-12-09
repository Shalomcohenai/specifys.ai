'use client';

/**
 * Firebase Initialization
 * Initializes Firebase app, auth, and firestore
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function initFirebase() {
  if (app) {
    return { app, auth: auth!, db: db! };
  }

  // Initialize Firebase app
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  // Initialize Auth
  auth = getAuth(app);

  // Initialize Firestore
  db = getFirestore(app);

  return { app, auth, db };
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const { auth: authInstance } = initFirebase();
    return authInstance;
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  if (!db) {
    const { db: dbInstance } = initFirebase();
    return dbInstance;
  }
  return db;
}

