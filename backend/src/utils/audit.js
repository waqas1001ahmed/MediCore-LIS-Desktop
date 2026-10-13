import { recordMongoAudit } from '../db/identity.js';

export async function recordAudit(options) {
  return recordMongoAudit(options);
}

export async function runAuditQuery() {
  const { identityCollectionsForUse } = await import('../db/identity.js');
  const collections = await identityCollectionsForUse();
  return collections.auditLogs.find({}).sort({ id: -1 }).toArray();
}
