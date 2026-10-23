import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  api, TOKEN_KEY, USER_KEY, apiError, readToken, writeToken, clearToken, writeRemember, isTokenPersistent,
} from '../api/client.js';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
  if (!user) return;
  const raw = JSON.stringify(user);
  // The user profile follows the token: remembered sign-ins live in
  // localStorage, temporary ones in sessionStorage.
  if (localStorage.getItem(TOKEN_KEY)) localStorage.setItem(USER_KEY, raw);
  else sessionStorage.setItem(USER_KEY, raw);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readToken());
  const [user, setUser] = useState(() => readStoredUser());
  const [booting, setBooting] = useState(!!readToken());
  const [authError, setAuthError] = useState(null);

  /**
   * Stores the session.
   *
   * `remember` decides where the token lives: `localStorage` for a remembered
   * sign-in, `sessionStorage` for a temporary one. When it is not supplied the
   * current storage location is preserved, so refreshing the profile never
   * silently promotes a temporary session to a persistent one.
   */
  const persist = useCallback((nextToken, nextUser, remember = null) => {
    if (nextToken) {
      const persistent = remember === null ? isTokenPersistent() : remember;
      writeToken(nextToken, persistent);
      writeRemember(persistent);
    } else {
      clearToken();
      writeRemember(false);
    }
    writeStoredUser(nextUser);
    setToken(nextToken || null);
    setUser(nextUser || null);
  }, []);

  const logout = useCallback(
    (options = {}) => {
      if (!options.silent && token) {
        api.post('/auth/logout').catch(() => {});
      }
      persist(null, null);
    },
    [persist, token],
  );

  const login = useCallback(
    async (username, password, remember = false) => {
      setAuthError(null);
      try {
        const { data } = await api.post('/auth/login', { username, password, remember });
        persist(data.token, data.user, remember);
        return data.user;
      } catch (error) {
        const message = apiError(error, 'Unable to sign in. Please try again.');
        setAuthError(message);
        throw new Error(message);
      }
    },
    [persist],
  );

  /** Refreshes the current user (permissions may have changed). */
  const refresh = useCallback(async () => {
    if (!readToken()) return null;
    try {
      const { data } = await api.get('/auth/me');
      persist(readToken(), data.user);
      return data.user;
    } catch {
      return null;
    }
  }, [persist]);

  // Validate the stored session once on boot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!readToken()) {
        setBooting(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) persist(readToken(), data.user);
      } catch {
        if (!cancelled) persist(null, null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to expired sessions reported by the axios interceptor.
  useEffect(() => {
    const handler = () => {
      persist(null, null);
      setAuthError('Your session has expired. Please sign in again.');
    };
    window.addEventListener('labms:unauthorized', handler);
    return () => window.removeEventListener('labms:unauthorized', handler);
  }, [persist]);

  const value = useMemo(
    () => ({
      token,
      user,
      booting,
      authError,
      clearAuthError: () => setAuthError(null),
      isAuthenticated: !!token && !!user,
      login,
      logout,
      refresh,
      setUser: (nextUser) => persist(readToken(), nextUser),
    }),
    [token, user, booting, authError, login, logout, refresh, persist],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
