import { supabase } from '../shared/supabase.js';
import { renderShell, attachShellEvents } from '../shared/shell.js';
import { handleError } from '../shared/error-handler.js';
import { showToast, showConfirm } from '../shared/toast.js';
import { toDecimalFromAan } from '../shared/hours-utils.js';
import { amountInWords } from '../shared/amount-words.js';
import { startAutosave, loadDraft, clearDraft } from '../shared/draft-manager.js';
import './bill-creator.css';
import { getCleanLogo, generateBillPDF } from '../pdf/pdf-generator.js';
import { sendBillViaWhatsApp } from '../shared/whatsapp.js';

// ── Module state ──────────────────────────────────────────────────────────────
let clients = [];
let machines = [];
let autosaveIntervalId = null;

let billData = {
  bill_no: null,                 // null = use the server-side auto-sequence
  date: new Date().toISOString().split('T')[0],
  client_id: '',
  client_name: '',
  client_site_name: '',
  client_mobile: '',
  client_address: '',
  client_gst_no: '',
  advance: 0,
  sgstRate: 9,
  cgstRate: 9,
  sgstManual: false,
  cgstManual: false,
  subtotal: 0,
  sgst: 0,
  cgst: 0,
  grand_total: 0,
  balance: 0,
  amount_in_words: 'Zero Only',
  lineItems: [newBlankRow(1)]
};

