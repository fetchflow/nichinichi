/**
 * Format a date as YYYY-MM-DD in the given IANA timezone (or local system
 * time if no timezone is provided). Use this instead of toISOString() which
 * always returns UTC and causes off-by-one-day bugs for users west of UTC.
 */
export function localDateStr(date = new Date(), tz?: string): string {
  if (tz) {
    // en-CA locale produces the YYYY-MM-DD format we need
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(date);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
