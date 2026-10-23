import express from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { recordMongoAudit, getRoleById, getRoleByName, getUserById, findUsers, nextIdentityId, identityCollectionsForUse, withIdentityTransaction } from '../db/identity.js';
import { revokeUserSessions, revokeSessionById, listAllActiveSessions } from '../db/sessions.js';
import { now } from '../utils/time.js';
import { assert, requireFields, toBool, paginate } from '../utils/validate.js';

const router = express.Router();
router.use(authenticate);

function duplicateKey(error) {
  return error?.code === 11000;
}

router.get('/', requirePermission('users.view'), asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { total, rows } = await findUsers({ search: (req.query.search || '').trim(), roleId: req.query.role_id, status: req.query.status, limit, offset });
  res.json({ data: rows, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
}));

/** Lists every active session across all users (administrators only). */
router.get('/sessions/active', requirePermission('users.view'), asyncHandler(async (req, res) => {
  const active = await listAllActiveSessions();
  res.json({
    data: active.map((session) => ({
      id: session.id,
      user_id: session.user_id,
      username: session.username,
      full_name: session.full_name,
      ip: session.ip,
      user_agent: session.user_agent,
      created_at: session.created_at,
      expires_at: session.expires_at,
      // Lets the admin page tell "this device" apart from the other devices
      // and avoid signing themselves out by accident.
      current: session.token_id === req.sessionId,
    })),
  });
}));

/** Revokes a single session by id (administrators only). */
router.delete('/sessions/:id', requirePermission('users.view'), asyncHandler(async (req, res) => {
  const collections = await identityCollectionsForUse();
  const session = await collections.sessions.findOne({ id: Number(req.params.id) });
  if (!session) throw ApiError.notFound('Session not found');
  await revokeSessionById(session.id);
  await recordMongoAudit({
    req,
    action: 'revoke_session',
    module: 'auth',
    entity: 'user',
    entityId: session.user_id,
    description: `Revoked session #${session.id}`,
  });
  res.json({ message: 'Session revoked' });
}));

router.get('/:id', requirePermission('users.view'), asyncHandler(async (req, res) => {
  const collections = await identityCollectionsForUse();
  const raw = await collections.users.findOne({ id: Number(req.params.id) });
  if (!raw) throw ApiError.notFound('User not found');
  const role = raw.role_id === null || raw.role_id === undefined ? null : await getRoleById(raw.role_id);
  const data = {
    id: raw.id, username: raw.username, full_name: raw.full_name, email: raw.email, phone: raw.phone,
    designation: raw.designation, signature_title: raw.signature_title, role_id: raw.role_id,
    is_active: raw.is_active, must_change_password: raw.must_change_password, last_login_at: raw.last_login_at,
    created_at: raw.created_at, updated_at: raw.updated_at, role: role?.name ?? null, role_label: role?.label ?? null,
  };
  res.json({ data });
}));

router.post('/', requirePermission('users.create'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['username', 'password', 'full_name', 'role_id']);
  const username = String(req.body.username).trim();
  assert(/^[a-zA-Z0-9._-]{3,32}$/.test(username), 'Username must be 3-32 characters (letters, numbers, . _ -)');
  assert(String(req.body.password).length >= 6, 'Password must be at least 6 characters');
  if (!(await getRoleById(req.body.role_id))) assert(false, 'Selected role does not exist');
  const collections = await identityCollectionsForUse();
  if (await collections.users.findOne({ username_normalized: username.toLowerCase() })) throw ApiError.conflict('That username is already taken');
  const timestamp = now();
  const id = await nextIdentityId('users');
  const user = {
    id, username, username_normalized: username.toLowerCase(), password_hash: await bcrypt.hash(String(req.body.password), config.bcryptRounds),
    full_name: String(req.body.full_name).trim(), email: req.body.email || null, phone: req.body.phone || null,
    designation: req.body.designation || null, signature_title: req.body.signature_title || null, role_id: Number(req.body.role_id),
    is_active: toBool(req.body.is_active, true) ? 1 : 0, must_change_password: toBool(req.body.must_change_password, false) ? 1 : 0,
    failed_attempts: 0, locked_until: null, last_login_at: null, created_by: req.user.id, created_at: timestamp, updated_at: timestamp,
  };
  try {
    await collections.users.insertOne(user);
  } catch (error) {
    if (duplicateKey(error)) throw ApiError.conflict('That username is already taken');
    throw error;
  }
  await recordMongoAudit({ req, action: 'create', module: 'users', entity: 'user', entityId: id, description: `Created user "${username}"` });
  const created = await findUsers({ search: username, limit: 1, offset: 0 });
  res.status(201).json({ data: created.rows[0] });
}));