function newBlankRow(srNo, prevDate = '') {
  return {
    sr_no: srNo,
    date: prevDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
    challan_no: '',
    machine_id: '',
    description: '',
    vehicle_no: '',
    qty_unit: '',
    qty_decimal: 0,
    rate: 0,
    amount: 0,
    amount_manual: false,
    rate_type: 'hourly'
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function render(container, params = {}) {
  if (autosaveIntervalId) { clearInterval(autosaveIntervalId); autosaveIntervalId = null; }

  // Reset billData for fresh form
  billData = {
    bill_no: null,
    date: new Date().toISOString().split('T')[0],
    client_id: '', client_name: '', client_site_name: '',
    client_mobile: '', client_address: '', client_gst_no: '',
    advance: 0, sgstRate: 9, cgstRate: 9,
    sgstManual: false, cgstManual: false,
    subtotal: 0, sgst: 0, cgst: 0,
    grand_total: 0, balance: 0, amount_in_words: 'Zero Only',
    lineItems: [newBlankRow(1)]
  };

  // Pre-fill the Bill No. with MAX(bill_no)+1 so the admin always sees what
  // number the next bill will get, while still being free to edit it.
  try {
    const { data: latest } = await supabase
      .from('bills')
      .select('bill_no')
      .order('bill_no', { ascending: false })
      .limit(1);
    billData.bill_no = (latest?.[0]?.bill_no || 0) + 1;
  } catch { /* fall through — input shows "Auto" placeholder */ }

  renderForm(container); // skeleton
  await Promise.all([fetchClients(), fetchMachines()]);

  const draft = loadDraft();
  if (draft) {
    renderForm(container, true, draft);
  } else {
    renderForm(container);
  }

  autosaveIntervalId = startAutosave(() => billData);
}

async function fetchClients() {
  try {
    const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
    if (error) throw error;
    clients = data || [];
  } catch (e) { handleError(e); }
}

async function fetchMachines() {
  try {
    const { data, error } = await supabase.from('machines').select('*').order('description', { ascending: true });
    if (error) throw error;
    machines = data || [];
  } catch (e) { handleError(e); }
}

// ── Main form render ──────────────────────────────────────────────────────────
function renderForm(container, showDraftPrompt = false, draft = null) {
  const isReady = clients.length > 0 || machines.length > 0;

  const contentHtml = `
    <div class="bill-creator-page anim-fade-in">

      ${showDraftPrompt && draft ? `
        <div class="card mb-3" style="background:#FFF8E1;border:1.5px solid var(--color-accent-yellow);padding:12px 16px;display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:var(--text-sm);font-weight:500;color:#E65100">
            Unsaved draft found from <strong>${new Date(draft.savedAt).toLocaleString()}</strong>.
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" id="load-draft-btn" style="padding:6px 12px;font-size:var(--text-xs)">Load Draft</button>
            <button class="btn btn-ghost" id="clear-draft-btn" style="padding:6px 12px;font-size:var(--text-xs)">Dismiss</button>
          </div>
        </div>
      ` : ''}

      <form id="bill-form" novalidate>

        <!-- Section 1: Bill Details -->
        <p class="bc-section-label">Bill Details</p>
        <div class="flex gap-3 mb-3" style="flex-wrap:wrap;align-items:stretch">

          <!-- Client Card -->
          <div class="card bc-client-card" style="flex:2;min-width:320px">
            <h3 class="mb-3" style="color:var(--color-navy)">Bill Header</h3>

            <div class="flex gap-2 mb-2" style="flex-wrap:wrap">

              <!-- Client combobox -->
              <div class="form-group" style="flex:1;min-width:220px">
                <label for="client-search-input">Client *
                  <span style="font-weight:400;color:var(--color-muted);font-size:var(--text-xs);margin-left:6px">
                    (type to search or create)
                  </span>
                </label>
                <div class="combobox-wrapper" id="client-combobox-wrapper">
                  <input type="text" class="combobox-input" id="client-search-input"
                    placeholder="Type client name..."
                    value="${escapeHtml(billData.client_name)}"
                    autocomplete="off" />
                  <span class="combobox-arrow">▼</span>
                  <div class="combobox-dropdown hidden" id="client-dropdown">
                    ${buildClientDropdownHTML('')}
                  </div>
                </div>
                <input type="hidden" id="bill-client-id" value="${billData.client_id}" />
                <div class="form-error-msg hidden" id="err-client-id">Please select or create a client.</div>
              </div>

              <!-- Bill date -->
              <div class="form-group" style="width:140px">
                <label for="bill-date">Bill Date *</label>
                <input type="date" id="bill-date" name="date" value="${billData.date}" required />
                <div class="form-error-msg hidden" id="err-bill-date">Required.</div>
              </div>

              <!-- Bill No. (editable, pre-filled with next auto value) -->
              <div class="form-group" style="width:120px">
                <label for="bill-no">Bill No. *</label>
                <input type="number" id="bill-no" name="bill_no" min="1" step="1"
                       value="${billData.bill_no ?? ''}" placeholder="Auto" required />
                <div class="form-error-msg hidden" id="err-bill-no">Bill number already exists.</div>
              </div>
            </div>

            <div class="divider"></div>

            <!-- Client info panel (auto-filled on selection) -->
            <div id="client-info-display" class="${billData.client_id ? '' : 'hidden'}">
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-2);font-size:var(--text-sm)">
                <div>
                  <div class="text-muted">Site / Location</div>
                  <div class="font-semibold" id="info-site" style="margin-top:2px">${escapeHtml(billData.client_site_name || '—')}</div>
                </div>
                <div>
                  <div class="text-muted">Mobile</div>
                  <div class="font-semibold" id="info-mobile" style="margin-top:2px">${escapeHtml(billData.client_mobile || '—')}</div>
                </div>
                <div>
                  <div class="text-muted">GSTIN</div>
                  <div class="font-semibold" id="info-gst" style="margin-top:2px">
                    <code class="code-chip">${escapeHtml(billData.client_gst_no || '—')}</code>
                  </div>
                </div>
              </div>
              <div class="mt-2" style="font-size:var(--text-sm)">
                <div class="text-muted">Address</div>
                <div class="font-semibold" id="info-address" style="margin-top:2px">${escapeHtml(billData.client_address || '—')}</div>
              </div>
            </div>
            <div id="client-info-placeholder" class="${billData.client_id ? 'hidden' : ''}"
              style="text-align:center;padding:20px;color:var(--color-muted);font-size:var(--text-sm)">
              Select a client or type a new name to create one inline.
            </div>
          </div>

          <!-- Grand Total Summary Card -->
          <div class="card bc-summary-card flex flex-col justify-between" style="flex:1;min-width:220px">
            <div>
              <div class="text-muted">Grand Total</div>
              <div style="font-size:2.4rem;font-weight:800;color:var(--color-primary-red);margin-top:4px" id="summary-grand-total">
                ₹${billData.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div class="mt-3">
              <div class="flex justify-between text-sm mb-1">
                <span>Subtotal:</span>
                <span class="font-semibold" id="summary-subtotal">₹${billData.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div class="flex justify-between text-sm mb-1 gst-rate-row">
                <span class="gst-rate-label">SGST&nbsp;<input type="number" id="summary-sgst-rate" class="gst-rate-input"
                  value="${billData.sgstRate}" min="0" max="50" step="0.1" />%</span>
                <span class="gst-amount-wrap">₹<input type="number" id="summary-sgst" class="gst-amount-input"
                  value="${billData.sgst}" min="0" step="1" /></span>
              </div>
              <div class="flex justify-between text-sm gst-rate-row">
                <span class="gst-rate-label">CGST&nbsp;<input type="number" id="summary-cgst-rate" class="gst-rate-input"
                  value="${billData.cgstRate}" min="0" max="50" step="0.1" />%</span>
                <span class="gst-amount-wrap">₹<input type="number" id="summary-cgst" class="gst-amount-input"
                  value="${billData.cgst}" min="0" step="1" /></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Line Items -->
        <p class="bc-section-label">Line Items</p>
        <div class="card bc-items-card mb-3">
          <table class="aan-table" id="line-items-table" style="min-width:820px">
            <thead>
              <tr>
                <th style="width:44px">Sr.</th>
                <th style="width:80px">Date *</th>
                <th style="width:90px">Challan No.</th>
                <th style="min-width:180px">Machine *</th>
                <th style="width:110px">Vehicle No.</th>
                <th style="width:190px">Qty / Unit *</th>
                <th style="width:100px">Rate (₹) *</th>
                <th style="width:110px;text-align:right">Amount (₹)</th>
                <th style="width:44px"></th>
              </tr>
            </thead>
            <tbody id="line-items-tbody">
              ${isReady ? renderLineItemRows() : '<tr><td colspan="9" style="text-align:center;padding:24px"><span class="spinner spinner-dark"></span> Loading…</td></tr>'}
            </tbody>
          </table>
          ${isReady ? `
            <div class="bc-add-row-bar">
              <button type="button" class="btn btn-ghost" id="add-row-btn" style="padding:6px 14px;font-size:var(--text-xs)">
                ➕ Add Line Item
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Section 3: Summary & Payment -->
        <p class="bc-section-label">Summary &amp; Payment</p>
        <div class="card bc-payment-card mb-3">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3)">
            <div class="form-group">
              <label for="bill-advance">Advance Received (₹)</label>
              <input type="number" id="bill-advance" value="${billData.advance}" min="0" placeholder="0" />
            </div>
            <div class="form-group">
              <label>Balance Due (₹)</label>
              <div class="font-bold" id="bill-balance"
                style="font-size:1.4rem;padding:8px 12px;background:#FFF8E1;border:1.5px solid var(--color-accent-yellow);border-radius:var(--radius-base);color:var(--color-primary-orange)">
                ₹${billData.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div class="mt-3">
            <div class="text-muted font-semibold">Amount In Words:</div>
            <div id="bill-amount-words">${escapeHtml(billData.amount_in_words)}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="bc-actions">
          <button type="button" class="btn btn-ghost" id="cancel-bill-btn" style="padding:10px 24px">Cancel</button>
          <div class="flex gap-2">
            <button type="button" class="btn btn-secondary" id="clear-bill-btn" style="padding:10px 20px">Clear Form</button>
            <button type="submit" class="btn btn-primary" id="save-bill-btn" ${isReady ? '' : 'disabled'}>
              Save Bill
            </button>
          </div>
        </div>

      </form>
    </div>
  `;

  container.innerHTML = renderShell('new-bill', 'Create Bill', contentHtml);
  attachShellEvents(container);
  if (isReady) attachFormEvents(container);

  // Draft buttons
  container.querySelector('#load-draft-btn')?.addEventListener('click', () => {
    billData = draft.data;
    billData.sgstRate = 9;
    billData.cgstRate = 9;
    recalculateTotals();
    renderForm(container);
    showToast('Draft loaded.', 'success');
  });
  container.querySelector('#clear-draft-btn')?.addEventListener('click', () => {
    clearDraft();
    renderForm(container);
  });
}

// ── Qty / Amount cell builders ────────────────────────────────────────────────
function fmtMult(n) {
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(2)).toString();
}

function qtyAutoHint(item) {
  if (item.amount_manual) return 'manual';
  const mult = parseQtyToMultiplier(item.qty_unit, item.rate_type);
  if (mult == null) return '';
  if (item.rate > 0) {
    const amt = Math.round(mult * item.rate);
    return `auto: ${fmtMult(mult)} × ₹${item.rate.toLocaleString('en-IN')} = ₹${amt.toLocaleString('en-IN')}`;
  }
  return `qty ${fmtMult(mult)}`;
}

function buildQtyCellHtml(item, idx) {
  const chipsHtml = getQtyPresets().map(p => `
    <button type="button" class="qty-chip" data-index="${idx}" data-fill="${escapeHtml(p)}"
      title="Insert &quot;${escapeHtml(p)}&quot; (right-click to remove)">${escapeHtml(p)}</button>
  `).join('');
  return `
    <div class="qty-cell" data-index="${idx}">
      <input type="text" class="row-qty" data-index="${idx}"
        value="${escapeHtml(item.qty_unit)}" autocomplete="off"
        placeholder="e.g. 7.30, full day, 2/full day, 5 brass" />
      <div class="qty-chips">
        ${chipsHtml}
        <button type="button" class="qty-chip qty-chip-hrs" data-index="${idx}" title="Hours picker (any minutes)">Hrs…</button>
        <button type="button" class="qty-chip qty-chip-add" data-index="${idx}" title="Add a quick-fill unit">＋</button>
      </div>
      <div class="qty-auto-hint" data-index="${idx}">${escapeHtml(qtyAutoHint(item))}</div>
    </div>
  `;
}

function buildAmountCellHtml(item, idx) {
  return `
    <div class="amount-cell">
      <input type="number" class="row-amount" data-index="${idx}"
        value="${item.amount || 0}" min="0" />
      <button type="button" class="amount-reset ${item.amount_manual ? '' : 'hidden'}"
        data-index="${idx}" title="Reset to auto-calculated amount">↺</button>
    </div>
  `;
}

// ── Line item row HTML ────────────────────────────────────────────────────────
function renderLineItemRows() {
  return billData.lineItems.map((item, idx) => {
    const qtyHtml = buildQtyCellHtml(item, idx);
    const amountHtml = buildAmountCellHtml(item, idx);

    return `
      <tr class="line-item-row" data-index="${idx}">
        <td style="text-align:center;font-weight:700;color:var(--color-muted)">${item.sr_no}</td>
        <td>
          <input type="text" class="row-date" data-index="${idx}"
            value="${escapeHtml(item.date)}" placeholder="DD/MM"
            style="padding:6px 8px;font-size:var(--text-sm);text-align:center;width:100%" />
        </td>
        <td>
          <input type="text" class="row-challan" data-index="${idx}"
            value="${escapeHtml(item.challan_no)}" placeholder="Challan"
            style="padding:6px 8px;font-size:var(--text-sm);width:100%" />
        </td>
        <td style="position:relative">
          <div class="combobox-wrapper" id="machine-combo-${idx}">
            <input type="text" class="combobox-input row-machine-input" data-index="${idx}"
              value="${escapeHtml(item.description)}"
              placeholder="Select or add machine..."
              autocomplete="off"
              style="font-size:var(--text-sm);padding:6px 28px 6px 8px" />
            <span class="combobox-arrow" style="right:6px;font-size:9px">▼</span>
            <div class="combobox-dropdown hidden" id="machine-drop-${idx}" style="min-width:240px">
              ${buildMachineDropdownHTML(idx, '')}
            </div>
          </div>
          <input type="hidden" class="row-machine-id" data-index="${idx}" value="${item.machine_id}" />
        </td>
        <td>
          <input type="text" class="row-vehicle-no" data-index="${idx}"
            value="${escapeHtml(item.vehicle_no)}"
            style="padding:6px 8px;font-size:var(--text-sm);color:var(--color-black);text-transform:uppercase;width:100%"
            placeholder="Vehicle No." />
        </td>
        <td>${qtyHtml}</td>
        <td>
          <input type="number" class="row-rate" data-index="${idx}"
            value="${item.rate}" min="0"
            style="padding:6px 8px;font-size:var(--text-sm);font-weight:600;text-align:right;width:100%" />
        </td>
        <td>${amountHtml}</td>
        <td style="text-align:center">
          ${billData.lineItems.length > 1 ? `
            <button type="button" class="btn btn-danger remove-row-btn" data-index="${idx}"
              style="padding:4px 8px;font-size:var(--text-xs)">✕</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// ── Dropdown HTML builders ────────────────────────────────────────────────────
function buildClientDropdownHTML(query) {
  const q = query.trim().toLowerCase();
  const filtered = q ? clients.filter(c => c.name.toLowerCase().includes(q)) : clients;

  const optionsHtml = filtered.map(c => `
    <div class="combobox-option" data-id="${c.id}" data-name="${escapeHtml(c.name)}">
      <span class="combobox-option-name">${escapeHtml(c.name)}</span>
      ${c.site_name ? `<span class="combobox-option-site">${escapeHtml(c.site_name)}</span>` : ''}
    </div>
  `).join('');

  const noMatchHtml = filtered.length === 0 && q
    ? `<div class="combobox-no-options" style="color:var(--color-muted);font-size:var(--text-xs);padding:8px 12px">No client found for "${escapeHtml(query)}"</div>`
    : '';

  const addNewLabel = q ? `Create "${escapeHtml(query)}" as new client` : 'Add new client...';
  const addNewHtml = `
    <div class="combobox-add-new" id="client-add-new" data-query="${escapeHtml(query)}"
      style="padding:10px 14px;cursor:pointer;border-top:1px solid var(--color-border);
             font-size:var(--text-sm);font-weight:600;color:var(--color-primary-red);
             display:flex;align-items:center;gap:6px">
      ➕ ${addNewLabel}
    </div>
  `;

  return optionsHtml + noMatchHtml + addNewHtml;
}

function buildMachineDropdownHTML(idx, query) {
  const q = query.trim().toLowerCase();
  const filtered = q ? machines.filter(m => m.description.toLowerCase().includes(q)) : machines;

  const optionsHtml = filtered.map(m => `
    <div class="combobox-option machine-option" data-id="${m.id}" data-name="${escapeHtml(m.description)}" data-index="${idx}">
      <span class="combobox-option-name">${escapeHtml(m.description)}</span>
      <span class="combobox-option-site">${escapeHtml(m.vehicle_no)} · ₹${parseFloat(m.default_rate).toLocaleString('en-IN')}/${m.rate_type}</span>
    </div>
  `).join('');

  const noMatchHtml = filtered.length === 0 && q
    ? `<div class="combobox-no-options" style="font-size:var(--text-xs);padding:8px 12px">No machine found for "${escapeHtml(query)}"</div>`
    : '';

  const addNewLabel = q ? `Add "${escapeHtml(query)}" as new machine` : 'Add new machine...';
  const addNewHtml = `
    <div class="combobox-add-new machine-add-new" data-query="${escapeHtml(query)}" data-index="${idx}"
      style="padding:10px 14px;cursor:pointer;border-top:1px solid var(--color-border);
             font-size:var(--text-sm);font-weight:600;color:var(--color-primary-red);
             display:flex;align-items:center;gap:6px">
      ➕ ${addNewLabel}
    </div>
  `;

  return optionsHtml + noMatchHtml + addNewHtml;
}

// ── Attach all form events ────────────────────────────────────────────────────
function attachFormEvents(container) {
  // Close all dropdowns on outside click
  document.addEventListener('click', handleOutsideClick, { capture: true });

  // ── CLIENT COMBOBOX ──
  const clientWrapper   = container.querySelector('#client-combobox-wrapper');
  const clientInput     = container.querySelector('#client-search-input');
  const clientDropdown  = container.querySelector('#client-dropdown');
  const hiddenClientId  = container.querySelector('#bill-client-id');

  clientInput.addEventListener('focus', () => {
    closeAllDropdowns(container, clientDropdown);
    clientDropdown.classList.remove('hidden');
    clientWrapper.classList.add('open');
    updateClientDropdown(clientInput.value, container);
  });

  clientInput.addEventListener('input', (e) => {
    updateClientDropdown(e.target.value, container);
    clientDropdown.classList.remove('hidden');
    if (!e.target.value) clearClientSelection(container, hiddenClientId);
  });

  clientInput.addEventListener('blur', () => {
    setTimeout(() => {
      clientDropdown.classList.add('hidden');
      clientWrapper.classList.remove('open');
      // If no client selected and user typed something invalid, reset
      if (!billData.client_id && clientInput.value) clientInput.value = '';
    }, 220);
  });

  // Client dropdown click delegation
  clientDropdown.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const opt = e.target.closest('.combobox-option');
    if (opt) {
      const id = opt.getAttribute('data-id');
      const client = clients.find(c => c.id === id);
      if (client) applyClientSelection(client, container, clientInput, hiddenClientId);
      clientDropdown.classList.add('hidden');
      clientWrapper.classList.remove('open');
      return;
    }
    const addNew = e.target.closest('#client-add-new');
    if (addNew) {
      const query = addNew.getAttribute('data-query') || clientInput.value;
      clientDropdown.classList.add('hidden');
      clientWrapper.classList.remove('open');
      openInlineClientModal(query, container, (newClient) => {
        clients.push(newClient);
        clients.sort((a, b) => a.name.localeCompare(b.name));
        applyClientSelection(newClient, container, clientInput, hiddenClientId);
        rebuildClientDropdown(container);
      });
    }
  });

  // ── BILL DATE ──
  container.querySelector('#bill-date').addEventListener('change', (e) => {
    billData.date = e.target.value;
  });

  // ── BILL NO. (editable; null falls back to server-side auto-sequence) ──
  container.querySelector('#bill-no').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    billData.bill_no = Number.isFinite(v) && v > 0 ? v : null;
    container.querySelector('#err-bill-no').classList.add('hidden');
    e.target.classList.remove('error');
  });

  // ── GST RATES (editable %) — change clears the manual-amount override so
  //    the amount auto-recomputes from the new rate ──
  container.querySelector('#summary-sgst-rate').addEventListener('input', (e) => {
    billData.sgstRate    = parseFloat(e.target.value) || 0;
    billData.sgstManual  = false;
    recalculateTotals();
    updateTotalDisplays(container);
  });
  container.querySelector('#summary-cgst-rate').addEventListener('input', (e) => {
    billData.cgstRate    = parseFloat(e.target.value) || 0;
    billData.cgstManual  = false;
    recalculateTotals();
    updateTotalDisplays(container);
  });

  // ── GST AMOUNTS (rupee value editable; marks the row as a manual override) ──
  container.querySelector('#summary-sgst').addEventListener('input', (e) => {
    billData.sgst = parseFloat(e.target.value) || 0;
    billData.sgstManual = true;
    recalculateTotals();
    updateTotalDisplays(container);
  });
  container.querySelector('#summary-cgst').addEventListener('input', (e) => {
    billData.cgst = parseFloat(e.target.value) || 0;
    billData.cgstManual = true;
    recalculateTotals();
    updateTotalDisplays(container);
  });

  // ── ADVANCE ──
  container.querySelector('#bill-advance').addEventListener('input', (e) => {
    billData.advance = parseFloat(e.target.value) || 0;
    recalculateTotals();
    updateTotalDisplays(container);
  });

  // ── ADD ROW ──
  container.querySelector('#add-row-btn').addEventListener('click', () => {
    const last = billData.lineItems[billData.lineItems.length - 1];
    const newIdx = billData.lineItems.length;
    billData.lineItems.push(newBlankRow(newIdx + 1, last?.date || ''));
    refreshLineItems(container);
    // Fade-in entrance animation on the freshly added row
    const newRow = container.querySelector(`.line-item-row[data-index="${newIdx}"]`);
    if (newRow) {
      newRow.classList.add('row-entering');
      newRow.addEventListener('animationend', () => newRow.classList.remove('row-entering'), { once: true });
    }
  });

  // ── CANCEL & CLEAR ──
  container.querySelector('#cancel-bill-btn').addEventListener('click', () => {
    document.removeEventListener('click', handleOutsideClick, { capture: true });
    window.navigate('dashboard');
  });

  container.querySelector('#clear-bill-btn').addEventListener('click', () => {
    showConfirm(
      'Clear Form',
      'Are you sure you want to clear the entire form and reset all line items? This will also remove any autosaved draft.',
      () => {
        clearDraft();
        billData = {
          bill_no: null,
          date: new Date().toISOString().split('T')[0],
          client_id: '', client_name: '', client_site_name: '',
          client_mobile: '', client_address: '', client_gst_no: '',
          advance: 0, sgstRate: 9, cgstRate: 9,
          sgstManual: false, cgstManual: false,
          subtotal: 0, sgst: 0, cgst: 0,
          grand_total: 0, balance: 0, amount_in_words: 'Zero Only',
          lineItems: [newBlankRow(1)]
        };
        document.removeEventListener('click', handleOutsideClick, { capture: true });
        renderForm(container);
        showToast('Form reset successfully.', 'success');
      }
    );
  });

  // ── SUBMIT ──
  container.querySelector('#bill-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveBill(container);
  });

  // Attach line item events
  attachLineItemsEvents(container);
}

// ── Client helper functions ───────────────────────────────────────────────────
function updateClientDropdown(query, container) {
  const dropdown = container.querySelector('#client-dropdown');
  if (dropdown) dropdown.innerHTML = buildClientDropdownHTML(query);
}

function rebuildClientDropdown(container) {
  const dropdown = container.querySelector('#client-dropdown');
  if (dropdown) dropdown.innerHTML = buildClientDropdownHTML('');
}

function applyClientSelection(client, container, inputEl, hiddenEl) {
  billData.client_id        = client.id;
  billData.client_name      = client.name;
  billData.client_site_name = client.site_name || '';
  billData.client_mobile    = client.mobile    || '';
  billData.client_address   = client.address   || '';
  billData.client_gst_no    = client.gst_no    || '';

  if (inputEl) inputEl.value = client.name;
  if (hiddenEl) hiddenEl.value = client.id;

  container.querySelector('#info-site').textContent    = client.site_name || '—';
  container.querySelector('#info-mobile').textContent  = client.mobile    || '—';
  container.querySelector('#info-gst').innerHTML       = `<code class="code-chip">${escapeHtml(client.gst_no || '—')}</code>`;
  container.querySelector('#info-address').textContent = client.address   || '—';
  container.querySelector('#client-info-display').classList.remove('hidden');
  container.querySelector('#client-info-placeholder').classList.add('hidden');
  container.querySelector('#client-search-input')?.classList.remove('error');
}

function clearClientSelection(container, hiddenEl) {
  billData.client_id = billData.client_name = billData.client_site_name =
  billData.client_mobile = billData.client_address = billData.client_gst_no = '';
  if (hiddenEl) hiddenEl.value = '';
  container.querySelector('#client-info-display').classList.add('hidden');
  container.querySelector('#client-info-placeholder').classList.remove('hidden');
}

// ── Line items events ─────────────────────────────────────────────────────────
function attachLineItemsEvents(container) {
  const tbody = container.querySelector('#line-items-tbody');

  // Machine combobox – per row
  tbody.querySelectorAll('.row-machine-input').forEach(input => {
    const idx = parseInt(input.getAttribute('data-index'), 10);
    const dropdown = container.querySelector(`#machine-drop-${idx}`);
    const wrapper  = container.querySelector(`#machine-combo-${idx}`);

    input.addEventListener('focus', () => {
      closeAllDropdowns(container, dropdown);
      dropdown.classList.remove('hidden');
      wrapper.classList.add('open');
      dropdown.innerHTML = buildMachineDropdownHTML(idx, input.value);
    });

    input.addEventListener('input', (e) => {
      dropdown.innerHTML = buildMachineDropdownHTML(idx, e.target.value);
      dropdown.classList.remove('hidden');
      if (!e.target.value) {
        billData.lineItems[idx].machine_id  = '';
        billData.lineItems[idx].description = '';
        billData.lineItems[idx].vehicle_no  = '';
        updateRowVehicleDisplay(container, idx);
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.add('hidden');
        wrapper.classList.remove('open');
        if (!billData.lineItems[idx].machine_id && input.value) input.value = '';
      }, 220);
    });

    dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const opt = e.target.closest('.machine-option');
      if (opt) {
        const machineId = opt.getAttribute('data-id');
        const machine = machines.find(m => m.id === machineId);
        if (machine) applyMachineSelection(machine, idx, container);
        dropdown.classList.add('hidden');
        wrapper.classList.remove('open');
        return;
      }
      const addNew = e.target.closest('.machine-add-new');
      if (addNew) {
        const query = addNew.getAttribute('data-query') || input.value;
        const rowIdx = parseInt(addNew.getAttribute('data-index'), 10);
        dropdown.classList.add('hidden');
        wrapper.classList.remove('open');
        openInlineMachineModal(query, container, (newMachine) => {
          machines.push(newMachine);
          machines.sort((a, b) => a.description.localeCompare(b.description));
          applyMachineSelection(newMachine, rowIdx, container);
          // Rebuild all machine dropdowns so new machine appears everywhere
          tbody.querySelectorAll('.row-machine-input').forEach(inp => {
            const i = parseInt(inp.getAttribute('data-index'), 10);
            const dd = container.querySelector(`#machine-drop-${i}`);
            if (dd) dd.innerHTML = buildMachineDropdownHTML(i, '');
          });
        });
      }
    });
  });

  // Qty / Unit (freeform text)
  tbody.querySelectorAll('.row-qty').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      billData.lineItems[idx].qty_unit = e.target.value;
      calculateRowAmount(idx);
      updateRowAmountDisplay(container, idx);
      recalculateTotals();
      updateTotalDisplays(container);
    });
    input.addEventListener('focus', (e) => e.target.select());
  });

  // Quick-fill preset chips
  tbody.querySelectorAll('.qty-chip[data-fill]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.getAttribute('data-index'), 10);
      const fill = btn.getAttribute('data-fill');
      const qtyInput = tbody.querySelector(`.row-qty[data-index="${idx}"]`);
      const current  = (qtyInput?.value || '').trim();
      // If a bare number is already typed, combine: "2" + "full day" → "2/full day"
      const numOnly = /^\d+(?:\.\d+)?$/.test(current) ? current : '';
      const value   = numOnly ? `${numOnly}/${fill}` : fill;
      billData.lineItems[idx].qty_unit      = value;
      billData.lineItems[idx].amount_manual = false;
      if (qtyInput) qtyInput.value = value;
      calculateRowAmount(idx);
      updateRowAmountDisplay(container, idx);
      recalculateTotals();
      updateTotalDisplays(container);
    });
    // Right-click / long-press to remove this preset
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const label = btn.getAttribute('data-fill');
      showConfirm('Remove unit', `Remove "${label}" from quick-fill units?`, () => {
        removeQtyPreset(label);
        refreshLineItems(container);
      });
    });
  });

  // Hours picker chip
  tbody.querySelectorAll('.qty-chip-hrs').forEach(btn => {
    btn.addEventListener('click', () => {
      openHoursPopover(container, parseInt(btn.getAttribute('data-index'), 10));
    });
  });

  // Add custom preset chip
  tbody.querySelectorAll('.qty-chip-add').forEach(btn => {
    btn.addEventListener('click', () => {
      openAddPresetPopover(container, parseInt(btn.getAttribute('data-index'), 10));
    });
  });

  // Amount (editable — manual override)
  tbody.querySelectorAll('.row-amount').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      billData.lineItems[idx].amount        = parseFloat(e.target.value) || 0;
      billData.lineItems[idx].amount_manual = true;
      updateRowAmountDisplay(container, idx);
      recalculateTotals();
      updateTotalDisplays(container);
    });
    input.addEventListener('focus', (e) => e.target.select());
  });

  // Reset amount to auto-calculated
  tbody.querySelectorAll('.amount-reset').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      billData.lineItems[idx].amount_manual = false;
      calculateRowAmount(idx);
      updateRowAmountDisplay(container, idx);
      recalculateTotals();
      updateTotalDisplays(container);
    });
  });

  // Rate
  tbody.querySelectorAll('.row-rate').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      billData.lineItems[idx].rate = parseFloat(e.target.value) || 0;
      calculateRowAmount(idx);
      updateRowAmountDisplay(container, idx);
      recalculateTotals();
      updateTotalDisplays(container);
    });
    input.addEventListener('focus', (e) => e.target.select());
  });

  // Date
  tbody.querySelectorAll('.row-date').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      billData.lineItems[idx].date = e.target.value;
    });
    input.addEventListener('focus', (e) => e.target.select());
  });

  // Challan
  tbody.querySelectorAll('.row-challan').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      billData.lineItems[idx].challan_no = e.target.value;
    });
  });

  // Vehicle No. — auto-filled from machine, editable per row
  tbody.querySelectorAll('.row-vehicle-no').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      billData.lineItems[idx].vehicle_no = e.target.value.toUpperCase();
    });
    input.addEventListener('focus', (e) => e.target.select());
  });

  // Remove row — fade/collapse out first, then splice and re-render
  tbody.querySelectorAll('.remove-row-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const row = tbody.querySelector(`.line-item-row[data-index="${idx}"]`);
      const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const finalize = () => {
        billData.lineItems.splice(idx, 1);
        billData.lineItems.forEach((it, i) => { it.sr_no = i + 1; });
        recalculateTotals();
        refreshLineItems(container);
      };
      if (!row || reducedMotion) { finalize(); return; }
      row.classList.add('row-exiting');
      let done = false;
      const onEnd = () => { if (done) return; done = true; finalize(); };
      row.addEventListener('animationend', onEnd, { once: true });
      setTimeout(onEnd, 260); // safety net if animationend doesn't fire
    });
  });
}

