import { supabase } from '../shared/supabase.js';
import { renderShell, attachShellEvents } from '../shared/shell.js';
import { handleError } from '../shared/error-handler.js';
import { showToast } from '../shared/toast.js';
import { generateBillPDF } from '../pdf/pdf-generator.js';
import { checkMilestone } from '../shared/confetti.js';
import { iconRupee, iconCheckCircle, iconHourglass, iconReceipt } from '../shared/icons.js';
import './dashboard.css';

let stats = { totalBilled: 0, totalCollected: 0, totalBalance: 0, invoiceCount: 0 };
let recentBills = [];
let loading = true;

export async function render(container) {
  renderDashboard(container);
  await loadDashboardData();
  renderDashboard(container);
}

async function loadDashboardData() {
  loading = true;
  try {
    const { data: bills, error } = await supabase
      .from('bills')
      .select('*')
      .order('bill_no', { ascending: false });

    if (error) throw error;

    stats = { totalBilled: 0, totalCollected: 0, totalBalance: 0, invoiceCount: bills ? bills.length : 0 };

    if (bills && bills.length > 0) {
      bills.forEach(b => {
        stats.totalBilled    += parseFloat(b.grand_total) || 0;
        stats.totalCollected += parseFloat(b.advance)     || 0;
        stats.totalBalance   += parseFloat(b.balance)     || 0;
      });
      recentBills = bills.slice(0, 8);
    } else {
      recentBills = [];
    }
  } catch (err) {
    handleError(err);
  } finally {
    loading = false;
  }
}

function greetingText() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── TIME-OF-DAY AMBIENT SKIN ────────────────────────────────────────────────────
function applyTimeOfDaySkin() {
  const h = new Date().getHours();
  let ambient;
  if (h >= 6  && h < 12) ambient = 'sunrise';
  else if (h >= 12 && h < 17) ambient = 'solar';
  else if (h >= 17 && h < 21) ambient = 'twilight';
  else ambient = 'midnight';
  document.documentElement.setAttribute('data-ambient', ambient);
}

function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ── MICRO-STORY INSIGHT ENGINE ────────────────────────────────────────────────
function buildInsights(s, bills) {
  const stories = [];

  // 1. Grand overview
  if (s.invoiceCount > 0) {
    stories.push({
      icon: '\uD83D\uDCCA',
      label: 'Business Overview',
      text: `You have created <strong>${s.invoiceCount}</strong> invoice${s.invoiceCount !== 1 ? 's' : ''} totalling <strong>\u20B9${fmt(s.totalBilled)}</strong>. Overall collection rate: <strong>${s.totalBilled > 0 ? Math.round((s.totalCollected / s.totalBilled) * 100) : 0}%</strong>.`,
    });
  }

  // 2. Pending balance insight
  if (s.totalBalance > 0) {
    const pendingBills = bills.filter(b => parseFloat(b.balance || 0) > 0);
    stories.push({
      icon: '\u23F3',
      label: 'Pending Receivables',
      text: `<strong>\u20B9${fmt(s.totalBalance)}</strong> is currently outstanding across <strong>${pendingBills.length}</strong> bill${pendingBills.length !== 1 ? 's' : ''}. Timely follow-up can improve cash flow.`,
    });
  }

  // 3. Top client by bill count
  if (bills.length >= 2) {
    const clientMap = {};
    bills.forEach(b => {
      const c = b.client_name || 'Unknown';
      clientMap[c] = (clientMap[c] || 0) + 1;
    });
    const topClient = Object.entries(clientMap).sort((a,b) => b[1]-a[1])[0];
    if (topClient) {
      stories.push({
        icon: '\uD83C\uDFC6',
        label: 'Most Active Client',
        text: `<strong>${escapeHtml(topClient[0])}</strong> is your most active client with <strong>${topClient[1]}</strong> invoices raised — a loyal partnership for AA Nagare.`,
      });
    }
  }

  // 4. Most recent bill
  if (bills.length > 0) {
    const latest = bills[0];
    stories.push({
      icon: '\uD83E\uDDFE',
      label: 'Latest Invoice',
      text: `The most recent bill is <strong>#${String(latest.bill_no || '').padStart(4,'0')}</strong> for <strong>${escapeHtml(latest.client_name || 'N/A')}</strong> on ${fmtDate(latest.date)}, totalling <strong>\u20B9${fmt(latest.grand_total)}</strong>.`,
    });
  }

  // 5. GST collected
  if (s.totalBilled > 0) {
    const subtotal = s.totalBilled / 1.18; // reverse from 18% GST
    const gstPortion = s.totalBilled - subtotal;
    stories.push({
      icon: '\uD83C\uDFDB\uFE0F',
      label: 'GST Compliance',
      text: `Estimated GST (SGST 9% + CGST 9%) across all bills: approximately <strong>\u20B9${fmt(gstPortion)}</strong>. All invoices are GST-compliant under GSTIN <strong>27BISPN4599L1Z3</strong>.`,
    });
  }

  // Fallback if no data
  if (stories.length === 0) {
    stories.push({
      icon: '\uD83D\uDE80',
      label: 'Getting Started',
      text: `Welcome to AA Nagare Infra Machinery Billing! Create your first invoice to unlock business insights and analytics here.`,
    });
  }

  return stories;
}

