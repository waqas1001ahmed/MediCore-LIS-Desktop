import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api, TOKEN_KEY, USER_KEY } from '../src/api/client.js';
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx';

function AuthProbe() {
  const { token, user, booting, isAuthenticated, authError, login, refresh } = useAuth();
  return (
    <div data-testid="auth-probe">
      <span data-testid="token">{token ?? ''}</span>
      <span data-testid="user">{user?.username ?? ''}</span>
      <span data-testid="booting">{String(booting)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="authError">{authError ?? ''}</span>
      <button data-testid="btn-login" onClick={() => login('admin', 'Admin@123', false)}>login</button>
      <button data-testid="btn-refresh" onClick={refresh}>refresh</button>
    </div>
  );
}

const wrap = (children) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

let mock;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  mock = new MockAdapter(api);
});

afterEach(() => {
  if (mock) mock.restore();
});

describe('AuthContext boot / session restoration', () => {
  test('with no stored token: not booting, not authenticated', async () => {
    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    expect(screen.getByTestId('booting').textContent).toBe('false');
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('token').textContent).toBe('');
  });

  test('with a valid stored token: restores user from /auth/me', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', role: 'Administrator' }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', role: 'Administrator' } });

    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    await waitFor(() => expect(screen.getByTestId('booting').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('admin');
  });

  test('with an expired / invalid stored token: clears auth, not booting', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'expired-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(401, { error: { message: 'Unauthorized' } });

    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    await waitFor(() => expect(screen.getByTestId('booting').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(USER_KEY)).toBeNull();
  });
});

describe('Login 401 handling', () => {
  test('login 401 sets error but does NOT clear an existing session', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'existing-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin' } });
    mock.onPost('/auth/login').reply(401, { error: { message: 'Invalid username or password' } });

    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    await waitFor(() => expect(screen.getByTestId('booting').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('btn-login'));

    await waitFor(() => screen.getByTestId('authError').textContent.includes('Invalid'));

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('admin');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('existing-token');
  });
});

describe('API 401 expiration (interceptor)', () => {
  test('a 401 on a non-login API call clears auth and sets session-expired error', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin' } });
    mock.onGet('/patients/1').reply(401, { error: { message: 'Token expired' } });

    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    await waitFor(() => expect(screen.getByTestId('booting').textContent).toBe('false'));

    await api.get('/patients/1').catch(() => {});

    await waitFor(() => screen.getByTestId('authError').textContent.includes('expired'));

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('a 401 on /auth/login does NOT broadcast unauthorized', async () => {
    mock.onPost('/auth/login').reply(401, { error: { message: 'Invalid credentials' } });

    const broadcastSpy = vi.spyOn(window, 'dispatchEvent');

    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    await api.post('/auth/login', { username: 'bad', password: 'bad' }).catch(() => {});

    await waitFor(() => screen.getByTestId('authError').textContent.includes('Invalid'));

    const unauthorizedCalls = broadcastSpy.mock.calls.filter(
      (call) => call[0] && call[0].type === 'labms:unauthorized'
    );
    expect(unauthorizedCalls).toHaveLength(0);

    broadcastSpy.mockRestore();
  });
});

describe('API 403 handling', () => {
  test('a 403 preserves authentication and does not clear the session', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin' } });
    mock.onGet('/reports/secret').reply(403, { error: { message: 'Forbidden' } });

    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    await waitFor(() => expect(screen.getByTestId('booting').textContent).toBe('false'));
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await api.get('/reports/secret').catch(() => {});

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('admin');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('valid-token');
  });
});

describe('Refresh', () => {
  test('refresh re-fetches /auth/me and updates user', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', role: 'Administrator' } });

    render(wrap(<AuthProbe />), { wrapper: ({ children }) => children });

    await waitFor(() => expect(screen.getByTestId('booting').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('admin');

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', role: 'Lab Technician' } });

    fireEvent.click(screen.getByTestId('btn-refresh'));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('admin'));
    expect(screen.getByTestId('token').textContent).toBe('valid-token');
  });
});



