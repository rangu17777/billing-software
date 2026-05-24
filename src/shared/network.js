/** Throws a typed error when the browser is offline. Call before Supabase/Firebase ops. */
export function assertOnline() {
  if (!navigator.onLine) {
    const err = new Error('No internet connection.');
    err.code = 'network/offline';
    throw err;
  }
}
