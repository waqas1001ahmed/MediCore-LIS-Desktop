import axios from 'axios';

const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : 'https://backend-mu-six-71.vercel.app/api';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'MediCore LIS';

export const TOKEN_KEY = 'labms.token';
export const USER_KEY = 'labms.user';
export const THEME_KEY = 'labms.theme';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Broadcast so the auth layer can react to expired sessions. */
function broadcastUnauthorized() {
  window.dispatchEvent(new CustomEvent('labms:unauthorized'));
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    if (status === 401 && !url.includes('/auth/login')) {
      broadcastUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Extracts a human-readable message from an axios error. */
export function apiError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (error.code === 'ECONNABORTED') return 'The request timed out. Check your connection and retry.';
  const data = error.response?.data;
  if (data?.error?.message) return data.error.message;
  if (typeof data === 'string' && data.length < 300) return data;
  if (error.message) return error.message;
  return fallback;
}

/** Unwraps `{ data }` payloads and returns the raw body for other shapes. */
export async function request(promise) {
  const response = await promise;
  return response.data;
}

/** Builds a query string, skipping empty values. */
export function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return url.startsWith('/') ? url : `/${url}`;
}
