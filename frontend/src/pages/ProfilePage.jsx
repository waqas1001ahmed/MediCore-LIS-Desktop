import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import {
  Alert, Avatar, Button, Card, CardBody, CardHeader, Field, Input, Tabs,
} from '../components/ui/index.jsx';
import { formatDateTime } from '../utils/format.js';

const EMPTY_PASSWORD = { currentPassword: '', newPassword: '', confirm: '' };

export default function ProfilePage() {
  const { user, setUser, refresh } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'password' ? 'password' : 'profile');
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    designation: user?.designation || '',
    signature_title: user?.signature_title || '',
  });
  const [pass, setPass] = useState(EMPTY_PASSWORD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setParams(tab === 'password' ? { tab: 'password' } : {}, { replace: true });
  }, [tab, setParams]);

  useEffect(() => {
    if (user?.must_change_password) setTab('password');
  }, [user?.must_change_password]);

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setError(null);
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/profile', form);
      setUser(data.user);
      await refresh();
      toast.success('Profile updated');
    } catch (saveError) {
      setError(apiError(saveError, 'Unable to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError(null);
    if (pass.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (pass.newPassword !== pass.confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pass.currentPassword,
        newPassword: pass.newPassword,
      });
      setPass(EMPTY_PASSWORD);
      await refresh();
      toast.success('Password changed');
    } catch (saveError) {
      setError(apiError(saveError, 'Unable to change password'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader icon="user" title="My profile" subtitle="Update your contact details and password." />

      <div className="patient-banner">
        <Avatar name={user?.full_name} size="lg" />
        <div>
          <div className="fw-650">{user?.full_name}</div>
          <div className="text-sm text-muted">{user?.roleLabel} · @{user?.username}</div>
          <div className="text-xs text-subtle mt-1">Last sign-in {formatDateTime(user?.last_login_at)}</div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'profile', label: 'Profile', icon: 'user' },
          { value: 'password', label: 'Password', icon: 'key' },
        ]}
      />

      {user?.must_change_password && (
        <Alert tone="warning" title="Password change required">
          Your administrator asked you to set a new password before using the laboratory system.
        </Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {tab === 'profile' ? (
        <Card>
          <CardHeader title="Contact details" />
          <CardBody>
            <form className="form-grid" onSubmit={saveProfile}>
              <Field label="Full name" required>
                <Input value={form.full_name} onChange={setField('full_name')} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={setField('email')} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={setField('phone')} />
              </Field>
              <Field label="Designation">
                <Input value={form.designation} onChange={setField('designation')} />
              </Field>
              <Field label="Signature title" className="span-2" hint="Printed under your name on laboratory reports.">
                <Input value={form.signature_title} onChange={setField('signature_title')} />
              </Field>
              <div className="span-full">
                <Button type="submit" variant="primary" loading={saving} icon="save">Save profile</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Change password" subtitle="Use a unique password of at least 6 characters." />
          <CardBody>
            <form className="form-grid" onSubmit={savePassword} style={{ maxWidth: 480 }}>
              <Field label="Current password" required className="span-full">
                <Input type="password" autoComplete="current-password" value={pass.currentPassword} onChange={(e) => setPass((c) => ({ ...c, currentPassword: e.target.value }))} />
              </Field>
              <Field label="New password" required>
                <Input type="password" autoComplete="new-password" value={pass.newPassword} onChange={(e) => setPass((c) => ({ ...c, newPassword: e.target.value }))} />
              </Field>
              <Field label="Confirm new password" required>
                <Input type="password" autoComplete="new-password" value={pass.confirm} onChange={(e) => setPass((c) => ({ ...c, confirm: e.target.value }))} />
              </Field>
              <div className="span-full">
                <Button type="submit" variant="primary" loading={saving} icon="lock">Update password</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
