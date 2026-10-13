/** Client-side permission helpers (the API is the source of truth). */

export function hasPermission(user, code) {
  if (!user) return false;
  if (!code) return true;
  const permissions = user.permissions || [];
  return permissions.includes(code);
}

export function hasAnyPermission(user, codes = []) {
  if (!user) return false;
  if (!codes.length) return true;
  return codes.some((code) => hasPermission(user, code));
}

export function hasAllPermissions(user, codes = []) {
  if (!user) return false;
  return codes.every((code) => hasPermission(user, code));
}

export function isRole(user, ...roles) {
  return !!user && roles.includes(user.role);
}

/**
 * Declarative route guard definition: the user needs at least one of the
 * listed permissions (or one of the listed roles).
 */
export function canAccess(user, { permissions = [], roles = [] } = {}) {
  if (!user) return false;
  if (roles.length && roles.includes(user.role)) return true;
  if (permissions.length) return hasAnyPermission(user, permissions);
  return true;
}

export const MODULES = [
  { key: 'patients', label: 'Patients' },
  { key: 'orders', label: 'Orders' },
  { key: 'results', label: 'Results' },
  { key: 'reports', label: 'Reports' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'revenue', label: 'Revenue' },
];
