import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getCleanLogo } from '../shared/logo.js';

// Re-export so existing importers (bill-creator) keep working unchanged.
export { getCleanLogo };

// Download entry point (used by dashboard + bills list).
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

// Builds the jsPDF document (layout only — no save/output).
export async function buildBillPDFDoc(bill, lineItems) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W  = doc.internal.pageSize.getWidth();   // 210
  const H  = doc.internal.pageSize.getHeight();  // 297
  const LM = 10;
  const RM = 10;
  const CX = W / 2;

  // Shared content grid — every box/table/bar aligns to these edges.
  const CONTENT_X = LM + 2.5;          // 12.5 — just right of the red strip
  const CONTENT_R = W - RM;            // 200  — right content edge
  const CONTENT_W = CONTENT_R - CONTENT_X; // 187.5
  const SIDE_BOX_W = 54;               // bill-info & footer right boxes share this
  const SIDE_BOX_X = CONTENT_R - SIDE_BOX_W; // 146 — both right boxes line up

  const RED   = [211, 47, 47];
  const NAVY  = [26, 35, 126];
  const BLACK = [33, 33, 33];
  const WHITE = [255, 255, 255];
  const LGRAY = [245, 245, 245];

  const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN');
  const fmtDate = (s) => {
    if (!s) return '';
    const p = s.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
  };

  // ── 1. OUTER BORDER ──────────────────────────────────────────────────────────
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.rect(LM, 8, W - LM - RM, H - 16);

  // ── 2. LEFT RED ACCENT STRIP (Branded Premium) ───────────────────────────────
  doc.setFillColor(...RED);
  doc.rect(LM, 8, 2.5, H - 16, 'F');

  // ── 3. HEADER — cleaned AAN logo lockup (no re-typed text) ────────────────────
  let y = 12;
  const logo = await getCleanLogo();
  const logoH = 26;
  let logoW = logoH * logo.aspect;
  const maxLogoW = W - LM - RM - 20;
  if (logoW > maxLogoW) logoW = maxLogoW;
  const logoX = CX - logoW / 2;

  doc.addImage(logo.dataUrl, 'JPEG', logoX, y, logoW, logoH);
  y += logoH + 4;

  // Address + contact (these are NOT in the logo) — three centered lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text('Add.: A/p Ambadwet, Tal. Mulshi, Dist - Pune.', CX, y, { align: 'center' });
  y += 4;
  doc.text('Mob.: 7875396396 / 9921353533 / 9822111882', CX, y, { align: 'center' });
  y += 4;
  doc.text('Email: aanagre.machinery@gmail.com', CX, y, { align: 'center' });
  y += 4;

  // Thin red accent bar below header
  doc.setFillColor(...RED);
  doc.rect(CONTENT_X, y, CONTENT_W, 1, 'F');
  y += 3;

  // ── 4. BILL INFO — two-column ─────────────────────────────────────────────────
  const infoTop  = y;
  const rightBoxW = SIDE_BOX_W;
  const rightBoxX = SIDE_BOX_X;
  const infoH    = 22;

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.rect(rightBoxX, infoTop, rightBoxW, infoH);
  doc.line(rightBoxX, infoTop + 8,  rightBoxX + rightBoxW, infoTop + 8);
  doc.line(rightBoxX, infoTop + 15, rightBoxX + rightBoxW, infoTop + 15);

  // Left: To / Client / Site
  const lx = LM + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...BLACK);
  doc.text('To.', lx, infoTop + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const clientDisplay = (bill.client_name || '').toUpperCase();
  doc.text(clientDisplay, lx + 10, infoTop + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Site Name :  ${bill.client_site_name || ''}`, lx, infoTop + 15);

  // Right box content
  const rbX  = rightBoxX + 3;
  const rbVX = rightBoxX + rightBoxW - 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Bill No. :', rbX, infoTop + 5.5);
  doc.text(`${bill.bill_no}`, rbVX, infoTop + 5.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Date :', rbX, infoTop + 12.5);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtDate(bill.date) + '.', rbVX, infoTop + 12.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Mob. :', rbX, infoTop + 19.5);
  doc.setFont('helvetica', 'bold');
  doc.text(bill.client_mobile || '', rbVX, infoTop + 19.5, { align: 'right' });

  y = infoTop + infoH + 1;

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(CONTENT_X, y, CONTENT_R, y);
  y += 1;

  // ── 5. LINE ITEMS TABLE ───────────────────────────────────────────────────────
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

  const subtotal    = parseFloat(bill.subtotal    || 0);
  const sgstAmt     = parseFloat(bill.sgst        || 0);
  const cgstAmt     = parseFloat(bill.cgst        || 0);
  const grandTotal  = parseFloat(bill.grand_total || 0);

  // Totals as footer rows of the same table: label spans Sr..Qty (right-aligned),
  // rate falls under the Rate column, value under the Amount column.
  const taxStartIdx = tableData.length;
  tableData.push([{ content: 'Subtotal', colSpan: 6, styles: { halign: 'right' } }, '',   fmt(subtotal)]);
  tableData.push([{ content: 'SGST',     colSpan: 6, styles: { halign: 'right' } }, '9%', fmt(sgstAmt)]);
  tableData.push([{ content: 'CGST',     colSpan: 6, styles: { halign: 'right' } }, '9%', fmt(cgstAmt)]);

  doc.autoTable({
    startY: y,
    head: [['Sr.\nNo.', 'Date', 'Challan\nNo.', 'Description', 'Vehicle\nNo.', 'Qty./Unit', 'Rate', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: RED,
      textColor: WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineColor: WHITE,
      lineWidth: 0.3,
      minCellHeight: 10
    },
    // Column widths sum to CONTENT_W (187.5) so the table fills the full grid.
    columnStyles: {
      0: { cellWidth: 11,   halign: 'center' },  // Sr. No.
      1: { cellWidth: 16,   halign: 'center' },  // Date
      2: { cellWidth: 19,   halign: 'center' },  // Challan No.
      3: { cellWidth: 49,   halign: 'left'   },  // Description
      4: { cellWidth: 22,   halign: 'center' },  // Vehicle No.
      5: { cellWidth: 23,   halign: 'center' },  // Qty./Unit
      6: { cellWidth: 21,   halign: 'right'  },  // Rate
      7: { cellWidth: 26.5, halign: 'right'  }   // Amount
    },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      textColor: BLACK,
      font: 'helvetica',
      overflow: 'linebreak'
    },
    alternateRowStyles: { fillColor: LGRAY },
    margin: { left: CONTENT_X, right: RM },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index >= taxStartIdx) {
        data.cell.styles.fillColor = [255, 248, 225];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = NAVY;
      }
    }
  });

  const tableEndY = doc.lastAutoTable.finalY;

  // ── 6. GRAND TOTAL BAR (red, full width) ──────────────────────────────────────
  const gtH = 9;
  doc.setFillColor(...RED);
  doc.rect(CONTENT_X, tableEndY, CONTENT_W, gtH, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('GRAND TOTAL', CONTENT_X + 5, tableEndY + 6);
  doc.text(fmt(grandTotal) + ' /-', CONTENT_R - 4, tableEndY + 6, { align: 'right' });

  let footY = tableEndY + gtH + 4;

  // ── 7. BOTTOM FOOTER — client box + Total/Advance/Balance ────────────────────
  const footBoxH = 24;
  const footGap  = 4;
  const rightFBW = SIDE_BOX_W;
  const rightFBX = SIDE_BOX_X;                       // aligns with bill-info box
  const leftFBW  = rightFBX - footGap - CONTENT_X;
  const fLx      = CONTENT_X + 3;                    // left padding inside box

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.rect(CONTENT_X, footY, leftFBW, footBoxH);

  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(bill.client_name || '', fLx, footY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (bill.client_address) {
    const addrLines = doc.splitTextToSize(bill.client_address, leftFBW - 6);
    doc.text(addrLines.slice(0, 2), fLx, footY + 10);
  }
  doc.text(`GST No.: ${bill.client_gst_no || '--'}`, fLx, footY + 20);

  // Right box
  doc.rect(rightFBX, footY, rightFBW, footBoxH);
  doc.line(rightFBX, footY + 8,  rightFBX + rightFBW, footY + 8);
  doc.line(rightFBX, footY + 16, rightFBX + rightFBW, footY + 16);

  const rfX  = rightFBX + 3;
  const rfVX = rightFBX + rightFBW - 3;

  // Red "Total" row
  doc.setFillColor(...RED);
  doc.rect(rightFBX, footY, rightFBW, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Total', rfX, footY + 5.5);
  doc.text(fmt(grandTotal), rfVX, footY + 5.5, { align: 'right' });

  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const adv = parseFloat(bill.advance || 0);
  doc.text('Advance', rfX, footY + 13);
  doc.text(adv > 0 ? fmt(adv) : '--', rfVX, footY + 13, { align: 'right' });

  const bal = parseFloat(bill.balance || 0);
  doc.text('Balance', rfX, footY + 21);
  doc.setFont('helvetica', 'bold');
  doc.text(bal > 0 ? fmt(bal) : '--', rfVX, footY + 21, { align: 'right' });

  footY += footBoxH + 4;

  // ── 8. Rs. IN WORDS — highlighted band ───────────────────────────────────────
  const wordsBandH = 9;
  doc.setFillColor(255, 248, 225);          // cream highlight fill
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.5);
  doc.rect(CONTENT_X, footY, CONTENT_W, wordsBandH, 'FD');  // fill + red border

  const wordsY = footY + wordsBandH / 2 + 1.5;
  const wordsLabel = 'Rs. In Words :  ';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...RED);
  doc.text(wordsLabel, CONTENT_X + 4, wordsY);
  const labelW = doc.getTextWidth(wordsLabel);

  // Fit the amount-in-words on one line (shrink slightly if very long).
  const valText = (bill.amount_in_words || '').toString();
  const avail = CONTENT_W - 8 - labelW;
  let valFont = 9;
  doc.setFontSize(valFont);
  while (valFont > 7 && doc.getTextWidth(valText) > avail) { valFont -= 0.5; doc.setFontSize(valFont); }
  doc.setTextColor(...NAVY);
  doc.text(valText, CONTENT_X + 4 + labelW, wordsY);

  footY += wordsBandH + 6;

  // ── 9. SIGNATURE ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text('For AA. NAGARE INFRA MACHINERY', CONTENT_R - 3, footY, { align: 'right' });

  footY += 12;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(SIDE_BOX_X, footY, CONTENT_R - 3, footY);

  footY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Authorised Signatory', CONTENT_R - 3, footY, { align: 'right' });

  return doc;
}
