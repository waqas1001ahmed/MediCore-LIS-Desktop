import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { config } from '../config.js';
import { PERMISSIONS, ROLES } from '../utils/permissions.js';
import { DEFAULT_SETTINGS } from './legacy-settings.js';
import { formatDateTime, periodKey } from './legacy-ids.js';
import { recalcOrderTotals } from './legacy-orders.js';
import { computeFlag } from '../utils/results.js';

// ---------------------------------------------------------------------------
// Starter test catalogue
// ---------------------------------------------------------------------------
const STARTER_CATEGORIES = [
  { name: 'Hematology', description: 'Blood cell counts, coagulation and blood grouping', color: '#dc2626', sort_order: 1 },
  { name: 'Biochemistry', description: 'Metabolic panels, liver, renal and lipid profiles', color: '#2563eb', sort_order: 2 },
  { name: 'Serology', description: 'Infectious disease screening and antibody tests', color: '#7c3aed', sort_order: 3 },
  { name: 'Hormones', description: 'Endocrine and thyroid function tests', color: '#db2777', sort_order: 4 },
  { name: 'Urinalysis', description: 'Routine and microscopic urine examination', color: '#0891b2', sort_order: 5 },
  { name: 'Microbiology', description: 'Culture, sensitivity and smear examinations', color: '#059669', sort_order: 6 },
  { name: 'Immunology', description: 'Autoimmune and allergy markers', color: '#ea580c', sort_order: 7 },
];

const STARTER_TESTS = [
  ['HEM001', 'Complete Blood Count (CBC)', 'Hematology', 18, 'Whole Blood', '', 'Automated 5-part analyser', '4.5 - 11.0 (WBC x10^3/uL)', '7.2'],
  ['HEM002', 'Hemoglobin (Hb)', 'Hematology', 8, 'Whole Blood', 'g/dL', 'Cyanmethemoglobin', '13.0 - 17.0', '14.4'],
  ['HEM003', 'Total Leukocyte Count (TLC)', 'Hematology', 7, 'Whole Blood', 'x10^3/uL', 'Impedance', '4.5 - 11.0', '8.1'],
  ['HEM004', 'Platelet Count', 'Hematology', 9, 'Whole Blood', 'x10^3/uL', 'Impedance', '150 - 450', '262'],
  ['HEM005', 'Erythrocyte Sedimentation Rate (ESR)', 'Hematology', 7, 'Whole Blood', 'mm/hr', 'Westergren', '0 - 20', '12'],
  ['HEM006', 'Blood Group & Rh Factor', 'Hematology', 6, 'Whole Blood', '', 'Slide agglutination', 'Not applicable', 'O Positive'],
  ['HEM007', 'Prothrombin Time / INR', 'Hematology', 20, 'Citrated Plasma', 'seconds', 'Optical coagulometry', '11 - 14', '12.6'],
  ['BIO001', 'Blood Sugar Fasting', 'Biochemistry', 7, 'Fluoride Plasma', 'mg/dL', 'Hexokinase', '70 - 100', '92'],
  ['BIO002', 'Blood Sugar Random', 'Biochemistry', 7, 'Fluoride Plasma', 'mg/dL', 'Hexokinase', '70 - 140', '118'],
  ['BIO003', 'HbA1c (Glycated Hemoglobin)', 'Biochemistry', 22, 'EDTA Whole Blood', '%', 'HPLC', '4.0 - 5.6', '5.3'],
  ['BIO004', 'Lipid Profile', 'Biochemistry', 26, 'Serum', 'mg/dL', 'Enzymatic colorimetric', 'Total Cholesterol < 200', '178'],
  ['BIO005', 'Liver Function Test (LFT)', 'Biochemistry', 30, 'Serum', 'IU/L', 'IFCC enzymatic', 'ALT 7 - 56', '31'],
  ['BIO006', 'Renal Function Test (RFT)', 'Biochemistry', 30, 'Serum', 'mg/dL', 'Jaffe / Urease', 'Creatinine 0.7 - 1.3', '1.0'],
  ['BIO007', 'Serum Urea', 'Biochemistry', 12, 'Serum', 'mg/dL', 'Urease-GLDH', '15 - 45', '28'],
  ['BIO008', 'Serum Creatinine', 'Biochemistry', 12, 'Serum', 'mg/dL', 'Jaffe kinetic', '0.7 - 1.3', '0.9'],
  ['BIO009', 'Serum Uric Acid', 'Biochemistry', 12, 'Serum', 'mg/dL', 'Uricase', '3.5 - 7.2', '5.4'],
  ['BIO010', 'Serum Calcium', 'Biochemistry', 13, 'Serum', 'mg/dL', 'Arsenazo III', '8.6 - 10.2', '9.3'],
  ['BIO011', 'Vitamin D (25-OH)', 'Biochemistry', 38, 'Serum', 'ng/mL', 'CLIA', '30 - 100', '34'],
  ['BIO012', 'C-Reactive Protein (CRP)', 'Biochemistry', 20, 'Serum', 'mg/L', 'Immunoturbidimetry', '0 - 5', '2.1'],
  ['SER001', 'Dengue NS1 Antigen', 'Serology', 25, 'Serum', '', 'Immunochromatography', 'Negative', 'Negative'],
  ['SER002', 'Malaria Parasite (ICT)', 'Serology', 18, 'Whole Blood', '', 'Immunochromatography', 'Negative', 'Negative'],
  ['SER003', 'Widal Test', 'Serology', 16, 'Serum', '', 'Tube agglutination', 'Titre < 1:80', 'Negative'],
  ['SER004', 'Hepatitis B Surface Antigen (HBsAg)', 'Serology', 20, 'Serum', '', 'ELISA', 'Non-reactive', 'Non-reactive'],
  ['SER005', 'Hepatitis C Antibody (Anti-HCV)', 'Serology', 22, 'Serum', '', 'ELISA', 'Non-reactive', 'Non-reactive'],
  ['SER006', 'HIV I & II Antibody', 'Serology', 28, 'Serum', '', 'ELISA', 'Non-reactive', 'Non-reactive'],
  ['HOR001', 'Thyroid Stimulating Hormone (TSH)', 'Hormones', 22, 'Serum', 'uIU/mL', 'CLIA', '0.4 - 4.0', '2.6'],
  ['HOR002', 'Triiodothyronine (T3)', 'Hormones', 18, 'Serum', 'ng/dL', 'CLIA', '80 - 200', '132'],
  ['HOR003', 'Thyroxine (T4)', 'Hormones', 18, 'Serum', 'ug/dL', 'CLIA', '5.0 - 12.0', '8.4'],
  ['HOR004', 'Prolactin', 'Hormones', 30, 'Serum', 'ng/mL', 'CLIA', '4 - 23', '14'],
  ['URI001', 'Urine Complete Examination', 'Urinalysis', 10, 'Urine', '', 'Dipstick & Microscopy', 'Normal', 'Normal'],
  ['URI002', 'Urine Culture & Sensitivity', 'Microbiology', 35, 'Midstream Urine', '', 'Culture on CLED', 'No growth', 'No growth'],
  ['MIC001', 'Blood Culture & Sensitivity', 'Microbiology', 45, 'Blood', '', 'Automated culture', 'No growth', 'No growth'],
  ['MIC002', 'Sputum AFB (Ziehl-Neelsen)', 'Microbiology', 15, 'Sputum', '', 'Microscopy', 'Negative', 'Negative'],
  ['IMM001', 'Rheumatoid Factor (RA)', 'Immunology', 22, 'Serum', 'IU/mL', 'Immunoturbidimetry', '0 - 14', '8'],
];

