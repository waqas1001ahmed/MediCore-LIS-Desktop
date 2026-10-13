export const db = null;

export function transaction() {
  throw new Error('SQLite support has been removed. This project now uses MongoDB only.');
}

export function all() {
  throw new Error('SQLite support has been removed. This project now uses MongoDB only.');
}

export function get() {
  throw new Error('SQLite support has been removed. This project now uses MongoDB only.');
}

export function run() {
  throw new Error('SQLite support has been removed. This project now uses MongoDB only.');
}

export function closeDatabase() {
  // No-op: MongoDB is the only supported database backend.
}
