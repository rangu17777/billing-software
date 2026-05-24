# Extended Error Handling Reference — AAN Billing Software

## Firebase Auth Error Code Map

```js
// src/auth/auth-errors.js
export const FIREBASE_AUTH_MESSAGES = {
  'auth/invalid-email':           'Enter a valid email address.',
  'auth/user-disabled':           'This account has been disabled.',
  'auth/user-not-found':          'Admin account not found. Contact support.',
  'auth/wrong-password':          'Incorrect password. Please try again.',
  'auth/too-many-requests':       'Too many failed attempts. Try again in 5 minutes.',
  'auth/network-request-failed':  'No internet connection. Check and retry.',
  'auth/popup-closed-by-user':    'Sign-in cancelled.',
  'auth/internal-error':          'An internal error occurred. Please try again.',
  'auth/invalid-credential':      'Invalid credentials. Please try again.',
};

export function getAuthErrorMessage(error) {
  return FIREBASE_AUTH_MESSAGES[error.code] ?? `Login failed: ${error.message}`;
}
```

---

## Supabase Error Handling Pattern

Supabase JS v2 always returns `{ data, error }`. Never assume success without checking `error`:

```js
const { data, error } = await supabase
  .from('bills')
  .insert(billPayload)
  .select()
  .single();

if (error) {
  if (error.code === '23505') {
    // Unique constraint — bill_no conflict, retry with next number
    showToast('Bill number conflict. Retrying with next number…', 'warning');
    billPayload.bill_no = await getNextBillNo();
    return saveBill(billPayload);  // retry once only
  }
  throw error;  // let outer catch handle
}

return data;
```

---

## Hours Utilities — Critical Business Logic

```js
// src/shared/hours-utils.js

/**
 * Converts AAN hours input (two fields) to decimal hours for storage and calculation.
 * hours: integer (0–23)
 * minutes: one of 0, 15, 30, 45
 *
 * Examples:
 *   toDecimalHours(7, 30)  → 7.5
 *   toDecimalHours(8, 0)   → 8.0
 *   toDecimalHours(2, 45)  → 2.75
 *   toDecimalHours(1, 15)  → 1.25
 */
export function toDecimalHours(hours, minutes) {
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  if (m < 0 || m > 59) throw new Error(`Invalid minutes value: ${m}`);
  return h + (m / 60);
}

/**
 * Formats decimal hours for DISPLAY on the AAN bill.
 * This is the physical bill notation — NOT a decimal number.
 *
 * Examples:
 *   toAanHoursDisplay(7.5)   → "7.30"
 *   toAanHoursDisplay(8.75)  → "8.45"
 *   toAanHoursDisplay(2.25)  → "2.15"
 *   toAanHoursDisplay(1.0)   → "1.00"
 */
export function toAanHoursDisplay(decimalHours) {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}.${String(minutes).padStart(2, '0')}`;
}

/**
 * Parses AAN display notation back to decimal (for reading stored bills).
 * toDecimalFromAan("7.30") → 7.5
 * toDecimalFromAan("2.45") → 2.75
 */
export function toDecimalFromAan(aanString) {
  const [hoursStr, minutesStr] = aanString.split('.');
  return toDecimalHours(parseInt(hoursStr, 10), parseInt(minutesStr || '0', 10));
}
```

---

## Amount in Words — Indian Numbering

```js
// src/shared/amount-words.js

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
  'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
  'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function belowThousand(n) {
  if (n < 100) return belowHundred(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + belowHundred(n % 100) : '');
}

/**
 * Converts a rupee amount to Indian English words.
 * amountInWords(62540) → "Sixty Two Thousand Five Hundred Fourty Only"
 * amountInWords(100000) → "One Lakh Only"
 */
export function amountInWords(amount) {
  const n = Math.round(amount);
  if (n === 0) return 'Zero Only';

  let result = '';
  const crore = Math.floor(n / 10000000);
  const lakh  = Math.floor((n % 10000000) / 100000);
  const thou  = Math.floor((n % 100000) / 1000);
  const rem   = n % 1000;

  if (crore) result += belowThousand(crore) + ' Crore ';
  if (lakh)  result += belowThousand(lakh)  + ' Lakh ';
  if (thou)  result += belowThousand(thou)  + ' Thousand ';
  if (rem)   result += belowThousand(rem);

  return result.trim() + ' Only';
}
```

---

## Draft Auto-Save Manager

```js
// src/shared/draft-manager.js

const DRAFT_KEY = 'aan_bill_draft';
const AUTOSAVE_INTERVAL_MS = 30_000;

/**
 * Starts auto-saving form data to localStorage every 30 seconds.
 * getFormData: function that returns the current form state as a plain object.
 * Returns the interval ID — call clearInterval(id) to stop.
 */
export function startAutosave(getFormData) {
  return setInterval(() => {
    try {
      const data = getFormData();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        data,
        savedAt: new Date().toISOString(),
      }));
    } catch {
      // localStorage write failure is non-fatal — silently ignore
    }
  }, AUTOSAVE_INTERVAL_MS);
}

/** Returns the saved draft or null. */
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Clears the draft after a successful save. */
export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
```

---

## Network Check Helper

```js
// src/shared/network.js

/** Throws a typed error if the browser is offline. Call before any Supabase/Firebase op. */
export function assertOnline() {
  if (!navigator.onLine) {
    const err = new Error('No internet connection.');
    err.code = 'network/offline';
    throw err;
  }
}
```

---

## handleError() — Centralised Error Handler

```js
// src/shared/error-handler.js
import { getAuthErrorMessage } from '../auth/auth-errors.js';
import { showToast } from './toast.js';

export function handleError(error) {
  console.error('[AAN Error]', error);

  // Firebase Auth errors
  if (error?.code?.startsWith('auth/')) {
    showToast(getAuthErrorMessage(error), 'error');
    return;
  }

  // Network offline
  if (error?.code === 'network/offline') {
    showToast('No internet connection. Check and retry.', 'error');
    return;
  }

  // Supabase / generic
  showToast(error?.message || 'An unexpected error occurred. Please try again.', 'error');
}
```