const STARTER_DOCTORS = [
  ['Dr. Amelia Hart', 'MBBS, FCPS (Pathology)', 'Clinical Pathology', 'City General Hospital', '+1 555 0101', 'a.hart@citygeneral.example'],
  ['Dr. Marcus Reid', 'MBBS, MD (Internal Medicine)', 'Internal Medicine', 'Northside Clinic', '+1 555 0102', 'm.reid@northside.example'],
  ['Dr. Sofia Nunez', 'MBBS, DCH', 'Pediatrics', 'Rainbow Children Hospital', '+1 555 0103', 's.nunez@rainbow.example'],
  ['Dr. Elliot Vance', 'MBBS, MS (Orthopedics)', 'Orthopedics', 'Vance Ortho Centre', '+1 555 0104', 'e.vance@ortho.example'],
  ['Dr. Priya Raman', 'MBBS, MRCOG', 'Gynecology & Obstetrics', 'Lifeline Maternity', '+1 555 0105', 'p.raman@lifeline.example'],
  ['Dr. Jonah Weber', 'MBBS, DM (Cardiology)', 'Cardiology', 'Heart Care Institute', '+1 555 0106', 'j.weber@heartcare.example'],
];

const STARTER_PATIENTS = [
  ['Michael Anderson', 42, 'male', 'O Positive', '+1 555 2201', '12 Oak Street, Springfield', 'Married'],
  ['Sarah Whitfield', 34, 'female', 'A Positive', '+1 555 2202', '48 Maple Avenue, Springfield', 'Married'],
  ['Daniel Okafor', 29, 'male', 'B Positive', '+1 555 2203', '9 Pine Road, Riverside', 'Single'],
  ['Emily Chen', 8, 'female', 'O Negative', '+1 555 2204', '77 Cedar Lane, Springfield', 'Single'],
  ['Robert Miles', 61, 'male', 'AB Positive', '+1 555 2205', '3 Birch Court, Lakeview', 'Married'],
  ['Ayesha Karim', 45, 'female', 'A Negative', '+1 555 2206', '21 Elm Street, Riverside', 'Married'],
  ['Thomas Bennett', 53, 'male', 'O Positive', '+1 555 2207', '5 Willow Drive, Springfield', 'Married'],
  ['Lucia Fernandez', 27, 'female', 'B Negative', '+1 555 2208', '88 Aspen Way, Lakeview', 'Single'],
  ['George Patel', 38, 'male', 'A Positive', '+1 555 2209', '14 Cherry Boulevard, Springfield', 'Married'],
  ['Hannah Lawson', 16, 'female', 'O Positive', '+1 555 2210', '62 Spruce Street, Riverside', 'Single'],
  ['Victor Nkemelu', 49, 'male', 'AB Negative', '+1 555 2211', '30 Poplar Avenue, Springfield', 'Married'],
  ['Grace Sullivan', 71, 'female', 'A Positive', '+1 555 2212', '7 Magnolia Close, Lakeview', 'Widowed'],
];

