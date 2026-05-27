/**
 * AAN Billing Software — service worker.
 *
 * Minimal pass-through worker. Its sole job today is to satisfy the
 * Chromium PWA-install eligibility heuristic ("has a manifest + a service
 * worker with a fetch handler"). It does NOT cache anything yet, which
 * keeps deploys instant — no stale-asset surprises for the admin.
 *
 * Future-proof: when offline support is wanted, replace the fetch handler
 * with a cache-first / network-falling-back strategy for static assets.
 */

self.addEventListener('install', () => {
  // Take over immediately on first install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all open tabs so they start using this SW without a reload
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Pass-through. (Empty handler still counts toward installability.)
});
