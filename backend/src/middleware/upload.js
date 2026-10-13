import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { put } from '@vercel/blob';
import multer from 'multer';
import { config } from '../config.js';

const ALLOWED = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
]);

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only PNG, JPEG, WEBP or SVG images are allowed'));
      return;
    }
    cb(null, true);
  },
});

export async function storeUploadedImage(file) {
  const extension = ALLOWED.get(file.mimetype);
  const filename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;

  if (config.isVercel) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required to upload images on Vercel.');
    }

    const blob = await put(`logos/${filename}`, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    return blob.url;
  }

  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadDir, filename), file.buffer, { flag: 'wx' });
  return `/uploads/${filename}`;
}
