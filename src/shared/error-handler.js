import { showToast } from './toast.js';

const FIREBASE_AUTH_MESSAGES = {
  'auth/invalid-email':          'Enter a valid email address.',
  'auth/user-disabled':          'This account has been disabled.',
  'auth/user-not-found':         'Admin account not found. Contact support.',
  'auth/wrong-password':         'Incorrect password. Please try again.',
  'auth/invalid-credential':     'Incorrect password. Please try again.',
  'auth/too-many-requests':      'Too many failed attempts. Try again in 5 minutes.',
  'auth/network-request-failed': 'No internet connection. Check and retry.',
  'auth/popup-closed-by-user':   'Sign-in cancelled.',
  'auth/internal-error':         'An internal error occurred. Please try again.',
};

export function handleError(error) {
  console.error('[AAN]', error);

  if (error?.code?.startsWith('auth/')) {
    showToast(FIREBASE_AUTH_MESSAGES[error.code] ?? `Login failed: ${error.message}`, 'error');
    return;
  }

  if (error?.code === 'network/offline') {
    showToast('No internet connection. Check and retry.', 'error');
    return;
  }

  showToast(error?.message || 'An unexpected error occurred. Please try again.', 'error');
}
