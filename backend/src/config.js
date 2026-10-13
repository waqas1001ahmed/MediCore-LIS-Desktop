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
    usedFallbackSecret: !process.env.JWT_SECRET,
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
