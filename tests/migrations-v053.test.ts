import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runMigrations, ensureSchemaTable } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS, V051_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';

const ALL_MIGRATIONS = [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS];

const { SQL_FTS_CREATE }: { SQL_FTS_CREATE: string } = require('../hooks/lib/mindlore-common.cjs');

function createBaseDb(dbPath: string): Database.Database {
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
  ensureSchemaTable(db);
  return db;
}

function addEpisodesTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      summary TEXT NOT NULL,
      project TEXT,
      tags TEXT,
      quality REAL DEFAULT 0.5
    );
  `);
}

describe('v0.5.3 Migrations', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-v053-'));
    dbPath = path.join(tmpDir, 'test.db');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('v4 should add recall_count and last_recalled_at to file_hashes', () => {
    const db = createBaseDb(dbPath);
    runMigrations(db, ALL_MIGRATIONS);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: pragma returns array of objects
    const cols = db.pragma('table_info(file_hashes)') as Array<{ name: string }>;
    const colNames = cols.map(c => c.name);

    expect(colNames).toContain('recall_count');
    expect(colNames).toContain('last_recalled_at');
    expect(colNames).toContain('archived_at');
    expect(colNames).toContain('importance');

    db.close();
  });

  test('v5 should add consolidation columns to episodes', () => {
    const db = createBaseDb(dbPath);
    addEpisodesTable(db);
    runMigrations(db, ALL_MIGRATIONS);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: pragma returns array of objects
    const cols = db.pragma('table_info(episodes)') as Array<{ name: string }>;
    const colNames = cols.map(c => c.name);

    expect(colNames).toContain('consolidation_status');
    expect(colNames).toContain('consolidated_into');
    expect(colNames).toContain('decay_score');
    expect(colNames).toContain('last_decay_calc');

    db.close();
  });

  test('v4+v5 should not corrupt existing data (backward compat)', () => {
    const db = createBaseDb(dbPath);
    addEpisodesTable(db);

    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run('/test/file.md', 'abc123', now);
    db.prepare(
      'INSERT INTO episodes (session_id, timestamp, summary, project) VALUES (?, ?, ?, ?)'
    ).run('sess-1', now, 'Test episode summary', 'mindlore');

    runMigrations(db, ALL_MIGRATIONS);

    // Verify existing file_hashes row intact + new column defaults
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: better-sqlite3 .get() returns unknown
    const fhRow = db.prepare('SELECT * FROM file_hashes WHERE path = ?').get('/test/file.md') as Record<string, unknown>;
    expect(fhRow.content_hash).toBe('abc123');
    expect(fhRow.recall_count).toBe(0);
    expect(fhRow.importance).toBe(1.0);
    expect(fhRow.last_recalled_at).toBeNull();
    expect(fhRow.archived_at).toBeNull();

    // Verify existing episodes row intact + new column defaults
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: better-sqlite3 .get() returns unknown
    const epRow = db.prepare('SELECT * FROM episodes WHERE session_id = ?').get('sess-1') as Record<string, unknown>;
    expect(epRow.summary).toBe('Test episode summary');
    expect(epRow.consolidation_status).toBe('raw');
    expect(epRow.consolidated_into).toBeNull();
    expect(epRow.decay_score).toBeNull();
    expect(epRow.last_decay_calc).toBeNull();

    db.close();
  });

  test('migrations should be idempotent', () => {
    const db = createBaseDb(dbPath);
    addEpisodesTable(db);

    expect(() => {
      runMigrations(db, ALL_MIGRATIONS);
      runMigrations(db, ALL_MIGRATIONS);
    }).not.toThrow();

    db.close();
  });
});
