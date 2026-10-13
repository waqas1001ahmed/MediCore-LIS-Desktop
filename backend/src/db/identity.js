import { getMongoClient, getMongoDatabase } from './mongodb.js';
import { PERMISSIONS } from '../utils/permissions.js';

let initialized;

const ID_TABLES = ['users', 'roles', 'permissions', 'role_permissions', 'audit_logs'];

function identityCollections(database) {
  return {
    users: database.collection('users'),
    roles: database.collection('roles'),
    permissions: database.collection('permissions'),
    rolePermissions: database.collection('role_permissions'),
    sequences: database.collection('sequences'),
    auditLogs: database.collection('audit_logs'),
    sessions: database.collection('sessions'),
  };
}

export async function initializeIdentityStore() {
  if (initialized) return initialized;
  initialized = (async () => {
    const database = await getMongoDatabase();
    const collections = identityCollections(database);

    await collections.users.updateMany(
      { username_normalized: { $exists: false } },
      [{ $set: { username_normalized: { $toLower: '$username' } } }],
    );
    const indexes = [
      [collections.users, { username_normalized: 1 }, { unique: true, name: 'users_username_normalized_unique' }],
      [collections.roles, { name: 1 }, { unique: true, name: 'roles_name_unique' }],
      [collections.permissions, { code: 1 }, { unique: true, name: 'permissions_code_unique' }],
      [collections.rolePermissions, { role_id: 1, permission_id: 1 }, { unique: true, name: 'role_permissions_pair_unique' }],
      [collections.sequences, { name: 1, period: 1 }, { unique: true, name: 'sequences_name_period_unique' }],
    ];
    for (const [collection, keys, options] of indexes) {
      try { await collection.createIndex(keys, options); } catch (error) { if (![85, 86].includes(error.code)) throw error; }
    }

    for (const table of ID_TABLES) {
      const max = await database.collection(table).find().sort({ id: -1 }).limit(1).next();
      await collections.sequences.updateOne(
        { name: `id:${table}`, period: '' },
        { $setOnInsert: { value: Number(max?.id || 0) } },
        { upsert: true },
      );
    }
    return { database, collections };
  })();
  return initialized;
}

async function store() {
  return initializeIdentityStore();
}

export async function nextIdentityId(table, session = undefined) {
  const { collections } = await store();
  const result = await collections.sequences.findOneAndUpdate(
    { name: `id:${table}`, period: '' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after', session },
  );
  const sequence = result?.value && typeof result.value === 'object' ? result.value : result;
  return sequence?.value;
}

export async function withIdentityTransaction(callback) {
  const client = getMongoClient();
  if (!client) throw new Error('MongoDB client is not connected');
  const session = client.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function publicUser(user, role, permissions) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    designation: user.designation,
    signature_title: user.signature_title,
    role_id: user.role_id,
    role: role?.name ?? null,
    roleLabel: role?.label ?? null,
    is_active: !!user.is_active,
    must_change_password: !!user.must_change_password,
    last_login_at: user.last_login_at,
    created_at: user.created_at,
    permissions,
  };
}

export async function getUserById(id) {
  const { collections } = await store();
  return collections.users.findOne({ id: Number(id) });
}

export async function getUserByUsername(username) {
  const { collections } = await store();
  const normalized = String(username).trim().toLowerCase();
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return collections.users.findOne({
    $or: [
      { username_normalized: normalized },
      { username: { $regex: `^${escaped}$`, $options: 'i' } },
    ],
  });
}

export async function getPublicUserById(id) {
  const { collections } = await store();
  const user = await getUserById(id);
  if (!user) return null;
  const role = user.role_id === null || user.role_id === undefined
    ? null
    : await collections.roles.findOne({ id: user.role_id });
  const links = role ? await collections.rolePermissions.find({ role_id: role.id }).toArray() : [];
  const permissionIds = links.map((link) => link.permission_id);
  const permissionRows = permissionIds.length
    ? await collections.permissions.find({ id: { $in: permissionIds } }).sort({ code: 1 }).toArray()
    : [];
  return publicUser(user, role, permissionRows.map((permission) => permission.code));
}

