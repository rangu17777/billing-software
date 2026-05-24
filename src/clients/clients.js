import { supabase } from '../shared/supabase.js';
import { renderShell, attachShellEvents } from '../shared/shell.js';
import { handleError } from '../shared/error-handler.js';
import { showToast, showConfirm } from '../shared/toast.js';

let clients = [];
let machines = [];
let activeTab = 'clients'; // 'clients' | 'machines'
let searchQuery = '';

export async function render(container) {
  // Initial render with loading states
  renderPage(container);

  // Load data asynchronously
  await Promise.all([fetchClients(), fetchMachines()]);

  // Re-render with fetched data
  renderPage(container);
}

async function fetchClients() {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    clients = data || [];
  } catch (error) {
    handleError(error);
  }
}

async function fetchMachines() {
  try {
    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .order('description', { ascending: true });

    if (error) throw error;
    machines = data || [];
  } catch (error) {
    handleError(error);
  }
}

function renderPage(container) {
  const filteredClients = clients.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.mobile || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.gst_no || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMachines = machines.filter(m =>
    (m.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.vehicle_no || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.rate_type || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const contentHtml = `
    <div class="clients-page anim-fade-in">
      <!-- Summary cards -->
      <div class="flex gap-3 mb-3" style="flex-wrap: wrap">
        <div class="card card-stat card-hover" style="flex: 1; min-width: 200px">
          <div class="text-muted">Total Clients</div>
          <div style="font-size: 2.2rem; font-weight: 800; color: var(--color-navy); margin-top: 4px">
            ${clients.length}
          </div>
        </div>
        <div class="card card-stat card-hover" style="flex: 1; min-width: 200px; border-left-color: var(--color-accent-yellow)">
          <div class="text-muted">Active Machinery</div>
          <div style="font-size: 2.2rem; font-weight: 800; color: var(--color-navy); margin-top: 4px">
            ${machines.length}
          </div>
        </div>
      </div>

      <!-- Controls & Navigation -->
      <div class="card mb-3 flex justify-between items-center" style="padding: var(--space-2) var(--space-3); flex-wrap: wrap; gap: var(--space-2)">
        <div class="flex gap-1" style="background: var(--color-surface); padding: 4px; border-radius: var(--radius-md)">
          <button class="btn ${activeTab === 'clients' ? 'btn-primary' : 'btn-ghost'}" id="tab-clients" style="padding: 6px 16px; border: none; font-size: var(--text-sm)">
            👥 Clients Master
          </button>
          <button class="btn ${activeTab === 'machines' ? 'btn-primary' : 'btn-ghost'}" id="tab-machines" style="padding: 6px 16px; border: none; font-size: var(--text-sm)">
            🚜 Machines Master
          </button>
        </div>

        <div class="flex gap-2" style="flex: 1; justify-content: flex-end; min-width: 280px">
          <input
            type="text"
            id="search-input"
            placeholder="${activeTab === 'clients' ? 'Search clients by name, site, mobile...' : 'Search machines by type, vehicle no...'}"
            value="${searchQuery}"
            style="max-width: 320px; padding: 8px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-base); outline: none"
          />
          <button class="btn btn-primary" id="add-btn" style="padding: 8px 16px">
            ${activeTab === 'clients' ? '➕ Add Client' : '➕ Add Machine'}
          </button>
        </div>
      </div>

      <!-- List Section -->
      <div class="card" style="padding: 0; overflow: hidden">
        ${activeTab === 'clients' ? renderClientsTable(filteredClients) : renderMachinesTable(filteredMachines)}
      </div>
    </div>
  `;

  container.innerHTML = renderShell('clients', 'Client & Machine Masters', contentHtml);
  attachShellEvents(container);
  attachLocalEvents(container);
}

function renderClientsTable(list) {
  if (clients.length === 0 && list.length === 0) {
    return renderSkeletonRows();
  }
  if (list.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">No Clients Found</div>
        <div class="empty-state-desc">Try search terms or add a new client profile.</div>
      </div>
    `;
  }

  return `
    <table class="aan-table">
      <thead>
        <tr>
          <th>Client Name</th>
          <th>Site Name</th>
          <th>Mobile</th>
          <th>GSTIN</th>
          <th>Address</th>
          <th style="width: 100px; text-align: center">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(c => `
          <tr data-id="${c.id}">
            <td class="font-semibold" style="color: var(--color-navy)">${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.site_name || '—')}</td>
            <td>${escapeHtml(c.mobile || '—')}</td>
            <td><code class="code-chip">${escapeHtml(c.gst_no || '—')}</code></td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.address || '—')}</td>
            <td style="text-align: center">
              <div class="flex gap-1" style="justify-content: center">
                <button class="btn btn-ghost edit-client-btn" data-id="${c.id}" style="padding: 4px 8px; font-size: var(--text-xs); border-color: var(--color-border)">
                  ✏️
                </button>
                <button class="btn btn-danger delete-client-btn" data-id="${c.id}" style="padding: 4px 8px; font-size: var(--text-xs)">
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

function renderMachinesTable(list) {
  if (machines.length === 0 && list.length === 0) {
    return renderSkeletonRows();
  }
  if (list.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🚜</div>
        <div class="empty-state-title">No Machines Found</div>
        <div class="empty-state-desc">Try search terms or add a new machine profile.</div>
      </div>
    `;
  }

  return `
    <table class="aan-table">
      <thead>
        <tr>
          <th>Machine / Description</th>
          <th>Vehicle No.</th>
          <th>Rate Type</th>
          <th>Default Rate</th>
          <th style="width: 100px; text-align: center">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(m => `
          <tr data-id="${m.id}">
            <td class="font-semibold" style="color: var(--color-navy)">${escapeHtml(m.description)}</td>
            <td><code class="code-chip">${escapeHtml(m.vehicle_no)}</code></td>
            <td>
              <span class="badge ${m.rate_type === 'hourly' ? 'badge-blue' : m.rate_type === 'daily' ? 'badge-green' : 'badge-yellow'}">
                ${m.rate_type === 'hourly' ? '⏱️ Hourly' : m.rate_type === 'daily' ? '📅 Daily' : '☀️ Full Day'}
              </span>
            </td>
            <td class="font-semibold" style="color: var(--color-primary-orange)">₹${parseFloat(m.default_rate).toLocaleString('en-IN')}</td>
            <td style="text-align: center">
              <div class="flex gap-1" style="justify-content: center">
                <button class="btn btn-ghost edit-machine-btn" data-id="${m.id}" style="padding: 4px 8px; font-size: var(--text-xs); border-color: var(--color-border)">
                  ✏️
                </button>
                <button class="btn btn-danger delete-machine-btn" data-id="${m.id}" style="padding: 4px 8px; font-size: var(--text-xs)">
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
      <div class="skeleton skeleton-row" style="animation-delay: 0.3s"></div>
    </div>
  `;
}

function attachLocalEvents(container) {
  // Tab Switching
  const tabClients = container.querySelector('#tab-clients');
  const tabMachines = container.querySelector('#tab-machines');
  
  tabClients.addEventListener('click', () => {
    activeTab = 'clients';
    renderPage(container);
  });
  tabMachines.addEventListener('click', () => {
    activeTab = 'machines';
    renderPage(container);
  });

  // Live Search
  const searchInput = container.querySelector('#search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    // Use requestAnimationFrame or debouncing if fast typers, but vanilla filter is extremely fast
    renderPage(container);
    // Refocus search input & set cursor to end
    const input = document.getElementById('search-input');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  // Add Button Click
  const addBtn = container.querySelector('#add-btn');
  addBtn.addEventListener('click', () => {
    if (activeTab === 'clients') {
      openClientModal(null, container);
    } else {
      openMachineModal(null, container);
    }
  });

  // Row Edit / Delete button handlers
  if (activeTab === 'clients') {
    container.querySelectorAll('.edit-client-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const client = clients.find(c => c.id === id);
        openClientModal(client, container);
      });
    });

    container.querySelectorAll('.delete-client-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const client = clients.find(c => c.id === id);
        confirmDeleteClient(client, container);
      });
    });
  } else {
    container.querySelectorAll('.edit-machine-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const machine = machines.find(m => m.id === id);
        openMachineModal(machine, container);
      });
    });

    container.querySelectorAll('.delete-machine-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const machine = machines.find(m => m.id === id);
        confirmDeleteMachine(machine, container);
      });
    });
  }
}

// ─── CLIENT MODALS & CRUD ───

function openClientModal(client = null, container) {
  const isEdit = !!client;
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-box border-beam">
        <h3 class="mb-3" style="color: var(--color-navy)">${isEdit ? '✏️ Edit Client Profile' : '👥 Add New Client'}</h3>
        <form id="client-form" novalidate>
          <div class="form-group mb-2">
            <label for="client-name">Client Name *</label>
            <input type="text" id="client-name" name="name" value="${client ? escapeHtml(client.name) : ''}" placeholder="e.g. Venkateshwara Hatcheries" required />
            <div class="form-error-msg hidden" id="err-client-name">Client name is required.</div>
          </div>
          
          <div class="form-group mb-2">
            <label for="client-site">Site Name / Location</label>
            <input type="text" id="client-site" name="site_name" value="${client && client.site_name ? escapeHtml(client.site_name) : ''}" placeholder="e.g. Uruli Kanchan, Pune" />
          </div>

          <div class="form-group mb-2">
            <label for="client-mobile">Mobile Number</label>
            <input type="tel" id="client-mobile" name="mobile" value="${client && client.mobile ? escapeHtml(client.mobile) : ''}" placeholder="e.g. 9876543210" />
            <div class="form-error-msg hidden" id="err-client-mobile">Enter a valid 10-digit mobile number.</div>
          </div>

          <div class="form-group mb-2">
            <label for="client-gst">GSTIN (Client)</label>
            <input type="text" id="client-gst" name="gst_no" value="${client && client.gst_no ? escapeHtml(client.gst_no) : ''}" placeholder="e.g. 27AAACV7247H1Z4" style="text-transform: uppercase" />
            <div class="form-error-msg hidden" id="err-client-gst">GSTIN must be 15 alphanumeric characters.</div>
          </div>

          <div class="form-group mb-3">
            <label for="client-address">Billing Address</label>
            <textarea id="client-address" name="address" rows="3" placeholder="Full billing address...">${client && client.address ? escapeHtml(client.address) : ''}</textarea>
          </div>

          <div class="flex justify-between" style="gap: var(--space-2)">
            <button type="button" class="btn btn-ghost" id="cancel-modal-btn" style="flex: 1">Cancel</button>
            <button type="submit" class="btn btn-primary" id="save-client-btn" style="flex: 1">Save Client</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Attach events
  const backdrop = modalContainer.querySelector('.modal-backdrop');
  const cancelBtn = modalContainer.querySelector('#cancel-modal-btn');
  const form = modalContainer.querySelector('#client-form');
  const saveBtn = modalContainer.querySelector('#save-client-btn');

  const closeModal = () => {
    modalContainer.innerHTML = '';
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear errors
    form.querySelectorAll('.form-error-msg').forEach(el => el.classList.add('hidden'));
    form.querySelectorAll('input').forEach(el => el.classList.remove('error'));

    const name = form.querySelector('#client-name').value.trim();
    const site_name = form.querySelector('#client-site').value.trim();
    const mobile = form.querySelector('#client-mobile').value.trim();
    const gst_no = form.querySelector('#client-gst').value.trim().toUpperCase();
    const address = form.querySelector('#client-address').value.trim();

    let hasError = false;

    if (!name) {
      form.querySelector('#client-name').classList.add('error');
      form.querySelector('#err-client-name').classList.remove('hidden');
      hasError = true;
    }

    if (mobile && !/^\d{10}$/.test(mobile)) {
      form.querySelector('#client-mobile').classList.add('error');
      form.querySelector('#err-client-mobile').classList.remove('hidden');
      hasError = true;
    }

    if (gst_no && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst_no)) {
      form.querySelector('#client-gst').classList.add('error');
      form.querySelector('#err-client-gst').classList.remove('hidden');
      hasError = true;
    }

    if (hasError) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

    const payload = { name, site_name, mobile, gst_no, address };

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', client.id);

        if (error) throw error;
        showToast('Client profile updated successfully.', 'success');
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([payload]);

        if (error) throw error;
        showToast('New client profile added.', 'success');
      }

      closeModal();
      await fetchClients();
      renderPage(container);
    } catch (error) {
      handleError(error);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Client';
    }
  });
}

function confirmDeleteClient(client, container) {
  showConfirm(
    `Delete Client?`,
    `Permanently delete the profile for "${client.name}"? Historical bills will preserve the client's info, but they will no longer appear in new billing dropdowns.`,
    async () => {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', client.id);
        if (error) throw error;
        showToast('Client profile deleted.', 'success');
        await fetchClients();
        renderPage(container);
      } catch (error) {
        handleError(error);
      }
    }
  );
}

// ─── MACHINE MODALS & CRUD ───

function openMachineModal(machine = null, container) {
  const isEdit = !!machine;
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-box border-beam">
        <h3 class="mb-3" style="color: var(--color-navy)">${isEdit ? '✏️ Edit Machine Profile' : '🚜 Add New Machine'}</h3>
        <form id="machine-form" novalidate>
          <div class="form-group mb-2">
            <label for="machine-desc">Machine Type / Description *</label>
            <input type="text" id="machine-desc" name="description" value="${machine ? escapeHtml(machine.description) : ''}" placeholder="e.g. JCB, Tractor, Tractor-2" required />
            <div class="form-error-msg hidden" id="err-machine-desc">Description is required.</div>
          </div>
          
          <div class="form-group mb-2">
            <label for="machine-veh">Vehicle Registration No. *</label>
            <input type="text" id="machine-veh" name="vehicle_no" value="${machine ? escapeHtml(machine.vehicle_no) : ''}" placeholder="e.g. MH 12 AB 3456 or 0396" required style="text-transform: uppercase" />
            <div class="form-error-msg hidden" id="err-machine-veh">Vehicle number is required.</div>
          </div>

          <div class="form-group mb-2">
            <label for="machine-rate-type">Rate Type / Unit *</label>
            <select id="machine-rate-type" name="rate_type" required>
              <option value="hourly" ${machine && machine.rate_type === 'hourly' ? 'selected' : ''}>⏱️ Hourly (per hour)</option>
              <option value="daily" ${machine && machine.rate_type === 'daily' ? 'selected' : ''}>📅 Daily (per day)</option>
              <option value="full day" ${machine && machine.rate_type === 'full day' ? 'selected' : ''}>☀️ Full Day (custom daily unit)</option>
            </select>
          </div>

          <div class="form-group mb-3">
            <label for="machine-rate">Default Rate (₹) *</label>
            <input type="number" id="machine-rate" name="default_rate" value="${machine ? machine.default_rate : '0'}" placeholder="e.g. 1000" min="0" required />
            <div class="form-error-msg hidden" id="err-machine-rate">Please enter a valid rate.</div>
          </div>

          <div class="flex justify-between" style="gap: var(--space-2)">
            <button type="button" class="btn btn-ghost" id="cancel-modal-btn" style="flex: 1">Cancel</button>
            <button type="submit" class="btn btn-primary" id="save-machine-btn" style="flex: 1">Save Machine</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const backdrop = modalContainer.querySelector('.modal-backdrop');
  const cancelBtn = modalContainer.querySelector('#cancel-modal-btn');
  const form = modalContainer.querySelector('#machine-form');
  const saveBtn = modalContainer.querySelector('#save-machine-btn');

  const closeModal = () => {
    modalContainer.innerHTML = '';
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    form.querySelectorAll('.form-error-msg').forEach(el => el.classList.add('hidden'));
    form.querySelectorAll('input').forEach(el => el.classList.remove('error'));

    const description = form.querySelector('#machine-desc').value.trim();
    const vehicle_no = form.querySelector('#machine-veh').value.trim().toUpperCase();
    const rate_type = form.querySelector('#machine-rate-type').value;
    const default_rate = parseFloat(form.querySelector('#machine-rate').value);

    let hasError = false;

    if (!description) {
      form.querySelector('#machine-desc').classList.add('error');
      form.querySelector('#err-machine-desc').classList.remove('hidden');
      hasError = true;
    }

    if (!vehicle_no) {
      form.querySelector('#machine-veh').classList.add('error');
      form.querySelector('#err-machine-veh').classList.remove('hidden');
      hasError = true;
    }

    if (isNaN(default_rate) || default_rate < 0) {
      form.querySelector('#machine-rate').classList.add('error');
      form.querySelector('#err-machine-rate').classList.remove('hidden');
      hasError = true;
    }

    if (hasError) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';

    const payload = { description, vehicle_no, rate_type, default_rate };

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('machines')
          .update(payload)
          .eq('id', machine.id);

        if (error) throw error;
        showToast('Machine profile updated.', 'success');
      } else {
        const { error } = await supabase
          .from('machines')
          .insert([payload]);

        if (error) throw error;
        showToast('New machine profile added.', 'success');
      }

      closeModal();
      await fetchMachines();
      renderPage(container);
    } catch (error) {
      handleError(error);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Machine';
    }
  });
}

function confirmDeleteMachine(machine, container) {
  showConfirm(
    `Delete Machine?`,
    `Permanently delete "${machine.description} (${machine.vehicle_no})"? Historical bills will preserve the machine's details, but it will no longer appear in new bill line items.`,
    async () => {
      try {
        const { error } = await supabase
          .from('machines')
          .delete()
          .eq('id', machine.id);
        if (error) throw error;
        showToast('Machine profile deleted.', 'success');
        await fetchMachines();
        renderPage(container);
      } catch (error) {
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