function insightBannerHtml(stories) {
  if (!stories || stories.length === 0) return '';
  const first = stories[0];
  const dots  = stories.map((_, i) =>
    `<span class="insight-dot${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Story ${i+1}"></span>`
  ).join('');

  return `
    <div class="insight-banner" id="insight-banner" role="region" aria-label="Business Insights">
      <div class="insight-content-wrap" id="insight-content-wrap">
        <div class="insight-body">
          <div class="insight-label" id="insight-label">&#128201; ${escapeHtml(first.label)}</div>
          <div class="insight-text" id="insight-text">${first.text}</div>
        </div>
      </div>
      <div class="insight-dots" id="insight-dots" role="tablist" aria-label="Insight navigation">
        ${dots}
      </div>
    </div>`;
}

let _insightTimer   = null;
let _insightStories = [];
let _insightIdx     = 0;

function attachInsightRotation(container) {
  _insightStories = buildInsights(stats, recentBills);
  _insightIdx = 0;

  const banner  = container.querySelector('#insight-banner');
  const wrap    = container.querySelector('#insight-content-wrap');
  const label   = container.querySelector('#insight-label');
  const text    = container.querySelector('#insight-text');
  const dotsEl  = container.querySelector('#insight-dots');
  if (!banner || !wrap || !label || !text) return;

  function goTo(idx) {
    if (_insightStories.length <= 1) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduced) {
      wrap.classList.remove('slide-in');
      wrap.classList.add('slide-out');
    }

    const delay = reduced ? 0 : 260;
    setTimeout(() => {
      _insightIdx = ((idx % _insightStories.length) + _insightStories.length) % _insightStories.length;
      const story = _insightStories[_insightIdx];
      label.innerHTML = `${story.icon} ${escapeHtml(story.label)}`;
      text.innerHTML  = story.text;

      // Update dots
      dotsEl?.querySelectorAll('.insight-dot').forEach((d, i) => {
        d.classList.toggle('active', i === _insightIdx);
      });

      if (!reduced) {
        wrap.classList.remove('slide-out');
        wrap.classList.add('slide-in');
        setTimeout(() => wrap.classList.remove('slide-in'), 320);
      }
    }, delay);
  }

  // Auto-rotate every 8 seconds
  if (_insightTimer) clearInterval(_insightTimer);
  _insightTimer = setInterval(() => goTo(_insightIdx + 1), 8000);

  // Manual dot navigation
  dotsEl?.querySelectorAll('.insight-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      if (_insightTimer) clearInterval(_insightTimer);
      goTo(parseInt(dot.dataset.idx, 10));
      _insightTimer = setInterval(() => goTo(_insightIdx + 1), 8000);
    });
  });

  // Stop timer when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (_insightTimer) clearInterval(_insightTimer);
    } else {
      if (_insightTimer) clearInterval(_insightTimer);
      _insightTimer = setInterval(() => goTo(_insightIdx + 1), 8000);
    }
  }, { once: false });
}

