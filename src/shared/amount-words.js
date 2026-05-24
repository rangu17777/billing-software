/**
 * Converts a rupee amount to Indian English words.
 * amountInWords(62540)   → "Sixty Two Thousand Five Hundred Forty Only"
 * amountInWords(100000)  → "One Lakh Only"
 * amountInWords(1200000) → "Twelve Lakh Only"
 */

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function belowThousand(n) {
  if (n < 100) return belowHundred(n);
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + belowHundred(n % 100) : '');
}

export function amountInWords(amount) {
  const n = Math.round(amount);
  if (n === 0) return 'Zero Only';

  const crore = Math.floor(n / 10_000_000);
  const lakh  = Math.floor((n % 10_000_000) / 100_000);
  const thou  = Math.floor((n % 100_000) / 1_000);
  const rem   = n % 1_000;

  let parts = [];
  if (crore) parts.push(belowThousand(crore) + ' Crore');
  if (lakh)  parts.push(belowThousand(lakh)  + ' Lakh');
  if (thou)  parts.push(belowThousand(thou)  + ' Thousand');
  if (rem)   parts.push(belowThousand(rem));

  return parts.join(' ') + ' Only';
}
