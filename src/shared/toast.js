/**
 * Forge Blueprint Notification System (Option A).
 * Custom toasts and confirmation modals aligning with AAN Luminous & Forge identity.
 */

/**
 * Shows a premium skeuomorphic "Forge Blueprint" toast notification.
 * @param {string} message - Toast message content
 * @param {'success'|'error'|'warning'|'info'} type - Type of toast
 * @param {number} durationMs - Auto-dismiss timeout in milliseconds
 */
export function showToast(message, type = 'info', durationMs = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'aan-toast-blueprint';
  toast.setAttribute('role', 'alert');

  // Set uppercase label
  const labelText = type === 'info' ? 'SYSTEM INFO' : type.toUpperCase();

  // Mechanical Blueprint Theme SVG Icons
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  } else if (type === 'warning') {
    iconSvg = `<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
  } else {
    // Mechanical Gear info icon
    iconSvg = `<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`;
  }

  toast.innerHTML = `
    <!-- Corner ticks representing mechanical blueprint coordinates -->
    <span class="corner-tick corner-tl">+</span>
    <span class="corner-tick corner-tr">+</span>
    <span class="corner-tick corner-bl">+</span>
    <span class="corner-tick corner-br">+</span>
    
    <div class="aan-toast-blueprint-icon aan-toast-blueprint-${type}">
      ${iconSvg}
    </div>
    
    <div class="aan-toast-blueprint-details">
      <div class="aan-toast-blueprint-title">${labelText}</div>
      <div class="aan-toast-blueprint-message">${message}</div>
    </div>
    
    <button class="aan-toast-blueprint-close" aria-label="Dismiss">✕</button>
    <div class="aan-toast-blueprint-progress" style="animation-duration: ${durationMs}ms"></div>
  `;

  container.appendChild(toast);

  let dismissTimeout = null;
  const dismissToast = () => {
    if (dismissTimeout) clearTimeout(dismissTimeout);
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 280);
  };

  toast.querySelector('.aan-toast-blueprint-close').addEventListener('click', dismissToast);
  dismissTimeout = setTimeout(dismissToast, durationMs);
}

/**
 * Shows a premium skeuomorphic "Forge Blueprint" Confirmation Dialog with custom grid sweep animations.
 * Replaces ugly native window.confirm() boxes.
 * @param {string} title - Action title
 * @param {string} message - Clear confirmation description
 * @param {() => void} onConfirm - Triggered when user confirms
 * @param {() => void} onCancel - Triggered when user cancels
 */
export function showConfirm(title, message, onConfirm, onCancel = null) {
  const container = document.getElementById('modal-container') || document.body;

  const backdrop = document.createElement('div');
  backdrop.className = 'aan-confirm-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  backdrop.innerHTML = `
    <div class="aan-confirm-box">
      <!-- Real-time blueprint laser scanner line -->
      <div class="blueprint-draw-line"></div>
      
      <div class="aan-confirm-header">
        <h3 class="aan-confirm-title">${title}</h3>
      </div>
      <div class="aan-confirm-message">${message}</div>
      
      <div class="aan-confirm-actions">
        <button class="btn btn-ghost aan-confirm-btn" id="confirm-cancel-btn">Cancel</button>
        <button class="btn btn-primary aan-confirm-btn" id="confirm-ok-btn">Confirm</button>
      </div>
    </div>
  `;

  container.appendChild(backdrop);

  const cleanup = () => {
    backdrop.style.opacity = '0';
    const box = backdrop.querySelector('.aan-confirm-box');
    if (box) box.style.transform = 'scale(0.9) translateY(12px)';
    setTimeout(() => backdrop.remove(), 220);
  };

  backdrop.querySelector('#confirm-cancel-btn').addEventListener('click', () => {
    cleanup();
    if (onCancel) onCancel();
  });

  backdrop.querySelector('#confirm-ok-btn').addEventListener('click', () => {
    cleanup();
    if (onConfirm) onConfirm();
  });

  // Tap backdrop to cancel
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      cleanup();
      if (onCancel) onCancel();
    }
  });
}

