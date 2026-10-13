/** Formatting helpers shared across the application. */

/** Parses the backend `YYYY-MM-DD HH:MM:SS` format safely across browsers. */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalised = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, fallback = '—') {
  const date = parseDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatDateInput(value) {
  const date = parseDate(value);
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTime(value, fallback = '—') {
  const date = parseDate(value);
  if (!date) return fallback;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value, fallback = '—') {
  const date = parseDate(value);
  if (!date) return fallback;
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatLongDateTime(value, fallback = '—') {
  const date = parseDate(value);
  if (!date) return fallback;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function relativeTime(value) {
  const date = parseDate(value);
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Formats money using the lab currency settings. */
export function formatMoney(value, currency = {}) {
  const number = Number(value || 0);
  const { symbol = '$', position = 'before' } = currency || {};
  const amount = Math.abs(number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signed = number < 0 ? `-${amount}` : amount;
  return position === 'after' ? `${signed} ${symbol}` : `${symbol}${signed}`;
}

export function initials(name) {
  if (!name) return '?';
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function titleCase(value) {
  if (!value) return '';
  return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ageLabel(age, unit = 'years') {
  if (age === null || age === undefined || age === '') return '—';
  const suffix = { years: 'y', months: 'mo', days: 'd' }[unit] || unit;
  return `${age} ${suffix}`;
}

export function percentage(part, total, digits = 0) {
  if (!total) return 0;
  return Number(((Number(part) / Number(total)) * 100).toFixed(digits));
}

export function truncate(text, length = 60) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

/** Deterministic colour badge class for a status string. */
export function statusTone(status) {
  const map = {
    pending: 'warning',
    collected: 'info',
    in_progress: 'info',
    completed: 'success',
    reported: 'success',
    cancelled: 'danger',
    draft: 'warning',
    verified: 'success',
    final: 'brand',
    amended: 'info',
    paid: 'success',
    partial: 'warning',
    unpaid: 'danger',
    active: 'success',
    void: 'danger',
    normal: 'success',
    low: 'info',
    high: 'danger',
    abnormal: 'warning',
    critical: 'danger',
    routine: 'neutral',
    urgent: 'danger',
  };
  return map[status] || 'neutral';
}
