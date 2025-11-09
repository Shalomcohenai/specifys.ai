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
 * Create or update user document in Firestore
 * @param {User} user - Firebase User object
 */
async function createUserDocument(user) {
  try {
    
    const userRef = doc(db, 'users', user.uid);
    const existingUserSnapshot = await getDoc(userRef);

    const userData = {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      emailVerified: user.emailVerified,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      newsletterSubscription: false,
      plan: 'free'
    };

    if (!existingUserSnapshot.exists()) {
      userData.free_specs_remaining = 1;
    } else {
      const currentFreeSpecs = existingUserSnapshot.data()?.free_specs_remaining;
      if (typeof currentFreeSpecs !== 'number') {
        userData.free_specs_remaining = 1;
      }
    }

    await setDoc(userRef, userData, { merge: true }); // merge: true will update existing or create new
    
    // Also create entitlements document if doesn't exist
    const entitlementsRef = doc(db, 'entitlements', user.uid);
    await setDoc(
      entitlementsRef,
      {
        userId: user.uid,
        spec_credits: 0,
        unlimited: false,
        can_edit: false,
        updated_at: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    // Don't throw - this shouldn't prevent login/registration
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