// ── KPI CARDS ───────────────────────────────────────────────────────────────
function kpiCards() {
  if (loading) {
    return `
      <div class="kpi-grid">
        ${Array(4).fill('<div class="kpi-card"><div class="dash-skel" style="height:24px;margin-bottom:10px"></div><div class="dash-skel" style="height:40px;width:60%"></div></div>').join('')}
      </div>`;
  }
  return `
    <div class="kpi-grid">
      <div class="kpi-card kpi-red">
        <div class="kpi-icon red">${iconRupee}</div>
        <div class="kpi-label">Total Billed</div>
        <div class="kpi-value rupee" data-count="${stats.totalBilled}" data-prefix="₹">₹${fmt(stats.totalBilled)}</div>
        <div class="kpi-sub">SGST + CGST included</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon green">${iconCheckCircle}</div>
        <div class="kpi-label">Amount Collected</div>
        <div class="kpi-value rupee" data-count="${stats.totalCollected}" data-prefix="₹">₹${fmt(stats.totalCollected)}</div>
        <div class="kpi-sub">Advances received</div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon orange">${iconHourglass}</div>
        <div class="kpi-label">Pending Balance</div>
        <div class="kpi-value rupee" data-count="${stats.totalBalance}" data-prefix="₹">₹${fmt(stats.totalBalance)}</div>
        <div class="kpi-sub">Outstanding receivables</div>
      </div>
      <div class="kpi-card kpi-navy">
        <div class="kpi-icon navy">${iconReceipt}</div>
        <div class="kpi-label">Total Invoices</div>
        <div class="kpi-value" data-count="${stats.invoiceCount}">${stats.invoiceCount}</div>
        <div class="kpi-sub">All-time bills created</div>
      </div>
    </div>`;
}

// ── RECENT BILLS TABLE ───────────────────────────────────────────────────────
function recentBillsSection() {
  const tableBody = loading
    ? `<tr><td colspan="7" style="padding:24px 16px">
        <div class="dash-skel"></div>
        <div class="dash-skel" style="animation-delay:.1s"></div>
        <div class="dash-skel" style="animation-delay:.2s"></div>
        <div class="dash-skel" style="animation-delay:.3s"></div>
      </td></tr>`
    : recentBills.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:40px 16px;color:#8a8a8e;font-size:0.84rem">No bills yet — create your first invoice!</td></tr>`
      : recentBills.map(b => {
          const due = parseFloat(b.balance || 0);
          const adv = parseFloat(b.advance || 0);
          return `
            <tr>
              <td><span class="bill-no-badge">#${String(b.bill_no).padStart(4,'0')}</span></td>
              <td>${fmtDate(b.date)}</td>
              <td style="font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(b.client_name)}</td>
              <td><span class="amt-billed">₹${fmt(b.grand_total)}</span></td>
              <td><span class="${adv > 0 ? 'amt-paid' : 'amt-zero'}">₹${fmt(adv)}</span></td>
              <td><span class="${due > 0 ? 'amt-due' : 'amt-zero'}">₹${fmt(due)}</span></td>
              <td style="text-align:center">
                <button class="dash-print-btn quick-print-btn" data-id="${b.id}" title="Download PDF">🖨️</button>
              </td>
            </tr>`;
        }).join('');

  return `
    <div class="dash-section">
      <div class="dash-section-header">
        <span class="dash-section-title">Recent Bills</span>
        <a class="dash-section-link" onclick="window.navigate('bills')">View all →</a>
      </div>
      <div style="overflow-x:auto">
        <table class="dash-bills-table">
          <thead>
            <tr>
              <th>Bill No.</th>
              <th>Date</th>
              <th>Client</th>
              <th>Grand Total</th>
              <th>Advance</th>
              <th>Balance Due</th>
              <th style="text-align:center">PDF</th>
            </tr>
          </thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;
}

// ── QUICK ACTIONS ────────────────────────────────────────────────────────────
function quickActionsSection() {
  return `
    <div class="dash-section" style="margin-bottom:16px">
      <div class="dash-section-header">
        <span class="dash-section-title">Quick Actions</span>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
        <button class="quick-action-btn" onclick="window.navigate('new-bill')">
          <span class="qa-icon red">➕</span>
          <span>Create New Bill</span>
        </button>
        <button class="quick-action-btn" onclick="window.navigate('clients')">
          <span class="qa-icon blue">👥</span>
          <span>Manage Clients</span>
        </button>
        <button class="quick-action-btn" onclick="window.navigate('clients')">
          <span class="qa-icon green">🚜</span>
          <span>Manage Machinery</span>
        </button>
        <button class="quick-action-btn" onclick="window.navigate('bills')">
          <span class="qa-icon yellow">📋</span>
          <span>View All Bills</span>
        </button>
      </div>
    </div>`;
}

// ── COMPLIANCE CARD ──────────────────────────────────────────────────────────
function complianceSection() {
  return `
    <div class="compliance-card">
      <h4>GST Compliance</h4>
      <div class="compliance-item"><span class="c-dot"></span>SGST 9% + CGST 9% auto-calculated</div>
      <div class="compliance-item"><span class="c-dot"></span>Rupee amount in words (Indian standard)</div>
      <div class="compliance-item"><span class="c-dot"></span>Sequential bill numbering enforced</div>
      <div class="compliance-item"><span class="c-dot"></span>Firebase auth + Supabase cloud storage</div>
      <div class="gstin-badge">GSTIN: 27BISPN4599L1Z3</div>
    </div>`;
}

// ── 3D MOUSE TILT ──────────────────────────────────────────────────────────────────
function attachKpiTilt(container) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  container.querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dx   = (e.clientX - cx) / (rect.width  / 2);
      const dy   = (e.clientY - cy) / (rect.height / 2);
      const rotX = -dy * 5;
      const rotY =  dx * 5;
      card.style.transform   = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px)`;
      card.style.transition  = 'transform 80ms linear, box-shadow 80ms';
      card.style.willChange  = 'transform';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform   = '';
      card.style.transition  = 'transform 400ms cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 400ms';
      card.style.willChange  = 'auto';
    });
  });
}