// ── Qty popovers (hours picker + add preset) ──────────────────────────────────
function closeQtyPopovers(container) {
  container.querySelectorAll('.qty-popover').forEach(p => p.remove());
}

function openHoursPopover(container, idx) {
  closeQtyPopovers(container);
  const cell = container.querySelector(`.qty-cell[data-index="${idx}"]`);
  if (!cell) return;
  const item = billData.lineItems[idx];
  const match = String(item.qty_unit || '').trim().match(/^(\d+)\.(\d{1,2})$/);
  const h = match ? match[1] : '';
  const m = match ? match[2] : '';

  const pop = document.createElement('div');
  pop.className = 'qty-popover';
  pop.innerHTML = `
    <div class="qty-popover-row">
      <input type="number" class="qpop-h" min="0" placeholder="Hrs" value="${h}" />
      <span>h</span>
      <input type="number" class="qpop-m" min="0" max="59" placeholder="Min" value="${m}" />
      <span>m</span>
    </div>
    <div class="qty-popover-actions">
      <button type="button" class="btn btn-ghost qpop-cancel">Cancel</button>
      <button type="button" class="btn btn-primary qpop-apply">Apply</button>
    </div>
  `;
  cell.appendChild(pop);
  pop.querySelector('.qpop-h').focus();

  pop.querySelector('.qpop-cancel').addEventListener('click', () => pop.remove());
  pop.querySelector('.qpop-apply').addEventListener('click', () => {
    const hv = parseInt(pop.querySelector('.qpop-h').value, 10) || 0;
    let   mv = parseInt(pop.querySelector('.qpop-m').value, 10) || 0;
    if (mv > 59) mv = 59;
    const value = `${hv}.${String(mv).padStart(2, '0')}`;
    billData.lineItems[idx].qty_unit      = value;
    billData.lineItems[idx].amount_manual = false;
    const qtyInput = container.querySelector(`.row-qty[data-index="${idx}"]`);
    if (qtyInput) qtyInput.value = value;
    pop.remove();
    calculateRowAmount(idx);
    updateRowAmountDisplay(container, idx);
    recalculateTotals();
    updateTotalDisplays(container);
  });
}

