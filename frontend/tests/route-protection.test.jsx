import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api, TOKEN_KEY, USER_KEY } from '../src/api/client.js';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { RequireAuth, RequirePermission, Can } from '../src/components/RouteGuards.jsx';

const wrapWithAuth = (children, authenticated = true) => {
  if (authenticated) {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', permissions: ['dashboard.view', 'patients.view', 'roles.view'] }));
  }
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
};

let mock;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  mock = new MockAdapter(api);
});

afterEach(() => {
  if (mock) mock.restore();
});

describe('RequireAuth', () => {
  test('while booting: renders LoadingBlock', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin' } });

    render(
      wrapWithAuth(
        <RequireAuth><div data-testid="children">children</div></RequireAuth>
      ),
      { wrapper: ({ children }) => children }
    );

    expect(screen.getByText(/Restoring your session/)).toBeTruthy();
  });

  test('when not authenticated: redirects to /login', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'invalid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(401, { error: { message: 'Unauthorized' } });

    render(
      wrapWithAuth(
        <RequireAuth><div data-testid="children">children</div></RequireAuth>,
        false
      ),
      { wrapper: ({ children }) => children }
    );

    await waitFor(() => expect(screen.queryByTestId('children')).toBeNull());
  });

  test('when authenticated: renders children', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin' }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin' } });

    render(
      wrapWithAuth(
        <RequireAuth><div data-testid="children">children</div></RequireAuth>
      ),
      { wrapper: ({ children }) => children }
    );

    await waitFor(() => expect(screen.getByTestId('children').textContent).toBe('children'));
  });
});

describe('RequirePermission', () => {
  test('when user lacks required permission: renders Access restricted', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', role: 'Lab Technician', permissions: ['patients.view'] }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', role: 'Lab Technician', permissions: ['patients.view'] } });

    render(
      wrapWithAuth(
        <RequirePermission permissions={['roles.manage']}><div data-testid="children">children</div></RequirePermission>
      ),
      { wrapper: ({ children }) => children }
    );

    await waitFor(() => expect(screen.queryByTestId('children')).toBeNull());
    expect(screen.getByText('Access restricted')).toBeTruthy();
  });

  test('when user has required permission: renders children', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', role: 'Administrator', permissions: ['roles.manage'] }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', role: 'Administrator', permissions: ['roles.manage'] } });

    render(
      wrapWithAuth(
        <RequirePermission permissions={['roles.manage']}><div data-testid="children">children</div></RequirePermission>
      ),
      { wrapper: ({ children }) => children }
    );

    await waitFor(() => expect(screen.getByTestId('children').textContent).toBe('children'));
  });

  test('when user matches allowed role: renders children', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', role: 'Administrator', permissions: [] }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', role: 'Administrator', permissions: [] } });

    render(
      wrapWithAuth(
        <RequirePermission roles={['Administrator']}><div data-testid="children">children</div></RequirePermission>
      ),
      { wrapper: ({ children }) => children }
    );

    await waitFor(() => expect(screen.getByTestId('children').textContent).toBe('children'));
  });
});

describe('Can', () => {
  test('when user has permission: renders children', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', permissions: ['patients.view'] }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', permissions: ['patients.view'] } });

    render(
      wrapWithAuth(
        <Can permission="patients.view"><div data-testid="children">children</div></Can>
      ),
      { wrapper: ({ children }) => children }
    );

    await waitFor(() => expect(screen.getByTestId('children').textContent).toBe('children'));
  });

  test('when user lacks permission: renders fallback (null)', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'valid-token');
    window.localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', permissions: ['patients.view'] }));

    mock.onGet('/auth/me').reply(200, { user: { username: 'admin', permissions: ['patients.view'] } });

    render(
      wrapWithAuth(
        <Can permission="roles.manage"><div data-testid="children">children</div></Can>
      ),
      { wrapper: ({ children }) => children }
    );

    await waitFor(() => expect(screen.queryByTestId('children')).toBeNull());
  });
});
