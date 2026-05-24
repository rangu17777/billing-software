/**
 * Hours conversion utilities for AAN billing.
 *
 * AAN display notation: "7.30 hrs" means 7 hours 30 minutes (NOT 7.3 hours).
 * Decimal storage: 7.5 (for calculation: 7.5 × rate = amount)
 */

/**
 * Converts separate hours + minutes fields to decimal hours for storage/calculation.
 * toDecimalHours(7, 30)  → 7.5
 * toDecimalHours(8, 0)   → 8.0
 * toDecimalHours(2, 45)  → 2.75
 */
export function toDecimalHours(hours, minutes) {
  const h = parseInt(hours, 10) || 0;
  const m = parseInt(minutes, 10) || 0;
  if (m < 0 || m > 59) throw new Error(`Invalid minutes: ${m}`);
  return h + m / 60;
}

/**
 * Formats decimal hours as AAN bill display notation.
 * toAanHoursDisplay(7.5)   → "7.30"
 * toAanHoursDisplay(8.75)  → "8.45"
 * toAanHoursDisplay(2.25)  → "2.15"
 */
export function toAanHoursDisplay(decimalHours) {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}.${String(m).padStart(2, '0')}`;
}

/**
 * Parses AAN display notation back to decimal hours.
 * toDecimalFromAan("7.30") → 7.5
 * toDecimalFromAan("2.45") → 2.75
 */
export function toDecimalFromAan(aanString) {
  const [hoursStr, minutesStr = '00'] = String(aanString).split('.');
  return toDecimalHours(parseInt(hoursStr, 10), parseInt(minutesStr, 10));
}
