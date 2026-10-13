import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { resolveAssetUrl } from '../api/client.js';
import Icon from '../components/ui/Icon.jsx';
import { Button, Field, Input, Alert } from '../components/ui/index.jsx';

export default function Login() {
  const { login, isAuthenticated, user, authError, clearAuthError } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from || '/';

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.must_change_password) navigate('/profile?tab=password', { replace: true });
    else navigate(from, { replace: true });
  }, [isAuthenticated, user, from, navigate]);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    clearAuthError?.();
    if (!form.username.trim() || !form.password) {
      setError('Enter both your username and password.');
      return;
    }
    setSubmitting(true);
    try {
      const signedIn = await login(form.username.trim(), form.password);
      if (signedIn?.must_change_password) navigate('/profile?tab=password', { replace: true });
      else navigate(from, { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const logo = resolveAssetUrl(settings?.lab_logo);
  const labName = settings?.lab_name || 'MediCore Diagnostics Laboratory';

  return (
    <div className="auth-screen">
      <aside className="auth-aside">
        <div className="auth-brand">
          <div className="sidebar-logo">
            {logo ? <img src={logo} alt="" /> : <Icon name="droplet" />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{labName}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Laboratory Information System</div>
          </div>
        </div>

        <div className="auth-hero">
          <h1>Complete laboratory operations, from sample to signed report.</h1>
          <p>
            Register patients, manage test orders, capture results, print professional reports and
            thermal receipts, and track revenue — all in one secure system.
          </p>
          <div className="auth-features">
            {[
              ['users', 'Patient registration, history and referring doctors'],
              ['flask', 'Configurable test catalogue with reference ranges'],
              ['file-text', 'A4 reports with automatic abnormal result flagging'],
              ['receipt', '80mm thermal receipts and revenue analytics'],
              ['shield', 'Role based access with a full audit trail'],
            ].map(([icon, text]) => (
              <div className="auth-feature" key={text}>
                <Icon name={icon} />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '0.6875rem', opacity: 0.75, position: 'relative', zIndex: 1 }}>
          Authorised personnel only. All activity is recorded in the audit log.
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-form">
          <div className="mb-6">
            <h2>Sign in</h2>
            <p className="text-muted text-sm mt-1">Use your laboratory credentials to continue.</p>
          </div>

          {error && (
            <div className="mb-4">
              <Alert tone="danger" title="Sign in failed">{error}</Alert>
            </div>
          )}

          <form onSubmit={submit} className="d-flex flex-col gap-4">
            <Field label="Username" required htmlFor="username">
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoFocus
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="e.g. admin"
              />
            </Field>

            <Field label="Password" required htmlFor="password">
              <div className="input-group">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="input-affix input-affix-right"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ cursor: 'pointer' }}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </Field>

            <Button type="submit" variant="primary" size="lg" loading={submitting} icon={submitting ? undefined : 'log-in'}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="auth-demo">
            <strong>First run?</strong> The default administrator account is{' '}
            <code>admin</code> / <code>Admin@123</code>. Change the password immediately after signing in.
          </div>
        </div>
      </main>
    </div>
  );
}
