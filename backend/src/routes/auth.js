import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { authenticate, signToken, loadUserById } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { getUserById, getUserByUsername, identityCollectionsForUse, recordMongoAudit } from '../db/identity.js';
import { now } from '../utils/time.js';
import { assert, requireFields } from '../utils/validate.js';

const router = express.Router();
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts. Please try again later.' } },
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  requireFields(req.body, ['username', 'password']);
  const username = String(req.body.username).trim().toLowerCase();
  const password = String(req.body.password);
  const user = await getUserByUsername(username);

  if (!user) {
    await recordMongoAudit({ req, action: 'login_failed', module: 'auth', entity: 'user', description: `Failed login attempt for unknown username "${username}"`, user: { id: null, username } });
    throw ApiError.unauthorized('Invalid username or password');
  }
  if (user.locked_until && new Date(String(user.locked_until).replace(' ', 'T')) > new Date()) {
    throw ApiError.forbidden('Account temporarily locked after repeated failed attempts. Try again later.');
  }
  if (!user.is_active) throw ApiError.forbidden('Your account has been deactivated. Contact an administrator.');

  const ok = await bcrypt.compare(password, user.password_hash);
  const collections = await identityCollectionsForUse();
  if (!ok) {
    const attempts = Number(user.failed_attempts || 0) + 1;
    const lockUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await collections.users.updateOne({ id: user.id }, { $set: { failed_attempts: attempts, locked_until: lockUntil ? lockUntil.toISOString().slice(0, 19).replace('T', ' ') : null, updated_at: now() } });
    await recordMongoAudit({ req, action: 'login_failed', module: 'auth', entity: 'user', entityId: user.id, description: `Failed login attempt ${attempts}/${MAX_ATTEMPTS} for "${username}"`, user: { id: user.id, username: user.username } });
    throw ApiError.unauthorized('Invalid username or password');
  }

  await collections.users.updateOne({ id: user.id }, { $set: { failed_attempts: 0, locked_until: null, last_login_at: now(), updated_at: now() } });
  const profile = await loadUserById(user.id);
  const token = signToken({ ...user, role_name: profile?.role });
  await recordMongoAudit({ req, action: 'login', module: 'auth', entity: 'user', entityId: user.id, description: `User "${user.username}" signed in`, user: profile });
  res.json({ token, user: profile, expiresIn: config.jwt.expiresIn });
}));

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  const { currentPassword, newPassword } = req.body;
  assert(String(newPassword).length >= 6, 'New password must be at least 6 characters');
  const user = await getUserById(req.user.id);
  if (!user || !(await bcrypt.compare(String(currentPassword), user.password_hash))) throw ApiError.badRequest('Current password is incorrect');
  const collections = await identityCollectionsForUse();
  await collections.users.updateOne({ id: req.user.id }, { $set: { password_hash: await bcrypt.hash(String(newPassword), config.bcryptRounds), must_change_password: 0, updated_at: now() } });
  await recordMongoAudit({ req, action: 'change_password', module: 'auth', entity: 'user', entityId: req.user.id, description: 'Password changed' });
  res.json({ message: 'Password updated successfully' });
}));

router.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const allowed = ['full_name', 'email', 'phone', 'designation', 'signature_title'];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key] === '' ? null : req.body[key];
  if (!Object.keys(updates).length) throw ApiError.badRequest('No profile fields supplied');
  updates.updated_at = now();
  const collections = await identityCollectionsForUse();
  await collections.users.updateOne({ id: req.user.id }, { $set: updates });
  await recordMongoAudit({ req, action: 'update', module: 'profile', entity: 'user', entityId: req.user.id, description: 'Updated own profile' });
  res.json({ user: await loadUserById(req.user.id) });
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await recordMongoAudit({ req, action: 'logout', module: 'auth', entity: 'user', entityId: req.user.id, description: 'User signed out' });
  res.json({ message: 'Signed out' });
}));

export default router;
