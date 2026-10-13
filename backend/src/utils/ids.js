import { appStore } from '../db/app-store.js';
import { now as formatNow } from './time.js';

export function now() { return formatNow(); }
export { formatNow };
export function formatDate(date = new Date()) { const pad = (n) => String(n).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
export function periodKey(date = new Date()) { const pad = (n) => String(n).padStart(2, '0'); return `${String(date.getFullYear()).slice(2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`; }
export async function nextSequence(name, period = '') { const { collections } = await appStore(); const result = await collections.sequences.findOneAndUpdate({ name, period }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' }); const sequence = result?.value && typeof result.value === 'object' ? result.value : result; return Number(sequence?.value || 1); }
export async function nextCode(prefix, name, padding = 4, date = new Date()) { return `${prefix}-${periodKey(date)}-${String(await nextSequence(name, periodKey(date))).padStart(padding, '0')}`; }
export const CODES = { patient: () => nextCode('PT', 'patient'), order: () => nextCode('ORD', 'order'), report: () => nextCode('RPT', 'report'), receipt: () => nextCode('RCP', 'receipt') };
