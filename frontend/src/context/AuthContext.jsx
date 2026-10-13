import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, TOKEN_KEY, USER_KEY, apiError } from '../api/client.js';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => readStoredUser());
  const [booting, setBooting] = useState(!!localStorage.getItem(TOKEN_KEY));
  const [authError, setAuthError] = useState(null);

  const persist = useCallback((nextToken, nextUser) => {
    if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken);
    else localStorage.removeItem(TOKEN_KEY);
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_KEY);
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
    async (username, password) => {
      setAuthError(null);
      try {
        const { data } = await api.post('/auth/login', { username, password });
        persist(data.token, data.user);
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
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    try {
      const { data } = await api.get('/auth/me');
      persist(token, data.user);
      return data.user;
    } catch {
      return null;
    }
  }, [persist, token]);

  // Validate the stored session once on boot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setBooting(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) persist(localStorage.getItem(TOKEN_KEY), data.user);
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
      setUser: (nextUser) => persist(localStorage.getItem(TOKEN_KEY), nextUser),
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
