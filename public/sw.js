/**
 * AAN Billing Software — service worker.
 *
 * Minimal worker that registers the app as a PWA so it stays installable
 * from the browser toolbar. It deliberately has NO fetch handler — modern
 * Chromium no longer requires one for installability, and an empty one only
 * adds navigation overhead (and a console warning). No caching yet, so
 * deploys stay instant with no stale-asset surprises.
 *
 * Future-proof: to add offline support later, add a `fetch` listener with a
 * real cache-first / network-falling-back strategy for static assets.
 */

self.addEventListener('install', () => {
  // Take over immediately on first install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all open tabs so they start using this SW without a reload
  event.waitUntil(self.clients.claim());
});
