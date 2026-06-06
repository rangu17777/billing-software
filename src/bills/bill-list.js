import { supabase } from '../shared/supabase.js';
import { renderShell, attachShellEvents } from '../shared/shell.js';
import { handleError } from '../shared/error-handler.js';
import { showToast, showConfirm } from '../shared/toast.js';
import { generateBillPDF } from '../pdf/pdf-generator.js';
import { sendBillViaWhatsApp } from '../shared/whatsapp.js';
import { exportBillsToExcel } from '../excel/excel-export.js';

let bills = [];
let searchQuery = '';
let activeTab = 'all'; // 'all' | 'pending' | 'collected'

export async function render(container) {
  // Skeleton loader first
  renderPage(container);

  // Fetch from Supabase
  await fetchBills();

  // Full render
  renderPage(container);
}

async function fetchBills() {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .order('bill_no', { ascending: false });

    if (error) throw error;
    bills = data || [];
  } catch (error) {
    handleError(error);
  }
}

function renderPage(container) {
  // ── Status-aware metrics ──────────────────────────────────────────────────
  let totalBilled = 0;
  let totalCollected = 0;
  let totalBalance = 0;
  let collectedCount = 0;

  bills.forEach(b => {
    totalBilled += parseFloat(b.grand_total) || 0;
    if (b.status === 'collected') {
      totalCollected += parseFloat(b.grand_total) || 0;
      collectedCount++;
    } else {
      totalCollected += parseFloat(b.advance) || 0;
      totalBalance  += parseFloat(b.balance)  || 0;
    }
  });

  // ── Search + tab filter ───────────────────────────────────────────────────
  const searched = bills.filter(b =>
    String(b.bill_no).includes(searchQuery) ||
    (b.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.client_site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.client_mobile || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filtered = searched.filter(b => {
    if (activeTab === 'pending')   return (b.status || 'pending') === 'pending';
    if (activeTab === 'collected') return b.status === 'collected';
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return dateStr;
  };

  const fmt = n => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const contentHtml = `
    <div class="bills-list-page anim-fade-in">

      <!-- KPI cards -->
      <div class="flex gap-3 mb-3" style="flex-wrap: wrap">
        <div class="card card-stat card-hover" style="flex: 1; min-width: 160px; position:relative">
          <div class="text-muted" style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Total Billed</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-navy); margin-top: 4px">
            ₹${fmt(totalBilled)}
          </div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px">${bills.length} invoice${bills.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="card card-stat card-hover" style="flex: 1; min-width: 160px; border-left-color: var(--color-success); position:relative">
          <div class="text-muted" style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Amount Collected</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-success); margin-top: 4px">
            ₹${fmt(totalCollected)}
          </div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px">Advances + fully paid</div>
        </div>
        <div class="card card-stat card-hover" style="flex: 1; min-width: 160px; border-left-color: var(--color-primary-orange); position:relative">
          <div class="text-muted" style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Outstanding Balance</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-primary-orange); margin-top: 4px">
            ₹${fmt(totalBalance)}
          </div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px">Pending receivables</div>
        </div>
        <div class="card card-stat card-hover" style="flex: 1; min-width: 160px; border-left-color: #2E7D32; position:relative">
          <div class="text-muted" style="font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Collected Bills</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #2E7D32; margin-top: 4px">
            ${collectedCount}
          </div>
          <div style="font-size:var(--text-xs);color:var(--color-muted);margin-top:2px">Fully paid invoices</div>
        </div>
      </div>

      <!-- Tab filter bar -->
      <div class="bl-tabs" style="display:flex;gap:6px;margin-bottom:12px">
        <button class="bl-tab ${activeTab === 'all'       ? 'bl-tab-active' : ''}" data-tab="all">All (${bills.length})</button>
        <button class="bl-tab ${activeTab === 'pending'   ? 'bl-tab-active' : ''}" data-tab="pending">⏳ Pending (${bills.filter(b => (b.status || 'pending') === 'pending').length})</button>
        <button class="bl-tab ${activeTab === 'collected' ? 'bl-tab-active' : ''}" data-tab="collected">✅ Collected (${collectedCount})</button>
      </div>

      <!-- Controls -->
      <div class="card mb-3 flex justify-between items-center" style="padding: var(--space-2) var(--space-3); flex-wrap: wrap; gap: var(--space-2)">
        <div class="flex gap-2" style="width: 100%; max-width: 480px">
          <input
            type="text"
            id="bill-search"
            placeholder="Search bills by number, client name, site..."
            value="${searchQuery}"
            style="flex: 1; padding: 8px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-base); outline: none"
          />
        </div>
        
        <div class="flex gap-2">
          <button class="btn btn-ghost" id="excel-export-btn" style="padding: 8px 16px; border-color: var(--color-success); color: var(--color-success)">
            🟢 Export Excel
          </button>
          <button class="btn btn-primary" onclick="window.navigate('new-bill')" style="padding: 8px 16px">
            ➕ Create New Bill
          </button>
        </div>
      </div>

      <!-- Table Section -->
      <div class="card" style="padding: 0; overflow: hidden">
        ${bills.length === 0 ? renderSkeletonRows() : renderBillsTable(filtered, formatDate)}
      </div>
    </div>
  `;

  container.innerHTML = renderShell('bills', 'Invoice / Bill Directory', contentHtml);
  attachShellEvents(container);

  // Inject tab styles
  injectTabStyles(container);

  if (bills.length > 0) {
    attachLocalEvents(container, filtered);
  }
}

function injectTabStyles(container) {
  if (container.querySelector('#bl-tab-styles')) return;
  const style = document.createElement('style');
  style.id = 'bl-tab-styles';
  style.textContent = `
    .bl-tab {
      padding: 7px 18px;
      border-radius: 999px;
      border: 1.5px solid var(--color-border);
      background: var(--color-surface-card);
      color: var(--color-muted);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 180ms ease;
    }
    .bl-tab:hover { border-color: var(--color-navy); color: var(--color-navy); }
    .bl-tab-active {
      background: var(--color-navy);
      color: #fff !important;
      border-color: var(--color-navy) !important;
    }
    .bl-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 700;
      cursor: pointer;
      border: 1.5px solid transparent;
      transition: all 180ms ease;
      white-space: nowrap;
    }
    .bl-status-badge:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.14); }
    .bl-status-pending   { background: #FFF3E0; color: #E65100; border-color: #FFCC80; }
    .bl-status-collected { background: #E8F5E9; color: #1B5E20; border-color: #A5D6A7; }
  `;
  document.head.appendChild(style);
}

function renderBillsTable(list, formatDate) {
  if (list.length === 0) {
    const emptyMsg = activeTab === 'collected'
      ? 'No collected bills yet. Mark a bill as paid to see it here.'
      : activeTab === 'pending'
      ? 'No pending bills! Everything is collected. 🎉'
      : 'No bills found. Try modifying your search query or create a new bill.';

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${activeTab === 'collected' ? '✅' : '🧾'}</div>
        <div class="empty-state-title">No Bills Found</div>
        <div class="empty-state-desc">${emptyMsg}</div>
      </div>
    `;
  }

  return `
    <table class="aan-table">
      <thead>
        <tr>
          <th style="width: 80px">Bill No</th>
          <th style="width: 100px">Date</th>
          <th>Client Name</th>
          <th>Site Location</th>
          <th style="text-align: right">Grand Total</th>
          <th style="text-align: right">Advance</th>
          <th style="text-align: right">Balance</th>
          <th style="width: 110px; text-align: center">Status</th>
          <th style="width: 140px; text-align: center">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(b => {
          const isCollected = b.status === 'collected';
          const balance = isCollected ? 0 : parseFloat(b.balance || 0);
          const balanceColor = isCollected ? 'var(--color-success)' : (balance > 0 ? 'var(--color-primary-orange)' : 'var(--color-muted)');
          return `
          <tr data-id="${b.id}" style="${isCollected ? 'background: rgba(46,125,50,0.03)' : ''}">
            <td class="font-semibold text-mono" style="color: var(--color-navy)">#${b.bill_no}</td>
            <td>${formatDate(b.date)}</td>
            <td class="font-semibold">${escapeHtml(b.client_name)}</td>
            <td>${escapeHtml(b.client_site_name || '—')}</td>
            <td class="font-semibold text-mono text-right" style="color: var(--color-black)">₹${parseFloat(b.grand_total).toLocaleString('en-IN')}</td>
            <td class="text-mono text-right" style="color: var(--color-success)">₹${parseFloat(b.advance || 0).toLocaleString('en-IN')}</td>
            <td class="font-semibold text-mono text-right" style="color: ${balanceColor}">
              ${isCollected ? '₹0' : `₹${balance.toLocaleString('en-IN')}`}
            </td>
            <td style="text-align: center">
              <button
                class="bl-status-badge ${isCollected ? 'bl-status-collected' : 'bl-status-pending'} toggle-status-btn"
                data-id="${b.id}"
                data-status="${b.status || 'pending'}"
                data-bill-no="${b.bill_no}"
                data-grand-total="${b.grand_total}"
                data-advance="${b.advance || 0}"
                title="Click to toggle collection status"
              >
                ${isCollected ? '✅ Collected' : '⏳ Pending'}
              </button>
            </td>
            <td style="text-align: center">
              <div class="flex gap-1" style="justify-content: center">
                <button class="btn whatsapp-bill-btn" data-id="${b.id}" title="Send via WhatsApp" style="padding: 4px 8px; font-size: var(--text-xs); background:#25D366; color:#fff; border-color:#25D366">
                  WhatsApp
                </button>
                <button class="btn btn-ghost print-bill-btn" data-id="${b.id}" title="Download PDF" style="padding: 4px 8px; font-size: var(--text-xs); border-color: var(--color-border)">
                  🖨️
                </button>
                <button class="btn btn-ghost edit-bill-btn" data-id="${b.id}" title="Edit Bill" style="padding: 4px 8px; font-size: var(--text-xs); border-color: var(--color-border)">
                  ✏️
                </button>
                <button class="btn btn-danger delete-bill-btn" data-id="${b.id}" title="Delete Bill" style="padding: 4px 8px; font-size: var(--text-xs)">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
  `;
}

function renderSkeletonRows() {
  return `
    <div style="padding: var(--space-3)">
      <div class="skeleton skeleton-row"></div>
      <div class="skeleton skeleton-row" style="animation-delay: 0.1s"></div>
      <div class="skeleton skeleton-row" style="animation-delay: 0.2s"></div>
    </div>
  `;
}

function attachLocalEvents(container, filteredList) {
  // Tab switching
  container.querySelectorAll('.bl-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.getAttribute('data-tab');
      renderPage(container);
    });
  });

  // Search
  const searchInput = container.querySelector('#bill-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPage(container);
      const input = document.getElementById('bill-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    });
  }

  // Excel Export
  container.querySelector('#excel-export-btn')?.addEventListener('click', () => {
    if (filteredList.length === 0) {
      showToast('No bills in listing to export.', 'warning');
      return;
    }
    exportBillsToExcel(filteredList);
    showToast('Spreadsheet downloaded successfully.', 'success');
  });

  // Toggle Status Badges
  container.querySelectorAll('.toggle-status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id          = btn.getAttribute('data-id');
      const curStatus   = btn.getAttribute('data-status');
      const billNo      = btn.getAttribute('data-bill-no');
      const grandTotal  = parseFloat(btn.getAttribute('data-grand-total') || 0);
      const advance     = parseFloat(btn.getAttribute('data-advance') || 0);
      const bill        = bills.find(b => b.id === id);
      if (!bill) return;
      toggleBillStatus(bill, curStatus, billNo, grandTotal, advance, container);
    });
  });

  // Print PDF
  container.querySelectorAll('.print-bill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const bill = bills.find(b => b.id === btn.getAttribute('data-id'));
      if (bill) await downloadPDF(bill, btn);
    });
  });

  // WhatsApp
  container.querySelectorAll('.whatsapp-bill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const bill = bills.find(b => b.id === btn.getAttribute('data-id'));
      if (bill) await shareViaWhatsApp(bill, btn);
    });
  });

  // Edit
  container.querySelectorAll('.edit-bill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.navigate('new-bill', { billId: btn.getAttribute('data-id') });
    });
  });

  // Delete
  container.querySelectorAll('.delete-bill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const bill = bills.find(b => b.id === btn.getAttribute('data-id'));
      if (bill) confirmDeleteBill(bill, container);
    });
  });
}