const DEMO_REMARKS = [
  'Sample quality satisfactory. Results correlate with clinical findings.',
  'Values within normal limits.',
  'Mild deviation noted; clinical correlation advised.',
  '',
];

function seedPermissions() {
  const upsert = db.prepare(
    `INSERT INTO permissions (code, module, action, label, description) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET module = excluded.module, action = excluded.action,
                                     label = excluded.label, description = excluded.description`,
  );
  const apply = db.transaction(() => {
    for (const permission of PERMISSIONS) {
      upsert.run(permission.code, permission.module, permission.action, permission.label, permission.description);
    }
  });
  apply();
}

function seedRoles() {
  const allCodes = db.prepare('SELECT code FROM permissions').all().map((row) => row.code);
  const insertRole = db.prepare(
    `INSERT INTO roles (name, label, description, is_system) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET label = excluded.label, description = excluded.description`,
  );
  const roleIdByCode = db.prepare('SELECT id, name FROM roles');
  const clear = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const link = db.prepare(
    `INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
     SELECT ?, id FROM permissions WHERE code = ?`,
  );

  const apply = db.transaction(() => {
    for (const role of ROLES) {
      insertRole.run(role.name, role.label, role.description, role.isSystem);
    }
    const roles = roleIdByCode.all();
    for (const role of ROLES) {
      const row = roles.find((item) => item.name === role.name);
      if (!row) continue;
      const codes = role.permissions === '*' ? allCodes : role.permissions;
      // Ensure the role has at least its intended default permissions without
      // wiping customisations performed by an administrator.
      const existing = db.prepare('SELECT COUNT(*) AS c FROM role_permissions WHERE role_id = ?').get(row.id).c;
      if (existing === 0) {
        clear.run(row.id);
        for (const code of codes) link.run(row.id, code);
      }
    }
  });
  apply();
}

function seedAdmin() {
  const hasUser = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (hasUser > 0) return;

  const role = db.prepare("SELECT id FROM roles WHERE name = 'super_admin'").get();
  const passwordHash = bcrypt.hashSync(config.defaults.adminPassword, config.bcryptRounds);
  db.prepare(
    `INSERT INTO users (username, password_hash, full_name, email, designation, signature_title, role_id,
       is_active, must_change_password, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))`,
  ).run(
    config.defaults.adminUsername,
    passwordHash,
    'System Administrator',
    'admin@labms.local',
    'Laboratory Administrator',
    'System Administrator',
    role.id,
  );

  console.log(`  Seed        : created default administrator "${config.defaults.adminUsername}"`);
  if (config.defaults.adminPassword === 'Admin@123') {
    console.warn('  WARNING     : default admin password is "Admin@123" - change it after first login.');
  }
}

function seedSettings() {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const apply = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insert.run(key, JSON.stringify(value));
  });
  apply();
}

