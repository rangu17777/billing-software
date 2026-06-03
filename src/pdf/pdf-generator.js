import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getCleanLogo } from '../shared/logo.js';

// Re-export so existing importers (bill-creator) keep working unchanged.
export { getCleanLogo };

// Company GSTIN — printed on every bill by default (also shown on the dashboard).
const COMPANY_GSTIN = '27BISPN4599L1Z3';

const RED       = [211, 47, 47];
const NAVY      = [26, 35, 126];
const BLACK     = [33, 33, 33];
const WHITE     = [255, 255, 255];
const LGRAY     = [245, 245, 245];
const SOFT_GRAY = [130, 130, 130];   // border colour for info / footer boxes
const TABLE_GRAY = [210, 210, 210];  // body-cell grid lines (lighter, no "collapsing")

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN');
const fmtDate = (s) => {
  if (!s) return '';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};

// ── Geometry (full-bleed, 3 mm safety margin on all sides) ────────────────────
// The red brand strip runs flush at x=0 (5 mm wide); content text starts a
// further 3 mm to its right. Right edge has a 3 mm safety so consumer printers
// don't clip. No outer black border.
function geometry(doc) {
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const LM = 3, RM = 3;
  const CX = W / 2;
  const STRIP_W = 5;
  const CONTENT_X  = STRIP_W + LM;              // 8
  const CONTENT_R  = W - RM;                    // 207
  const CONTENT_W  = CONTENT_R - CONTENT_X;     // 199
  const SIDE_BOX_W = 60;                        // bill-info & footer right boxes share this
  const SIDE_BOX_X = CONTENT_R - SIDE_BOX_W;
  return { W, H, LM, RM, CX, STRIP_W, CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X };
}

// Where the line-items table starts on every page (just below the full header).
const HEADER_BOTTOM  = 80;
// Space the bottom block (grand total + footer + words + signature) needs.
const BOTTOM_BLOCK_H = 90;
// Bottom-of-page safety clearance.
const BOTTOM_SAFETY  = 5;

// ── Download entry point (used by dashboard + bills list) ─────────────────────
export async function generateBillPDF(bill, lineItems) {
  const doc = await buildBillPDFDoc(bill, lineItems);
  const safeName = (bill.client_name || 'client').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`AAN_Bill_${bill.bill_no}_${safeName}.pdf`);
}

// Returns the bill PDF as a Blob (used for WhatsApp upload / sharing).
export async function getBillPDFBlob(bill, lineItems) {
  const doc = await buildBillPDFDoc(bill, lineItems);
  return doc.output('blob');
}

