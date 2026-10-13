import express from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { recordMongoAudit, getRoleById, getRoleByName, getRoleWithPermissions, listRoles, nextIdentityId, identityCollectionsForUse, replaceRolePermissions, withIdentityTransaction } from '../db/identity.js';
import { now } from '../utils/time.js';
import { assert, requireFields } from '../utils/validate.js';
import { PERMISSIONS, MODULE_LABELS, ACTION_LABELS } from '../utils/permissions.js';

const router = express.Router();
router.use(authenticate);

router.get('/permissions', requirePermission('roles.view', 'roles.manage'), asyncHandler(async (req, res) => {
  const groups = {};
  for (const permission of PERMISSIONS) {
    groups[permission.module] ??= { module: permission.module, label: MODULE_LABELS[permission.module] || permission.module, permissions: [] };
    groups[permission.module].permissions.push({ code: permission.code, action: permission.action, actionLabel: ACTION_LABELS[permission.action] || permission.action, label: permission.label, description: permission.description });
  }
  res.json({ data: Object.values(groups) });
}));

router.get('/', requirePermission('roles.view', 'roles.manage', 'users.view'), asyncHandler(async (req, res) => {
  res.json({ data: await listRoles() });
}));

router.get('/:id', requirePermission('roles.view', 'roles.manage'), asyncHandler(async (req, res) => {
  const role = await getRoleById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  res.json({ data: await getRoleWithPermissions(role) });
}));

function validatePermissionCodes(codes) {
  if (codes === undefined) return null;
  assert(Array.isArray(codes), 'permissions must be an array of permission codes');
  const valid = new Set(PERMISSIONS.map((permission) => permission.code));
  const invalid = codes.filter((code) => !valid.has(code));
  assert(invalid.length === 0, `Unknown permission code(s): ${invalid.join(', ')}`);
  return [...new Set(codes)];
}

router.post('/', requirePermission('roles.manage'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'label']);
  const name = String(req.body.name).trim().toLowerCase().replace(/\s+/g, '_');
  assert(/^[a-z][a-z0-9_]{2,31}$/.test(name), 'Role key must be 3-32 lowercase characters (a-z, 0-9, _)');
  if (await getRoleByName(name)) throw ApiError.conflict('A role with that key already exists');
  const codes = validatePermissionCodes(req.body.permissions) || [];
  const id = await nextIdentityId('roles');
  const timestamp = now();
  await withIdentityTransaction(async (session) => {
    const collections = await identityCollectionsForUse();
    await collections.roles.insertOne({ id, name, label: req.body.label, description: req.body.description || null, is_system: 0, created_at: timestamp, updated_at: timestamp }, { session });
    await replaceRolePermissions(id, codes, session);
  });
  await recordMongoAudit({ req, action: 'create', module: 'roles', entity: 'role', entityId: id, description: `Created role "${req.body.label}"` });
  res.status(201).json({ data: await getRoleWithPermissions(await getRoleById(id)) });
}));

router.put('/:id', requirePermission('roles.manage'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const role = await getRoleById(id);
  if (!role) throw ApiError.notFound('Role not found');
  requireFields(req.body, ['label']);
  const codes = validatePermissionCodes(req.body.permissions);
  await withIdentityTransaction(async (session) => {
    const collections = await identityCollectionsForUse();
    await collections.roles.updateOne({ id }, { $set: { label: req.body.label, description: req.body.description ?? role.description, updated_at: now() } }, { session });
    if (codes) await replaceRolePermissions(id, codes, session);
  });
  await recordMongoAudit({ req, action: 'update', module: 'roles', entity: 'role', entityId: id, description: `Updated role "${req.body.label}"` });
  res.json({ data: await getRoleWithPermissions(await getRoleById(id)) });
}));

router.delete('/:id', requirePermission('roles.manage'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const role = await getRoleById(id);
  if (!role) throw ApiError.notFound('Role not found');
  assert(!role.is_system, 'Built-in system roles cannot be deleted');
  const collections = await identityCollectionsForUse();
  const users = await collections.users.countDocuments({ role_id: id });
  assert(users === 0, 'Reassign the users of this role before deleting it');
  await withIdentityTransaction(async (session) => {
    await collections.roles.deleteOne({ id }, { session });
    await collections.rolePermissions.deleteMany({ role_id: id }, { session });
  });
  await recordMongoAudit({ req, action: 'delete', module: 'roles', entity: 'role', entityId: id, description: `Deleted role "${role.label}"` });
  res.json({ message: 'Role deleted' });
}));

export default router;