function openAddPresetPopover(container, idx) {
  closeQtyPopovers(container);
  const cell = container.querySelector(`.qty-cell[data-index="${idx}"]`);
  if (!cell) return;

  const pop = document.createElement('div');
  pop.className = 'qty-popover';
  pop.innerHTML = `
    <div class="qty-popover-row">
      <input type="text" class="qpop-label" placeholder="e.g. brass, trip, load" />
    </div>
    <div class="qty-popover-actions">
      <button type="button" class="btn btn-ghost qpop-cancel">Cancel</button>
      <button type="button" class="btn btn-primary qpop-add">Add</button>
    </div>
  `;
  cell.appendChild(pop);
  const inp = pop.querySelector('.qpop-label');
  inp.focus();

  const doAdd = () => {
    const v = inp.value.trim();
    pop.remove();
    if (!v) return;
    addQtyPreset(v);
    refreshLineItems(container);
    showToast(`Added quick-fill "${v}".`, 'success');
  };
  pop.querySelector('.qpop-cancel').addEventListener('click', () => pop.remove());
  pop.querySelector('.qpop-add').addEventListener('click', doAdd);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
}

// ── Machine helpers ───────────────────────────────────────────────────────────
function applyMachineSelection(machine, idx, container) {
  billData.lineItems[idx].machine_id    = machine.id;
  billData.lineItems[idx].description   = machine.description;
  billData.lineItems[idx].vehicle_no    = machine.vehicle_no;
  billData.lineItems[idx].rate_type     = machine.rate_type;
  billData.lineItems[idx].rate          = parseFloat(machine.default_rate) || 0;
  billData.lineItems[idx].amount_manual = false;

  // Seed a sensible default qty: hourly → blank (placeholder guides typing),
  // day-based → "full day". Amount auto-fills from the parser.
  billData.lineItems[idx].qty_unit = machine.rate_type === 'hourly' ? '' : 'full day';
  calculateRowAmount(idx);

  // Update the input value
  const inp = container.querySelector(`#machine-combo-${idx} .row-machine-input`);
  if (inp) inp.value = machine.description;

  updateRowVehicleDisplay(container, idx);

  // Rate_type changed — refresh just this row (re-render qty cell)
  recalculateTotals();
  refreshLineItems(container);
}

