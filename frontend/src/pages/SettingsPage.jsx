import { useEffect, useState } from 'react';
import { api, apiError, resolveAssetUrl } from '../api/client.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { hasPermission } from '../utils/permissions.js';
import { PageHeader } from '../components/PageHeader.jsx';
import {
  Alert, Button, Card, CardBody, CardHeader, Field, Input, Select, Switch, Tabs, Textarea,
} from '../components/ui/index.jsx';
import { Can } from '../components/RouteGuards.jsx';

const GROUPS = [
  {
    key: 'identity',
    label: 'Identity',
    fields: [
      { key: 'lab_name', label: 'Laboratory name', required: true },
      { key: 'lab_tagline', label: 'Tagline' },
      { key: 'lab_address', label: 'Address', type: 'textarea' },
      { key: 'lab_phone', label: 'Phone' },
      { key: 'lab_email', label: 'Email' },
      { key: 'lab_website', label: 'Website' },
      { key: 'lab_license', label: 'Registration / licence' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    fields: [
      { key: 'report_title', label: 'Report title' },
      { key: 'report_header', label: 'Header text', type: 'textarea' },
      { key: 'report_footer', label: 'Footer text', type: 'textarea' },
      { key: 'report_authorized_name', label: 'Authorising pathologist' },
      { key: 'report_authorized_title', label: 'Pathologist title' },
      { key: 'report_verified_note', label: 'Verification note', type: 'textarea' },
      { key: 'report_show_logo', label: 'Show logo on reports', type: 'switch' },
      { key: 'report_show_barcode', label: 'Show barcode on reports', type: 'switch' },
      {
        key: 'report_org_enabled',
        label: 'Show hospital / lab / clinic name on the report header',
        type: 'switch',
      },
      {
        key: 'report_org_kind',
        label: 'Organisation type',
        type: 'select',
        options: [
          { value: 'hospital', label: 'Hospital' },
          { value: 'laboratory', label: 'Laboratory' },
          { value: 'clinic', label: 'Clinic' },
          { value: 'organization', label: 'Organization' },
        ],
      },
      {
        key: 'report_org_name',
        label: 'Hospital / laboratory / clinic name',
        hint: 'Optional. Leave blank to omit the organisation line from printed reports.',
      },
    ],
  },
  {
    key: 'receipts',
    label: 'Receipts',
    fields: [
      { key: 'receipt_title', label: 'Receipt title' },
      { key: 'receipt_header', label: 'Header text' },
      { key: 'receipt_footer', label: 'Footer text', type: 'textarea' },
      { key: 'receipt_width_mm', label: 'Paper width (mm)', type: 'number' },
      { key: 'receipt_show_logo', label: 'Show logo on receipts', type: 'switch' },
      { key: 'invoice_terms', label: 'Invoice terms', type: 'textarea' },
    ],
  },
  {
    key: 'commercial',
    label: 'Commercial',
    fields: [
      { key: 'currency_code', label: 'Currency code' },
      { key: 'currency_symbol', label: 'Currency symbol' },
      {
        key: 'currency_position',
        label: 'Symbol position',
        type: 'select',
        options: [
          { value: 'before', label: 'Before amount' },
          { value: 'after', label: 'After amount' },
        ],
      },
      { key: 'tax_percent', label: 'Default tax (%)', type: 'number' },
      { key: 'patient_prefix', label: 'Patient ID prefix' },
      { key: 'order_prefix', label: 'Order number prefix' },
      { key: 'report_prefix', label: 'Report number prefix' },
      { key: 'receipt_prefix', label: 'Receipt number prefix' },
    ],
  },
  {
    key: 'appearance',
    label: 'Appearance',
    fields: [
      { key: 'primary_color', label: 'Primary colour', type: 'color' },
      { key: 'accent_color', label: 'Accent colour', type: 'color' },
      {
        key: 'theme',
        label: 'Default theme',
        type: 'select',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ],
      },
    ],
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { settings, update, uploadLogo, removeLogo, load } = useSettings();
  const toast = useToast();
  const canEdit = hasPermission(user, 'settings.edit');
  const [tab, setTab] = useState('identity');
  const [form, setForm] = useState(settings || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const group = GROUPS.find((item) => item.key === tab) || GROUPS[0];

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const patch = {};
      for (const item of group.fields) patch[item.key] = form[item.key];
      if (tab === 'identity') {
        patch.lab_name = form.lab_name;
        patch.lab_tagline = form.lab_tagline;
        patch.lab_address = form.lab_address;
        patch.lab_phone = form.lab_phone;
        patch.lab_email = form.lab_email;
        patch.lab_website = form.lab_website;
        patch.lab_license = form.lab_license;
      }
      if (tab === 'reports') {
        const orgName = String(form.report_org_name || '').trim();
        if (orgName.length > 120) {
          setError('Organisation name must be 120 characters or fewer.');
          setSaving(false);
          return;
        }
        patch.report_org_name = orgName;
        patch.report_org_enabled = !!form.report_org_enabled && orgName.length > 0;
        if (form.report_org_enabled && !orgName) {
          setError('Enter a hospital, laboratory or clinic name, or turn the header option off.');
          setSaving(false);
          return;
        }
      }
      await update(patch);
      toast.success('Settings saved');
    } catch (saveError) {
      setError(apiError(saveError, 'Unable to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await uploadLogo(file);
      toast.success('Logo uploaded');
    } catch (uploadError) {
      toast.error('Logo upload failed', apiError(uploadError));
    }
  };

  if (!settings) return null;

  return (
    <div className="page">
      <PageHeader
        icon="settings"
        title="Laboratory settings"
        subtitle="Letterhead, numbering, currency and report presentation."
        actions={
          <Button variant="ghost" icon="refresh" onClick={load}>Reload</Button>
        }
      />

      {!canEdit && <Alert tone="warning">You can view these settings but cannot change them.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={GROUPS.map((item) => ({ value: item.key, label: item.label }))}
      />

      <div className="grid grid-2">
        <Card>
          <CardHeader title={group.label} />
          <CardBody>
            <form className="form-grid" onSubmit={save}>
              {group.fields.map((field) => {
                const value = form[field.key] ?? '';
                if (field.type === 'switch') {
                  return (
                    <Field key={field.key} label={field.label} className="span-full">
                      <Switch checked={!!value} disabled={!canEdit} onChange={(checked) => setValue(field.key, checked)} />
                    </Field>
                  );
                }
                if (field.type === 'textarea') {
                  return (
                    <Field key={field.key} label={field.label} className="span-full">
                      <Textarea rows={3} disabled={!canEdit} value={value} onChange={(e) => setValue(field.key, e.target.value)} />
                    </Field>
                  );
                }
                if (field.type === 'select') {
                  return (
                    <Field key={field.key} label={field.label}>
                      <Select disabled={!canEdit} value={value} options={field.options} onChange={(e) => setValue(field.key, e.target.value)} />
                    </Field>
                  );
                }
                if (field.type === 'color') {
                  return (
                    <Field key={field.key} label={field.label}>
                      <div className="d-flex align-center gap-3">
                        <input type="color" disabled={!canEdit} value={value || '#1f7a8c'} onChange={(e) => setValue(field.key, e.target.value)} style={{ width: 42, height: 38, border: 'none', background: 'none' }} />
                        <Input disabled={!canEdit} value={value} onChange={(e) => setValue(field.key, e.target.value)} />
                      </div>
                    </Field>
                  );
                }
                return (
                  <Field key={field.key} label={field.label} required={field.required} hint={field.hint} className={field.key === 'report_org_name' ? 'span-full' : ''}>
                    <Input
                      type={field.type || 'text'}
                      disabled={!canEdit}
                      maxLength={field.key === 'report_org_name' ? 120 : undefined}
                      value={value}
                      onChange={(e) => setValue(field.key, field.type === 'number' ? e.target.value : e.target.value)}
                    />
                  </Field>
                );
              })}
              <Can permission="settings.edit">
                <div className="span-full">
                  <Button type="submit" variant="primary" loading={saving} icon="save">Save {group.label.toLowerCase()}</Button>
                </div>
              </Can>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Laboratory logo" subtitle="Used on reports, receipts and the login screen." />
          <CardBody>
            <div className="logo-preview mb-4">
              {form.lab_logo
                ? <img src={resolveAssetUrl(form.lab_logo)} alt="Laboratory logo" />
                : <span className="text-subtle text-sm">No logo</span>}
            </div>
            <Can permission="settings.edit">
              <div className="d-flex gap-2 flex-wrap">
                <label className="btn btn-secondary">
                  Upload image
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={onLogo} />
                </label>
                {form.lab_logo && (
                  <Button variant="danger-soft" onClick={async () => { await removeLogo(); toast.success('Logo removed'); }}>
                    Remove
                  </Button>
                )}
              </div>
            </Can>
            <p className="text-xs text-subtle mt-3">PNG, JPEG, WebP or SVG. Keep the file under 2 MB for clean printing.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
