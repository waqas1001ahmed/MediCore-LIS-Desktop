/**
 * Canonical permission catalogue and default role definitions.
 *
 * Permissions follow the `module.action` convention so the UI can group them
 * by module automatically and the API can gate routes with `requirePermission`.
 */

export const PERMISSIONS = [
  // Dashboard
  { code: 'dashboard.view', module: 'dashboard', action: 'view', label: 'View dashboard', description: 'Access the statistics dashboard' },

  // Patients
  { code: 'patients.view', module: 'patients', action: 'view', label: 'View patients', description: 'Browse and search patient records' },
  { code: 'patients.create', module: 'patients', action: 'create', label: 'Add patients', description: 'Register new patients' },
  { code: 'patients.edit', module: 'patients', action: 'edit', label: 'Edit patients', description: 'Update patient demographics' },
  { code: 'patients.delete', module: 'patients', action: 'delete', label: 'Delete patients', description: 'Archive or delete patient records' },

  // Doctors
  { code: 'doctors.view', module: 'doctors', action: 'view', label: 'View doctors', description: 'Browse referring doctors' },
  { code: 'doctors.create', module: 'doctors', action: 'create', label: 'Add doctors', description: 'Register referring doctors' },
  { code: 'doctors.edit', module: 'doctors', action: 'edit', label: 'Edit doctors', description: 'Update doctor details' },
  { code: 'doctors.delete', module: 'doctors', action: 'delete', label: 'Delete doctors', description: 'Remove referring doctors' },

  // Test catalogue
  { code: 'tests.view', module: 'tests', action: 'view', label: 'View tests', description: 'Browse test catalogue' },
  { code: 'tests.create', module: 'tests', action: 'create', label: 'Add tests', description: 'Create test categories and tests' },
  { code: 'tests.edit', module: 'tests', action: 'edit', label: 'Edit tests', description: 'Update tests and pricing' },
  { code: 'tests.delete', module: 'tests', action: 'delete', label: 'Delete tests', description: 'Remove tests from the catalogue' },

  // Orders
  { code: 'orders.view', module: 'orders', action: 'view', label: 'View orders', description: 'Browse lab orders' },
  { code: 'orders.create', module: 'orders', action: 'create', label: 'Create orders', description: 'Register new lab orders' },
  { code: 'orders.edit', module: 'orders', action: 'edit', label: 'Edit orders', description: 'Modify orders and sample details' },
  { code: 'orders.delete', module: 'orders', action: 'delete', label: 'Delete orders', description: 'Cancel or delete orders' },
  { code: 'orders.collect', module: 'orders', action: 'collect', label: 'Collect samples', description: 'Mark samples as collected' },

  // Results
  { code: 'results.enter', module: 'results', action: 'enter', label: 'Enter results', description: 'Record test result values' },
  { code: 'results.verify', module: 'results', action: 'verify', label: 'Verify results', description: 'Verify and authorise results' },

  // Reports
  { code: 'reports.view', module: 'reports', action: 'view', label: 'View reports', description: 'Browse generated reports' },
  { code: 'reports.generate', module: 'reports', action: 'generate', label: 'Generate reports', description: 'Create lab reports from orders' },
  { code: 'reports.verify', module: 'reports', action: 'verify', label: 'Verify reports', description: 'Authorise and sign reports' },
  { code: 'reports.print', module: 'reports', action: 'print', label: 'Print reports', description: 'Print or download reports' },
  { code: 'reports.delete', module: 'reports', action: 'delete', label: 'Delete reports', description: 'Remove reports' },

  // Receipts
  { code: 'receipts.view', module: 'receipts', action: 'view', label: 'View receipts', description: 'Browse receipts' },
  { code: 'receipts.create', module: 'receipts', action: 'create', label: 'Generate receipts', description: 'Generate payment receipts' },
  { code: 'receipts.print', module: 'receipts', action: 'print', label: 'Print receipts', description: 'Print thermal receipts' },
  { code: 'receipts.void', module: 'receipts', action: 'void', label: 'Void receipts', description: 'Void or refund a receipt' },

  // Payments & revenue
  { code: 'payments.create', module: 'payments', action: 'create', label: 'Record payments', description: 'Record patient payments' },
  { code: 'revenue.view', module: 'revenue', action: 'view', label: 'View revenue', description: 'Access revenue summaries' },
  { code: 'revenue.export', module: 'revenue', action: 'export', label: 'Export revenue', description: 'Export revenue data (CSV)' },

  // Administration
  { code: 'users.view', module: 'users', action: 'view', label: 'View users', description: 'Browse system users' },
  { code: 'users.create', module: 'users', action: 'create', label: 'Create users', description: 'Add new system users' },
  { code: 'users.edit', module: 'users', action: 'edit', label: 'Edit users', description: 'Update users and reset passwords' },
  { code: 'users.delete', module: 'users', action: 'delete', label: 'Delete users', description: 'Deactivate or delete users' },
  { code: 'roles.view', module: 'roles', action: 'view', label: 'View roles', description: 'Browse roles and permissions' },
  { code: 'roles.manage', module: 'roles', action: 'manage', label: 'Manage roles', description: 'Create roles and assign permissions' },
  { code: 'settings.view', module: 'settings', action: 'view', label: 'View settings', description: 'View laboratory settings' },
  { code: 'settings.edit', module: 'settings', action: 'edit', label: 'Manage settings', description: 'Configure laboratory settings' },
  { code: 'audit.view', module: 'audit', action: 'view', label: 'View audit log', description: 'Inspect the activity audit trail' },
];

