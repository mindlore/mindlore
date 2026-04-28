import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { createTestDb } from './helpers/db.js';
import { ensureSchemaTable, runMigrations, getSchemaVersion } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V051_MIGRATIONS } from '../scripts/lib/migrations-v051.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';
import { V062_MIGRATIONS } from '../scripts/lib/migrations-v062.js';

const { ensureEpisodesTable: ensureEpisodesTableCjs }: {
  ensureEpisodesTable: (db: Database.Database) => void;
} = require('../hooks/lib/mindlore-common.cjs');

const PRE_MIGRATIONS = [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS];

describe('v0.6.2 migrations', () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig062-'));
    const dbPath = path.join(tmpDir, 'test.db');
    db = createTestDb(dbPath);
    ensureEpisodesTableCjs(db);
    ensureSchemaTable(db);
    runMigrations(db, PRE_MIGRATIONS);
  });

  afterEach(() => {
    try { db.close(); } catch { /* already closed */ }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates raw_metadata table', () => {
    runMigrations(db, V062_MIGRATIONS);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='raw_metadata'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('adds session_summary column to episodes', () => {
    runMigrations(db, V062_MIGRATIONS);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const cols = db.pragma('table_info(episodes)') as Array<{ name: string }>;
    expect(cols.some(c => c.name === 'session_summary')).toBe(true);
  });

  it('is idempotent', () => {
    runMigrations(db, V062_MIGRATIONS);
    runMigrations(db, V062_MIGRATIONS);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='raw_metadata'"
    ).all();
    expect(tables).toHaveLength(1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const cols = db.pragma('table_info(episodes)') as Array<{ name: string }>;
    expect(cols.some(c => c.name === 'session_summary')).toBe(true);
  });

  it('sets schema version to 9', () => {
    runMigrations(db, V062_MIGRATIONS);
    expect(getSchemaVersion(db)).toBe(9);
  });
});
