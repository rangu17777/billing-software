import { supabase } from './supabase.js';
import { getBillPDFBlob } from '../pdf/pdf-generator.js';
import { showToast } from './toast.js';
import { handleError } from './error-handler.js';

const BUCKET = 'invoices';
const DEFAULT_CC = '91'; // India

// Normalize a stored mobile number into wa.me format (digits, with country code).
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return DEFAULT_CC + digits;          // 10-digit local
  if (digits.length === 11 && digits.startsWith('0')) return DEFAULT_CC + digits.slice(1);
  if (digits.length >= 11 && digits.length <= 13) return digits;  // already has CC
  return '';
}

function buildMessage(bill, pdfUrl) {
  const billNo = String(bill.bill_no);
  const total = parseFloat(bill.grand_total || 0).toLocaleString('en-IN');
  const balance = parseFloat(bill.balance || 0).toLocaleString('en-IN');
  const lines = [
    `Dear ${bill.client_name || 'Customer'},`,
    ``,
    `Your AA. NAGARE Infra Machinery invoice #${billNo} dated ${formatDate(bill.date)} for Rs. ${total}/- is ready.`,
    `Balance due: Rs. ${balance}/-.`,
    ``,
    `View / download your bill:`,
    pdfUrl,
    ``,
    `Thank you.`,
    `- AA. NAGARE Infra Machinery`
  ];
  return lines.join('\n');
}

function formatDate(s) {
  if (!s) return '';
  const p = String(s).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
}

// Generate the bill PDF, upload to Supabase Storage, and open WhatsApp
// to the client's number with a pre-filled message + PDF link.
export async function sendBillViaWhatsApp(bill, lineItems) {
  const phone = normalizePhone(bill.client_mobile);
  if (!phone) {
    showToast('No valid mobile number on this client — cannot open WhatsApp.', 'warning');
    return;
  }

  // Open the tab synchronously (inside the click gesture) to avoid popup blockers;
  // we set its URL once the async upload finishes.
  const win = window.open('', '_blank');

  try {
    const blob = await getBillPDFBlob(bill, lineItems);
    const path = `bill_${bill.bill_no}.pdf`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'application/pdf' });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const pdfUrl = data?.publicUrl;
    if (!pdfUrl) throw new Error('Could not get public URL for the uploaded PDF.');

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(bill, pdfUrl))}`;
    if (win) {
      win.location.href = url;
    } else {
      // popup was blocked despite the sync open — fall back to same-tab nav
      window.location.href = url;
    }
    showToast('Opening WhatsApp…', 'success');
  } catch (err) {
    if (win) win.close();
    handleError(err);
  }
}
