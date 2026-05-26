/**
 * Single source of truth for inline SVG icons (lucide-style, 2px stroke).
 * All icons render at the natural svg size — pass via `innerHTML` and let
 * width/height in the SVG dictate the box, with `currentColor` controlling
 * the stroke so they tint via CSS color.
 *
 * Naming convention: ICONS.<name> returns the SVG markup as a string.
 */

const SIZE_NAV = 17;
const SIZE_KPI = 22;

const sv = (size, body) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

// ── Top-nav icons ────────────────────────────────────────────────────────────
export const iconDashboard = sv(SIZE_NAV,
  '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>');

export const iconNewBill = sv(SIZE_NAV,
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>');

export const iconBills = sv(SIZE_NAV,
  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>');

export const iconClients = sv(SIZE_NAV,
  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>');

// ── Dashboard KPI icons ──────────────────────────────────────────────────────
export const iconRupee = sv(SIZE_KPI,
  '<path d="M6 3h12"/><path d="M6 8h12"/><path d="M6 13h3a5 5 0 0 0 0-10"/><path d="M6 13l8.5 8"/>');

export const iconCheckCircle = sv(SIZE_KPI,
  '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>');

export const iconHourglass = sv(SIZE_KPI,
  '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M17 2v4.172a2 2 0 0 1-.586 1.414L12 12 7.586 7.586A2 2 0 0 1 7 6.172V2"/>');

export const iconReceipt = sv(SIZE_KPI,
  '<path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V2l-2 2-2-2-2 2-2-2-2 2-2-2-2 2Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>');

// Convenience map (used by shell.js — same keys it already used)
export const NAV_ICONS = {
  dashboard: iconDashboard,
  newBill:   iconNewBill,
  bills:     iconBills,
  clients:   iconClients,
};