export const ALL_PERMISSION_CODES = PERMISSIONS.map((p) => p.code);

const P = (...codes) => codes;

/**
 * Default roles shipped with the system.
 * `super_admin` receives every permission automatically.
 */
export const ROLES = [
  {
    name: 'super_admin',
    label: 'Super Admin',
    description: 'Unrestricted access to every module and setting.',
    isSystem: 1,
    permissions: '*',
  },
  {
    name: 'admin',
    label: 'Administrator',
    description: 'Manages operations, staff, catalogue and configuration.',
    isSystem: 1,
    permissions: ALL_PERMISSION_CODES.filter((code) => code !== 'users.delete'),
  },
  {
    name: 'receptionist',
    label: 'Receptionist',
    description: 'Registers patients, books orders and issues receipts.',
    isSystem: 1,
    permissions: P(
      'dashboard.view',
      'patients.view', 'patients.create', 'patients.edit',
      'doctors.view', 'doctors.create', 'doctors.edit',
      'tests.view',
      'orders.view', 'orders.create', 'orders.edit',
      'reports.view', 'reports.print',
      'receipts.view', 'receipts.create', 'receipts.print',
      'payments.create',
      'settings.view',
    ),
  },
  {
    name: 'lab_technician',
    label: 'Lab Technician',
    description: 'Processes samples and enters test results.',
    isSystem: 1,
    permissions: P(
      'dashboard.view',
      'patients.view',
      'doctors.view',
      'tests.view',
      'orders.view', 'orders.collect',
      'results.enter',
      'reports.view', 'reports.generate', 'reports.print',
      'settings.view',
    ),
  },
  {
    name: 'accountant',
    label: 'Accountant',
    description: 'Handles billing, payments and revenue reporting.',
    isSystem: 1,
    permissions: P(
      'dashboard.view',
      'patients.view',
      'doctors.view',
      'tests.view',
      'orders.view',
      'reports.view',
      'receipts.view', 'receipts.create', 'receipts.print', 'receipts.void',
      'payments.create',
      'revenue.view', 'revenue.export',
      'settings.view',
    ),
  },
  {
    name: 'doctor',
    label: 'Doctor / Pathologist',
    description: 'Reviews results and verifies medical reports.',
    isSystem: 1,
    permissions: P(
      'dashboard.view',
      'patients.view', 'patients.create', 'patients.edit',
      'doctors.view',
      'tests.view',
      'orders.view',
      'results.enter', 'results.verify',
      'reports.view', 'reports.generate', 'reports.verify', 'reports.print',
      'settings.view',
    ),
  },
];

export const MODULE_LABELS = {
  dashboard: 'Dashboard',
  patients: 'Patients',
  doctors: 'Doctors',
  tests: 'Test Catalogue',
  orders: 'Orders',
  results: 'Results',
  reports: 'Reports',
  receipts: 'Receipts',
  payments: 'Payments',
  revenue: 'Revenue',
  users: 'Users',
  roles: 'Roles & Permissions',
  settings: 'Settings',
  audit: 'Audit Log',
};

export const ACTION_LABELS = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  collect: 'Collect',
  enter: 'Enter',
  verify: 'Verify',
  generate: 'Generate',
  print: 'Print',
  void: 'Void',
  manage: 'Manage',
  export: 'Export',
};
