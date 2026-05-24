import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../shared/firebase.js';
import { handleError } from '../shared/error-handler.js';
import { showToast } from '../shared/toast.js';
import { getCleanLogo } from '../shared/logo.js';
import './auth.css';

// ── Blueprint machinery line-art ───────────────────────────────────────────────
// Thin "drawn" outlines: excavator, engine block + pistons, and gears.
// Each <path>/<circle> uses .bp-draw so CSS can stroke-animate them in.

function excavatorSVG() {
  return `<svg class="bp-machine bp-excavator" viewBox="0 0 300 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- tracks -->
    <rect class="bp-draw" x="40" y="168" width="170" height="34" rx="17"/>
    <circle class="bp-draw" cx="68" cy="185" r="11"/>
    <circle class="bp-draw" cx="125" cy="185" r="11"/>
    <circle class="bp-draw" cx="182" cy="185" r="11"/>
    <!-- cab body -->
    <path class="bp-draw" d="M60 168 L70 120 L150 120 L165 150 L200 150 L200 168 Z"/>
    <rect class="bp-draw" x="84" y="128" width="40" height="28" rx="3"/>
    <!-- boom + arm -->
    <path class="bp-draw" d="M150 130 L230 86 L262 110"/>
    <path class="bp-draw" d="M262 110 L250 150 L226 156"/>
    <!-- bucket -->
    <path class="bp-draw" d="M226 156 L214 178 L246 184 L256 160 Z"/>
  </svg>`;
}

function engineSVG() {
  return `<svg class="bp-machine bp-engine" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <!-- block -->
    <rect class="bp-draw" x="46" y="96" width="150" height="92" rx="6"/>
    <rect class="bp-draw" x="66" y="60" width="110" height="40" rx="5"/>
    <!-- pistons -->
    <rect class="bp-draw" x="80" y="24" width="18" height="44" rx="3"/>
    <rect class="bp-draw" x="118" y="14" width="18" height="54" rx="3"/>
    <rect class="bp-draw" x="156" y="30" width="18" height="38" rx="3"/>
    <line class="bp-draw" x1="89" y1="24" x2="89" y2="6"/>
    <line class="bp-draw" x1="127" y1="14" x2="127" y2="2"/>
    <line class="bp-draw" x1="165" y1="30" x2="165" y2="12"/>
    <!-- flywheel -->
    <circle class="bp-draw" cx="60" cy="150" r="26"/>
    <circle class="bp-draw" cx="60" cy="150" r="10"/>
    <!-- base bolts -->
    <line class="bp-draw" x1="60" y1="188" x2="60" y2="204"/>
    <line class="bp-draw" x1="180" y1="188" x2="180" y2="204"/>
  </svg>`;
}

function gearSVG(teeth = 12) {
  const cx = 60, cy = 60, rOut = 52, rIn = 40;
  let d = '';
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = i * step;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
  }
  d += 'Z';
  return `<svg class="bp-machine bp-gear" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path class="bp-draw" d="${d}"/>
    <circle class="bp-draw" cx="60" cy="60" r="18"/>
  </svg>`;
}

export async function render(container) {
  container.innerHTML = `
    <div class="login-page">
      <div class="bp-grid" aria-hidden="true"></div>
      <div class="bp-vignette" aria-hidden="true"></div>

      <!-- Floating machinery layers (parallax) -->
      <div class="bp-layer bp-layer-1" data-depth="22">${excavatorSVG()}</div>
      <div class="bp-layer bp-layer-2" data-depth="34">${engineSVG()}</div>
      <div class="bp-layer bp-layer-3" data-depth="14">${gearSVG(12)}</div>
      <div class="bp-layer bp-layer-4" data-depth="18">${gearSVG(9)}</div>

      <div class="login-tilt" id="login-tilt">
        <div class="login-card">
          <!-- corner registration ticks -->
          <span class="bp-tick bp-tick-tl"></span>
          <span class="bp-tick bp-tick-tr"></span>
          <span class="bp-tick bp-tick-bl"></span>
          <span class="bp-tick bp-tick-br"></span>

          <!-- Header plate (raised layer) -->
          <div class="login-plate">
            <div class="login-logo-wrap">
              <img id="login-logo" class="login-logo" alt="AA. NAGARE Infra Machinery" />
            </div>
          </div>

          <h1 class="login-title">Admin Sign In</h1>
          <p class="login-subtitle">AA. Nagare Infra Machinery</p>

          <form id="login-form" novalidate>
            <div class="float-field">
              <span class="float-tick float-tick-tl"></span>
              <span class="float-tick float-tick-tr"></span>
              <span class="float-tick float-tick-bl"></span>
              <span class="float-tick float-tick-br"></span>
              <input type="email" id="login-email" name="email" placeholder=" "
                autocomplete="email" required />
              <label for="login-email">Email address</label>
            </div>

            <div class="float-field">
              <span class="float-tick float-tick-tl"></span>
              <span class="float-tick float-tick-tr"></span>
              <span class="float-tick float-tick-bl"></span>
              <span class="float-tick float-tick-br"></span>
              <input type="password" id="login-password" name="password" placeholder=" "
                autocomplete="current-password" required />
              <label for="login-password">Password</label>
            </div>

            <button type="submit" class="btn btn-login" id="login-btn">
              <span class="btn-login-text">Sign In</span>
            </button>
          </form>
        </div>
      </div>

      <p class="login-footer">AA. Nagare Infra Machinery &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  // Logo stamp — reuse the cropped, watermark-free lockup used by the PDF.
  getCleanLogo()
    .then(l => { const img = document.getElementById('login-logo'); if (img) img.src = l.dataUrl; })
    .catch(() => {});

  // ── Pseudo-3D parallax (fine pointer + motion allowed only) ──
  const page = container.querySelector('.login-page');
  const tilt = container.querySelector('#login-tilt');
  const layers = Array.from(container.querySelectorAll('.bp-layer'));
  const allowMotion = window.matchMedia('(pointer:fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let parallaxHandler = null;
  if (allowMotion && page) {
    parallaxHandler = (e) => {
      const r = page.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
      const my = (e.clientY - r.top) / r.height - 0.5;
      if (tilt) tilt.style.transform = `rotateY(${mx * 7}deg) rotateX(${-my * 7}deg)`;
      layers.forEach(layer => {
        const d = parseFloat(layer.getAttribute('data-depth')) || 16;
        layer.style.transform = `translate3d(${-mx * d}px, ${-my * d}px, 0)`;
      });
    };
    page.addEventListener('mousemove', parallaxHandler);
    page.addEventListener('mouseleave', () => {
      if (tilt) tilt.style.transform = '';
      layers.forEach(layer => { layer.style.transform = ''; });
    });
  }

  // ── Auth flow (unchanged behavior) ──
  const form     = document.getElementById('login-form');
  const emailEl  = document.getElementById('login-email');
  const passEl   = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
      showToast('Please enter your email and password.', 'warning');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // ── Grid-zoom transition: fire before onAuthStateChanged navigates away ──
      const loginPage = container.querySelector('.login-page');
      if (loginPage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        loginPage.classList.add('bp-zoom-out');
        // Signal main.js to wait for the animation to finish before rendering dashboard
        window.__loginGridTransition = true;
      }
    } catch (error) {
      handleError(error);
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<span class="btn-login-text">Sign In</span>';
      if (error?.code?.startsWith('auth/')) {
        passEl.value = '';
        passEl.focus();
      }
    }
  });
}

export async function logout() {
  try {
    await signOut(auth);
    window.navigate('login');
    showToast('Signed out successfully.', 'success');
  } catch (error) {
    handleError(error);
  }
}