function updateRowVehicleDisplay(container, idx) {
  const veh = container.querySelector(`.row-vehicle-no[data-index="${idx}"]`);
  if (veh) veh.value = billData.lineItems[idx].vehicle_no || '';
}

function updateRowAmountDisplay(container, idx) {
  const item = billData.lineItems[idx];
  const row = container.querySelector(`.line-item-row[data-index="${idx}"]`);
  if (!row) return;
  const amtInput = row.querySelector('.row-amount');
  if (amtInput && amtInput !== document.activeElement) amtInput.value = item.amount || 0;
  const resetBtn = row.querySelector('.amount-reset');
  if (resetBtn) resetBtn.classList.toggle('hidden', !item.amount_manual);
  const hint = row.querySelector('.qty-auto-hint');
  if (hint) hint.textContent = qtyAutoHint(item);
}

// ── Dropdown helpers ──────────────────────────────────────────────────────────
function closeAllDropdowns(container, except = null) {
  container.querySelectorAll('.combobox-dropdown').forEach(dd => {
    if (dd !== except) {
      dd.classList.add('hidden');
      dd.closest('.combobox-wrapper')?.classList.remove('open');
    }
  });
}

function handleOutsideClick(e) {
  if (!e.target.closest('.combobox-wrapper')) {
    document.querySelectorAll('.combobox-dropdown').forEach(dd => dd.classList.add('hidden'));
    document.querySelectorAll('.combobox-wrapper').forEach(w => w.classList.remove('open'));
  }
}

