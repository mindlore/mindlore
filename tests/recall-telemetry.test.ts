import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { ensureSchemaTable, runMigrations } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS, V051_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';

describe('Recall Telemetry', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-recall-'));
    dbPath = path.join(tmpDir, 'mindlore.db');
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_hashes (path TEXT PRIMARY KEY, hash TEXT, last_indexed TEXT);
      CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(
        path, slug, description, type, category, title, content, tags, quality, date_captured, project
      );
    `);
    ensureSchemaTable(db);
    runMigrations(db, [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS]);
    db.exec(`
      INSERT INTO file_hashes (path, hash, last_indexed, recall_count, last_recalled_at)
      VALUES ('/test/file.md', 'abc123', '2026-01-01', 0, NULL);
    `);
    db.close();
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('incrementRecallCount should update recall_count and last_recalled_at', () => {
    const db = new Database(dbPath);
    const { incrementRecallCount } = require('../hooks/lib/mindlore-common.cjs');
    incrementRecallCount(db, '/test/file.md');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const row = db.prepare('SELECT recall_count, last_recalled_at FROM file_hashes WHERE path = ?').get('/test/file.md') as { recall_count: number; last_recalled_at: string | null };
    expect(row.recall_count).toBe(1);
    expect(row.last_recalled_at).toBeTruthy();
    incrementRecallCount(db, '/test/file.md');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown, narrowing to expected row shape
    const row2 = db.prepare('SELECT recall_count FROM file_hashes WHERE path = ?').get('/test/file.md') as { recall_count: number };
    expect(row2.recall_count).toBe(2);
    db.close();
  });

  test('incrementRecallCount should not error on missing path', () => {
    const db = new Database(dbPath);
    const { incrementRecallCount } = require('../hooks/lib/mindlore-common.cjs');
    expect(() => incrementRecallCount(db, '/nonexistent.md')).not.toThrow();
    db.close();
  });
});