// Builds the jsPDF document.
//
// Layout invariants:
//   • Every page begins with the full company header (logo + address + GSTIN
//     + To/Bill No./Date box) — drawn via autoTable's didDrawPage hook so it
//     repeats automatically on pages 2, 3, ...
//   • The red column header row repeats on every page too (autoTable default
//     `showHead: 'everyPage'`).
//   • Serial numbers continue naturally (autoTable renders the next slice).
//   • The Grand Total bar + Total/Advance/Balance footer + Rs.-in-Words band
//     + Authorised Signatory appear ONCE at the very end. If there isn't
//     room on the last table page, they get a fresh page (with the full
//     header repeated above them).
export async function buildBillPDFDoc(bill, lineItems) {
  const logo = await getCleanLogo();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { H, RM, CONTENT_X } = geometry(doc);
  const PAGE_BOTTOM = H - BOTTOM_SAFETY;

  // ── LINE ITEMS TABLE ────────────────────────────────────────────────────────
  const tableData = lineItems.map(item => [
    item.sr_no,
    item.date || '',
    item.challan_no || '--',
    item.description || '',
    item.vehicle_no || '',
    item.qty_unit || '',
    fmt(item.rate),
    fmt(item.amount)
  ]);

  const subtotal = parseFloat(bill.subtotal || 0);
  const sgstAmt  = parseFloat(bill.sgst     || 0);
  const cgstAmt  = parseFloat(bill.cgst     || 0);
  const sgstRate = subtotal > 0 ? +(sgstAmt * 100 / subtotal).toFixed(2) : 9;
  const cgstRate = subtotal > 0 ? +(cgstAmt * 100 / subtotal).toFixed(2) : 9;

  // Tax summary rows live inside the table so they stay glued to the body.
  const taxStartIdx = tableData.length;
  tableData.push([{ content: 'Subtotal', colSpan: 6, styles: { halign: 'right' } }, '',              fmt(subtotal)]);
  tableData.push([{ content: 'SGST',     colSpan: 6, styles: { halign: 'right' } }, `${sgstRate}%`,  fmt(sgstAmt)]);
  tableData.push([{ content: 'CGST',     colSpan: 6, styles: { halign: 'right' } }, `${cgstRate}%`,  fmt(cgstAmt)]);

  doc.autoTable({
    startY: HEADER_BOTTOM,
    margin: { top: HEADER_BOTTOM, left: CONTENT_X, right: RM, bottom: BOTTOM_SAFETY },
    showHead: 'everyPage',
    head: [['Sr.\nNo.', 'Date', 'Challan\nNo.', 'Description', 'Vehicle\nNo.', 'Qty./Unit', 'Rate', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: RED,
      textColor: WHITE,
      fontSize: 9.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: WHITE,
      lineWidth: 0.3,
      minCellHeight: 12
    },
    // Column widths sum to CONTENT_W (199 mm).
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },   // Sr. No.
      1: { cellWidth: 17, halign: 'center' },   // Date
      2: { cellWidth: 20, halign: 'center' },   // Challan No.
      3: { cellWidth: 52, halign: 'left'   },   // Description
      4: { cellWidth: 23, halign: 'center' },   // Vehicle No.
      5: { cellWidth: 25, halign: 'center' },   // Qty./Unit
      6: { cellWidth: 22, halign: 'right'  },   // Rate
      7: { cellWidth: 28, halign: 'right'  }    // Amount
    },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.8, bottom: 2.8, left: 3, right: 3 },
      // Lighter grid + thinner stroke so the shared cell edges in autoTable's
      // grid theme don't stack into heavy-looking "collapsed" vertical lines.
      lineColor: TABLE_GRAY,
      lineWidth: 0.12,
      textColor: BLACK,
      font: 'helvetica',
      overflow: 'linebreak'
    },
    alternateRowStyles: { fillColor: LGRAY },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index >= taxStartIdx) {
        data.cell.styles.fillColor = [255, 248, 225];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = NAVY;
        data.cell.styles.fontSize  = 10;          // a touch larger for the tax rows
      }
    },
    // Full company header + red strip on EVERY page autoTable creates.
    didDrawPage: () => {
      drawPageStrip(doc);
      drawPageHeader(doc, bill, logo);
    }
  });

  let finalY = doc.lastAutoTable.finalY;

  // The bottom block goes wherever the table ended IF it fits; otherwise a
  // fresh final page (full header repeated above) carries just the totals.
  if (finalY + BOTTOM_BLOCK_H > PAGE_BOTTOM) {
    doc.addPage();
    drawPageStrip(doc);
    drawPageHeader(doc, bill, logo);
    finalY = HEADER_BOTTOM;
  }
  drawBottomBlock(doc, bill, finalY);

  return doc;
}

// Red brand strip flush at the very left edge of the page, drawn on every page.
function drawPageStrip(doc) {
  const { H, STRIP_W } = geometry(doc);
  doc.setFillColor(...RED);
  doc.rect(0, 0, STRIP_W, H, 'F');
}

