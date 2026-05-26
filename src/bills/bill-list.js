import { supabase } from '../shared/supabase.js';
import { renderShell, attachShellEvents } from '../shared/shell.js';
import { handleError } from '../shared/error-handler.js';
import { showToast, showConfirm } from '../shared/toast.js';
import { generateBillPDF } from '../pdf/pdf-generator.js';
import { sendBillViaWhatsApp } from '../shared/whatsapp.js';
import { exportBillsToExcel } from '../excel/excel-export.js';

let bills = [];
let searchQuery = '';

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
  const filtered = bills.filter(b =>
    String(b.bill_no).includes(searchQuery) ||
    (b.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.client_site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.client_mobile || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate metrics
  let totalBilled = 0;
  let totalCollected = 0;
  let totalBalance = 0;

  bills.forEach(b => {
    totalBilled += parseFloat(b.grand_total) || 0;
    totalCollected += parseFloat(b.advance) || 0;
    totalBalance += parseFloat(b.balance) || 0;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return dateStr;
  };

  const contentHtml = `
    <div class="bills-list-page anim-fade-in">
      <!-- KPI cards -->
      <div class="flex gap-3 mb-3" style="flex-wrap: wrap">
        <div class="card card-stat card-hover" style="flex: 1; min-width: 180px">
          <div class="text-muted">Total Billed</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-navy); margin-top: 4px">
            ₹${totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div class="card card-stat card-hover" style="flex: 1; min-width: 180px; border-left-color: var(--color-success)">
          <div class="text-muted">Total Collected</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-success); margin-top: 4px">
            ₹${totalCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div class="card card-stat card-hover" style="flex: 1; min-width: 180px; border-left-color: var(--color-primary-orange)">
          <div class="text-muted">Outstanding Balance</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: var(--color-primary-orange); margin-top: 4px">
            ₹${totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>
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
        ${bills.length === 0 && filtered.length === 0 ? renderSkeletonRows() : renderBillsTable(filtered, formatDate)}
      </div>
    </div>
  `;

  container.innerHTML = renderShell('bills', 'Invoice / Bill Directory', contentHtml);
  attachShellEvents(container);
  
  if (bills.length > 0 || filtered.length > 0) {
    attachLocalEvents(container, filtered);
  }
}

function renderBillsTable(list, formatDate) {
  if (list.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🧾</div>
        <div class="empty-state-title">No Bills Found</div>
        <div class="empty-state-desc">Try modifying your search query or create a new bill.</div>
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
          <th style="width: 120px; text-align: center">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(b => `
          <tr data-id="${b.id}">
            <td class="font-semibold text-mono" style="color: var(--color-navy)">#${String(b.bill_no).padStart(4, '0')}</td>
            <td>${formatDate(b.date)}</td>
            <td class="font-semibold">${escapeHtml(b.client_name)}</td>
            <td>${escapeHtml(b.client_site_name || '—')}</td>
            <td class="font-semibold text-mono text-right" style="color: var(--color-black)">₹${parseFloat(b.grand_total).toLocaleString('en-IN')}</td>
            <td class="text-mono text-right" style="color: var(--color-success)">₹${parseFloat(b.advance).toLocaleString('en-IN')}</td>
            <td class="font-semibold text-mono text-right" style="color: ${b.balance > 0 ? 'var(--color-primary-orange)' : 'var(--color-muted)'}">
              ₹${parseFloat(b.balance).toLocaleString('en-IN')}
            </td>
            <td style="text-align: center">
              <div class="flex gap-1" style="justify-content: center">
                <button class="btn whatsapp-bill-btn" data-id="${b.id}" title="Send via WhatsApp" style="padding: 4px 8px; font-size: var(--text-xs); background:#25D366; color:#fff; border-color:#25D366">
                  WhatsApp
                </button>
                <button class="btn btn-ghost print-bill-btn" data-id="${b.id}" title="Download PDF" style="padding: 4px 8px; font-size: var(--text-xs); border-color: var(--color-border)">
                  🖨️
                </button>
                <button class="btn btn-danger delete-bill-btn" data-id="${b.id}" title="Delete Bill" style="padding: 4px 8px; font-size: var(--text-xs)">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
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
  // Search
  const searchInput = container.querySelector('#bill-search');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderPage(container);
    // Refocus search & set cursor to end
    const input = document.getElementById('bill-search');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  // Excel Export
  container.querySelector('#excel-export-btn').addEventListener('click', () => {
    if (filteredList.length === 0) {
      showToast('No bills in listing to export.', 'warning');
      return;
    }
    exportBillsToExcel(filteredList);
    showToast('Spreadsheet downloaded successfully.', 'success');
  });

  // Action Buttons
  container.querySelectorAll('.print-bill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const bill = bills.find(b => b.id === id);
      if (bill) {
        await downloadPDF(bill, btn);
      }
    });
  });

  container.querySelectorAll('.whatsapp-bill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const bill = bills.find(b => b.id === id);
      if (bill) {
        await shareViaWhatsApp(bill, btn);
      }
    });
  });

  container.querySelectorAll('.delete-bill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const bill = bills.find(b => b.id === id);
      if (bill) {
        confirmDeleteBill(bill, container);
      }
    });
  });
}

async function shareViaWhatsApp(bill, buttonEl) {
  buttonEl.disabled = true;
  const originalHtml = buttonEl.innerHTML;
  buttonEl.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span>';

  try {
    const { data: lineItems, error } = await supabase
      .from('bill_items')
      .select('*')
      .eq('bill_id', bill.id)
      .order('sr_no', { ascending: true });
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
      .from('bill_items')
      .select('*')
      .eq('bill_id', bill.id)
      .order('sr_no', { ascending: true });

    if (error) throw error;
    
    await generateBillPDF(bill, lineItems);
    showToast(`Invoice #${String(bill.bill_no).padStart(4, '0')} PDF generated.`, 'success');
  } catch (error) {
    handleError(error);
  } finally {
    buttonEl.disabled = false;
    buttonEl.innerHTML = originalHtml;
  }
}

function confirmDeleteBill(bill, container) {
  showConfirm(
    `Delete Bill #${String(bill.bill_no).padStart(4, '0')}?`,
    `Permanently delete Bill #${String(bill.bill_no).padStart(4, '0')} for ${bill.client_name}? All line items will also be deleted. This cannot be undone.`,
    async () => {
      // Visually fade the row out while the network delete runs in parallel.
      const row = container.querySelector(`tr[data-id="${bill.id}"]`);
      if (row) row.classList.add('row-exiting');
      try {
        const { error } = await supabase
          .from('bills')
          .delete()
          .eq('id', bill.id);
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

// Helper to escape HTML tags to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