// ── Toggle collection status ─────────────────────────────────────────────────
function toggleBillStatus(bill, curStatus, billNo, grandTotal, advance, container) {
  const isCurrentlyCollected = curStatus === 'collected';
  const fmt = n => parseFloat(n || 0).toLocaleString('en-IN');

  const title = isCurrentlyCollected
    ? `Revert Bill #${billNo} to Pending?`
    : `Mark Bill #${billNo} as Collected?`;

  const message = isCurrentlyCollected
    ? `Bill #${billNo} will be marked as pending again. The outstanding balance of ₹${fmt(grandTotal - advance)} will be restored.`
    : `Bill #${billNo} for ₹${fmt(grandTotal)} will be marked as fully collected (paid). This moves the full amount to "Total Collected".`;

  showConfirm(title, message, async () => {
    const newStatus  = isCurrentlyCollected ? 'pending' : 'collected';
    const newBalance = isCurrentlyCollected ? (grandTotal - advance) : 0;

    try {
      const { error } = await supabase
        .from('bills')
        .update({ status: newStatus, balance: newBalance })
        .eq('id', bill.id);

      if (error) throw error;

      // Update local state immediately
      const idx = bills.findIndex(b => b.id === bill.id);
      if (idx !== -1) {
        bills[idx].status  = newStatus;
        bills[idx].balance = newBalance;
      }

      showToast(
        isCurrentlyCollected
          ? `Bill #${billNo} reverted to pending.`
          : `Bill #${billNo} marked as collected! ✅`,
        'success'
      );
      renderPage(container);
    } catch (err) {
      handleError(err);
    }
  });
}

