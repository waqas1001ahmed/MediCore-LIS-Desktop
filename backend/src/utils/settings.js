import { appStore } from '../db/app-store.js';
import { nextCode, now } from './ids.js';

function decodeSettingValue(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return value;

    const tryJson = (candidate) => {
      try {
        return JSON.parse(candidate);
      } catch {
        return undefined;
      }
    };

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const parsed = tryJson(trimmed);
      if (parsed !== undefined) return parsed;
    }

    if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
      const parsed = tryJson(trimmed);
      if (parsed !== undefined) return parsed;
    }

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      const parsed = tryJson(trimmed);
      if (typeof parsed === 'string') {
        if (parsed.startsWith('"') && parsed.endsWith('"')) {
          return decodeSettingValue(parsed);
        }
        return parsed;
      }

      const inner = trimmed.slice(1, -1);
      return inner.replace(/\\(["'\\])/g, '$1');
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }

  return value;
}

export const DEFAULT_SETTINGS = {
  lab_name: 'MediCore Diagnostics Laboratory', lab_tagline: 'Accurate Results. Trusted Care.', lab_logo: '', lab_address: '12 Health Avenue, Medical District, Springfield', lab_phone: '+1 (555) 018-4400', lab_email: 'care@medicore-lab.example', lab_website: 'www.medicore-lab.example', lab_license: 'LAB-REG-88213',
  report_title: 'Laboratory Investigation Report', report_header: 'Comprehensive diagnostic services for physicians and patients.', report_footer: 'This report is generated electronically and is valid without a manual signature unless otherwise stated.', report_show_logo: true, report_show_barcode: true, report_authorized_name: 'Dr. Amelia Hart', report_authorized_title: 'Consultant Pathologist (MBBS, FCPS)', report_verified_note: 'Results verified by the laboratory quality control team.', report_org_enabled: false, report_org_kind: 'hospital', report_org_name: '',
  receipt_title: 'Payment Receipt', receipt_header: '', receipt_footer: 'Thank you for choosing our laboratory. Get well soon!', receipt_show_logo: true, receipt_width_mm: 80,
  patient_prefix: 'PT', order_prefix: 'ORD', report_prefix: 'RPT', receipt_prefix: 'RCP', currency_code: 'USD', currency_symbol: '$', currency_position: 'before', tax_percent: 0, invoice_terms: 'Payment is due at the time of service. Tests are non-refundable once processed.', theme: 'light', primary_color: '#1f7a8c', accent_color: '#0ea5a4', date_format: 'YYYY-MM-DD', time_format: '24h', timezone_label: 'Local time',
};
export const SETTINGS_KEY_LABELS = {
  lab_name: 'Laboratory name', lab_tagline: 'Tagline', lab_logo: 'Logo', lab_address: 'Address', lab_phone: 'Phone', lab_email: 'Email', lab_website: 'Website', lab_license: 'Registration / licence number',
  report_title: 'Report title', report_header: 'Report header text', report_footer: 'Report footer text', report_show_logo: 'Show logo on reports', report_show_barcode: 'Show barcode on reports', report_authorized_name: 'Authorising pathologist', report_authorized_title: 'Authorising pathologist title', report_verified_note: 'Verification note', report_org_enabled: 'Show organisation name on report header', report_org_kind: 'Organisation type on report header', report_org_name: 'Hospital / laboratory / clinic name on report header',
  receipt_title: 'Receipt title', receipt_header: 'Receipt header text', receipt_footer: 'Receipt footer text', receipt_show_logo: 'Show logo on receipts', receipt_width_mm: 'Receipt paper width (mm)', patient_prefix: 'Patient ID prefix', order_prefix: 'Order number prefix', report_prefix: 'Report number prefix', receipt_prefix: 'Receipt number prefix', currency_code: 'Currency code', currency_symbol: 'Currency symbol', currency_position: 'Currency symbol position', tax_percent: 'Default tax (%)', invoice_terms: 'Invoice terms', theme: 'Default theme', primary_color: 'Primary colour', accent_color: 'Accent colour', date_format: 'Date format', time_format: 'Time format', timezone_label: 'Timezone label',
};

export async function getSettings(keys = null) {
  const { collections } = await appStore();
  const selectedKeys = Array.isArray(keys) ? [...new Set(keys.filter((key) => key in DEFAULT_SETTINGS))] : null;
  const filter = selectedKeys ? { key: { $in: selectedKeys } } : {};
  const rows = await collections.settings.find(filter, { projection: { _id: 0, key: 1, value: 1 } }).toArray();
  const stored = Object.fromEntries(rows.map((row) => [row.key, decodeSettingValue(row.value)]));
  const defaults = selectedKeys
    ? Object.fromEntries(selectedKeys.map((key) => [key, DEFAULT_SETTINGS[key]]))
    : DEFAULT_SETTINGS;
  return { ...defaults, ...stored };
}

export async function getSetting(key) {
  const { collections } = await appStore();
  const row = await collections.settings.findOne({ key });
  return decodeSettingValue(row?.value ?? DEFAULT_SETTINGS[key]);
}

export async function setSettings(patch, userId = null) { const { collections } = await appStore(); for (const [key, value] of Object.entries(patch || {})) if (key in DEFAULT_SETTINGS) await collections.settings.updateOne({ key }, { $set: { key, value, updated_by: userId, updated_at: now() } }, { upsert: true }); return getSettings(); }
const PREFIX_KEYS = { patient: 'patient_prefix', order: 'order_prefix', report: 'report_prefix', receipt: 'receipt_prefix' };
export async function nextDocumentNumber(kind, date = new Date()) { const key = PREFIX_KEYS[kind]; if (!key) throw new Error(`Unknown document kind: ${kind}`); return nextCode(String(await getSetting(key) || kind).trim() || kind.toUpperCase(), kind, 4, date); }
