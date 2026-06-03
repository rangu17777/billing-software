import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getCleanLogo } from '../shared/logo.js';

// Re-export so existing importers (bill-creator) keep working unchanged.
export { getCleanLogo };

// Company GSTIN — printed on every bill by default (also shown on the dashboard).
const COMPANY_GSTIN = '27BISPN4599L1Z3';

const RED        = [211, 47, 47];
const NAVY       = [26, 35, 126];
const BLACK      = [33, 33, 33];
const WHITE      = [255, 255, 255];
const LGRAY      = [245, 245, 245];
const SOFT_GRAY  = [130, 130, 130];   // border colour for info / footer boxes
const TABLE_GRAY = [210, 210, 210];   // body-cell grid lines (lighter, no "collapsing")

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

const BOTTOM_SAFETY = 5;   // bottom-of-page safety clearance

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
// ADAPTIVE SIZING: a single `density` variable, chosen from the row count,
// scales the logo, header fonts, table fonts, padding, and the bottom block:
//
//   • ≤ 7 items  → density 1.00 ("big" mode, today's spacious look).
//   • ≥ 8 items  → density 0.78 ("compact" mode), so ~15 items + tax +
//                  Grand Total + footer + signature fit one A4 page.
//
// Beyond what compact mode fits (~16+ items), the table paginates
// automatically (full header repeated on every page via autoTable's
// didDrawPage; signature only on the last page).
export async function buildBillPDFDoc(bill, lineItems) {
  const logo = await getCleanLogo();

  // ── Density + scaled constants ────────────────────────────────────────────
  // Threshold = 7: 7 items is the empirical single-page cap at density 1.0,
  // so 8-item bills jump to compact mode (which fits up to ~15 single page).
  const density = lineItems.length <= 7 ? 1 : 0.78;
  const sc = (v, min) => Math.max(min, +(v * density).toFixed(2));

  // Layout (mm)
  const HEADER_BOTTOM  = sc(86,  65);
  const BOTTOM_BLOCK_H = sc(90,  70);
  const LOGO_H         = sc(32,  24);
  const BILL_INFO_H    = sc(26,  20);
  const GT_H           = sc(12,  10);
  const FOOT_BOX_H     = sc(28,  22);
  const WORDS_BAND_H   = sc(12,  10);
  const TABLE_PAD      = sc(2.8, 2);
  const TABLE_HEAD_MIN = sc(12,  9);

  // Fonts (pt)
  const F_ADDRESS      = sc(9.5,  7.5);
  const F_GSTIN_HDR    = sc(9,    7.5);
  const F_TO_LABEL     = sc(10,   8);
  const F_CLIENT_NAME  = sc(12,   10);
  const F_BILLINFO_LBL = sc(9.5,  7.5);
  const F_BILLINFO_VAL = sc(10.5, 8.5);
  const F_TABLE_HEAD   = sc(9.5,  8);
  const F_TABLE_BODY   = sc(9,    7.5);
  const F_TABLE_TAX    = sc(10,   8.5);
  const F_GRAND_TOTAL  = sc(13,   11);
  const F_FOOT_CLIENT  = sc(11,   9.5);
  const F_FOOT_ADDR    = sc(9,    8);
  const F_TOTAL_HEAD   = sc(12,   10);
  const F_TOTAL_VAL    = sc(11,   9.5);
  const F_WORDS_LBL    = sc(11,   9.5);
  const F_WORDS_VAL    = sc(11,   9.5);
  const F_SIG_NAME     = sc(10,   8.5);
  const F_SIG_LABEL    = sc(8,    7);

  // Signature vertical rhythm (mm)
  const SIG_PAD_TOP    = sc(10, 7);
  const SIG_LINE_GAP   = sc(12, 9);
  const SIG_LABEL_GAP  = sc(4,  3);

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
      fontSize: F_TABLE_HEAD,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: WHITE,
      lineWidth: 0.3,
      minCellHeight: TABLE_HEAD_MIN
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
      fontSize: F_TABLE_BODY,
      cellPadding: { top: TABLE_PAD, bottom: TABLE_PAD, left: 3, right: 3 },
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
        data.cell.styles.fontSize  = F_TABLE_TAX;
      }
    },
    // Full company header + red strip on EVERY page autoTable creates.
    didDrawPage: () => {
      drawPageStrip(doc);
      drawPageHeader();
    }
  });

  let finalY = doc.lastAutoTable.finalY;

  // The bottom block goes wherever the table ended IF it fits; otherwise a
  // fresh final page (full header repeated above) carries just the totals.
  if (finalY + BOTTOM_BLOCK_H > PAGE_BOTTOM) {
    doc.addPage();
    drawPageStrip(doc);
    drawPageHeader();
    finalY = HEADER_BOTTOM;
  }
  drawBottomBlock(finalY);

  return doc;

  // ── Inner helpers (close over `bill`, `logo`, density-scaled constants) ───

  // Full company header (logo + address + mobile + GSTIN + email + bill-info
  // box). Drawn on every page so a long bill reads as one continuous document.
  function drawPageHeader() {
    const { W, RM, CX, CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X } = geometry(doc);

    // ── Cleaned AAN logo lockup ───────────────────────────────────────────
    let y = 4;
    let logoW = LOGO_H * logo.aspect;
    const maxLogoW = W - CONTENT_X - RM - 70; // leave room for top-right GSTIN
    if (logoW > maxLogoW) logoW = maxLogoW;
    const logoX = CX - logoW / 2;
    doc.addImage(logo.dataUrl, 'JPEG', logoX, y, logoW, LOGO_H);
    y += LOGO_H + sc(4, 3);

    // ── Address + contact (3 centered lines; GSTIN rides on the Mob row) ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_ADDRESS);
    doc.setTextColor(...BLACK);
    doc.text('Add.: A/p Ambadwet, Tal. Mulshi, Dist - Pune.', CX, y, { align: 'center' });
    y += sc(4.5, 3.6);
    doc.text('Mob.: 7875396396 / 9921353533 / 9822111882', CX, y, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_GSTIN_HDR);
    doc.setTextColor(...NAVY);
    doc.text(`GSTIN: ${COMPANY_GSTIN}`, CONTENT_R - 1, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_ADDRESS);
    doc.setTextColor(...BLACK);
    y += sc(4.5, 3.6);
    doc.text('Email: aanagre.machinery@gmail.com', CX, y, { align: 'center' });
    y += sc(3, 2.5);

    // Thin red accent bar below contact block
    doc.setFillColor(...RED);
    doc.rect(CONTENT_X, y, CONTENT_W, sc(1.2, 1), 'F');
    y += sc(3, 2.5);

    // ── Bill-info: To/Site on the left, Bill No./Date/Mob box on the right ──
    const infoTop = y;
    doc.setDrawColor(...SOFT_GRAY);
    doc.setLineWidth(0.22);
    doc.rect(SIDE_BOX_X, infoTop, SIDE_BOX_W, BILL_INFO_H);
    doc.line(SIDE_BOX_X, infoTop + BILL_INFO_H / 3,     SIDE_BOX_X + SIDE_BOX_W, infoTop + BILL_INFO_H / 3);
    doc.line(SIDE_BOX_X, infoTop + 2 * BILL_INFO_H / 3, SIDE_BOX_X + SIDE_BOX_W, infoTop + 2 * BILL_INFO_H / 3);

    // Left: To / Client / Site
    const lx = CONTENT_X + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_TO_LABEL);
    doc.setTextColor(...BLACK);
    doc.text('To.', lx, infoTop + BILL_INFO_H * 0.23);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_CLIENT_NAME);
    const clientDisplay = (bill.client_name || '').toUpperCase();
    doc.text(clientDisplay, lx + 11, infoTop + BILL_INFO_H * 0.23);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_TO_LABEL);
    doc.text(`Site Name :  ${bill.client_site_name || ''}`, lx, infoTop + BILL_INFO_H * 0.69);

    // Right-box content (3 evenly-spaced rows inside the box)
    const rbX  = SIDE_BOX_X + 3;
    const rbVX = SIDE_BOX_X + SIDE_BOX_W - 3;
    const rowH = BILL_INFO_H / 3;
    const row1Y = infoTop + rowH * 0.65;
    const row2Y = infoTop + rowH * 1.65;
    const row3Y = infoTop + rowH * 2.65;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_BILLINFO_LBL);
    doc.text('Bill No. :', rbX, row1Y);
    doc.setFontSize(F_BILLINFO_VAL);
    doc.text(`${bill.bill_no}`, rbVX, row1Y, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_BILLINFO_LBL);
    doc.text('Date :', rbX, row2Y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_BILLINFO_VAL);
    doc.text(fmtDate(bill.date) + '.', rbVX, row2Y, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_BILLINFO_LBL);
    doc.text('Mob. :', rbX, row3Y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_BILLINFO_VAL);
    doc.text(bill.client_mobile || '', rbVX, row3Y, { align: 'right' });

    // No separator line above the table — the red column header row gives
    // enough visual top edge, and the HEADER_BOTTOM gap keeps it from butting
    // up against the bill-info box.
  }

  // Grand Total + Total/Advance/Balance + Rs.-in-Words + signature. Drawn ONCE,
  // on whichever page the table ended on (or a fresh final page if it doesn't fit).
  function drawBottomBlock(tableEndY) {
    const { CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X } = geometry(doc);

    const grandTotal = parseFloat(bill.grand_total || 0);

    // ── Grand Total bar (red, full width) ──────────────────────────────────
    doc.setFillColor(...RED);
    doc.rect(CONTENT_X, tableEndY, CONTENT_W, GT_H, 'F');

    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_GRAND_TOTAL);
    doc.text('GRAND TOTAL', CONTENT_X + 6, tableEndY + GT_H * 0.67);
    doc.text(fmt(grandTotal) + ' /-', CONTENT_R - 5, tableEndY + GT_H * 0.67, { align: 'right' });

    let footY = tableEndY + GT_H + sc(4, 3);

    // ── Bottom footer — client box + Total/Advance/Balance box ─────────────
    const footGap  = sc(4, 3);
    const rightFBW = SIDE_BOX_W;
    const rightFBX = SIDE_BOX_X;
    const leftFBW  = rightFBX - footGap - CONTENT_X;
    const fLx      = CONTENT_X + 4;

    doc.setDrawColor(...SOFT_GRAY);
    doc.setLineWidth(0.22);
    doc.rect(CONTENT_X, footY, leftFBW, FOOT_BOX_H);

    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_FOOT_CLIENT);
    doc.text(bill.client_name || '', fLx, footY + FOOT_BOX_H * 0.25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_FOOT_ADDR);
    if (bill.client_address) {
      const addrLines = doc.splitTextToSize(bill.client_address, leftFBW - 8);
      doc.text(addrLines.slice(0, 2), fLx, footY + FOOT_BOX_H * 0.50);
    }
    doc.text(`GST No.: ${bill.client_gst_no || '--'}`, fLx, footY + FOOT_BOX_H * 0.86);

    // Right footer box
    doc.rect(rightFBX, footY, rightFBW, FOOT_BOX_H);
    doc.line(rightFBX, footY + FOOT_BOX_H / 3,     rightFBX + rightFBW, footY + FOOT_BOX_H / 3);
    doc.line(rightFBX, footY + 2 * FOOT_BOX_H / 3, rightFBX + rightFBW, footY + 2 * FOOT_BOX_H / 3);

    const rfX  = rightFBX + 3;
    const rfVX = rightFBX + rightFBW - 3;

    // Red "Total" row at the top of the right box
    doc.setFillColor(...RED);
    doc.rect(rightFBX, footY, rightFBW, FOOT_BOX_H / 3, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_TOTAL_HEAD);
    doc.text('Total', rfX, footY + FOOT_BOX_H / 6 + sc(2, 1.5));
    doc.text(fmt(grandTotal), rfVX, footY + FOOT_BOX_H / 6 + sc(2, 1.5), { align: 'right' });

    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_TOTAL_VAL);
    const adv = parseFloat(bill.advance || 0);
    doc.text('Advance', rfX, footY + FOOT_BOX_H / 2 + sc(1.5, 1));
    doc.text(adv > 0 ? fmt(adv) : '--', rfVX, footY + FOOT_BOX_H / 2 + sc(1.5, 1), { align: 'right' });

    const bal = parseFloat(bill.balance || 0);
    doc.text('Balance', rfX, footY + 5 * FOOT_BOX_H / 6 + sc(1, 0.8));
    doc.setFont('helvetica', 'bold');
    doc.text(bal > 0 ? fmt(bal) : '--', rfVX, footY + 5 * FOOT_BOX_H / 6 + sc(1, 0.8), { align: 'right' });

    footY += FOOT_BOX_H + sc(4, 3);

    // ── Rs. In Words — highlighted band ────────────────────────────────────
    doc.setFillColor(255, 248, 225);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.5);
    doc.rect(CONTENT_X, footY, CONTENT_W, WORDS_BAND_H, 'FD');

    const wordsY = footY + WORDS_BAND_H / 2 + sc(2, 1.6);
    const wordsLabel = 'Rs. In Words :  ';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_WORDS_LBL);
    doc.setTextColor(...RED);
    doc.text(wordsLabel, CONTENT_X + 5, wordsY);
    const labelW = doc.getTextWidth(wordsLabel);

    // Shrink the value slightly if very long, so it still fits on one line.
    const valText = (bill.amount_in_words || '').toString();
    const avail = CONTENT_W - 10 - labelW;
    let valFont = F_WORDS_VAL;
    doc.setFontSize(valFont);
    while (valFont > 7 && doc.getTextWidth(valText) > avail) { valFont -= 0.5; doc.setFontSize(valFont); }
    doc.setTextColor(...NAVY);
    doc.text(valText, CONTENT_X + 5 + labelW, wordsY);

    footY += WORDS_BAND_H + SIG_PAD_TOP;

    // ── Signature — compact, right-aligned ─────────────────────────────────
    const sigRight = CONTENT_R - 4;
    const sigLeft  = CONTENT_R - sc(70, 56);
    const sigMid   = (sigLeft + sigRight) / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_SIG_NAME);
    doc.setTextColor(...NAVY);
    doc.text('For AA. NAGARE INFRA MACHINERY', sigRight, footY, { align: 'right' });

    footY += SIG_LINE_GAP;
    doc.setDrawColor(...SOFT_GRAY);
    doc.setLineWidth(0.25);
    doc.line(sigLeft, footY, sigRight, footY);

    footY += SIG_LABEL_GAP;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_SIG_LABEL);
    doc.setTextColor(100, 100, 100);
    doc.text('Authorised Signatory', sigMid, footY, { align: 'center' });
  }
}

// Red brand strip flush at the very left edge of the page, drawn on every page.
function drawPageStrip(doc) {
  const { H, STRIP_W } = geometry(doc);
  doc.setFillColor(...RED);
  doc.rect(0, 0, STRIP_W, H, 'F');
}
