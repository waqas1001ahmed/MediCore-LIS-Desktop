export const MIGRATION_TABLES = [
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'doctors',
  'patients',
  'test_categories',
  'tests',
  'test_reference_ranges',
  'orders',
  'order_items',
  'reports',
  'receipts',
  'payments',
  'settings',
  'sequences',
  'audit_logs',
  'sessions',
];

const tableKeys = {
  role_permissions: ['role_id', 'permission_id'],
  settings: ['key'],
  sequences: ['name', 'period'],
};

export function migrationKey(table, row) {
  const keys = tableKeys[table] || ['id'];
  return keys.map((key) => `${key}=${String(row[key])}`).join('|');
}

export function migrationFilter(table, row) {
  const keys = tableKeys[table] || ['id'];
  return Object.fromEntries(keys.map((key) => [key, row[key]]));
}

export const INDEXES = {
  users: [
    [{ username: 1 }, { unique: true, name: 'users_username_unique' }],
    [{ role_id: 1 }, { name: 'users_role_id' }],
  ],
  roles: [[{ name: 1 }, { unique: true, name: 'roles_name_unique' }]],
  permissions: [[{ code: 1 }, { unique: true, name: 'permissions_code_unique' }]],
  role_permissions: [[{ role_id: 1, permission_id: 1 }, { unique: true, name: 'role_permissions_pair_unique' }]],
  doctors: [[{ name: 1 }, { name: 'doctors_name' }]],
  patients: [
    [{ patient_code: 1 }, { unique: true, name: 'patients_code_unique' }],
    [{ full_name: 1 }, { name: 'patients_name' }],
    [{ phone: 1 }, { name: 'patients_phone' }],
    [{ is_deleted: 1 }, { name: 'patients_deleted' }],
  ],
  test_categories: [[{ name: 1 }, { unique: true, name: 'test_categories_name_unique' }]],
  tests: [
    [{ code: 1 }, { unique: true, name: 'tests_code_unique' }],
    [{ category_id: 1 }, { name: 'tests_category_id' }],
    [{ name: 1 }, { name: 'tests_name' }],
  ],
  test_reference_ranges: [[{ test_id: 1 }, { name: 'reference_ranges_test_id' }]],
  orders: [
    [{ order_no: 1 }, { unique: true, name: 'orders_number_unique' }],
    [{ patient_id: 1 }, { name: 'orders_patient_id' }],
    [{ created_at: -1 }, { name: 'orders_created_at' }],
    [{ payment_status: 1 }, { name: 'orders_payment_status' }],
  ],
  order_items: [
    [{ order_id: 1 }, { name: 'order_items_order_id' }],
    [{ test_id: 1 }, { name: 'order_items_test_id' }],
  ],
  reports: [
    [{ report_no: 1 }, { unique: true, name: 'reports_number_unique' }],
    [{ order_id: 1 }, { name: 'reports_order_id' }],
    [{ patient_id: 1 }, { name: 'reports_patient_id' }],
    [{ status: 1 }, { name: 'reports_status' }],
  ],
  receipts: [
    [{ receipt_no: 1 }, { unique: true, name: 'receipts_number_unique' }],
    [{ order_id: 1 }, { name: 'receipts_order_id' }],
    [{ created_at: -1 }, { name: 'receipts_created_at' }],
  ],
  payments: [
    [{ order_id: 1 }, { name: 'payments_order_id' }],
    [{ paid_at: -1 }, { name: 'payments_paid_at' }],
  ],
  settings: [[{ key: 1 }, { unique: true, name: 'settings_key_unique' }]],
  sequences: [[{ name: 1, period: 1 }, { unique: true, name: 'sequences_name_period_unique' }]],
  audit_logs: [
    [{ created_at: -1 }, { name: 'audit_created_at' }],
    [{ user_id: 1 }, { name: 'audit_user_id' }],
    [{ module: 1 }, { name: 'audit_module' }],
  ],
  sessions: [
    [{ token_id: 1 }, { unique: true, name: 'sessions_token_unique' }],
    [{ user_id: 1 }, { name: 'sessions_user_id' }],
  ],
};

export async function ensureMongoCollections(database) {
  const existing = new Set(await database.listCollections({}, { nameOnly: true }).toArray().then((items) => items.map((item) => item.name)));
  for (const table of MIGRATION_TABLES) {
    if (!existing.has(table)) await database.createCollection(table);
    for (const [keys, options] of INDEXES[table] || []) {
      await database.collection(table).createIndex(keys, options);
    }
  }
}