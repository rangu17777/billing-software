import { logout } from '../auth/auth.js';
import { getBrandLogo } from './logo.js';
import { openPalette } from './command-palette.js';
import { showToast } from './toast.js';

export function renderShell(activePage, pageTitle, contentHtml) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const navItem = (id, label, icon) => `
    <a class="topnav-item ${activePage === id ? 'active' : ''}" onclick="window.navigate('${id}')">
      ${activePage === id ? '<span class="topnav-capsule"></span>' : ''}
      <span class="topnav-icon">${icon}</span>
      <span class="topnav-label">${label}</span>
    </a>`;

  const ICONS = {
    dashboard: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    newBill: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
    bills: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    clients: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  };

  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-plate">
            <img id="brand-logo" class="brand-logo-img" alt="AA. NAGARE Infra Machinery" />
          </span>
          <span class="brand-fallback" hidden>AA. NAGARE <b>INFRA&nbsp;MACHINERY</b></span>
        </div>

        <nav class="topnav">
          ${navItem('dashboard', 'Dashboard', ICONS.dashboard)}
          ${navItem('new-bill', 'Create Bill', ICONS.newBill)}
          ${navItem('bills', 'Bills', ICONS.bills)}
          ${navItem('clients', 'Clients', ICONS.clients)}
        </nav>

        <div class="topbar-right">
          <button class="cmdk-trigger" id="cmdk-trigger-btn" title="Search / commands (Ctrl+K)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span class="cmdk-trigger-label">Search</span>
            <kbd>⌘K</kbd>
          </button>
          <span class="topbar-date">${dateStr} · ${timeStr}</span>
          <button class="theme-toggle" id="theme-toggle-btn" title="Toggle light / dark" aria-label="Toggle theme">
            <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          </button>
          <button class="topbar-logout" id="shell-logout-btn" title="Sign out" aria-label="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      <div class="pwa-banner" id="pwa-banner" hidden>
        <span class="pwa-banner-icon" aria-hidden="true">⬇</span>
        <span class="pwa-banner-text" id="pwa-banner-text">
          <strong>Install AAN Billing</strong>
          for a real desktop app — opens in its own window, no browser tab.
        </span>
        <button class="btn btn-primary" id="pwa-install-btn">Install</button>
        <button class="btn btn-ghost" id="pwa-dismiss-btn" aria-label="Dismiss install banner">Not now</button>
      </div>

      <main class="main-canvas">
        <div class="page-body page-enter">
          ${contentHtml}
        </div>
      </main>
    </div>
  `;
}

// ── Forge & Blueprint: IntersectionObserver scroll-reveal ──────────────────────
// Adds .scroll-reveal to all page blocks, then adds .in-view as they enter viewport.
// Each block is staggered by 80ms for a cascade effect.
function attachScrollReveal(container) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const targets = Array.from(container.querySelectorAll(
    '.page-body .kpi-card, .page-body .dash-section, .page-body .compliance-card, ' +
    '.page-body .card, .page-body .bc-section-label, .page-body .quick-action-btn, ' +
    '.page-body h1, .page-body h2, .page-body h3, .page-body .page-section'
  ));

  if (targets.length === 0) return;

  // Apply scroll-reveal class with staggered transition-delay
  targets.forEach((el, i) => {
    el.classList.add('scroll-reveal');
    el.style.transitionDelay = `${Math.min(i * 70, 450)}ms`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        // Once revealed, unobserve so it doesn't re-hide on scroll up
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -20px 0px'
  });

  targets.forEach(el => observer.observe(el));
}

// ── PWA install banner ───────────────────────────────────────────────────────
// Captures the Chromium `beforeinstallprompt` event and surfaces a dismissible
// banner the admin can click to install AAN Billing as a real desktop app.
// On Safari (no programmatic install) the banner shows manual instructions.
let deferredInstallPrompt = null;

function attachPwaInstall(container) {
  const banner   = container.querySelector('#pwa-banner');
  const textEl   = container.querySelector('#pwa-banner-text');
  const installB = container.querySelector('#pwa-install-btn');
  const dismissB = container.querySelector('#pwa-dismiss-btn');
  if (!banner || !installB || !dismissB) return;

  const dismissed = localStorage.getItem('aan-pwa-banner-dismissed') === '1';
  const alreadyInstalled =
    localStorage.getItem('aan-pwa-installed') === '1' ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;     // iOS Safari home-screen

  if (dismissed || alreadyInstalled) return;

  const showBanner = () => { banner.hidden = false; };
  const hideBanner = () => { banner.hidden = true; };

  // Chromium: native install prompt path
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showBanner();
  });

  installB.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    installB.disabled = true;
    try {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      hideBanner();
      if (outcome === 'accepted') {
        // The `appinstalled` event below will also fire and toast.
      } else {
        // User cancelled — treat like Not Now so we don't badger them.
        localStorage.setItem('aan-pwa-banner-dismissed', '1');
      }
    } catch { /* swallow */ }
    installB.disabled = false;
  });

  dismissB.addEventListener('click', () => {
    localStorage.setItem('aan-pwa-banner-dismissed', '1');
    hideBanner();
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('aan-pwa-installed', '1');
    hideBanner();
    showToast('Installed — find AAN Billing on your desktop.', 'success');
  });

  // Safari fallback — no `beforeinstallprompt`. If after ~1.2s nothing fired
  // and we're on iOS/macOS Safari (and not already standalone), surface the
  // manual instructions instead.
  setTimeout(() => {
    if (deferredInstallPrompt || !banner.hidden) return;
    const ua = navigator.userAgent || '';
    const isIOSSafari = /iP(ad|hone|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    const isMacSafari = /Safari/.test(ua) && /Macintosh/.test(ua) && !/Chrome|Chromium/.test(ua);
    if (isIOSSafari || isMacSafari) {
      textEl.innerHTML = '<strong>Install AAN Billing</strong>tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.';
      installB.hidden = true;
      showBanner();
    }
  }, 1200);
}

// Toggle a `.scrolled` class on the sticky top bar once the main canvas has
// scrolled past ~10px — the CSS in global.css adds a soft drop shadow.
function attachStickyHeaderShadow(container) {
  const topbar = container.querySelector('.topbar');
  const scroller = container.querySelector('.main-canvas');
  if (!topbar || !scroller) return;

  let ticking = false;
  const sync = () => {
    ticking = false;
    topbar.classList.toggle('scrolled', scroller.scrollTop > 10);
  };
  scroller.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(sync);
  }, { passive: true });
  sync(); // initial state
}

export function attachShellEvents(container) {
  attachScrollReveal(container);
  attachStickyHeaderShadow(container);
  attachPwaInstall(container);

  // Brand logo (top bar) — auto-trimmed; falls back to text if it can't load.
  const brandImg = container.querySelector('#brand-logo');
  const brandFallback = container.querySelector('.brand-fallback');
  const brandPlate = container.querySelector('.brand-plate');
  const showBrandFallback = () => {
    if (brandPlate) brandPlate.style.display = 'none';
    if (brandFallback) brandFallback.hidden = false;
  };
  if (brandImg) {
    brandImg.onerror = showBrandFallback;
    getBrandLogo()
      .then(l => { brandImg.src = l.dataUrl; })
      .catch(showBrandFallback);
  }

  const cmdkBtn = container.querySelector('#cmdk-trigger-btn');
  if (cmdkBtn) cmdkBtn.addEventListener('click', openPalette);

  const logoutBtn = container.querySelector('#shell-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      logoutBtn.innerHTML = '<span class="spinner spinner-dark"></span> Signing out...';
      await logout();
    });
  }

  const themeBtn = container.querySelector('#theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const root = document.documentElement;
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('aan-theme', next); } catch (e) {}
    });
  }
}
