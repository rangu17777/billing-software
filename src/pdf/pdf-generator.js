import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getCleanLogo } from '../shared/logo.js';

// Re-export so existing importers (bill-creator) keep working unchanged.
export { getCleanLogo };

// Company GSTIN — printed on every bill by default.
const COMPANY_GSTIN = '27BISPN4599L1Z3';

const RED        = [211, 47, 47];
const NAVY       = [26, 35, 126];
const BLACK      = [33, 33, 33];
const WHITE      = [255, 255, 255];
const LGRAY      = [245, 245, 245];
const SOFT_GRAY  = [130, 130, 130];
const TABLE_GRAY = [210, 210, 210];

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN');
const fmtDate = (s) => {
  if (!s) return '';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};

// ── Geometry ──────────────────────────────────────────────────────────────────
function geometry(doc) {
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();  // 297
  const LM = 3, RM = 3;
  const CX = W / 2;
  const STRIP_W = 5;
  const CONTENT_X  = STRIP_W + LM;              // 8
  const CONTENT_R  = W - RM;                    // 207
  const CONTENT_W  = CONTENT_R - CONTENT_X;     // 199
  const SIDE_BOX_W = 60;
  const SIDE_BOX_X = CONTENT_R - SIDE_BOX_W;
  return { W, H, LM, RM, CX, STRIP_W, CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X };
}

const BOTTOM_SAFETY = 5;

// ── Download entry point ──────────────────────────────────────────────────────
export async function generateBillPDF(bill, lineItems) {
  const doc = await buildBillPDFDoc(bill, lineItems);
  const safeName = (bill.client_name || 'client').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`AAN_Bill_${bill.bill_no}_${safeName}.pdf`);
}

// Returns the bill PDF as a Blob.
export async function getBillPDFBlob(bill, lineItems) {
  const doc = await buildBillPDFDoc(bill, lineItems);
  return doc.output('blob');
}