export async function findUsers({ search, roleId, status, limit, offset }) {
  const { collections } = await store();
  const filter = {};
  if (search) {
    const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ username: regex }, { full_name: regex }, { email: regex }];
  }
  if (roleId) filter.role_id = Number(roleId);
  if (status === 'active') filter.is_active = 1;
  if (status === 'inactive') filter.is_active = 0;
  const [total, users] = await Promise.all([
    collections.users.countDocuments(filter),
    collections.users.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).toArray(),
  ]);
  const rows = await Promise.all(users.map(async (user) => {
    const role = user.role_id === null || user.role_id === undefined ? null : await collections.roles.findOne({ id: user.role_id });
    return {
      id: user.id, username: user.username, full_name: user.full_name, email: user.email, phone: user.phone,
      designation: user.designation, signature_title: user.signature_title, role_id: user.role_id,
      is_active: user.is_active, must_change_password: user.must_change_password, last_login_at: user.last_login_at,
      created_at: user.created_at, updated_at: user.updated_at, role: role?.name ?? null, role_label: role?.label ?? null,
    };
  }));
  return { total, rows };
}

export async function getRoleById(id) {
  const { collections } = await store();
  return collections.roles.findOne({ id: Number(id) });
}

export async function getRoleByName(name) {
  const { collections } = await store();
  return collections.roles.findOne({ name });
}

export async function getPermissionByCode(code) {
  const { collections } = await store();
  return collections.permissions.findOne({ code });
}

export async function getRoleWithPermissions(role) {
  const { collections } = await store();
  const links = await collections.rolePermissions.find({ role_id: role.id }).toArray();
  const permissionIds = links.map((link) => link.permission_id);
  const permissions = permissionIds.length
    ? await collections.permissions.find({ id: { $in: permissionIds } }).sort({ code: 1 }).toArray()
    : [];
  const userCount = await collections.users.countDocuments({ role_id: role.id });
  return { ...role, permissions: permissions.map((permission) => permission.code), user_count: userCount };
}

export async function listRoles() {
  const { collections } = await store();
  const roles = await collections.roles.find({}).sort({ is_system: -1, id: 1 }).toArray();
  return Promise.all(roles.map(getRoleWithPermissions));
}

export async function replaceRolePermissions(roleId, codes, session = undefined) {
  const { collections } = await store();
  const permissions = await collections.permissions.find({ code: { $in: codes } }).toArray();
  await collections.rolePermissions.deleteMany({ role_id: roleId }, { session });
  if (permissions.length) {
    await collections.rolePermissions.insertMany(
      permissions.map((permission) => ({ role_id: roleId, permission_id: permission.id })),
      { session, ordered: true },
    );
  }
}

export async function recordMongoAudit({ req, action, module, entity = null, entityId = null, description = null, meta = null, user = null }) {
  try {
    const { collections } = await store();
    const actor = user || req?.user || null;
    const id = await nextIdentityId('audit_logs');
    await collections.auditLogs.insertOne({
      id,
      user_id: actor?.id ?? null,
      username: actor?.username ?? 'system',
      action,
      module,
      entity,
      entity_id: entityId === null || entityId === undefined ? null : String(entityId),
      description,
      meta: meta === null || meta === undefined || typeof meta === 'string' ? meta : JSON.stringify(meta),
      ip: req?.ip ?? null,
      user_agent: req?.headers?.['user-agent'] ?? null,
      created_at: formatNow(),
    });
  } catch (error) {
    console.error('[mongo-audit] failed to persist entry:', error.message);
  }
}

export async function identityCollectionsForUse() {
  return (await store()).collections;
}

export { PERMISSIONS };

function formatNow(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
