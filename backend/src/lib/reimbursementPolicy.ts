export const REIMBURSEMENT_FILING_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === Number(match[1]) && parsed.getUTCMonth() === Number(match[2]) - 1 && parsed.getUTCDate() === Number(match[3]) ? timestamp : null;
}

export function getTodayIsoDate(timeZone = 'Asia/Manila'): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getReimbursementDateError(purchaseDate: string | undefined, filingDate = getTodayIsoDate()): string | null {
  if (!purchaseDate) return 'Enter the receipt purchase date.';
  const purchaseTimestamp = parseDateOnly(purchaseDate);
  const filingTimestamp = parseDateOnly(filingDate);
  if (purchaseTimestamp === null || filingTimestamp === null) return 'Enter a valid receipt purchase date.';
  const ageDays = Math.round((filingTimestamp - purchaseTimestamp) / DAY_MS);
  if (ageDays < 0) return 'The receipt purchase date cannot be in the future.';
  return ageDays > REIMBURSEMENT_FILING_WINDOW_DAYS
    ? `This receipt is ${ageDays} days old. Reimbursement claims must be filed within ${REIMBURSEMENT_FILING_WINDOW_DAYS} days of purchase.`
    : null;
}