// ── Qty parsing ───────────────────────────────────────────────────────────────
// Derives a numeric multiplier from the freeform qty/unit text so the amount can
// auto-fill. Returns null when nothing sensible can be parsed (admin types amount).
// Examples: "full day"→1, "half day"→0.5, "2/full day"→2, "5 brass"→5,
//           "7.30"(hourly)→7.5, "6.40"(hourly)→6.667, "8"(hourly)→8.
function parseQtyToMultiplier(text, rateType) {
  if (text == null) return null;
  const t = String(text).trim().toLowerCase();
  if (!t) return null;

  const leadingMatch = t.match(/^(\d+(?:\.\d+)?)/);
  const leadingNum = leadingMatch ? parseFloat(leadingMatch[1]) : null;
  const hasWord = /[a-z]/.test(t);

  if (hasWord) {
    if (/half\s*day/.test(t))    return leadingNum != null ? leadingNum * 0.5  : 0.5;
    if (/quarter\s*day/.test(t)) return leadingNum != null ? leadingNum * 0.25 : 0.25;
    if (/full\s*day/.test(t))    return leadingNum != null ? leadingNum        : 1;
    // generic unit word (brass, day(s), trip, load, …) → leading number, else 1
    return leadingNum != null ? leadingNum : 1;
  }

  // pure numeric
  if (rateType === 'hourly') {
    try {
      const dec = toDecimalFromAan(t); // "6.40" → 6.667, "8" → 8
      if (!isNaN(dec)) return dec;
    } catch { /* invalid minutes (>59) → fall through to plain number */ }
  }
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

// ── Admin-controlled qty quick-fill presets (localStorage) ─────────────────────
const QTY_PRESETS_KEY = 'aan-qty-presets';
const DEFAULT_QTY_PRESETS = ['full day', 'half day', 'brass'];

function getQtyPresets() {
  try {
    const raw = localStorage.getItem(QTY_PRESETS_KEY);
    if (!raw) return [...DEFAULT_QTY_PRESETS];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [...DEFAULT_QTY_PRESETS];
  } catch { return [...DEFAULT_QTY_PRESETS]; }
}
function saveQtyPresets(list) {
  try { localStorage.setItem(QTY_PRESETS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
function addQtyPreset(label) {
  const v = String(label || '').trim();
  const list = getQtyPresets();
  if (v && !list.some(x => x.toLowerCase() === v.toLowerCase())) { list.push(v); saveQtyPresets(list); }
  return list;
}
function removeQtyPreset(label) {
  const list = getQtyPresets().filter(x => x.toLowerCase() !== String(label).toLowerCase());
  saveQtyPresets(list);
  return list;
}

// ── Calculations ──────────────────────────────────────────────────────────────
function calculateRowAmount(idx) {
  const item = billData.lineItems[idx];
  const mult = parseQtyToMultiplier(item.qty_unit, item.rate_type);
  item.qty_decimal = mult != null ? mult : 0;
  if (!item.amount_manual) {
    item.amount = mult != null ? Math.round(mult * item.rate) : 0;
  }
}

function recalculateTotals() {
  const subtotal = billData.lineItems.reduce((s, it) => s + (it.amount || 0), 0);
  billData.subtotal    = subtotal;
  if (!billData.sgstManual) billData.sgst = Math.round(subtotal * (billData.sgstRate || 9) / 100);
  if (!billData.cgstManual) billData.cgst = Math.round(subtotal * (billData.cgstRate || 9) / 100);
  billData.grand_total = subtotal + billData.sgst + billData.cgst;
  billData.balance     = billData.grand_total - billData.advance;
  billData.amount_in_words = amountInWords(billData.grand_total);
}

function updateTotalDisplays(container) {
  container.querySelector('#summary-subtotal').textContent    = `₹${billData.subtotal.toLocaleString('en-IN')}`;
  const sgstEl = container.querySelector('#summary-sgst');
  const cgstEl = container.querySelector('#summary-cgst');
  if (sgstEl && sgstEl !== document.activeElement) sgstEl.value = billData.sgst;
  if (cgstEl && cgstEl !== document.activeElement) cgstEl.value = billData.cgst;
  const sgstRateEl = container.querySelector('#summary-sgst-rate');
  const cgstRateEl = container.querySelector('#summary-cgst-rate');
  if (sgstRateEl && sgstRateEl !== document.activeElement) sgstRateEl.value = billData.sgstRate;
  if (cgstRateEl && cgstRateEl !== document.activeElement) cgstRateEl.value = billData.cgstRate;
  container.querySelector('#summary-grand-total').textContent = `₹${billData.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  container.querySelector('#bill-balance').textContent        = `₹${billData.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  container.querySelector('#bill-amount-words').textContent   = billData.amount_in_words;
}

function refreshLineItems(container) {
  container.querySelector('#line-items-tbody').innerHTML = renderLineItemRows();
  attachLineItemsEvents(container);
  recalculateTotals();
  updateTotalDisplays(container);
}

// ── Inline modals: Create Client from bill form ───────────────────────────────
function openInlineClientModal(initialName, container, onCreated) {
  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-backdrop" id="inline-client-backdrop">
      <div class="modal-box border-beam" style="max-width:480px">
        <h3 class="mb-1" style="color:var(--color-navy)">New Client</h3>
        <p class="text-muted mb-3" style="font-size:var(--text-sm)">Created inline — appears in Clients master immediately.</p>
        <form id="inline-client-form" novalidate>
          <div class="form-group mb-2">
            <label>Client Name *</label>
            <input type="text" id="ic-name" value="${escapeHtml(initialName)}" placeholder="e.g. Venkateshwara Hatcheries PVT LTD" required />
            <div class="form-error-msg hidden" id="ic-err-name">Name is required.</div>
          </div>
          <div class="form-group mb-2">
            <label>Site Name / Location</label>
            <input type="text" id="ic-site" placeholder="e.g. Urawade, Tal Mulshi, Pune" />
          </div>
          <div class="flex gap-2 mb-2" style="flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:140px">
              <label>Mobile</label>
              <input type="tel" id="ic-mobile" placeholder="10-digit number" />
              <div class="form-error-msg hidden" id="ic-err-mobile">Enter valid 10-digit number.</div>
            </div>
            <div class="form-group" style="flex:1;min-width:160px">
              <label>GSTIN</label>
              <input type="text" id="ic-gst" placeholder="27AAACV7247H1Z4" style="text-transform:uppercase" />
              <div class="form-error-msg hidden" id="ic-err-gst">Must be 15-char GSTIN.</div>
            </div>
          </div>
          <div class="form-group mb-3">
            <label>Billing Address</label>
            <textarea id="ic-address" rows="2" placeholder="Full address..."></textarea>
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn btn-ghost" id="ic-cancel" style="flex:1">Cancel</button>
            <button type="submit" class="btn btn-primary" id="ic-save" style="flex:1">Save & Select</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const backdrop = mc.querySelector('#inline-client-backdrop');
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) mc.innerHTML = ''; });
  mc.querySelector('#ic-cancel').addEventListener('click', () => { mc.innerHTML = ''; });

  mc.querySelector('#inline-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = mc.querySelector('#ic-name').value.trim();
    const site    = mc.querySelector('#ic-site').value.trim();
    const mobile  = mc.querySelector('#ic-mobile').value.trim();
    const gst     = mc.querySelector('#ic-gst').value.trim().toUpperCase();
    const address = mc.querySelector('#ic-address').value.trim();

    let err = false;
    if (!name) { mc.querySelector('#ic-name').classList.add('error'); mc.querySelector('#ic-err-name').classList.remove('hidden'); err = true; }
    if (mobile && !/^\d{10}$/.test(mobile)) { mc.querySelector('#ic-mobile').classList.add('error'); mc.querySelector('#ic-err-mobile').classList.remove('hidden'); err = true; }
    if (gst && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) { mc.querySelector('#ic-gst').classList.add('error'); mc.querySelector('#ic-err-gst').classList.remove('hidden'); err = true; }
    if (err) return;

    const saveBtn = mc.querySelector('#ic-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

    try {
      const { data, error } = await supabase.from('clients')
        .insert([{ name, site_name: site, mobile, gst_no: gst, address }])
        .select().single();
      if (error) throw error;
      showToast(`Client "${data.name}" created and selected.`, 'success');
      mc.innerHTML = '';
      onCreated(data);
    } catch (err2) {
      handleError(err2);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save & Select';
    }
  });
}

// ── Inline modal: Create Machine from bill form ───────────────────────────────
function openInlineMachineModal(initialName, container, onCreated) {
  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-backdrop" id="inline-machine-backdrop">
      <div class="modal-box border-beam" style="max-width:440px">
        <h3 class="mb-1" style="color:var(--color-navy)">New Machine</h3>
        <p class="text-muted mb-3" style="font-size:var(--text-sm)">Created inline — appears in Machines master immediately.</p>
        <form id="inline-machine-form" novalidate>
          <div class="form-group mb-2">
            <label>Machine Description *</label>
            <input type="text" id="im-desc" value="${escapeHtml(initialName)}" placeholder="e.g. JCB, Tractor, Tractor-2" required />
            <div class="form-error-msg hidden" id="im-err-desc">Description is required.</div>
          </div>
          <div class="form-group mb-2">
            <label>Vehicle / Registration No. *</label>
            <input type="text" id="im-veh" placeholder="e.g. 0396 or MH12AB1234" style="text-transform:uppercase" required />
            <div class="form-error-msg hidden" id="im-err-veh">Vehicle number is required.</div>
          </div>
          <div class="flex gap-2 mb-3" style="flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:140px">
              <label>Rate Type *</label>
              <select id="im-rate-type">
                <option value="hourly">Hourly (per hour)</option>
                <option value="daily">Daily (per day)</option>
                <option value="full day">Full Day</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;min-width:120px">
              <label>Default Rate (₹) *</label>
              <input type="number" id="im-rate" value="0" min="0" placeholder="e.g. 1000" required />
              <div class="form-error-msg hidden" id="im-err-rate">Enter valid rate.</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button type="button" class="btn btn-ghost" id="im-cancel" style="flex:1">Cancel</button>
            <button type="submit" class="btn btn-primary" id="im-save" style="flex:1">Save & Select</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const backdrop = mc.querySelector('#inline-machine-backdrop');
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) mc.innerHTML = ''; });
  mc.querySelector('#im-cancel').addEventListener('click', () => { mc.innerHTML = ''; });

  mc.querySelector('#inline-machine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const description  = mc.querySelector('#im-desc').value.trim();
    const vehicle_no   = mc.querySelector('#im-veh').value.trim().toUpperCase();
    const rate_type    = mc.querySelector('#im-rate-type').value;
    const default_rate = parseFloat(mc.querySelector('#im-rate').value);

    let err = false;
    if (!description) { mc.querySelector('#im-desc').classList.add('error'); mc.querySelector('#im-err-desc').classList.remove('hidden'); err = true; }
    if (!vehicle_no)  { mc.querySelector('#im-veh').classList.add('error');  mc.querySelector('#im-err-veh').classList.remove('hidden'); err = true; }
    if (isNaN(default_rate) || default_rate < 0) { mc.querySelector('#im-rate').classList.add('error'); mc.querySelector('#im-err-rate').classList.remove('hidden'); err = true; }
    if (err) return;

    const saveBtn = mc.querySelector('#im-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

    try {
      const { data, error } = await supabase.from('machines')
        .insert([{ description, vehicle_no, rate_type, default_rate }])
        .select().single();
      if (error) throw error;
      showToast(`Machine "${data.description}" created and selected.`, 'success');
      mc.innerHTML = '';
      onCreated(data);
    } catch (err2) {
      handleError(err2);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save & Select';
    }
  });
}

