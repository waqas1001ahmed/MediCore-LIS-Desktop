import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function resolveFromRoot(target) {
  if (!target) return undefined;
  return path.isAbsolute(target) ? target : path.resolve(ROOT_DIR, target);
}

const isVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
const uploadDir = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : resolveFromRoot(process.env.UPLOAD_DIR || './uploads');
const staticDir = resolveFromRoot(process.env.STATIC_DIR);
const mongoUri = process.env.MONGODB_URI || '';
const mongoDatabase = process.env.MONGODB_DATABASE || 'MediCoreLIS';

if (!isVercel) fs.mkdirSync(uploadDir, { recursive: true });

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  isVercel,
  port: Number(process.env.PORT || 4000),
  uploadDir,
  staticDir,
  mongodb: {
    uri: mongoUri,
    database: mongoDatabase,
    configured: Boolean(mongoUri && mongoUri !== 'your_mongodb_connection_string_here'),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'insecure-development-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
    usedFallbackSecret: !process.env.JWT_SECRET,
  },
  sessions: {
    // Idle lifetime of a normal (non "remember me") session.
    ttlSeconds: Number(process.env.SESSION_TTL_SECONDS || 12 * 60 * 60),
    // Lifetime of a session created from the login screen's "remember me" option.
    rememberTtlSeconds: Number(process.env.SESSION_REMEMBER_TTL_SECONDS || 30 * 24 * 60 * 60),
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 2) * 1024 * 1024,
  defaults: {
    adminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123',
  },
  trustProxy: bool(process.env.TRUST_PROXY, true),
};

/**
 * Refuse to boot in production with the well-known development secret.
 *
 * A Vercel deployment that forgot to set JWT_SECRET would otherwise sign every
 * token with a value published in this repository, which would let anyone
 * forge an admin session. Failing fast is far safer than booting insecurely.
 */
if (config.isProduction && config.jwt.usedFallbackSecret) {
  throw new Error(
    'JWT_SECRET must be set in production. Refusing to start with the development fallback secret.',
  );
}