// Full company header (logo + address + mobile + GSTIN + email + bill-info
// box). Drawn on every page so a long bill reads as one continuous document.
function drawPageHeader(doc, bill, logo) {
  const { W, LM, RM, CX, CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X } = geometry(doc);

  // ── Cleaned AAN logo lockup ─────────────────────────────────────────────────
  let y = 4;
  const logoH = 32;
  let logoW = logoH * logo.aspect;
  const maxLogoW = W - CONTENT_X - RM - 70; // leave room for top-right GSTIN
  if (logoW > maxLogoW) logoW = maxLogoW;
  const logoX = CX - logoW / 2;
  doc.addImage(logo.dataUrl, 'JPEG', logoX, y, logoW, logoH);
  y += logoH + 4;

  // ── Address + contact (3 centered lines; GSTIN rides on the Mob row) ─────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  doc.text('Add.: A/p Ambadwet, Tal. Mulshi, Dist - Pune.', CX, y, { align: 'center' });
  y += 4.5;
  doc.text('Mob.: 7875396396 / 9921353533 / 9822111882', CX, y, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(`GSTIN: ${COMPANY_GSTIN}`, CONTENT_R - 1, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...BLACK);
  y += 4.5;
  doc.text('Email: aanagre.machinery@gmail.com', CX, y, { align: 'center' });
  y += 3;

  // Thin red accent bar below contact block
  doc.setFillColor(...RED);
  doc.rect(CONTENT_X, y, CONTENT_W, 1.2, 'F');
  y += 3;

  // ── Bill-info: To/Site on the left, Bill No./Date/Mob box on the right ────
  const infoTop  = y;
  const infoH    = 26;

  doc.setDrawColor(...SOFT_GRAY);
  doc.setLineWidth(0.22);
  doc.rect(SIDE_BOX_X, infoTop, SIDE_BOX_W, infoH);
  doc.line(SIDE_BOX_X, infoTop + infoH / 3,     SIDE_BOX_X + SIDE_BOX_W, infoTop + infoH / 3);
  doc.line(SIDE_BOX_X, infoTop + 2 * infoH / 3, SIDE_BOX_X + SIDE_BOX_W, infoTop + 2 * infoH / 3);

  // Left: To / Client / Site
  const lx = CONTENT_X + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text('To.', lx, infoTop + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const clientDisplay = (bill.client_name || '').toUpperCase();
  doc.text(clientDisplay, lx + 11, infoTop + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Site Name :  ${bill.client_site_name || ''}`, lx, infoTop + 18);

  // Right-box content
  const rbX  = SIDE_BOX_X + 3;
  const rbVX = SIDE_BOX_X + SIDE_BOX_W - 3;
  const row1Y = infoTop + infoH / 6 + 2.5;
  const row2Y = infoTop + infoH / 2 + 1.5;
  const row3Y = infoTop + 5 * infoH / 6 + 0.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Bill No. :', rbX, row1Y);
  doc.setFontSize(10.5);
  doc.text(`${bill.bill_no}`, rbVX, row1Y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Date :', rbX, row2Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(fmtDate(bill.date) + '.', rbVX, row2Y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Mob. :', rbX, row3Y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(bill.client_mobile || '', rbVX, row3Y, { align: 'right' });

  y = infoTop + infoH + 1;

  // Separator line above the table
  doc.setDrawColor(...SOFT_GRAY);
  doc.setLineWidth(0.22);
  doc.line(CONTENT_X, y, CONTENT_R, y);
}

// Grand Total + Total/Advance/Balance + Rs.-in-Words + signature. Drawn ONCE,
// on whichever page the table ended on (or a fresh final page if it doesn't fit).
function drawBottomBlock(doc, bill, tableEndY) {
  const { CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X } = geometry(doc);

  const grandTotal = parseFloat(bill.grand_total || 0);

  // ── Grand Total bar (red, full width) ────────────────────────────────────
  const gtH = 12;
  doc.setFillColor(...RED);
  doc.rect(CONTENT_X, tableEndY, CONTENT_W, gtH, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('GRAND TOTAL', CONTENT_X + 6, tableEndY + 8);
  doc.text(fmt(grandTotal) + ' /-', CONTENT_R - 5, tableEndY + 8, { align: 'right' });

  let footY = tableEndY + gtH + 4;

  // ── Bottom footer — client box + Total/Advance/Balance box ────────────────
  const footBoxH = 28;
  const footGap  = 4;
  const rightFBW = SIDE_BOX_W;
  const rightFBX = SIDE_BOX_X;
  const leftFBW  = rightFBX - footGap - CONTENT_X;
  const fLx      = CONTENT_X + 4;

  doc.setDrawColor(...SOFT_GRAY);
  doc.setLineWidth(0.22);
  doc.rect(CONTENT_X, footY, leftFBW, footBoxH);

  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(bill.client_name || '', fLx, footY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (bill.client_address) {
    const addrLines = doc.splitTextToSize(bill.client_address, leftFBW - 8);
    doc.text(addrLines.slice(0, 2), fLx, footY + 14);
  }
  doc.text(`GST No.: ${bill.client_gst_no || '--'}`, fLx, footY + 24);

  // Right footer box
  doc.rect(rightFBX, footY, rightFBW, footBoxH);
  doc.line(rightFBX, footY + footBoxH / 3,     rightFBX + rightFBW, footY + footBoxH / 3);
  doc.line(rightFBX, footY + 2 * footBoxH / 3, rightFBX + rightFBW, footY + 2 * footBoxH / 3);

  const rfX  = rightFBX + 3;
  const rfVX = rightFBX + rightFBW - 3;

  // Red "Total" row at the top of the right box
  doc.setFillColor(...RED);
  doc.rect(rightFBX, footY, rightFBW, footBoxH / 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total', rfX, footY + footBoxH / 6 + 2);
  doc.text(fmt(grandTotal), rfVX, footY + footBoxH / 6 + 2, { align: 'right' });

  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const adv = parseFloat(bill.advance || 0);
  doc.text('Advance', rfX, footY + footBoxH / 2 + 1.5);
  doc.text(adv > 0 ? fmt(adv) : '--', rfVX, footY + footBoxH / 2 + 1.5, { align: 'right' });

  const bal = parseFloat(bill.balance || 0);
  doc.text('Balance', rfX, footY + 5 * footBoxH / 6 + 1);
  doc.setFont('helvetica', 'bold');
  doc.text(bal > 0 ? fmt(bal) : '--', rfVX, footY + 5 * footBoxH / 6 + 1, { align: 'right' });

  footY += footBoxH + 4;

  // ── Rs. In Words — highlighted band ──────────────────────────────────────
  const wordsBandH = 12;
  doc.setFillColor(255, 248, 225);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.5);
  doc.rect(CONTENT_X, footY, CONTENT_W, wordsBandH, 'FD');

  const wordsY = footY + wordsBandH / 2 + 2;
  const wordsLabel = 'Rs. In Words :  ';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...RED);
  doc.text(wordsLabel, CONTENT_X + 5, wordsY);
  const labelW = doc.getTextWidth(wordsLabel);

  // Shrink the value slightly if very long, so it still fits on one line.
  const valText = (bill.amount_in_words || '').toString();
  const avail = CONTENT_W - 10 - labelW;
  let valFont = 11;
  doc.setFontSize(valFont);
  while (valFont > 8 && doc.getTextWidth(valText) > avail) { valFont -= 0.5; doc.setFontSize(valFont); }
  doc.setTextColor(...NAVY);
  doc.text(valText, CONTENT_X + 5 + labelW, wordsY);

  footY += wordsBandH + 6;

  // ── Signature ───────────────────────────────────────────────────────────
  // Right-aligned block with a wider signing line and the "Authorised
  // Signatory" label centered UNDER the line for a balanced, formal look.
  const sigRight = CONTENT_R - 4;
  const sigLeft  = CONTENT_R - 90;     // 86 mm wide signing area (was ~56 mm)
  const sigMid   = (sigLeft + sigRight) / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('For AA. NAGARE INFRA MACHINERY', sigMid, footY, { align: 'center' });

  footY += 16;
  doc.setDrawColor(...SOFT_GRAY);
  doc.setLineWidth(0.25);
  doc.line(sigLeft, footY, sigRight, footY);

  footY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Authorised Signatory', sigMid, footY, { align: 'center' });
}
