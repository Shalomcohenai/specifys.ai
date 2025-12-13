import { auth, db } from './firebaseConfig.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

/**
 * Initialize user documents (users + entitlements) via API
 * Uses Firestore Transaction for atomicity
 * @param {User} user - Firebase User object
 * @param {number} retryCount - Current retry attempt
 */
async function createUserDocument(user, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [500, 1000, 2000]; // ms
  
  try {
    // Verify user is still authenticated
    if (!user) {
      return; // User logged out, skip initialization
    }
    
    const token = await user.getIdToken();
    const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
    
    const response = await fetch(`${apiBaseUrl}/api/users/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (response.status === 404) {
      // Endpoint doesn't exist - silently fail (might be development or endpoint not deployed)
      // Don't retry on 404 - it won't help
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Don't retry on network errors that suggest the endpoint doesn't exist
    if (error.message && (error.message.includes('404') || error.message.includes('Failed to fetch'))) {
      // Silently fail - endpoint might not be available
      return;
    }
    
    // Retry on other failures
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return createUserDocument(user, retryCount + 1);
    }
    // Only log error if it's not a 404 or network error
    if (!error.message || (!error.message.includes('404') && !error.message.includes('Failed to fetch'))) {
      console.error('[createUserDocument] Failed to initialize user documents after retries:', {
        uid: user?.uid,
        email: user?.email,
        error: error.message,
        stack: error.stack
      });
    }
  }
}

/**
 * Register a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<User>} - Firebase User object
 */
export async function registerWithEmail(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create user document in Firestore
    await createUserDocument(userCredential.user);
    
    return userCredential.user;
  } catch (error) {
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Login user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<User>} - Firebase User object
 */
export async function loginWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Create/update user document in Firestore
    await createUserDocument(userCredential.user);
    
    return userCredential.user;
  } catch (error) {
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Login user with Google OAuth
 * @returns {Promise<User>} - Firebase User object
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Create/update user document in Firestore
    await createUserDocument(result.user);
    
    return result.user;
  } catch (error) {
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error('Error logging out of account');
  }
}

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} - Unsubscribe function
 */
export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 * @returns {User|null} - Current user or null if not authenticated
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean} - True if user is authenticated
 */
export function isAuthenticated() {
  return !!auth.currentUser;
}

/**
 * Convert Firebase auth error codes to English messages
 * @param {string} errorCode - Firebase error code
 * @returns {string} - English error message
 */
function getAuthErrorMessage(errorCode) {
  const errorMessages = {
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Wrong password',
    'auth/email-already-in-use': 'Email address already in use',
    'auth/weak-password': 'Password is too weak',
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'Account has been disabled',
    'auth/too-many-requests': 'Too many attempts, please try again later',
    'auth/operation-not-allowed': 'Operation not allowed',
    'auth/requires-recent-login': 'Requires recent login',
    'auth/popup-closed-by-user': 'Login window was closed',
    'auth/cancelled-popup-request': 'Request was cancelled',
    'auth/popup-blocked': 'Login window was blocked',
    'auth/account-exists-with-different-credential': 'Account exists with different credentials',
    'auth/credential-already-in-use': 'Credentials already in use',
    'auth/invalid-credential': 'Invalid credentials',
    'auth/timeout': 'Connection timed out, please try again',
    'auth/network-request-failed': 'Network error, please check your internet connection'
  };
  
  return errorMessages[errorCode] || 'Unknown error';
}