router.put('/:id', requirePermission('users.edit'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getUserById(id);
  if (!existing) throw ApiError.notFound('User not found');
  requireFields(req.body, ['full_name', 'role_id']);
  if (!(await getRoleById(req.body.role_id))) assert(false, 'Selected role does not exist');
  const username = (req.body.username || existing.username).trim();
  const collections = await identityCollectionsForUse();
  const clash = await collections.users.findOne({ username_normalized: username.toLowerCase(), id: { $ne: id } });
  if (clash) throw ApiError.conflict('That username is already taken');
  const updates = {
    username, username_normalized: username.toLowerCase(), full_name: req.body.full_name, email: req.body.email || null,
    phone: req.body.phone || null, designation: req.body.designation || null, signature_title: req.body.signature_title || null,
    role_id: Number(req.body.role_id), is_active: toBool(req.body.is_active, !!existing.is_active) ? 1 : 0, updated_at: now(),
  };
  if (req.body.password) {
    assert(String(req.body.password).length >= 6, 'Password must be at least 6 characters');
    updates.password_hash = await bcrypt.hash(String(req.body.password), config.bcryptRounds);
    updates.must_change_password = toBool(req.body.must_change_password, false) ? 1 : 0;
  }
  try {
    await collections.users.updateOne({ id }, { $set: updates });
  } catch (error) {
    if (duplicateKey(error)) throw ApiError.conflict('That username is already taken');
    throw error;
  }
  // Deactivating an account or changing its password must end the existing sessions.
  const deactivated = updates.is_active === 0 && existing.is_active !== 0;
  if (deactivated || updates.password_hash) {
    await revokeUserSessions(id);
  }
  await recordMongoAudit({ req, action: 'update', module: 'users', entity: 'user', entityId: id, description: `Updated user "${existing.username}"` });
  const updated = await findUsers({ search: username, limit: 1, offset: 0 });
  res.json({ data: updated.rows.find((row) => row.id === id) });
}));

router.post('/:id/reset-password', requirePermission('users.edit'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const user = await getUserById(id);
  if (!user) throw ApiError.notFound('User not found');
  requireFields(req.body, ['password']);
  assert(String(req.body.password).length >= 6, 'Password must be at least 6 characters');
  const collections = await identityCollectionsForUse();
  await collections.users.updateOne({ id }, { $set: { password_hash: await bcrypt.hash(String(req.body.password), config.bcryptRounds), must_change_password: toBool(req.body.must_change_password, true) ? 1 : 0, failed_attempts: 0, locked_until: null, updated_at: now() } });
  // A forced password reset must invalidate every existing session of that user.
  await revokeUserSessions(id);
  await recordMongoAudit({ req, action: 'reset_password', module: 'users', entity: 'user', entityId: id, description: `Reset password for "${user.username}"` });
  res.json({ message: 'Password reset successfully' });
}));

router.delete('/:id', requirePermission('users.delete'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');
  const user = await getUserById(id);
  if (!user) throw ApiError.notFound('User not found');
  const superAdminRole = await getRoleByName('super_admin');
  const collections = await identityCollectionsForUse();
  if (superAdminRole && user.role_id === superAdminRole.id) {
    const remaining = await collections.users.countDocuments({ role_id: superAdminRole.id, is_active: 1, id: { $ne: id } });
    assert(remaining > 0, 'Cannot delete the last active super administrator');
  }
  await withIdentityTransaction(async (session) => {
    await collections.users.deleteOne({ id }, { session });
    await collections.sessions.deleteMany({ user_id: id }, { session });
  });
  await recordMongoAudit({ req, action: 'delete', module: 'users', entity: 'user', entityId: id, description: `Deleted user "${user.username}"` });
  res.json({ message: 'User deleted' });
}));

export default router;
