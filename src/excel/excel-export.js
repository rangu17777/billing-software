import * as XLSX from 'xlsx';

/**
 * Exports a flat list of bills into a well-formatted Excel spreadsheet
 * using SheetJS (xlsx).
 * 
 * @param {Array} billsList - Array of bill records from Supabase
 */
export function exportBillsToExcel(billsList) {
  // Helper to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return dateStr;
  };

  // Convert array of bills to clean spreadsheet rows
  const rows = billsList.map(b => ({
    'Bill No': b.bill_no,
    'Date': formatDate(b.date),
    'Client Name': b.client_name,
    'Site Location': b.client_site_name || '—',
    'Mobile': b.client_mobile || '—',
    'Client GSTIN': b.client_gst_no || '—',
    'Subtotal (₹)': b.subtotal,
    'SGST (9%) (₹)': b.sgst,
    'CGST (9%) (₹)': b.cgst,
    'Grand Total (₹)': b.grand_total,
    'Advance Paid (₹)': b.advance,
    'Balance Due (₹)': b.balance,
  }));

  // Create sheet
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'AAN Bills Summary');

  // Adjust column widths automatically for visual readability
  worksheet['!cols'] = [
    { wch: 10 }, // Bill No
    { wch: 12 }, // Date
    { wch: 28 }, // Client Name
    { wch: 20 }, // Site Location
    { wch: 15 }, // Mobile
    { wch: 18 }, // Client GSTIN
    { wch: 14 }, // Subtotal
    { wch: 12 }, // SGST
    { wch: 12 }, // CGST
    { wch: 16 }, // Grand Total
    { wch: 16 }, // Advance Paid
    { wch: 16 }  // Balance Due
  ];

  // Write and download file
  const filename = `AAN_Bills_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
