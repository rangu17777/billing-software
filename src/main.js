import { auth } from './shared/firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { initCommandPalette } from './shared/command-palette.js';

const routes = {
  login:     () => import('./auth/auth.js'),
  dashboard: () => import('./dashboard/dashboard.js'),
  bills:     () => import('./bills/bill-list.js'),
  'new-bill':() => import('./bills/bill-creator.js'),
  clients:   () => import('./clients/clients.js'),
};

let currentRoute = null;

// ── Gold rule sweep overlay (shared DOM node, created once) ──────────────────
let goldRuleEl = null;
function getGoldRule() {
  if (!goldRuleEl) {
    goldRuleEl = document.createElement('div');
    goldRuleEl.id = 'forge-gold-rule';
    goldRuleEl.style.cssText = `
      position:fixed; top:0; left:-100%; width:100%; height:2px;
      background:linear-gradient(90deg,transparent,#C8A24B 30%,#E3C36B 60%,transparent);
      z-index:9999; pointer-events:none;
      transition:none;
    `;
    document.body.appendChild(goldRuleEl);
  }
  return goldRuleEl;
}
function sweepGoldRule() {
  const el = getGoldRule();
  el.style.transition = 'none';
  el.style.left = '-100%';
  // Force reflow
  void el.offsetWidth;
  el.style.transition = 'left 320ms cubic-bezier(0.4,0,0.2,1)';
  el.style.left = '100%';
  setTimeout(() => { el.style.left = '-100%'; }, 360);
}

export async function navigate(route, params = {}) {
  if (!routes[route]) route = 'dashboard';

  const mod = await routes[route]();
  const app = document.getElementById('app');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFirstNav = app.childElementCount === 0;
  const isLoginToDash = currentRoute === 'login' && route === 'dashboard';

  currentRoute = route;

  if (!reduce && !isFirstNav) {
    // ── EXIT: slide left + Z-retreat ──
    app.style.transition = 'opacity 190ms ease, transform 190ms cubic-bezier(0.4,0,1,1)';
    app.style.opacity = '0';
    app.style.transform = 'translateX(-22px) scale(0.97)';

    // If this is login→dashboard, check for grid-zoom transition delay
    const loginDelay = (isLoginToDash && window.__loginGridTransition) ? 480 : 0;
    window.__loginGridTransition = false;

    await new Promise(r => setTimeout(r, Math.max(190, loginDelay)));

    // Sweep the gold rule between pages
    sweepGoldRule();
  }

  // Reset transform BEFORE rendering so content doesn't flash
  app.style.transition = 'none';
  app.style.opacity = '0';
  app.style.transform = 'translateX(26px) scale(0.97)';

  await mod.render(app, params);

  window.location.hash = route;

  if (!reduce) {
    // ── ENTER: spring slide from right + Z-advance ──
    requestAnimationFrame(() => {
      app.style.transition = 'opacity 340ms cubic-bezier(0.34,1.56,0.64,1), transform 340ms cubic-bezier(0.34,1.56,0.64,1)';
      app.style.opacity = '1';
      app.style.transform = 'translateX(0) scale(1)';
    });
  } else {
    app.style.opacity = '1';
    app.style.transform = '';
    app.style.transition = '';
  }
}


window.navigate = navigate;

// ── PWA service worker (production only — Vite HMR conflicts with SW in dev) ──
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* fail silently */ });
  });
}

// Check if Firebase is configured before initializing
const firebaseKey = import.meta.env.VITE_FIREBASE_API_KEY;
if (!firebaseKey || firebaseKey.startsWith('REPLACE_')) {
  document.getElementById('app').innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #D32F2F 0%, #E65100 60%, #FFC107 100%);
      font-family: system-ui, sans-serif;
      padding: 24px;
    ">
      <div style="
        background: rgba(255,255,255,0.92);
        border-radius: 16px;
        padding: 40px;
        max-width: 480px;
        width: 100%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      ">
        <div style="font-size: 2rem; font-weight: 800; color: #D32F2F; margin-bottom: 8px;">AAN</div>
        <h1 style="font-size: 1.3rem; font-weight: 700; color: #212121; margin-bottom: 16px;">
          Setup Required
        </h1>
        <p style="color: #555; line-height: 1.6; margin-bottom: 16px;">
          Add your Firebase and Supabase keys to the <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">.env</code> file to get started.
        </p>
        <ol style="color: #333; line-height: 2; padding-left: 20px; font-size: 0.9rem;">
          <li>Open <strong>.env</strong> in the project root</li>
          <li>Replace all <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">REPLACE_WITH_...</code> values</li>
          <li>Restart the dev server (<code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">npm run dev</code>)</li>
        </ol>
        <div style="margin-top: 20px; padding: 12px; background: #FFF8E1; border-radius: 8px; font-size: 0.82rem; color: #555;">
          Firebase keys → Firebase Console → Project Settings → Your apps<br/>
          Supabase keys → Supabase Dashboard → Settings → API
        </div>
      </div>
    </div>
  `;
} else {
  initCommandPalette();  // Ctrl/Cmd+K command palette (guarded to authed pages)

  // Auth gate — redirect based on login state
  onAuthStateChanged(auth, (user) => {
    const hash = window.location.hash.replace('#', '') || '';
    if (!user) {
      navigate('login');
    } else if (!hash || hash === 'login') {
      navigate('dashboard');
    } else {
      navigate(hash);
    }
  });

  // Handle hash changes (back/forward)
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== currentRoute) navigate(hash);
  });
}