// ── Validate + show preview modal ────────────────────────────────────────────
async function saveBill(container) {
  const form = container.querySelector('#bill-form');
  let hasError = false;

  form.querySelectorAll('.form-error-msg').forEach(el => el.classList.add('hidden'));
  form.querySelectorAll('input, select').forEach(el => el.classList.remove('error'));

  if (!billData.client_id) {
    container.querySelector('#client-search-input').classList.add('error');
    container.querySelector('#err-client-id').classList.remove('hidden');
    hasError = true;
  }
  if (!billData.date) {
    container.querySelector('#bill-date').classList.add('error');
    container.querySelector('#err-bill-date').classList.remove('hidden');
    hasError = true;
  }
  if (!(billData.bill_no > 0)) {
    const errBox  = container.querySelector('#err-bill-no');
    const inputEl = container.querySelector('#bill-no');
    if (inputEl) inputEl.classList.add('error');
    if (errBox) { errBox.textContent = 'Enter a valid bill number.'; errBox.classList.remove('hidden'); }
    hasError = true;
  }
  if (billData.lineItems.length === 0) {
    showToast('Add at least one line item.', 'warning');
    return;
  }

  billData.lineItems.forEach((item, idx) => {
    const row = form.querySelector(`.line-item-row[data-index="${idx}"]`);
    if (!item.machine_id) {
      row.querySelector('.row-machine-input').classList.add('error');
      hasError = true;
    }
    if (!String(item.qty_unit || '').trim()) {
      row.querySelector('.row-qty')?.classList.add('error');
      hasError = true;
    }
    if (!(item.amount > 0)) {
      row.querySelector('.row-amount')?.classList.add('error');
      hasError = true;
    }
  });

  if (hasError) {
    showToast('Fix the highlighted fields before saving.', 'error');
    return;
  }

  recalculateTotals();
  showBillPreviewModal(container);
}

