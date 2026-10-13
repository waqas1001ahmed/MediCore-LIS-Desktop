import express from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { recordAudit } from '../utils/audit.js';
import { storeUploadedImage, uploadImage } from '../middleware/upload.js';
import { getSettings, setSettings, DEFAULT_SETTINGS, SETTINGS_KEY_LABELS } from '../utils/settings.js';
import { assert } from '../utils/validate.js';

const router = express.Router();

/** Lightweight subset for the login screen (no session required). */
router.get(
  '/branding',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    res.json({
      data: {
        lab_name: settings.lab_name,
        lab_tagline: settings.lab_tagline,
        lab_logo: settings.lab_logo,
        theme: settings.theme,
        primary_color: settings.primary_color,
        accent_color: settings.accent_color,
        currency_symbol: settings.currency_symbol,
        currency_code: settings.currency_code,
        currency_position: settings.currency_position,
      },
    });
  }),
);

router.use(authenticate);

/** Readable by every signed-in user: the UI renders letterheads everywhere. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: await getSettings(), labels: SETTINGS_KEY_LABELS, defaults: DEFAULT_SETTINGS });
  }),
);

router.put(
  '/',
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const patch = req.body?.settings || req.body;
    assert(patch && typeof patch === 'object' && !Array.isArray(patch), 'Settings payload must be an object');

    const unknown = Object.keys(patch).filter((key) => !(key in DEFAULT_SETTINGS));
    assert(unknown.length === 0, `Unknown setting key(s): ${unknown.join(', ')}`);

    if (patch.tax_percent !== undefined) {
      const value = Number(patch.tax_percent);
      assert(Number.isFinite(value) && value >= 0 && value <= 100, 'Tax percent must be between 0 and 100');
    }
    if (patch.receipt_width_mm !== undefined) {
      const value = Number(patch.receipt_width_mm);
      assert(Number.isFinite(value) && value >= 58 && value <= 120, 'Receipt width must be between 58mm and 120mm');
    }
    for (const key of ['patient_prefix', 'order_prefix', 'report_prefix', 'receipt_prefix']) {
      if (patch[key] !== undefined) {
        assert(/^[A-Za-z0-9-]{1,8}$/.test(String(patch[key])), `${SETTINGS_KEY_LABELS[key]} must be 1-8 letters or digits`);
      }
    }
    if (patch.theme !== undefined) {
      assert(['light', 'dark', 'system'].includes(patch.theme), 'Theme must be light, dark or system');
    }
    if (patch.report_org_kind !== undefined && String(patch.report_org_kind).trim() !== '') {
      assert(
        ['hospital', 'laboratory', 'clinic', 'organization'].includes(String(patch.report_org_kind)),
        'Organisation type must be hospital, laboratory, clinic or organization',
      );
    }
    if (patch.report_org_name !== undefined) {
      const name = String(patch.report_org_name || '').trim();
      assert(name.length <= 120, 'Organisation name must be 120 characters or fewer');
      patch.report_org_name = name;
    }
    if (patch.report_org_enabled !== undefined) {
      patch.report_org_enabled = !!patch.report_org_enabled;
      if (patch.report_org_enabled) {
        const currentSettings = await getSettings();
        const name = String(patch.report_org_name ?? currentSettings.report_org_name ?? '').trim();
        assert(name.length > 0, 'Enter a hospital, laboratory or clinic name, or turn the header option off.');
      }
    }

    const updated = await setSettings(patch, req.user.id);
    await recordAudit({
      req, action: 'update', module: 'settings', entity: 'settings',
      description: `Updated lab settings (${Object.keys(patch).join(', ')})`,
      meta: patch,
    });
    res.json({ data: updated });
  }),
);

router.post(
  '/logo',
  requirePermission('settings.edit'),
  uploadImage.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No logo file was uploaded');
    const url = await storeUploadedImage(req.file);
    const updated = await setSettings({ lab_logo: url }, req.user.id);
    await recordAudit({ req, action: 'update', module: 'settings', entity: 'settings', description: 'Uploaded laboratory logo' });
    res.json({ data: updated, logo_url: url });
  }),
);

router.delete(
  '/logo',
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const updated = await setSettings({ lab_logo: '' }, req.user.id);
    await recordAudit({ req, action: 'update', module: 'settings', entity: 'settings', description: 'Removed laboratory logo' });
    res.json({ data: updated });
  }),
);

export default router;
