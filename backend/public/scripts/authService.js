import { auth, db } from './firebaseConfig.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

/**
 * Create or update user document in Firestore
 * @param {User} user - Firebase User object
 */
async function createUserDocument(user) {
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      emailVerified: user.emailVerified,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      newsletterSubscription: false
    }, { merge: true }); // merge: true will update existing or create new
  } catch (error) {
    console.error('❌ Error creating user document:', error);
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
    
    // Create/update user document in Firestore
    await createUserDocument(userCredential.user);
    
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
    
    // Create/update user document in Firestore
    await createUserDocument(result.user);
    
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
