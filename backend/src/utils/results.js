/**
 * Result helpers: reference-range parsing and normal/abnormal flagging.
 */

/** Parses common reference range notations into numeric bounds when possible. */
export function parseReferenceRange(range) {
  if (!range) return null;
  const text = String(range).trim();

  const between = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (between) {
    return { low: Number(between[1]), high: Number(between[2]) };
  }

  const lessThan = text.match(/^(?:<|<=|less than)\s*(-?\d+(?:\.\d+)?)/i);
  if (lessThan) return { low: null, high: Number(lessThan[1]) };

  const greaterThan = text.match(/^(?:>|>=|greater than)\s*(-?\d+(?:\.\d+)?)/i);
  if (greaterThan) return { low: Number(greaterThan[1]), high: null };

  const single = text.match(/^(-?\d+(?:\.\d+)?)$/);
  if (single) return { low: Number(single[1]), high: Number(single[1]) };

  return null;
}

/**
 * Determines whether a numeric result is within the reference range.
 * Returns `normal`, `low`, `high`, `abnormal` (non-numeric mismatch) or null
 * when a comparison is not possible.
 */
export function computeFlag(value, referenceRange) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).trim());
  const bounds = parseReferenceRange(referenceRange);

  if (!bounds) {
    return null;
  }
  if (!Number.isFinite(numeric)) {
    return 'abnormal';
  }
  if (bounds.low !== null && numeric < bounds.low) return 'low';
  if (bounds.high !== null && numeric > bounds.high) return 'high';
  return 'normal';
}

/** Human label for a flag value. */
export function flagLabel(flag) {
  switch (flag) {
    case 'low': return 'Low';
    case 'high': return 'High';
    case 'abnormal': return 'Abnormal';
    case 'critical': return 'Critical';
    case 'normal': return 'Normal';
    default: return '—';
  }
}
