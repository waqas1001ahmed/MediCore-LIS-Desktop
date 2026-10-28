/**
 * Parses a stored timestamp.
 *
 * Timestamps are stored as UTC instants (ISO 8601 with `Z` suffix). Older
 * records may use the legacy `YYYY-MM-DD HH:MM:SS` format without a timezone;
 * those were stored as UTC on the server, so they are also interpreted as UTC.
 */
export function parseStoredDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value);
  // ISO strings with explicit timezone (Z or offset) are parsed correctly as-is
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const date = new Date(s);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // All other strings (legacy "YYYY-MM-DD HH:MM:SS" or ISO without timezone)
  // are stored as UTC on the server; treat them as UTC
  const normalised = s.includes('T') ? s : s.replace(' ', 'T');
  const date = new Date(normalised + 'Z');
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date as a UTC ISO 8601 string for storage.
 *
 * Every timestamp is stored as a UTC instant so that it can be converted to
 * any timezone (Asia/Karachi for display) without depending on the server's
 * local time.
 */
export function formatStoredDate(date = new Date()) {
  return date.toISOString();
}

export function now(date = new Date()) {
  return formatStoredDate(date);
}
