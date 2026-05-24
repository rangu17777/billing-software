---
skill: error-handling-patterns
version: 1.0.0
project: AAN Billing Software
applies-to: ["src/**/*.js"]
trigger: "any time async operations, Firebase, Supabase, PDF generation, or network code is written"
resources:
  - references/details.md
---

# Error Handling Patterns — AAN Billing Software

## Purpose

Provide consistent, recoverable error handling for all async operations in Vanilla JS.
This is a single-user admin app — errors must preserve bill data and never leave the UI
in a broken state.

## Core Pattern: Try/Catch with Toast

Every async operation follows this exact pattern:

```js
async function performAction(data) {
  try {
    showLoadingState();
    const result = await apiCall(data);
    showToast('Action completed successfully.', 'success');
    return result;
  } catch (error) {
    handleError(error);
    return null;
  } finally {
    hideLoadingState();
  }
}
```

## Error Category Map

| Source | Error Identifier | User-Facing Message | Recovery |
|---|---|---|---|
| Firebase Auth | `auth/wrong-password` | "Incorrect password. Please try again." | Re-focus password field |
| Firebase Auth | `auth/user-not-found` | "Admin account not found." | Show support contact |
| Firebase Auth | `auth/network-request-failed` | "No internet. Check connection." | Retry button |
| Firebase Auth | `auth/too-many-requests` | "Too many attempts. Wait 5 minutes." | Show countdown timer |
| Supabase | `PGRST116` (no rows) | "Record not found." | Navigate back |
| Supabase | `23505` (unique violation) | "Bill number conflict. Retrying…" | Auto-increment, retry once |
| Supabase | Network error | "Could not reach server. Check internet." | Retry button |
| jsPDF | Any | "PDF could not be generated. Try again." | Toast only, keep bill open |
| SheetJS | Any | "Excel export failed. Try again." | Toast only |
| Network | `network/offline` | "No internet connection." | Retry button |

## Bill Data Protection Rules

1. **Never clear the Bill Creator form on a Supabase error** — preserve all user input.
2. **Confirm before delete** — show a dialog: "Delete Bill No. XXXX? This cannot be undone."
3. **Auto-save draft to localStorage every 30 seconds** while creating or editing a bill.
4. **On PDF failure, stay on bill view** — do not navigate away.
5. **On Supabase 23505**, retry once with the next bill number before surfacing an error.

## Toast System (src/shared/toast.js)

```js
// type: 'success' | 'error' | 'info' | 'warning'
showToast(message, type = 'info', durationMs = 4000)
```

Appends a toast element to `#toast-container` in the DOM. Auto-removes after `durationMs`.
Color mapping: success → `#2E7D32`, error → `#B71C1C`, info → `#1A237E`, warning → `#E65100`.

## Extended Reference

For: full Firebase error code map, Supabase destructure patterns, `hours-utils.js` implementation,
`draft-manager.js`, `amount-words.js` signature, `assertOnline()` helper — see `references/details.md`.
