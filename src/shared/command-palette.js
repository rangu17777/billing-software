import { logout } from '../auth/auth.js';

let paletteEl = null;
let isOpen = false;
let filtered = [];
let activeIdx = 0;

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('aan-theme', next); } catch (e) {}
}

function commands() {
  return [
    { label: 'Go to Dashboard',     hint: 'Overview & KPIs', run: () => window.navigate('dashboard') },
    { label: 'Create Bill',         hint: 'New invoice',     run: () => window.navigate('new-bill') },
    { label: 'Bills',               hint: 'All invoices',    run: () => window.navigate('bills') },
    { label: 'Clients & Machines',  hint: 'Masters',         run: () => window.navigate('clients') },
    { label: 'Toggle Light / Dark', hint: 'Theme',           run: toggleTheme },
    { label: 'Sign Out',            hint: 'End session',     run: () => logout() }
  ];
}

function ensureEl() {
  if (paletteEl) return paletteEl;
  paletteEl = document.createElement('div');
  paletteEl.className = 'cmdk-backdrop';
  paletteEl.innerHTML = `
    <div class="cmdk-box" role="dialog" aria-label="Command palette">
      <input class="cmdk-input" type="text" placeholder="Type a command or jump to a page…" autocomplete="off" spellcheck="false" />
      <div class="cmdk-list"></div>
      <div class="cmdk-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>`;
  document.body.appendChild(paletteEl);

  paletteEl.addEventListener('mousedown', (e) => { if (e.target === paletteEl) closePalette(); });

  const input = paletteEl.querySelector('.cmdk-input');
  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('keydown', onKey);

  paletteEl.querySelector('.cmdk-list').addEventListener('mousedown', (e) => {
    const item = e.target.closest('.cmdk-item');
    if (item) { e.preventDefault(); runIndex(parseInt(item.dataset.i, 10)); }
  });
  return paletteEl;
}

function renderList(query = '') {
  const q = query.trim().toLowerCase();
  const all = commands();
  filtered = q ? all.filter(c => c.label.toLowerCase().includes(q) || (c.hint || '').toLowerCase().includes(q)) : all;
  activeIdx = 0;
  const list = paletteEl.querySelector('.cmdk-list');
  list.innerHTML = filtered.length
    ? filtered.map((c, i) => `
        <div class="cmdk-item ${i === 0 ? 'active' : ''}" data-i="${i}">
          <span class="cmdk-item-label">${c.label}</span>
          <span class="cmdk-item-hint">${c.hint || ''}</span>
        </div>`).join('')
    : `<div class="cmdk-empty">No matches</div>`;
}

function setActive(i) {
  const items = paletteEl.querySelectorAll('.cmdk-item');
  if (!items.length) return;
  activeIdx = (i + items.length) % items.length;
  items.forEach((el, idx) => el.classList.toggle('active', idx === activeIdx));
  items[activeIdx].scrollIntoView({ block: 'nearest' });
}

function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIdx + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIdx - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); runIndex(activeIdx); }
  else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
}

function runIndex(i) {
  const c = filtered[i];
  closePalette();
  if (c) setTimeout(() => c.run(), 0);
}

export function openPalette() {
  // Only when an authenticated app shell is on screen (not the login page).
  if (!document.querySelector('.app-shell')) return;
  ensureEl();
  isOpen = true;
  paletteEl.classList.add('open');
  renderList('');
  const input = paletteEl.querySelector('.cmdk-input');
  input.value = '';
  setTimeout(() => input.focus(), 20);
}

export function closePalette() {
  isOpen = false;
  if (paletteEl) paletteEl.classList.remove('open');
}

export function initCommandPalette() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen ? closePalette() : openPalette();
    }
  });
}
