/**
 * Complete relational schema for the Laboratory Management System.
 *
 * The schema is idempotent: every statement uses `IF NOT EXISTS` so it can be
 * applied safely on every boot. Default rows (roles, permissions, settings)
 * are handled by `seed.js`, not here.
 */

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Identity & access control
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE,
  label        TEXT    NOT NULL,
  description  TEXT,
  is_system    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT    NOT NULL UNIQUE,
  module       TEXT    NOT NULL,
  action       TEXT    NOT NULL,
  label        TEXT    NOT NULL,
  description  TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE,
  password_hash        TEXT    NOT NULL,
  full_name            TEXT    NOT NULL,
  email                TEXT,
  phone                TEXT,
  designation          TEXT,
  signature_title      TEXT,
  role_id              INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  is_active            INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts      INTEGER NOT NULL DEFAULT 0,
  locked_until         TEXT,
  last_login_at        TEXT,
  created_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Clinical masters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT    NOT NULL,
  qualification      TEXT,
  specialization     TEXT,
  hospital           TEXT,
  phone              TEXT,
  email              TEXT,
  address            TEXT,
  commission_percent REAL    NOT NULL DEFAULT 0,
  notes              TEXT,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_code    TEXT    NOT NULL UNIQUE,
  full_name       TEXT    NOT NULL,
  age             INTEGER,
  age_unit        TEXT    NOT NULL DEFAULT 'years',
  date_of_birth   TEXT,
  gender          TEXT    NOT NULL DEFAULT 'male',
  phone           TEXT,
  email           TEXT,
  national_id     TEXT,
  address         TEXT,
  blood_group     TEXT,
  marital_status  TEXT,
  referred_by     INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  is_deleted      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tests (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  category_id      INTEGER REFERENCES test_categories(id) ON DELETE SET NULL,
  price            REAL    NOT NULL DEFAULT 0,
  cost             REAL    NOT NULL DEFAULT 0,
  sample_type      TEXT,
  unit             TEXT,
  reference_range  TEXT,
  method           TEXT,
  turnaround_hours INTEGER NOT NULL DEFAULT 24,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Optional structured reference ranges (per gender / age band).
CREATE TABLE IF NOT EXISTS test_reference_ranges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id     INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  gender      TEXT    NOT NULL DEFAULT 'all',
  min_age     INTEGER NOT NULL DEFAULT 0,
  max_age     INTEGER NOT NULL DEFAULT 150,
  low_value   REAL,
  high_value  REAL,
  text_range  TEXT,
  unit        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no            TEXT    NOT NULL UNIQUE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id           INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  status              TEXT    NOT NULL DEFAULT 'pending',
  priority            TEXT    NOT NULL DEFAULT 'routine',
  sample_collected_at TEXT,
  sample_type         TEXT,
  clinical_notes      TEXT,
  subtotal            REAL    NOT NULL DEFAULT 0,
  discount            REAL    NOT NULL DEFAULT 0,
  tax_percent         REAL    NOT NULL DEFAULT 0,
  tax_amount          REAL    NOT NULL DEFAULT 0,
  total               REAL    NOT NULL DEFAULT 0,
  paid_amount         REAL    NOT NULL DEFAULT 0,
  balance             REAL    NOT NULL DEFAULT 0,
  payment_status      TEXT    NOT NULL DEFAULT 'unpaid',
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  is_deleted          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  test_id         INTEGER REFERENCES tests(id) ON DELETE SET NULL,
  test_code       TEXT,
  test_name       TEXT    NOT NULL,
  category_name   TEXT,
  price           REAL    NOT NULL DEFAULT 0,
  discount        REAL    NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'pending',
  result_value    TEXT,
  result_unit     TEXT,
  reference_range TEXT,
  flag            TEXT,
  method          TEXT,
  remarks         TEXT,
  resulted_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resulted_at     TEXT,
  verified_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at     TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  report_no           TEXT    NOT NULL UNIQUE,
  order_id            INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id           INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  status              TEXT    NOT NULL DEFAULT 'draft',
  sample_collected_at TEXT,
  reported_at         TEXT,
  conclusion          TEXT,
  remarks             TEXT,
  verified_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at         TEXT,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  print_count         INTEGER NOT NULL DEFAULT 0,
  last_printed_at     TEXT
);

CREATE TABLE IF NOT EXISTS receipts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no      TEXT    NOT NULL UNIQUE,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  subtotal        REAL    NOT NULL DEFAULT 0,
  discount        REAL    NOT NULL DEFAULT 0,
  tax_amount      REAL    NOT NULL DEFAULT 0,
  total           REAL    NOT NULL DEFAULT 0,
  amount_paid     REAL    NOT NULL DEFAULT 0,
  balance         REAL    NOT NULL DEFAULT 0,
  payment_method  TEXT    NOT NULL DEFAULT 'cash',
  reference_no    TEXT,
  notes           TEXT,
  status          TEXT    NOT NULL DEFAULT 'active',
  received_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  print_count     INTEGER NOT NULL DEFAULT 0,
  last_printed_at TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  receipt_id   INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
  amount       REAL    NOT NULL DEFAULT 0,
  method       TEXT    NOT NULL DEFAULT 'cash',
  reference_no TEXT,
  notes        TEXT,
  is_void      INTEGER NOT NULL DEFAULT 0,
  received_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  paid_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Platform services
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequences (
  name   TEXT    NOT NULL,
  period TEXT    NOT NULL DEFAULT '',
  value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (name, period)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT,
  action      TEXT    NOT NULL,
  module      TEXT    NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  description TEXT,
  meta        TEXT,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id   TEXT    NOT NULL UNIQUE,
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  revoked_at TEXT
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_patients_name         ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone        ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_deleted      ON patients(is_deleted);
CREATE INDEX IF NOT EXISTS idx_doctors_name          ON doctors(name);
CREATE INDEX IF NOT EXISTS idx_tests_category        ON tests(category_id);
CREATE INDEX IF NOT EXISTS idx_tests_name            ON tests(name);
CREATE INDEX IF NOT EXISTS idx_orders_patient        ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_created        ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order     ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_test      ON order_items(test_id);
CREATE INDEX IF NOT EXISTS idx_reports_order         ON reports(order_id);
CREATE INDEX IF NOT EXISTS idx_reports_patient       ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_status        ON reports(status);
CREATE INDEX IF NOT EXISTS idx_receipts_order        ON receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created      ON receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order        ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at      ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_audit_created         ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user            ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module          ON audit_logs(module);
`;

export function applySchema(db) {
  db.exec(SCHEMA_SQL);
}
