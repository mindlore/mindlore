import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { ensureSchemaTable, runMigrations } from '../../scripts/lib/schema-version.js';
import { V050_MIGRATIONS } from '../../scripts/lib/migrations.js';
import { V051_MIGRATIONS } from '../../scripts/lib/migrations-v051.js';
import { V052_MIGRATIONS } from '../../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../../scripts/lib/migrations-v053.js';
import { V062_MIGRATIONS } from '../../scripts/lib/migrations-v062.js';
import { V063_MIGRATIONS } from '../../scripts/lib/migrations-v063.js';
import { V066_MIGRATIONS } from '../../scripts/lib/migrations-v066.js';

// Hook'lar .cjs kalıyor — SQL constants'ları oradan import ediyoruz
const { SQL_FTS_CREATE, insertFtsRow, ensureEpisodesTable: ensureEpisodesTableCjs, parseFrontmatter: parseFrontmatterCjs, extractFtsMetadata: extractFtsMetadataCjs, resolveProject: resolveProjectCjs }: {
  SQL_FTS_CREATE: string;
  insertFtsRow: (db: Database.Database, entry: Record<string, unknown>) => void;
  ensureEpisodesTable: (db: Database.Database) => void;
  parseFrontmatter: (content: string) => { meta: Record<string, string>; body: string };
  extractFtsMetadata: (meta: Record<string, string>, body: string, filePath: string, baseDir: string) => { slug: string; description: string; type: string; category: string; title: string; tags: string; quality: string | null; dateCaptured: string | null; project: string | null };
  resolveProject: (ftsProject: string | null, filePath: string, cwdFallback: string) => string;
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
      last_indexed TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      source_type TEXT DEFAULT 'mindlore',
      project_scope TEXT,
      recall_count INTEGER DEFAULT 0,
      last_recalled_at TEXT,
      archived_at TEXT,
      importance REAL
    );
  `);
  return db;
}

export function createTestDbWithMigrations(dbPath: string): Database.Database {
  const db = createTestDb(dbPath);
  ensureEpisodesTableCjs(db);
  ensureSchemaTable(db);
  runMigrations(db, [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS, ...V062_MIGRATIONS, ...V063_MIGRATIONS, ...V066_MIGRATIONS]);
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

export function createEpisodesTestEnvWithMigrations(prefix: string): EpisodesTestEnv {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `mindlore-${prefix}-`));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = createTestDbWithMigrations(dbPath);
  return { db, tmpDir };
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

export const parseFrontmatter = parseFrontmatterCjs;
export const extractFtsMetadata = extractFtsMetadataCjs;
export const resolveProject = resolveProjectCjs;

export function insertVec(db: Database.Database, slug: string, embedding: Float32Array, model: string = 'test-model'): void {
  db.prepare('INSERT INTO documents_vec (slug, embedding, created_at, model_name) VALUES (?, ?, ?, ?)').run(
    slug,
    Buffer.from(embedding.buffer),
    new Date().toISOString(),
    model,
  );
}
