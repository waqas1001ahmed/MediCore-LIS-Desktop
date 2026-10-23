import { identityCollectionsForUse, nextIdentityId } from './identity.js';
import { formatStoredDate, now, parseStoredDate } from '../utils/time.js';

/**
 * Server-side session store.
 *
 * The API issues a stateless JWT, but every token also carries a `jti` that is
 * recorded here. A session row is the authority for "is this token still
 * valid", which makes sign-out, password changes and account deactivation
 * immediately effective instead of waiting for the JWT to expire.
 */

/** Returns true when the session is neither revoked nor past its expiry. */
export function isSessionActive(session, reference = new Date()) {
  if (!session) return false;
  if (session.revoked_at) return false;
  const expiresAt = parseStoredDate(session.expires_at);
  if (expiresAt && expiresAt.getTime() <= reference.getTime()) return false;
  return true;
}

/** Filters a session list down to the ones that are still usable. */
export function filterActiveSessions(sessions) {
  const reference = new Date();
  return (sessions || []).filter((session) => isSessionActive(session, reference));
}

export async function createSession({ userId, tokenId, ip = null, userAgent = null, expiresAt = null }) {
  const collections = await identityCollectionsForUse();
  const id = await nextIdentityId('sessions');
  const session = {
    id,
    user_id: userId,
    token_id: tokenId,
    ip,
    user_agent: userAgent,
    created_at: now(),
    // The expiry is always stored in the app's local `YYYY-MM-DD HH:MM:SS`
    // format so it can be compared with `parseStoredDate` later on.
    expires_at: expiresAt ? formatStoredDate(new Date(expiresAt)) : null,
    revoked_at: null,
  };
  await collections.sessions.insertOne(session);
  return session;
}

export async function findSession(tokenId) {
  if (!tokenId) return null;
  const collections = await identityCollectionsForUse();
  return collections.sessions.findOne({ token_id: tokenId });
}

export async function revokeSession(tokenId) {
  if (!tokenId) return 0;
  const collections = await identityCollectionsForUse();
  const result = await collections.sessions.updateMany(
    { token_id: tokenId, revoked_at: null },
    { $set: { revoked_at: now() } },
  );
  return result.modifiedCount || 0;
}

/** Revokes a single session by its numeric id. */
export async function revokeSessionById(sessionId) {
  const collections = await identityCollectionsForUse();
  const result = await collections.sessions.updateOne(
    { id: Number(sessionId), revoked_at: null },
    { $set: { revoked_at: now() } },
  );
  return result.modifiedCount || 0;
}

/** Revokes every session of a user, optionally keeping one session alive. */
export async function revokeUserSessions(userId, { exceptTokenId = null } = {}) {
  const collections = await identityCollectionsForUse();
  const filter = { user_id: userId, revoked_at: null };
  if (exceptTokenId) filter.token_id = { $ne: exceptTokenId };
  const result = await collections.sessions.updateMany(filter, { $set: { revoked_at: now() } });
  return result.modifiedCount || 0;
}

/** Lists the sessions of one user, newest first. */
export async function listUserSessions(userId) {
  const collections = await identityCollectionsForUse();
  return collections.sessions.find({ user_id: userId }).sort({ id: -1 }).toArray();
}

/** Lists the still usable sessions of one user, newest first. */
export async function listActiveUserSessions(userId) {
  return filterActiveSessions(await listUserSessions(userId));
}

/** Lists every session with the owning username resolved. */
export async function listAllSessions() {
  const collections = await identityCollectionsForUse();
  const rows = await collections.sessions.find({}).sort({ id: -1 }).limit(500).toArray();
  const users = await collections.users
    .find({ id: { $in: [...new Set(rows.map((row) => row.user_id))] } })
    .toArray();
  const byId = new Map(users.map((user) => [user.id, user]));
  return rows.map((row) => ({
    ...row,
    username: byId.get(row.user_id)?.username ?? null,
    full_name: byId.get(row.user_id)?.full_name ?? null,
  }));
}

/** Lists every session that is still usable, with the owning user resolved. */
export async function listAllActiveSessions() {
  return filterActiveSessions(await listAllSessions());
}

/**
 * Removes sessions that are no longer useful:
 * - sessions that expired more than a day ago, and
 * - sessions that were revoked more than a day ago.
 *
 * Revoked sessions are kept briefly so the admin audit trail still shows what
 * happened, but they must never be treated as active.
 */
export async function pruneExpiredSessions() {
  const collections = await identityCollectionsForUse();
  const cutoff = formatStoredDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const result = await collections.sessions.deleteMany({
    $or: [
      { expires_at: { $ne: null, $lt: cutoff } },
      { revoked_at: { $ne: null }, created_at: { $lt: cutoff } },
    ],
  });
  return result.deletedCount || 0;
}