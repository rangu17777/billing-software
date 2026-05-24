/**
 * AAN Confetti Engine — Lightweight canvas particle celebration
 * Brand palette: gold (#C9A227) + lavender (#BDB8FF) + cream (#FEF9EB)
 * No external dependencies. Hardware-accelerated via rAF.
 */

const MILESTONES = [10, 25, 50, 100, 250, 500];
const LS_PREFIX  = 'aan-milestone-';

// Particle config
const COLORS = ['#C9A227', '#d4b23c', '#BDB8FF', '#a89bff', '#FEF9EB', '#C9A227', '#e0d4a0'];
const PARTICLE_COUNT = 110;
const GRAVITY  = 0.28;
const DRAG     = 0.97;
const DURATION = 3200; // ms

/**
 * Check milestone and fire confetti if this is the first time hitting it.
 * @param {number} invoiceCount
 */
export function checkMilestone(invoiceCount) {
  if (!invoiceCount || invoiceCount <= 0) return;
  // Find the largest milestone ≤ invoiceCount that hasn't been celebrated yet
  for (const m of MILESTONES) {
    if (invoiceCount >= m && !localStorage.getItem(LS_PREFIX + m)) {
      localStorage.setItem(LS_PREFIX + m, '1');
      fireConfetti(m);
      break; // only one celebration per page load
    }
  }
}

/**
 * Fire a confetti burst for the given milestone number.
 * @param {number} milestone
 */
function fireConfetti(milestone) {
  // Reduced motion guard
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Create toast-style milestone banner
  showMilestoneBanner(milestone);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'aan-confetti-canvas';
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '9998',
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  const onResize = () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', onResize);

  // Build particles — burst from top-center with random spread
  const particles = Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = (Math.random() * 180 - 90) * (Math.PI / 180); // -90° to +90°
    const speed = 4 + Math.random() * 9;
    const size  = 5 + Math.random() * 7;
    const shape = Math.random() < 0.5 ? 'rect' : 'circle';
    return {
      x:  W * 0.5 + (Math.random() - 0.5) * W * 0.4,
      y: -10,
      vx: Math.sin(angle) * speed,
      vy: Math.cos(angle) * speed * -1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      shape,
      opacity: 1,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.06 + Math.random() * 0.04,
    };
  });

  const startTime = performance.now();

  const tick = (now) => {
    const elapsed = now - startTime;
    if (elapsed > DURATION) {
      canvas.remove();
      window.removeEventListener('resize', onResize);
      return;
    }

    ctx.clearRect(0, 0, W, H);

    const progress = elapsed / DURATION;

    particles.forEach(p => {
      // Physics
      p.vy   += GRAVITY;
      p.vx   *= DRAG;
      p.vy   *= DRAG;
      p.x    += p.vx;
      p.y    += p.vy;
      p.rotation += p.rotationSpeed;
      p.wobble   += p.wobbleSpeed;
      p.x        += Math.sin(p.wobble) * 0.6;

      // Fade out in last 30% of duration
      p.opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

      if (p.y > H + 20 || p.opacity <= 0) return;

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/**
 * Show a slim celebration banner above the KPI grid.
 */
function showMilestoneBanner(milestone) {
  const banner = document.createElement('div');
  banner.id = 'aan-milestone-banner';
  banner.setAttribute('aria-live', 'polite');
  const msgs = {
    10:  '🎉 10 Invoices! Your billing engine is warming up.',
    25:  '🚀 25 Invoices! AA Nagare is gaining momentum.',
    50:  '⭐ 50 Invoices! Half a century of precision billing.',
    100: '🏆 100 Invoices! A landmark achievement for AA Nagare Infra!',
    250: '💎 250 Invoices! Elite-tier billing performance.',
    500: '👑 500 Invoices! AA Nagare Infra Machinery — Legendary!',
  };
  banner.textContent = msgs[milestone] || `🎊 ${milestone} Invoices milestone reached!`;

  Object.assign(banner.style, {
    position: 'fixed',
    top: '80px',
    left: '50%',
    transform: 'translateX(-50%) translateY(-20px)',
    zIndex: '9999',
    background: 'linear-gradient(135deg, #C9A227, #897E01)',
    color: '#fff',
    padding: '12px 28px',
    borderRadius: '999px',
    fontFamily: 'var(--font-display, sans-serif)',
    fontWeight: '700',
    fontSize: '0.92rem',
    boxShadow: '0 8px 32px rgba(201,162,39,0.4)',
    opacity: '0',
    transition: 'opacity 400ms, transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
  });

  document.body.appendChild(banner);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      banner.style.opacity = '1';
      banner.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  // Animate out after 3.5s
  setTimeout(() => {
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(-50%) translateY(-16px)';
    setTimeout(() => banner.remove(), 500);
  }, 3500);
}
