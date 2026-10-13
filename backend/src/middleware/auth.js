import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getPublicUserById } from '../db/identity.js';
import { ApiError } from '../utils/errors.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role_name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

/** Loads a user together with role and flattened permission codes. */
export async function loadUserById(id) {
  return getPublicUserById(id);
}

/** Express middleware: requires a valid bearer token. */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
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
