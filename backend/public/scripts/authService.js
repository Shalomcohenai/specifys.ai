import { auth } from './firebaseConfig.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

/**
 * Register a new user with email and password
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<User>} - Firebase User object
 */
export async function registerWithEmail(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User registered successfully:', userCredential.user.email);
    return userCredential.user;
  } catch (error) {
    console.error('Registration error:', error);
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
    console.log('User logged in successfully:', userCredential.user.email);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
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
    console.log('Google login successful:', result.user.email);
    return result.user;
  } catch (error) {
    console.error('Google login error:', error);
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
    console.log('User logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error('שגיאה ביציאה מהחשבון');
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
 * Convert Firebase auth error codes to Hebrew messages
 * @param {string} errorCode - Firebase error code
 * @returns {string} - Hebrew error message
 */
function getAuthErrorMessage(errorCode) {
  const errorMessages = {
    'auth/user-not-found': 'משתמש לא נמצא',
    'auth/wrong-password': 'סיסמה שגויה',
    'auth/email-already-in-use': 'כתובת אימייל כבר בשימוש',
    'auth/weak-password': 'הסיסמה חלשה מדי',
    'auth/invalid-email': 'כתובת אימייל לא תקינה',
    'auth/user-disabled': 'החשבון הושבת',
    'auth/too-many-requests': 'יותר מדי ניסיונות, נסה שוב מאוחר יותר',
    'auth/operation-not-allowed': 'פעולה לא מורשית',
    'auth/requires-recent-login': 'נדרש להתחבר מחדש',
    'auth/popup-closed-by-user': 'חלון ההתחברות נסגר',
    'auth/cancelled-popup-request': 'בקשה בוטלה',
    'auth/popup-blocked': 'חלון ההתחברות נחסם',
    'auth/account-exists-with-different-credential': 'חשבון קיים עם פרטי התחברות שונים',
    'auth/credential-already-in-use': 'פרטי התחברות כבר בשימוש',
    'auth/invalid-credential': 'פרטי התחברות לא תקינים',
    'auth/timeout': 'פג הזמן, נסה שוב',
    'auth/network-request-failed': 'שגיאת רשת, בדוק את החיבור לאינטרנט'
  };
  
  return errorMessages[errorCode] || 'שגיאה לא ידועה';
}