// ── Bill preview modal ────────────────────────────────────────────────────────
function showBillPreviewModal(container) {
  const mc = document.getElementById('modal-container');

  const fmtD = (s) => {
    if (!s) return '—';
    const p = s.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
  };
  const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN');

  const itemRows = billData.lineItems.map(item => `
    <tr>
      <td style="text-align:center">${item.sr_no}</td>
      <td style="text-align:center">${escapeHtml(item.date)}</td>
      <td style="text-align:center">${escapeHtml(item.challan_no || '—')}</td>
      <td>${escapeHtml(item.description)}</td>
      <td style="text-align:center">${escapeHtml(item.vehicle_no)}</td>
      <td style="text-align:center">${escapeHtml(item.qty_unit)}</td>
      <td style="text-align:right">${fmt(item.rate)}</td>
      <td style="text-align:right"><strong>${fmt(item.amount)}</strong></td>
    </tr>
  `).join('');

  mc.innerHTML = `
    <div class="bpm-backdrop" id="bpm-modal">
      <div class="bpm-shell">

        <div class="bpm-toolbar">
          <div>
            <span class="bpm-toolbar-title">Review Bill Before Saving</span>
            <span class="bpm-toolbar-sub">Confirm all details are correct, then save.</span>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost bpm-ghost-btn" id="bpm-back-btn">← Back to Edit</button>
            <button class="btn btn-primary" id="bpm-confirm-btn" style="padding:10px 28px">
              Confirm &amp; Save Bill
            </button>
          </div>
        </div>

        <div class="bpm-scroll-area">
          <div class="bpm-paper">

            <!-- Header (cleaned logo only — matches exported PDF) -->
            <div class="bpm-company-header">
              <img id="bpm-logo" alt="AA. NAGARE Infra Machinery" class="bpm-company-logo" />
              <div class="bpm-company-addr">Add.: A/p Ambadwet, Tal. Mulshi, Dist - Pune.</div>
              <div class="bpm-company-addr bpm-mob-row">
                Mob.: 7875396396 / 9921353533 / 9822111882
                <span class="bpm-mob-gstin">GSTIN: 27BISPN4599L1Z3</span>
              </div>
              <div class="bpm-company-addr">Email: aanagre.machinery@gmail.com</div>
            </div>

            <div class="bpm-red-rule"></div>

            <!-- Client + Bill meta -->
            <div class="bpm-info-grid">
              <div class="bpm-client-info">
                <div class="bpm-to-row">
                  <span class="bpm-to-label">To.</span>
                  <span class="bpm-client-name">${escapeHtml((billData.client_name || '').toUpperCase())}</span>
                </div>
                <div class="bpm-site-row">Site Name: &nbsp;${escapeHtml(billData.client_site_name || '—')}</div>
              </div>
              <div class="bpm-bill-meta">
                <div class="bpm-meta-row"><span>Bill No.:</span><strong>${billData.bill_no ? String(billData.bill_no).padStart(4, '0') : 'Auto'}</strong></div>
                <div class="bpm-meta-row"><span>Date:</span><strong>${fmtD(billData.date)}</strong></div>
                <div class="bpm-meta-row"><span>Mobile:</span><strong>${escapeHtml(billData.client_mobile || '—')}</strong></div>
              </div>
            </div>

            <!-- Line items -->
            <div class="bpm-table-scroll">
            <table class="bpm-items-table">
              <thead>
                <tr>
                  <th>Sr.</th><th>Date</th><th>Challan No.</th><th>Description</th>
                  <th>Vehicle No.</th><th>Qty./Unit</th><th>Rate</th><th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
                <tr class="bpm-summary-row">
                  <td colspan="6" style="text-align:right"><strong>Subtotal</strong></td>
                  <td></td>
                  <td class="bpm-amt">${fmt(billData.subtotal)}</td>
                </tr>
                <tr class="bpm-summary-row">
                  <td colspan="6" style="text-align:right"><strong>SGST</strong></td>
                  <td style="text-align:center">${billData.sgstRate}%</td>
                  <td class="bpm-amt">${fmt(billData.sgst)}</td>
                </tr>
                <tr class="bpm-summary-row">
                  <td colspan="6" style="text-align:right"><strong>CGST</strong></td>
                  <td style="text-align:center">${billData.cgstRate}%</td>
                  <td class="bpm-amt">${fmt(billData.cgst)}</td>
                </tr>
              </tbody>
            </table>
            </div>

            <!-- Grand total bar -->
            <div class="bpm-grand-total-bar">
              <span>Total</span>
              <span style="margin-left:28px">Grand Total.</span>
              <span class="bpm-gt-amount">₹${fmt(billData.grand_total)}/-</span>
            </div>

            <!-- Footer: client box + amounts box -->
            <div class="bpm-footer-grid">
              <div class="bpm-footer-client">
                <strong>${escapeHtml(billData.client_name)}</strong><br/>
                ${escapeHtml(billData.client_address || '')}<br/>
                GST No.: ${escapeHtml(billData.client_gst_no || '—')}
              </div>
              <div class="bpm-footer-amounts">
                <div class="bpm-fa-row bpm-fa-total">
                  <span>Total</span><span>₹${fmt(billData.grand_total)}</span>
                </div>
                <div class="bpm-fa-row">
                  <span>Advance</span>
                  <span>${billData.advance > 0 ? '₹' + fmt(billData.advance) : '—'}</span>
                </div>
                <div class="bpm-fa-row bpm-fa-balance">
                  <span>Balance</span>
                  <span>${billData.balance > 0 ? '₹' + fmt(billData.balance) : '—'}</span>
                </div>
              </div>
            </div>

            <!-- Rs. in words -->
            <div class="bpm-words">
              <span>Rs. In Words :</span>
              <strong>${escapeHtml(billData.amount_in_words)}</strong>
            </div>

            <!-- Signature -->
            <div class="bpm-signature">
              <div>For AA. NAGARE INFRA MACHINERY</div>
              <div class="bpm-sig-line"></div>
              <div class="bpm-sig-label">Authorised Signatory</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  // Load the same cropped logo the PDF uses (no watermark, no duplicated text)
  getCleanLogo().then(l => {
    const el = mc.querySelector('#bpm-logo');
    if (el) el.src = l.dataUrl;
  }).catch(() => {});

  mc.querySelector('#bpm-back-btn').addEventListener('click', () => {
    mc.innerHTML = '';
  });

  mc.querySelector('#bpm-confirm-btn').addEventListener('click', () => {
    doActualSave(container, mc);
  });
}

// ── Actual Supabase save (after preview confirmed) ────────────────────────────
async function doActualSave(container, mc) {
  const confirmBtn = mc.querySelector('#bpm-confirm-btn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    const { data: billRecord, error: billError } = await supabase
      .from('bills')
      .insert([{
        // Only send bill_no when the admin set one; null lets the DB sequence assign it.
        ...(billData.bill_no ? { bill_no: billData.bill_no } : {}),
        date: billData.date,
        client_id: billData.client_id,
        client_name: billData.client_name,
        client_site_name: billData.client_site_name,
        client_mobile: billData.client_mobile,
        client_address: billData.client_address,
        client_gst_no: billData.client_gst_no,
        subtotal: billData.subtotal,
        sgst: billData.sgst,
        cgst: billData.cgst,
        grand_total: billData.grand_total,
        advance: billData.advance,
        balance: billData.balance,
        amount_in_words: billData.amount_in_words
      }])
      .select().single();

    if (billError) throw billError;

    const { error: itemsError } = await supabase.from('bill_items').insert(
      billData.lineItems.map(item => ({
        bill_id: billRecord.id,
        sr_no: item.sr_no,
        date: item.date,
        challan_no: item.challan_no || null,
        machine_id: item.machine_id,
        description: item.description,
        vehicle_no: item.vehicle_no,
        qty_unit: item.qty_unit,
        qty_decimal: item.qty_decimal,
        rate: item.rate,
        amount: item.amount
      }))
    );
    if (itemsError) throw itemsError;

    clearDraft();
    document.removeEventListener('click', handleOutsideClick, { capture: true });
    showToast(`Bill #${billRecord.bill_no} saved successfully!`, 'success');
    showSaveSuccessModal(mc, billRecord, billData.lineItems);
  } catch (err) {
    // Friendly inline handling when the chosen bill_no collides with an
    // existing one (Postgres unique-violation, code 23505). Otherwise fall
    // through to the generic toast/log path.
    const isDuplicateBillNo =
      err?.code === '23505' &&
      (err?.message?.toLowerCase().includes('bill_no') ||
       err?.details?.toLowerCase().includes('bill_no'));
    if (isDuplicateBillNo) {
      const errBox  = container.querySelector('#err-bill-no');
      const inputEl = container.querySelector('#bill-no');
      if (errBox) { errBox.textContent = 'Bill number already exists.'; errBox.classList.remove('hidden'); }
      if (inputEl) inputEl.classList.add('error');
      showToast(`Bill number ${billData.bill_no} is already used. Pick another.`, 'error');
      // Close the preview modal so the admin can edit the number directly.
      mc.innerHTML = '';
      document.removeEventListener('click', handleOutsideClick, { capture: true });
      inputEl?.focus();
      return;
    }
    handleError(err);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm & Save Bill';
  }
}

// ── Save-success step: Download PDF / Send via WhatsApp / Go to Bills ──────────
function showSaveSuccessModal(mc, bill, lineItems) {
  const billNo = String(bill.bill_no).padStart(4, '0');
  mc.innerHTML = `
    <div class="modal-backdrop" id="save-success-backdrop">
      <div class="modal-box border-beam" style="max-width:440px;text-align:center">
        <div style="width:56px;height:56px;border-radius:50%;background:#E8F5E9;display:flex;align-items:center;justify-content:center;margin:4px auto 12px;font-size:28px;color:#2E7D32">✓</div>
        <h3 class="mb-1" style="color:var(--color-navy)">Bill #${billNo} Saved</h3>
        <p class="text-muted mb-3" style="font-size:var(--text-sm)">
          Saved for <strong>${escapeHtml(bill.client_name || '')}</strong> — Grand Total ₹${parseFloat(bill.grand_total || 0).toLocaleString('en-IN')}.
        </p>
        <div class="flex flex-col gap-2" style="margin-bottom:12px">
          <button class="btn" id="ss-whatsapp-btn" style="background:#25D366;color:#fff;border-color:#25D366;padding:10px">
            Send via WhatsApp
          </button>
          <button class="btn btn-secondary" id="ss-pdf-btn" style="padding:10px">Download PDF</button>
        </div>
        <button class="btn btn-ghost" id="ss-done-btn" style="padding:8px 18px">Go to Bills</button>
      </div>
    </div>
  `;

  const goToBills = () => { mc.innerHTML = ''; window.navigate('bills'); };

  mc.querySelector('#ss-pdf-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Generating…';
    try { await generateBillPDF(bill, lineItems); }
    catch (err) { handleError(err); }
    finally { btn.disabled = false; btn.innerHTML = orig; }
  });

  mc.querySelector('#ss-whatsapp-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Preparing…';
    try { await sendBillViaWhatsApp(bill, lineItems); }
    catch (err) { handleError(err); }
    finally { btn.disabled = false; btn.innerHTML = orig; }
  });

  mc.querySelector('#ss-done-btn').addEventListener('click', goToBills);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
