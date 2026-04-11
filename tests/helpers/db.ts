import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';

// Hook'lar .cjs kalıyor — SQL constants'ları oradan import ediyoruz
 
const { SQL_FTS_CREATE, SQL_FTS_INSERT } = require('../../hooks/lib/mindlore-common.cjs') as {
  SQL_FTS_CREATE: string;
  SQL_FTS_INSERT: string;
};

export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function createTestDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SQL_FTS_CREATE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      last_indexed TEXT NOT NULL
    );
  `);
  return db;
}

export function insertFts(
  db: Database.Database,
  filePath: string,
  slug: string,
  description: string,
  type: string,
  category: string,
  title: string,
  content: string,
  tags: string,
  quality: string | null,
): void {
  db.prepare(SQL_FTS_INSERT).run(
    filePath,
    slug || '',
    description || '',
    type || '',
    category || '',
    title || '',
    content || '',
    tags || '',
    quality || null,
  );
}

export function setupTestDir(testDir: string, subdirs?: string[]): void {
  const dirs = subdirs ?? [];
  fs.mkdirSync(testDir, { recursive: true });
  for (const sub of dirs) {
    fs.mkdirSync(path.join(testDir, sub), { recursive: true });
  }
}

export function teardownTestDir(testDir: string): void {
  fs.rmSync(testDir, { recursive: true, force: true });
}
