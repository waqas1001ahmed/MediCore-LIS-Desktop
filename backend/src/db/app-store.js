import { getMongoClient, getMongoDatabase } from './mongodb.js';
import { now } from '../utils/time.js';

let ready;
const names = ['users', 'roles', 'permissions', 'role_permissions', 'doctors', 'patients', 'test_categories', 'tests', 'test_reference_ranges', 'orders', 'order_items', 'reports', 'receipts', 'payments', 'settings', 'sequences', 'audit_logs', 'sessions'];

export async function appStore() {
  if (!ready) ready = (async () => {
    const database = await getMongoDatabase();
    const collections = Object.fromEntries(names.map((name) => [name, database.collection(name)]));
    const indexes = [
      [collections.patients, { full_name: 1 }], [collections.patients, { phone: 1 }],
      [collections.patients, { is_deleted: 1, created_at: -1, id: -1 }, { name: 'patients_active_created_id' }],
      [collections.doctors, { name: 1 }], [collections.tests, { name: 1 }],
      [collections.orders, { id: 1 }, { unique: true, name: 'orders_app_id_unique' }],
      [collections.orders, { is_deleted: 1, created_at: -1, id: -1 }, { name: 'orders_active_created_id' }],
      [collections.orders, { patient_id: 1, created_at: -1 }], [collections.orders, { status: 1 }],
      [collections.order_items, { order_id: 1 }], [collections.reports, { order_id: 1, created_at: -1 }],
      [collections.reports, { created_at: -1, id: -1 }, { name: 'reports_created_id' }],
      [collections.receipts, { order_id: 1 }], [collections.payments, { order_id: 1, paid_at: -1 }],
      [collections.settings, { key: 1 }, { unique: true }], [collections.sequences, { name: 1, period: 1 }, { unique: true }],
      [collections.audit_logs, { id: -1 }], [collections.audit_logs, { module: 1, created_at: -1 }],
    ];
    for (const [collection, keys, options] of indexes) {
      try { await collection.createIndex(keys, options); } catch (error) { if (![85, 86].includes(error.code)) throw error; }
    }
    return { database, collections };
  })();
  return ready;
}

export async function nextId(collectionName, session) {
  const { collections } = await appStore();
  const existing = await collections.sequences.findOne({ name: `id:${collectionName}`, period: '' }, { session });
  if (!existing) {
    const highest = await collections[collectionName].find({}, { session }).sort({ id: -1 }).limit(1).next();
    await collections.sequences.updateOne({ name: `id:${collectionName}`, period: '' }, { $setOnInsert: { value: Number(highest?.id || 0) } }, { upsert: true, session });
  }
  const result = await collections.sequences.findOneAndUpdate(
    { name: `id:${collectionName}`, period: '' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  const sequence = result?.value && typeof result.value === 'object' ? result.value : result;
  return Number(sequence?.value || 1);
}

export async function transaction(callback) {
  const client = getMongoClient();
  if (!client) throw new Error('MongoDB is not connected');
  const session = client.startSession();
  try { let output; await session.withTransaction(async () => { output = await callback(session); }); return output; }
  finally { await session.endSession(); }
}

export async function findOne(name, filter, session) { const { collections } = await appStore(); return collections[name].findOne(filter, { session }); }
export async function insert(name, value, session) { const { collections } = await appStore(); const row = { ...value, id: value.id ?? await nextId(name, session) }; await collections[name].insertOne(row, { session }); return row; }
export async function update(name, filter, update, session) { const { collections } = await appStore(); return collections[name].updateOne(filter, update, { session }); }
export async function remove(name, filter, session) { const { collections } = await appStore(); return collections[name].deleteOne(filter, { session }); }
export async function list(name, filter = {}, options = {}) { const { collections } = await appStore(); let cursor = collections[name].find(filter, { session: options.session }); if (options.sort) cursor = cursor.sort(options.sort); if (options.skip) cursor = cursor.skip(options.skip); if (options.limit) cursor = cursor.limit(options.limit); return cursor.toArray(); }
export async function count(name, filter = {}, session) { const { collections } = await appStore(); return collections[name].countDocuments(filter, { session }); }

export function regex(value) { return new RegExp(String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
export function dateRange(field, from, to) { const filter = {}; if (from || to) filter[field] = { ...(from ? { $gte: `${from} 00:00:00` } : {}), ...(to ? { $lte: `${to} 23:59:59` } : {}) }; return filter; }
export function withUpdated(value = {}) { return { ...value, updated_at: now() }; }
