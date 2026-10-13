import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { hasAnyPermission } from '../utils/permissions.js';
import { LoadingBlock, EmptyState } from './ui/index.jsx';

/** Requires an authenticated session. */
export function RequireAuth({ children }) {
  const { isAuthenticated, booting, user } = useAuth();
  const location = useLocation();

  if (booting) return <LoadingBlock label="Restoring your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user?.must_change_password && !location.pathname.startsWith('/profile')) {
    return <Navigate to="/profile?tab=password" replace />;
  }
  return children;
}

/** Requires at least one of the supplied permissions (or roles). */
export function RequirePermission({ permissions = [], roles = [], children }) {
  const { user } = useAuth();
  if (!user) return null;
  const roleAllowed = roles.length > 0 && roles.includes(user.role);
  const permissionAllowed = permissions.length === 0 || hasAnyPermission(user, permissions);
  if (roleAllowed || permissionAllowed) return children;

  return (
    <div className="card">
      <EmptyState
        icon="shield-off"
        title="Access restricted"
        description="Your role does not include permission to view this module. Contact an administrator if you believe this is a mistake."
      />
    </div>
  );
}

/** Renders children only when the user holds the given permission. */
export function Can({ permission, permissions, children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;
  const list = permissions || (permission ? [permission] : []);
  return hasAnyPermission(user, list) ? children : fallback;
}
