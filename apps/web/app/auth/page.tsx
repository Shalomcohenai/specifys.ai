'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  getRedirectResult
} from 'firebase/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import { getFirebaseAuth } from '@/lib/firebase/init';
import { apiClient as api } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';

const googleProvider = new GoogleAuthProvider();

export default function AuthPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  // Check for redirect result
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        setIsProcessingRedirect(true);
        const auth = getFirebaseAuth();
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await createUserDocument(result.user);
          setSuccess('Login successful! Redirecting...');
          setTimeout(() => {
            router.push('/');
          }, 1500);
        }
      } catch (err: any) {
        setError(getAuthErrorMessage(err.code));
      } finally {
        setIsProcessingRedirect(false);
      }
    };

    checkRedirectResult();
  }, [router]);

  const createUserDocument = async (user: any) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [500, 1000, 2000];

    for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
      try {
        const token = await user.getIdToken();
        await api.post(
          '/users/initialize',
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        return;
      } catch (error: any) {
        if (retryCount < MAX_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        } else {
          throw error;
        }
      }
    }
  };

  const getAuthErrorMessage = (errorCode: string): string => {
    const errorMessages: { [key: string]: string } = {
      'auth/user-not-found': 'User not found',
      'auth/wrong-password': 'Wrong password',
      'auth/email-already-in-use': 'Email already in use',
      'auth/weak-password': 'Password too weak',
      'auth/invalid-email': 'Invalid email',
      'auth/user-disabled': 'Account disabled',
      'auth/too-many-requests': 'Too many attempts, try again later',
      'auth/operation-not-allowed': 'Operation not allowed',
      'auth/requires-recent-login': 'Requires recent login',
      'auth/popup-closed-by-user': 'Login window closed',
      'auth/cancelled-popup-request': 'Request cancelled',
      'auth/popup-blocked': 'Login window blocked',
      'auth/account-exists-with-different-credential': 'Account exists with different credential',
      'auth/credential-already-in-use': 'Credential already in use',
      'auth/invalid-credential': 'Invalid credential',
      'auth/timeout': 'Timeout, try again',
      'auth/network-request-failed': 'Network error, check internet connection'
    };
    return errorMessages[errorCode] || 'Unknown error';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (activeTab === 'register') {
      if (!privacyAgreed) {
        setError('Please agree to the Privacy Policy');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      let userCredential;
      if (activeTab === 'register') {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      await createUserDocument(userCredential.user);
      setSuccess(activeTab === 'register' ? 'Registration successful!' : 'Login successful!');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (useRedirect = false) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      if (useRedirect) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      const result = await signInWithPopup(auth, googleProvider);
      await createUserDocument(result.user);
      setSuccess('Login successful!');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked') {
        // Try redirect method
        const authInstance = getFirebaseAuth();
        await signInWithRedirect(authInstance, googleProvider);
        return;
      }
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPrivacyAgreed(false);
  };

  if (isProcessingRedirect) {
    return (
      <div className="auth-page-layout">
        <div>
          <p>Completing sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="auth-page-layout">
      {/* Left Panel - Marketing Content */}
      <div className="auth-left-panel">
        <div className="auth-left-content">
          <h1 className="auth-brand-name">Specifys.ai</h1>
          
          <div className="auth-feature-section">
            <h2>App Specification</h2>
            <p>
              Define your app requirements, features, and functionality with our intelligent
              specification tool. Create detailed technical specifications and user stories.
            </p>
          </div>

          <div className="auth-feature-section">
            <h2>Market Research</h2>
            <p>
              Conduct comprehensive market analysis to understand your target audience and
              competition. Get insights on market trends and user needs.
            </p>
          </div>

          <div className="auth-feature-section">
            <h2>Development Management</h2>
            <p>
              Manage your app development process efficiently with our project management tools.
              Track progress, coordinate teams, and ensure timely delivery.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="auth-right-panel">
        <div className="auth-form-container">
          <div className="auth-header-section">
            <h1 className="auth-welcome-title">
              {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="auth-welcome-subtitle">
              {activeTab === 'login'
                ? 'Sign in to continue your app development journey'
                : 'Start your app development journey today'}
            </p>
          </div>

          {/* Tab Buttons */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => switchTab('login')}
            >
              Login
            </button>
            <button
              className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => switchTab('register')}
            >
              Register
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="auth-message error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="auth-message success" role="alert">
              {success}
            </div>
          )}

          {/* Login Form */}
          <form
            id="login-form"
            className={`auth-form ${activeTab === 'login' ? 'active' : ''}`}
            onSubmit={handleEmailAuth}
          >
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit"  disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Register Form */}
          <form
            id="register-form"
            className={`auth-form ${activeTab === 'register' ? 'active' : ''}`}
            onSubmit={handleEmailAuth}
          >
            <div className="form-group">
              <label htmlFor="register-email">Email</label>
              <input
                type="email"
                id="register-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Password</label>
              <input
                type="password"
                id="register-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group" id="privacy-policy-group">
              <label>
                <input
                  type="checkbox"
                  id="privacy-policy-agreement"
                  checked={privacyAgreed}
                  onChange={(e) => setPrivacyAgreed(e.target.checked)}
                  disabled={loading}
                />
                I agree to the{' '}
                <Link href="/privacy" target="_blank">
                  Privacy Policy
                </Link>
              </label>
              {error && error.includes('Privacy Policy') && (
                <div className="form-error" id="privacy-policy-error">
                  {error}
                </div>
              )}
            </div>
            <Button type="submit"  disabled={loading || !privacyAgreed}>
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </form>

          {/* Google Auth */}
          <div className="auth-divider">
            <span>or</span>
          </div>
          <Button
            
            onClick={() => handleGoogleAuth(false)}
            disabled={loading}
            className="w-full"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <path
                d="M17.64 9.20454C17.64 8.56636 17.5827 7.95272 17.4764 7.36363H9V10.8449H13.8436C13.635 11.9699 13.0009 12.9231 12.0477 13.5613V15.8195H15.9564C17.1882 14.6818 17.64 12.9545 17.64 9.20454Z"
                fill="#4285F4"
              />
              <path
                d="M9 18C11.43 18 13.467 17.1941 14.9564 15.8195L11.0477 13.5613C10.2418 14.1013 9.21091 14.4204 9 14.4204C6.65455 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z"
                fill="#34A853"
              />
              <path
                d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40681 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54772 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65455 3.57955 9 3.57955Z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </main>
  );
}

