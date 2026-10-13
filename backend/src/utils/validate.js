import { ApiError } from '../utils/errors.js';

/** Throws a 400 error when the condition is falsy. */
export function assert(condition, message, details) {
  if (!condition) throw ApiError.badRequest(message, details);
}

export function pick(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export function trimmed(value) {
  return typeof value === 'string' ? value.trim() : value;
}

export function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = body?.[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });
  assert(missing.length === 0, `Missing required field(s): ${missing.join(', ')}`, { fields: missing });
}

export function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toInt(value, fallback = 0) {
  const num = toNumber(value, NaN);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

export function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export function oneOf(value, allowed, field = 'value') {
  assert(allowed.includes(value), `Invalid ${field}. Allowed: ${allowed.join(', ')}`);
  return value;
}

export function isEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

export function paginate(query) {
  const page = Math.max(1, toInt(query.page, 1));
  const rawLimit = toInt(query.limit ?? query.pageSize, 20);
  const limit = Math.min(200, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Escapes `%` and `_` for use inside a LIKE clause. */
export function likeValue(term) {
  return `%${String(term || '').trim().replace(/[%_]/g, (m) => `\\${m}`)}%`;
}

export const ORDER_STATUSES = ['pending', 'collected', 'in_progress', 'completed', 'reported', 'cancelled'];
export const ITEM_STATUSES = ['pending', 'in_progress', 'completed', 'verified'];
export const REPORT_STATUSES = ['draft', 'verified', 'final', 'amended'];
export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];
export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile_wallet', 'insurance', 'cheque'];
export const GENDERS = ['male', 'female', 'other'];
export const AGE_UNITS = ['years', 'months', 'days'];
export const RESULT_FLAGS = ['normal', 'low', 'high', 'abnormal', 'critical'];
export const PRIORITIES = ['routine', 'urgent'];