// ── MAIN PDF BUILDER ──────────────────────────────────────────────────────────
//
// DEFINITIVE PAGINATION MODEL — "Physical Bill Pad":
//
//   EVERY page (non-last AND last) is structurally identical:
//     ① Full header: logo + address + GSTIN + bill-info box
//     ② Exactly 15 item rows — always padded with blank rows if fewer items
//     ③ Subtotal / SGST / CGST rows
//        → non-last: labels + rates shown, AMOUNT COLUMN EMPTY
//        → last page: labels + rates + actual amounts
//     ④ Grand Total bar
//        → non-last: bar shown, NO amount text
//        → last page: bar + actual grand total amount
//     ⑤ Client details box (left) — real data on EVERY page
//        Totals box (right) — Total / Advance / Balance / Prev.Due
//        → non-last: row labels shown, VALUES EMPTY
//        → last page: labels + actual values
//     ⑥ Rs. In Words band
//        → non-last: band shown, TEXT EMPTY
//        → last page: band + actual words
//     ⑦ Signature block — LAST PAGE ONLY
//
export async function buildBillPDFDoc(bill, lineItems) {
  const logo = await getCleanLogo();

  // ── Fixed layout constants (mm) ──────────────────────────────────────────
  const ITEMS_PER_PAGE = 15;   // hardcoded — never changes

  // Header
  const HEADER_BOTTOM   = 76;
  const LOGO_H          = 32;
  const BILL_INFO_H     = 24;

  // Table row geometry
  const TABLE_HEAD_MIN  = 10;
  const TABLE_ROW_MIN   = 6.5;
  const TABLE_PAD_V     = 1.6;

  // Footer block dimensions (mm)
  const GT_H            = 12;   // Grand Total red bar
  const FOOT_BOX_H      = 24;   // client + totals boxes
  const WORDS_BAND_H    = 10;   // Rs. In Words band
  const SIG_PAD_TOP     = 7;
  const SIG_LINE_GAP    = 10;
  const SIG_LABEL_GAP   = 3;

  // ── Font sizes (pt) ──────────────────────────────────────────────────────
  const F_ADDRESS      = 9.5;
  const F_GSTIN_HDR    = 9;
  const F_TO_LABEL     = 10;
  const F_CLIENT_NAME  = 12;
  const F_BILLINFO_LBL = 9.5;
  const F_BILLINFO_VAL = 10.5;
  const F_TABLE_HEAD   = 9.5;
  const F_TABLE_BODY   = 10;
  const F_TABLE_TAX    = 10.5;
  const F_GRAND_TOTAL  = 13;
  const F_FOOT_CLIENT  = 11;
  const F_FOOT_ADDR    = 9;
  const F_TOTAL_HEAD   = 12;
  const F_TOTAL_VAL    = 11;
  const F_WORDS_LBL    = 11;
  const F_WORDS_VAL    = 11;
  const F_SIG_NAME     = 10;
  const F_SIG_LABEL    = 8;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { RM, CONTENT_X } = geometry(doc);

  // ── Tax amounts ──────────────────────────────────────────────────────────
  const subtotal = parseFloat(bill.subtotal || 0);
  const sgstAmt  = parseFloat(bill.sgst     || 0);
  const cgstAmt  = parseFloat(bill.cgst     || 0);
  const sgstRate = subtotal > 0 ? +(sgstAmt * 100 / subtotal).toFixed(2) : 9;
  const cgstRate = subtotal > 0 ? +(cgstAmt * 100 / subtotal).toFixed(2) : 9;

  // Tax rows — two variants:
  //   filledTaxRows  → last page: real amounts shown
  //   emptyTaxRows   → non-last: amounts blank, labels + rates still visible
  const filledTaxRows = [
    [{ content: 'Subtotal', colSpan: 6, styles: { halign: 'right' } }, '',              fmt(subtotal)],
    [{ content: 'SGST',     colSpan: 6, styles: { halign: 'right' } }, `${sgstRate}%`,  fmt(sgstAmt)],
    [{ content: 'CGST',     colSpan: 6, styles: { halign: 'right' } }, `${cgstRate}%`,  fmt(cgstAmt)],
  ];
  const emptyTaxRows = [
    [{ content: 'Subtotal', colSpan: 6, styles: { halign: 'right' } }, '', ''],
    [{ content: 'SGST',     colSpan: 6, styles: { halign: 'right' } }, '9%', ''],
    [{ content: 'CGST',     colSpan: 6, styles: { halign: 'right' } }, '9%', ''],
  ];

  // ── Chunk items into groups of 15 ────────────────────────────────────────
  const allItems = lineItems.length > 0 ? lineItems : [];

  const chunks = [];
  if (allItems.length === 0) {
    chunks.push([]);  // one blank-template page for empty bills
  } else {
    for (let i = 0; i < allItems.length; i += ITEMS_PER_PAGE) {
      chunks.push(allItems.slice(i, i + ITEMS_PER_PAGE));
    }
  }

  // ── Render each chunk on its own page ────────────────────────────────────
  for (let pageIdx = 0; pageIdx < chunks.length; pageIdx++) {
    const isLastPage = pageIdx === chunks.length - 1;
    const chunk      = chunks[pageIdx];

    if (pageIdx > 0) doc.addPage();

    // ① Full header on every page
    drawPageStrip(doc);
    drawPageHeader();

    // ② Build 15-row padded body + tax rows
    const paddedChunk = [...chunk];
    while (paddedChunk.length < ITEMS_PER_PAGE) paddedChunk.push(null);

    const tableData = paddedChunk.map((item, i) => {
      if (!item) return ['', '', '', '', '', '', '', ''];
      const srNo = pageIdx * ITEMS_PER_PAGE + i + 1;
      return [
        srNo,
        item.date        || '',
        item.challan_no  || '--',
        item.description || '',
        item.vehicle_no  || '',
        item.qty_unit    || '',
        fmt(item.rate),
        fmt(item.amount)
      ];
    });

    // ③ Tax rows — always present, filled or empty depending on page
    tableData.push(...(isLastPage ? filledTaxRows : emptyTaxRows));

    // Tax row start index (for didParseCell styling)
    const taxStartIdx = ITEMS_PER_PAGE;

    // ④ Draw table for this chunk — no auto-pagination (one call = one page)
    doc.autoTable({
      startY: HEADER_BOTTOM,
      margin: {
        top:    HEADER_BOTTOM,
        left:   CONTENT_X,
        right:  RM,
        bottom: BOTTOM_SAFETY
      },
      showHead: 'firstPage',
      head: [['Sr.\nNo.', 'Date', 'Challan\nNo.', 'Description', 'Vehicle\nNo.', 'Qty./Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor:     RED,
        textColor:     WHITE,
        fontSize:      F_TABLE_HEAD,
        fontStyle:     'bold',
        halign:        'center',
        valign:        'middle',
        lineColor:     WHITE,
        lineWidth:     0.3,
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
        fontSize:      F_TABLE_BODY,
        fontStyle:     'bold',
        cellPadding:   { top: TABLE_PAD_V, bottom: TABLE_PAD_V, left: 3, right: 3 },
        lineColor:     TABLE_GRAY,
        lineWidth:     0.12,
        textColor:     BLACK,
        font:          'helvetica',
        overflow:      'linebreak',
        minCellHeight: TABLE_ROW_MIN
      },
      alternateRowStyles: { fillColor: LGRAY },
      didParseCell: (data) => {
        // Blank padding rows — show only grid lines, text invisible
        if (data.section === 'body'
            && data.row.index >= chunk.length
            && data.row.index < ITEMS_PER_PAGE) {
          data.cell.styles.fontStyle = 'normal';
          data.cell.styles.textColor = [200, 200, 200];
        }
        // Tax rows (Subtotal / SGST / CGST) — warm yellow styling always
        if (data.section === 'body' && data.row.index >= taxStartIdx) {
          data.cell.styles.fillColor     = [255, 248, 225];
          data.cell.styles.fontStyle     = 'bold';
          data.cell.styles.textColor     = NAVY;
          data.cell.styles.fontSize      = F_TABLE_TAX;
          data.cell.styles.minCellHeight = 8;
        }
      }
      // NO didDrawPage — headers are drawn manually before each autoTable call.
    });

    const tableEndY = doc.lastAutoTable.finalY;

    // ⑤ ⑥ ⑦ Draw the full page footer (unified function)
    drawPageFooter(tableEndY, isLastPage);
  }

  return doc;

  // ══ Inner helpers ══════════════════════════════════════════════════════════

  // Full company header — identical on every page.
  function drawPageHeader() {
    const { W, RM, CX, CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X } = geometry(doc);

    // Logo (always 32 mm)
    let y = 3;
    let logoW = LOGO_H * logo.aspect;
    const maxLogoW = W - CONTENT_X - RM - 70;
    if (logoW > maxLogoW) logoW = maxLogoW;
    const logoX = CX - logoW / 2;
    doc.addImage(logo.dataUrl, 'JPEG', logoX, y, logoW, LOGO_H);
    y += LOGO_H + 3; // ≈ 38

    // Address + contact
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_ADDRESS);
    doc.setTextColor(...BLACK);
    doc.text('Add.: A/p Ambadwet, Tal. Mulshi, Dist - Pune.', CX, y, { align: 'center' });
    y += 4; // ≈ 42

    doc.text('Mob.: 7875396396 / 9921353533 / 9822111882', CX, y, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_GSTIN_HDR);
    doc.setTextColor(...NAVY);
    doc.text(`GSTIN: ${COMPANY_GSTIN}`, CONTENT_R - 1, y, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_ADDRESS);
    doc.setTextColor(...BLACK);
    y += 4; // ≈ 46

    doc.text('Email: aanagare.machinery@gmail.com', CX, y, { align: 'center' });
    y += 2.5; // ≈ 48.5

    // Red accent bar
    doc.setFillColor(...RED);
    doc.rect(CONTENT_X, y, CONTENT_W, 1, 'F');
    y += 2.5; // ≈ 51 → infoTop

    const infoTop = y; // infoTop + BILL_INFO_H(24) ≈ 75 ≈ HEADER_BOTTOM ✓

    // Bill-info box (right side)
    doc.setDrawColor(...SOFT_GRAY);
    doc.setLineWidth(0.22);
    doc.rect(SIDE_BOX_X, infoTop, SIDE_BOX_W, BILL_INFO_H);
    doc.line(SIDE_BOX_X, infoTop + BILL_INFO_H / 3,     SIDE_BOX_X + SIDE_BOX_W, infoTop + BILL_INFO_H / 3);
    doc.line(SIDE_BOX_X, infoTop + 2 * BILL_INFO_H / 3, SIDE_BOX_X + SIDE_BOX_W, infoTop + 2 * BILL_INFO_H / 3);

    // Left: To / client name / site name
    const lx = CONTENT_X + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_TO_LABEL);
    doc.setTextColor(...BLACK);
    doc.text('To.', lx, infoTop + BILL_INFO_H * 0.25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_CLIENT_NAME);
    doc.text((bill.client_name || '').toUpperCase(), lx + 11, infoTop + BILL_INFO_H * 0.25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_TO_LABEL);
    doc.text(`Site Name :  ${bill.client_site_name || ''}`, lx, infoTop + BILL_INFO_H * 0.72);

    // Right: Bill No. / Date / Mob.
    const rbX  = SIDE_BOX_X + 3;
    const rbVX = SIDE_BOX_X + SIDE_BOX_W - 3;
    const rowH  = BILL_INFO_H / 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_BILLINFO_LBL);
    doc.text('Bill No. :', rbX, infoTop + rowH * 0.65);
    doc.setFontSize(F_BILLINFO_VAL);
    doc.text(`${bill.bill_no}`, rbVX, infoTop + rowH * 0.65, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_BILLINFO_LBL);
    doc.text('Date :', rbX, infoTop + rowH * 1.65);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_BILLINFO_VAL);
    doc.text(fmtDate(bill.date) + '.', rbVX, infoTop + rowH * 1.65, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_BILLINFO_LBL);
    doc.text('Mob. :', rbX, infoTop + rowH * 2.65);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_BILLINFO_VAL);
    doc.text(bill.client_mobile || '', rbVX, infoTop + rowH * 2.65, { align: 'right' });
  }

  // ── Unified page footer ───────────────────────────────────────────────────
  // Draws EVERYTHING below the table on every page.
  //   isLastPage = true  → filled amounts + signature
  //   isLastPage = false → empty amounts, NO signature
  function drawPageFooter(tableEndY, isLastPage) {
    const { CONTENT_X, CONTENT_R, CONTENT_W, SIDE_BOX_W, SIDE_BOX_X } = geometry(doc);
    const grandTotal = parseFloat(bill.grand_total || 0);

    // ── ⑤ Grand Total bar ────────────────────────────────────────────────
    doc.setFillColor(...RED);
    doc.rect(CONTENT_X, tableEndY, CONTENT_W, GT_H, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_GRAND_TOTAL);
    doc.text('GRAND TOTAL', CONTENT_X + 6, tableEndY + GT_H * 0.67);
    if (isLastPage) {
      doc.text(fmt(grandTotal) + ' /-', CONTENT_R - 5, tableEndY + GT_H * 0.67, { align: 'right' });
    }

    let footY = tableEndY + GT_H + 3;

    // ── ⑤ Client box (left) + Totals box (right) ─────────────────────────
    const footGap  = 3;
    const rightFBW = SIDE_BOX_W;
    const rightFBX = SIDE_BOX_X;
    const leftFBW  = rightFBX - footGap - CONTENT_X;
    const fLx      = CONTENT_X + 4;

    doc.setDrawColor(...SOFT_GRAY);
    doc.setLineWidth(0.22);

    // Left box — client details (always real data)
    doc.rect(CONTENT_X, footY, leftFBW, FOOT_BOX_H);
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_FOOT_CLIENT);
    doc.text(bill.client_name || '', fLx, footY + FOOT_BOX_H * 0.25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_FOOT_ADDR);
    if (bill.client_address) {
      const addrLines = doc.splitTextToSize(bill.client_address, leftFBW - 8);
      doc.text(addrLines.slice(0, 2), fLx, footY + FOOT_BOX_H * 0.52);
    }
    doc.text(`GST No.: ${bill.client_gst_no || '--'}`, fLx, footY + FOOT_BOX_H * 0.85);

    // Right box — 4 rows: Total / Advance / Prev. Due / Balance
    doc.rect(rightFBX, footY, rightFBW, FOOT_BOX_H);
    doc.line(rightFBX, footY + FOOT_BOX_H / 4,     rightFBX + rightFBW, footY + FOOT_BOX_H / 4);
    doc.line(rightFBX, footY + FOOT_BOX_H / 2,     rightFBX + rightFBW, footY + FOOT_BOX_H / 2);
    doc.line(rightFBX, footY + 3 * FOOT_BOX_H / 4, rightFBX + rightFBW, footY + 3 * FOOT_BOX_H / 4);

    const rfX   = rightFBX + 3;
    const rfVX  = rightFBX + rightFBW - 3;
    const rowH4 = FOOT_BOX_H / 4;

    // Row 1 — "Total" (always red fill)
    doc.setFillColor(...RED);
    doc.rect(rightFBX, footY, rightFBW, rowH4, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_TOTAL_HEAD);
    doc.text('Total', rfX, footY + rowH4 * 0.65);
    if (isLastPage) {
      doc.text(fmt(grandTotal), rfVX, footY + rowH4 * 0.65, { align: 'right' });
    }

    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(F_TOTAL_VAL);

    // Row 2 — Advance
    doc.text('Advance', rfX, footY + rowH4 * 1.65);
    if (isLastPage) {
      const adv = parseFloat(bill.advance || 0);
      doc.text(adv > 0 ? fmt(adv) : '--', rfVX, footY + rowH4 * 1.65, { align: 'right' });
    }

    // Row 3 — Prev. Due
    doc.text('Prev. Due', rfX, footY + rowH4 * 2.65);
    if (isLastPage) {
      const prevDue = parseFloat(bill.previous_due || 0);
      doc.text(prevDue > 0 ? fmt(prevDue) : '--', rfVX, footY + rowH4 * 2.65, { align: 'right' });
    }

    // Row 4 — Balance (bold + navy — final amount owed, most prominent)
    doc.setFillColor(240, 240, 250);   // very subtle blue-grey tint
    doc.rect(rightFBX, footY + rowH4 * 3, rightFBW, rowH4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(F_TOTAL_HEAD);     // same size as Total row for emphasis
    doc.setTextColor(...NAVY);
    doc.text('Balance', rfX, footY + rowH4 * 3.65);
    if (isLastPage) {
      const bal = parseFloat(bill.balance || 0);
      doc.text(bal > 0 ? fmt(bal) : '--', rfVX, footY + rowH4 * 3.65, { align: 'right' });
    }

    footY += FOOT_BOX_H + 3;

    // ── ⑥ Rs. In Words band — present on EVERY page ───────────────────────
    doc.setFillColor(255, 248, 225);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.5);
    doc.rect(CONTENT_X, footY, CONTENT_W, WORDS_BAND_H, 'FD');

    if (isLastPage) {
      // Last page: render full "Rs. In Words : <text>"
      const wordsY     = footY + WORDS_BAND_H / 2 + 1.8;
      const wordsLabel = 'Rs. In Words :  ';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(F_WORDS_LBL);
      doc.setTextColor(...RED);
      doc.text(wordsLabel, CONTENT_X + 5, wordsY);
      const labelW = doc.getTextWidth(wordsLabel);

      const valText = (bill.amount_in_words || '').toString();
      const avail   = CONTENT_W - 10 - labelW;
      let valFont   = F_WORDS_VAL;
      doc.setFontSize(valFont);
      while (valFont > 7 && doc.getTextWidth(valText) > avail) {
        valFont -= 0.5;
        doc.setFontSize(valFont);
      }
      doc.setTextColor(...NAVY);
      doc.text(valText, CONTENT_X + 5 + labelW, wordsY);
    } else {
      // Non-last page: show only the label, value stays empty
      const wordsY = footY + WORDS_BAND_H / 2 + 1.8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(F_WORDS_LBL);
      doc.setTextColor(...RED);
      doc.text('Rs. In Words :  ', CONTENT_X + 5, wordsY);
    }

    footY += WORDS_BAND_H + SIG_PAD_TOP;

    // ── ⑦ Signature — LAST PAGE ONLY ─────────────────────────────────────
    if (isLastPage) {
      const sigRight = CONTENT_R - 4;
      const sigLeft  = CONTENT_R - 70;
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
}

// Red brand strip — full left edge, drawn on every page.
function drawPageStrip(doc) {
  const { H, STRIP_W } = geometry(doc);
  doc.setFillColor(...RED);
  doc.rect(0, 0, STRIP_W, H, 'F');
}
