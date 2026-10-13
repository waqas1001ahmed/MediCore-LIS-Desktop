import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, apiError } from '../api/client.js';
import { DEFAULT_CURRENCY } from '../utils/constants.js';
import { useAuth } from './AuthContext.jsx';

const SettingsContext = createContext(null);

function applyBrandColours(settings) {
  if (settings.primary_color) {
    document.documentElement.style.setProperty('--brand-500', settings.primary_color);
  }
  if (settings.accent_color) {
    document.documentElement.style.setProperty('--accent', settings.accent_color);
  }
}

export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings');
      setSettings(data.data);
      applyBrandColours(data.data);
      setError(null);
      return data.data;
    } catch (loadError) {
      setError(apiError(loadError, 'Unable to load laboratory settings'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBranding = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings/branding');
      setSettings(data.data);
      applyBrandColours(data.data);
      setError(null);
      return data.data;
    } catch {
      setSettings(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else loadBranding();
  }, [isAuthenticated, load, loadBranding]);

  const update = useCallback(async (patch) => {
    const { data } = await api.put('/settings', { settings: patch });
    setSettings(data.data);
    applyBrandColours(data.data);
    return data.data;
  }, []);

  const uploadLogo = useCallback(async (file) => {
    const form = new FormData();
    form.append('logo', file);
    const { data } = await api.post('/settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setSettings(data.data);
    return data.data;
  }, []);

  const removeLogo = useCallback(async () => {
    const { data } = await api.delete('/settings/logo');
    setSettings(data.data);
    return data.data;
  }, []);

  const currency = useMemo(
    () => ({
      symbol: settings?.currency_symbol ?? DEFAULT_CURRENCY.symbol,
      code: settings?.currency_code ?? DEFAULT_CURRENCY.code,
      position: settings?.currency_position ?? DEFAULT_CURRENCY.position,
    }),
    [settings],
  );

  const value = useMemo(
    () => ({ settings, loading, error, currency, load, update, uploadLogo, removeLogo }),
    [settings, loading, error, currency, load, update, uploadLogo, removeLogo],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside a SettingsProvider');
  return context;
}