// ── MAIN RENDER ──────────────────────────────────────────────────────────────
function renderDashboard(container) {
  // Apply time-of-day ambient skin (no args — reads system clock internally)
  applyTimeOfDaySkin();

  // Build insight stories from live data (empty array while loading)
  const insightStories = loading ? [] : buildInsights(stats, recentBills);

  const contentHtml = `
    <div class="dashboard-page-container">
      <!-- Greeting -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:24px">
        <div>
          <h1 style="font-family:var(--font-display);font-size:1.6rem;font-weight:800;color:var(--color-black);line-height:1.2">${greetingText()}, Administrator</h1>
          <p style="font-size:0.82rem;color:var(--color-muted);margin-top:4px">${todayLabel()}</p>
        </div>
        <div style="font-size:0.78rem;font-weight:600;color:#2e7d32;background:#e8f5e9;padding:6px 14px;border-radius:999px;align-self:center">
          &#9679; Systems Operational
        </div>
      </div>

      ${insightBannerHtml(insightStories)}

      ${kpiCards()}

      <div class="dash-2col-grid" style="display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start">
        <div>${recentBillsSection()}</div>
        <div>
          ${quickActionsSection()}
          ${complianceSection()}
        </div>
      </div>
    </div>`;

  container.innerHTML = renderShell('dashboard', 'Dashboard', contentHtml);
  attachShellEvents(container);
  attachLocalEvents(container);
}

function animateCounters(container) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  container.querySelectorAll('.kpi-value[data-count]').forEach(el => {
    const target = parseFloat(el.getAttribute('data-count')) || 0;
    if (target <= 0) return;
    const prefix = el.getAttribute('data-prefix') || '';
    const dur = 850, start = performance.now();
    const draw = (n) => { el.textContent = prefix + Math.round(n).toLocaleString('en-IN'); };
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      draw(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else draw(target);
    };
    requestAnimationFrame(tick);
  });
}

function attachLocalEvents(container) {
  if (!loading) {
    animateCounters(container);
    attachInsightRotation(container);
    attachKpiTilt(container);
    // Milestone confetti — check after data is loaded
    checkMilestone(stats.invoiceCount);
  }

  container.querySelectorAll('.quick-print-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const bill = recentBills.find(b => b.id === id);
      if (bill) await downloadPDF(bill, btn);
    });
  });
}

async function downloadPDF(bill, btn) {
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner spinner-dark" style="width:10px;height:10px"></span>';
  try {
    const { data: lineItems, error } = await supabase
      .from('bill_items').select('*').eq('bill_id', bill.id).order('sr_no', { ascending: true });
    if (error) throw error;
    await generateBillPDF(bill, lineItems);
    showToast(`Invoice #${String(bill.bill_no).padStart(4,'0')} PDF ready.`, 'success');
  } catch (err) {
    handleError(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