function seedCatalogue() {
  const hasCategories = db.prepare('SELECT COUNT(*) AS c FROM test_categories').get().c;
  if (hasCategories > 0) return;

  const apply = db.transaction(() => {
    const insertCategory = db.prepare('INSERT INTO test_categories (name, description, color, sort_order) VALUES (?, ?, ?, ?)');
    const categoryIds = {};
    for (const category of STARTER_CATEGORIES) {
      const result = insertCategory.run(category.name, category.description, category.color, category.sort_order);
      categoryIds[category.name] = result.lastInsertRowid;
    }
    const insertTest = db.prepare(
      `INSERT INTO tests (code, name, category_id, price, sample_type, unit, method, reference_range)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [code, name, category, price, sample, unit, method, range] of STARTER_TESTS) {
      insertTest.run(code, name, categoryIds[category] ?? null, price, sample, unit || null, method, range);
    }
  });
  apply();
  console.log(`  Seed        : loaded starter catalogue (${STARTER_CATEGORIES.length} categories, ${STARTER_TESTS.length} tests)`);
}

/** Deterministic pseudo-random generator so demo data is stable across resets. */
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function dateTimeDaysAgo(days, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return formatDateTime(date);
}

function seedDemoData() {
  const enabled = process.env.SEED_DEMO_DATA !== undefined
    ? ['1', 'true', 'yes', 'on'].includes(String(process.env.SEED_DEMO_DATA).toLowerCase())
    : !config.isProduction;

  if (!enabled) return;
  if (db.prepare('SELECT COUNT(*) AS c FROM patients').get().c > 0) return;

  const random = makeRandom(20260916);
  const admin = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
  const userId = admin?.id ?? null;

  const apply = db.transaction(() => {
    // Doctors
    const insertDoctor = db.prepare(
      `INSERT INTO doctors (name, qualification, specialization, hospital, phone, email, commission_percent, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const doctorIds = STARTER_DOCTORS.map((doctor, index) =>
      insertDoctor.run(...doctor, [0, 5, 10, 7.5, 0, 12][index % 6], userId, dateTimeDaysAgo(90 - index, 9, 0)).lastInsertRowid,
    );

    // Patients
    const insertPatient = db.prepare(
      `INSERT INTO patients (patient_code, full_name, age, age_unit, gender, phone, address, blood_group,
         marital_status, referred_by, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'years', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const patientRows = STARTER_PATIENTS.map((patient, index) => {
      const [name, age, gender, bloodGroup, phone, address, marital] = patient;
      const daysAgo = 60 - index * 4;
      const code = `PT-${periodKey(new Date(Date.now() - daysAgo * 86400000))}-${String(index + 1).padStart(4, '0')}`;
      const createdAt = dateTimeDaysAgo(daysAgo, 9 + (index % 6), (index * 7) % 60);
      const id = insertPatient.run(
        code, name, age, gender, phone, address, bloodGroup, marital,
        doctorIds[index % doctorIds.length], userId, createdAt, createdAt,
      ).lastInsertRowid;
      return { id, index, daysAgo };
    });

    const tests = db.prepare('SELECT * FROM tests ORDER BY id').all();
    const categoryName = (categoryId) =>
      categoryId ? db.prepare('SELECT name FROM test_categories WHERE id = ?').get(categoryId)?.name ?? null : null;

    const insertOrder = db.prepare(
      `INSERT INTO orders (order_no, patient_id, doctor_id, status, priority, sample_collected_at, sample_type,
         clinical_notes, discount, tax_percent, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
    );
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, test_id, test_code, test_name, category_name, price, discount,
         status, result_value, result_unit, reference_range, flag, method, remarks, resulted_by, resulted_at,
         verified_by, verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertReport = db.prepare(
      `INSERT INTO reports (report_no, order_id, patient_id, doctor_id, status, sample_collected_at, reported_at,
         conclusion, remarks, verified_by, verified_at, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertReceipt = db.prepare(
      `INSERT INTO receipts (receipt_no, order_id, patient_id, subtotal, discount, tax_amount, total, amount_paid,
         balance, payment_method, reference_no, status, received_by, created_by, created_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, NULL, 'active', ?, ?, ?)`,
    );
    const insertPayment = db.prepare(
      `INSERT INTO payments (order_id, patient_id, receipt_id, amount, method, received_by, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    let orderSeq = 0;
    let receiptSeq = 0;
    let reportSeq = 0;

    const orderPlan = [
      { daysAgo: 28, count: 3, payment: 'paid' },
      { daysAgo: 24, count: 2, payment: 'paid' },
      { daysAgo: 20, count: 3, payment: 'partial' },
      { daysAgo: 16, count: 2, payment: 'paid' },
      { daysAgo: 12, count: 3, payment: 'unpaid' },
      { daysAgo: 9, count: 2, payment: 'paid' },
      { daysAgo: 6, count: 3, payment: 'partial' },
      { daysAgo: 4, count: 2, payment: 'paid' },
      { daysAgo: 2, count: 3, payment: 'unpaid' },
      { daysAgo: 0, count: 3, payment: 'paid' },
    ];

    const bulkTests = ['HEM001', 'BIO004', 'BIO005', 'BIO006', 'HOR001', 'URI001', 'BIO001', 'HEM002', 'BIO003', 'SER001'];

    for (const plan of orderPlan) {
      for (let i = 0; i < plan.count; i += 1) {
        orderSeq += 1;
        const patient = patientRows[(orderSeq * 3) % patientRows.length];
        const createdAt = dateTimeDaysAgo(plan.daysAgo, 8 + (i % 8), (orderSeq * 11) % 60);
        const period = periodKey(new Date(Date.now() - plan.daysAgo * 86400000));
        const orderNo = `ORD-${period}-${String(orderSeq).padStart(4, '0')}`;
        const priority = random() > 0.82 ? 'urgent' : 'routine';

        // Choose 1-4 tests, mixing a bulk panel with single tests.
        const chosen = [tests.find((t) => t.code === bulkTests[orderSeq % bulkTests.length])];
        const extraCount = 1 + Math.floor(random() * 3);
        for (let e = 0; e < extraCount; e += 1) {
          const candidate = tests[Math.floor(random() * tests.length)];
          if (!chosen.some((test) => test.id === candidate.id)) chosen.push(candidate);
        }

        const completed = plan.daysAgo >= 2;
        const status = completed ? 'reported' : 'in_progress';

        const orderId = insertOrder.run(
          orderNo, patient.id, doctorIds[orderSeq % doctorIds.length], status, priority,
          createdAt, chosen[0].sample_type, null, userId, userId, createdAt, createdAt,
        ).lastInsertRowid;

        let total = 0;
        for (const test of chosen) {
          total += Number(test.price);
          if (!completed) {
            insertItem.run(orderId, test.id, test.code, test.name, categoryName(test.category_id), test.price,
              'pending', null, test.unit, test.reference_range, null, test.method, null, null, null, null, null, createdAt, createdAt);
            continue;
          }
          const demo = STARTER_TESTS.find((row) => row[0] === test.code)?.[8];
          const value = demo ?? 'Normal';
          const flag = computeFlag(value, test.reference_range);
          insertItem.run(
            orderId, test.id, test.code, test.name, categoryName(test.category_id), test.price,
            'verified', value, test.unit, test.reference_range, flag, test.method,
            DEMO_REMARKS[orderSeq % DEMO_REMARKS.length] || null, userId, createdAt, userId, createdAt, createdAt, createdAt,
          );
        }

        recalcOrderTotals(orderId);
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

        // Report
        if (completed) {
          reportSeq += 1;
          const reportNo = `RPT-${period}-${String(reportSeq).padStart(4, '0')}`;
          insertReport.run(
            reportNo, orderId, patient.id, order.doctor_id, 'verified', createdAt, createdAt,
            'All parameters reviewed. No significant abnormality detected.',
            DEMO_REMARKS[reportSeq % DEMO_REMARKS.length] || null,
            userId, createdAt, userId, createdAt, createdAt,
          );
        }

        // Payments / receipts
        if (plan.payment !== 'unpaid' && order.total > 0) {
          receiptSeq += 1;
          const receiptNo = `RCP-${period}-${String(receiptSeq).padStart(4, '0')}`;
          const paid = plan.payment === 'paid' ? order.total : Math.round(order.total * 0.5 * 100) / 100;
          const balance = Math.round((order.total - paid) * 100) / 100;
          const method = ['cash', 'card', 'bank_transfer', 'mobile_wallet'][orderSeq % 4];
          const receiptId = insertReceipt.run(
            receiptNo, orderId, patient.id, order.subtotal, order.total, paid, balance, method,
            userId, userId, createdAt,
          ).lastInsertRowid;
          insertPayment.run(orderId, patient.id, receiptId, paid, method, userId, createdAt, createdAt);
          recalcOrderTotals(orderId);
        }
      }
    }
  });

  apply();
  const counts = db
    .prepare('SELECT (SELECT COUNT(*) FROM patients) AS patients, (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM reports) AS reports')
    .get();
  console.log(`  Seed        : demo data loaded (${counts.patients} patients, ${counts.orders} orders, ${counts.reports} reports)`);
}

/** Idempotent seeding executed on every server boot. */
export function ensureSeedData() {
  seedPermissions();
  seedRoles();
  seedAdmin();
  seedSettings();
  seedCatalogue();
  seedDemoData();
}

// Allow `npm run seed` to invoke the same routine directly.
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  ensureSeedData();
  console.log('  Seed        : completed');
}
