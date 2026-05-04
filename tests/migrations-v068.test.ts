/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createTestDbWithFullSchema } from './helpers/db.js';
import { V068_MIGRATIONS } from '../scripts/lib/migrations-v068.js';
import { runMigrations } from '../scripts/lib/schema-version.js';

describe('V068 Migrations', () => {
  let db: Database.Database;
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-v068-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    db = createTestDbWithFullSchema(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('v18: creates injected_at index', () => {
    runMigrations(db, V068_MIGRATIONS);
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='episode_inject_log'"
    ).all() as Array<{ name: string }>;
    expect(indexes.some(i => i.name === 'idx_inject_log_injected_at')).toBe(true);
  });

  test('v18: is idempotent', () => {
    runMigrations(db, V068_MIGRATIONS);
    expect(() => runMigrations(db, V068_MIGRATIONS)).not.toThrow();
  });

  test('v19: drops all documents_vec shadow tables', () => {
    // Reset schema version to before v19 so migration actually runs
    db.exec("DELETE FROM schema_versions WHERE version >= 19");
    const vecTables = [
      'documents_vec_info', 'documents_vec_chunks',
      'documents_vec_rowids', 'documents_vec_vector_chunks00',
      'documents_vec_metadatachunks00', 'documents_vec_metadatatext00',
      'documents_vec_auxiliary',
    ];
    for (const table of vecTables) {
      db.exec(`CREATE TABLE IF NOT EXISTS "${table}" (id INTEGER PRIMARY KEY)`);
    }
    runMigrations(db, V068_MIGRATIONS);
    const remaining = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'documents_vec%'"
    ).all() as Array<{ name: string }>;
    expect(remaining).toHaveLength(0);
  });

  test('v19: is idempotent (no tables to drop)', () => {
    runMigrations(db, V068_MIGRATIONS);
    expect(() => runMigrations(db, V068_MIGRATIONS)).not.toThrow();
  });
});