async function shareViaWhatsApp(bill, buttonEl) {
  buttonEl.disabled = true;
  const originalHtml = buttonEl.innerHTML;
  buttonEl.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span>';

  try {
    const { data: lineItems, error } = await supabase
      .from('bill_items').select('*').eq('bill_id', bill.id).order('sr_no', { ascending: true });
    if (error) throw error;
    await sendBillViaWhatsApp(bill, lineItems);
  } catch (error) {
    handleError(error);
  } finally {
    buttonEl.disabled = false;
    buttonEl.innerHTML = originalHtml;
  }
}

async function downloadPDF(bill, buttonEl) {
  buttonEl.disabled = true;
  const originalHtml = buttonEl.innerHTML;
  buttonEl.innerHTML = '<span class="spinner spinner-dark" style="width:12px;height:12px"></span>';

  try {
    const { data: lineItems, error } = await supabase
      .from('bill_items').select('*').eq('bill_id', bill.id).order('sr_no', { ascending: true });
    if (error) throw error;
    await generateBillPDF(bill, lineItems);
    showToast(`Invoice #${bill.bill_no} PDF generated.`, 'success');
  } catch (error) {
    handleError(error);
  } finally {
    buttonEl.disabled = false;
    buttonEl.innerHTML = originalHtml;
  }
}

function confirmDeleteBill(bill, container) {
  showConfirm(
    `Delete Bill #${bill.bill_no}?`,
    `Permanently delete Bill #${bill.bill_no} for ${bill.client_name}? All line items will also be deleted. This cannot be undone.`,
    async () => {
      const row = container.querySelector(`tr[data-id="${bill.id}"]`);
      if (row) row.classList.add('row-exiting');
      try {
        const { error } = await supabase.from('bills').delete().eq('id', bill.id);
        if (error) throw error;
        showToast('Bill deleted successfully.', 'success');
        await fetchBills();
        renderPage(container);
      } catch (error) {
        if (row) row.classList.remove('row-exiting');
        handleError(error);
      }
    }
  );
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
