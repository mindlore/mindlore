import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import Database from 'better-sqlite3';

// Hook'lar .cjs kalıyor — SQL constants'ları oradan import ediyoruz
const { SQL_FTS_CREATE, insertFtsRow, ensureEpisodesTable: ensureEpisodesTableCjs }: {
  SQL_FTS_CREATE: string;
  insertFtsRow: (db: Database.Database, entry: Record<string, unknown>) => void;
  ensureEpisodesTable: (db: Database.Database) => void;
} = require('../../hooks/lib/mindlore-common.cjs');

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

export interface FtsEntry {
  [key: string]: string | null | undefined;
  path: string;
  slug?: string;
  description?: string;
  type?: string;
  category?: string;
  title?: string;
  content?: string;
  tags?: string;
  quality?: string | null;
  dateCaptured?: string | null;
  project?: string | null;
}

export function insertFts(db: Database.Database, entry: FtsEntry): void {
  insertFtsRow(db, entry);
}

export function createTestDbWithEpisodes(dbPath: string): Database.Database {
  const db = createTestDb(dbPath);
  ensureEpisodesTableCjs(db);
  return db;
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

export interface EpisodesTestEnv {
  db: Database.Database;
  tmpDir: string;
}

export function createEpisodesTestEnv(prefix: string): EpisodesTestEnv {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `mindlore-${prefix}-`));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = createTestDbWithEpisodes(dbPath);
  return { db, tmpDir };
}

export function destroyEpisodesTestEnv(env: EpisodesTestEnv): void {
  env.db.close();
  fs.rmSync(env.tmpDir, { recursive: true, force: true });
}

export function createTestDbWithVec(dbPath: string): { db: Database.Database; vecLoaded: boolean } {
  const db = createTestDb(dbPath);
  let vecLoaded = false;
  try {
    const { loadSqliteVec, ensureVecTable }: {
      loadSqliteVec: (db: Database.Database) => boolean;
      ensureVecTable: (db: Database.Database) => boolean;
    } = require('../../scripts/lib/db-helpers.js');
    vecLoaded = loadSqliteVec(db);
    if (vecLoaded) ensureVecTable(db);
  } catch (_err) {
    // sqlite-vec not available
  }
  return { db, vecLoaded };
}

export function insertVec(db: Database.Database, slug: string, embedding: Float32Array, model: string = 'test-model'): void {
  db.prepare('INSERT INTO documents_vec (slug, embedding, created_at, model_name) VALUES (?, ?, ?, ?)').run(
    slug,
    Buffer.from(embedding.buffer),
    new Date().toISOString(),
    model,
  );
}
