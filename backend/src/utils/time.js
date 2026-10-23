/**
 * Parses a stored `YYYY-MM-DD HH:MM:SS` timestamp.
 *
 * The app stores every timestamp in local time (see `now`), so it must also be
 * read back as local time. Parsing it as UTC would shift every stored value by
 * the server's UTC offset.
 */
export function parseStoredDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalised = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date as the local `YYYY-MM-DD HH:MM:SS` string used for storage.
 *
 * Every timestamp in the app is stored in local time, so writing and reading
 * must always go through this helper and `parseStoredDate` to stay in sync.
 */
export function formatStoredDate(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function now(date = new Date()) {
  return formatStoredDate(date);
}
