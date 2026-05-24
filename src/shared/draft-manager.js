/**
 * Auto-saves bill form data to localStorage every 30 seconds.
 * Protects against data loss on network errors or accidental navigation.
 */

const DRAFT_KEY = 'aan_bill_draft';
const INTERVAL_MS = 30_000;

/**
 * Checks if the bill data has unsaved progress (is dirty).
 * A bill is dirty if a client is selected, advance is entered,
 * or line items have any entered details.
 * @param {object} data - The current billData object
 * @returns {boolean} true if form is dirty
 */
export function isDraftDirty(data) {
  if (!data) return false;
  // If a client was chosen or typed, the form is dirty
  if (data.client_id || (data.client_name && data.client_name.trim() !== '')) {
    return true;
  }
  // If advance is set
  if (data.advance && data.advance > 0) {
    return true;
  }
  // If there is more than 1 line item
  if (data.lineItems && data.lineItems.length > 1) {
    return true;
  }
  // If there's exactly 1 line item, check if any of its input fields are modified
  if (data.lineItems && data.lineItems.length === 1) {
    const item = data.lineItems[0];
    if (
      (item.challan_no && item.challan_no.trim() !== '') ||
      item.machine_id ||
      (item.description && item.description.trim() !== '') ||
      item.hours > 0 ||
      item.minutes > 0 ||
      item.rate > 0 ||
      item.amount > 0 ||
      item.days !== 1
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Starts auto-saving. Returns the interval ID — call clearInterval(id) to stop.
 * @param {() => object} getFormData - Function returning current form state as plain object
 * @returns {number} interval ID
 */
export function startAutosave(getFormData) {
  return setInterval(() => {
    try {
      const data = getFormData();
      if (!isDraftDirty(data)) {
        // If form is not dirty, clear any existing draft to avoid stale prompts
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        data,
        savedAt: new Date().toISOString(),
      }));
    } catch {
      // localStorage write failure is non-fatal
    }
  }, INTERVAL_MS);
}

/** Returns saved draft { data, savedAt } or null if empty or non-dirty. */
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && isDraftDirty(parsed.data)) {
      return parsed;
    }
    // Clean up empty/stale drafts
    localStorage.removeItem(DRAFT_KEY);
    return null;
  } catch {
    return null;
  }
}

/** Clears draft after a successful bill save. */
export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

