import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { getPublicUserById } from '../db/identity.js';
import { findSession, isSessionActive } from '../db/sessions.js';
import { ApiError } from '../utils/errors.js';

/**
 * Signs a JWT for a user.
 *
 * Every token carries a unique `jti` (session id) that is recorded in the
 * `sessions` collection. That row is the authority on whether the token is
 * still active, so signing out or changing a password takes effect
 * immediately instead of waiting for the token to expire.
 */
export function signToken(user, { expiresIn = config.jwt.expiresIn, sessionId = randomUUID() } = {}) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role_name, jti: sessionId },
    config.jwt.secret,
    { expiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

/** Extracts the bearer token from the Authorization header. */
export function readBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

/** Loads a user together with role and flattened permission codes. */
export async function loadUserById(id) {
  return getPublicUserById(id);
}

/** Express middleware: requires a valid bearer token and an active session. */
export async function authenticate(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(ApiError.unauthorized('Session expired or token is invalid'));
  }

  try {
    const user = await loadUserById(payload.sub);
    if (!user) return next(ApiError.unauthorized('Account no longer exists'));
    if (!user.is_active) return next(ApiError.forbidden('Your account has been deactivated'));

    // The session row decides whether this token is still valid.
    if (payload.jti) {
      const session = await findSession(payload.jti);
      if (!session) return next(ApiError.unauthorized('Your session has ended. Please sign in again.'));
      if (session.revoked_at) return next(ApiError.unauthorized('Your session has ended. Please sign in again.'));
      if (!isSessionActive(session)) {
        return next(ApiError.unauthorized('Your session has expired. Please sign in again.'));
      }
    }

    req.sessionId = payload.jti || null;
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Express middleware factory enforcing granular permissions.
 * Pass one or more permission codes; the user needs at least one of them.
 */
export function requirePermission(...codes) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    const wanted = codes.flat().filter(Boolean);
    if (wanted.length === 0) return next();
    const granted = wanted.some((code) => req.user.permissions.includes(code));
    if (!granted) {
      return next(ApiError.forbidden(`Missing permission: ${wanted.join(' or ')}`));
    }
    return next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}
