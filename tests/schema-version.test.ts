import path from 'path';
import Database from 'better-sqlite3';
import { setupTestDir, teardownTestDir, createTestDb } from './helpers/db.js';

const TEST_DIR = path.join(__dirname, '..', '.test-schema-version');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources']);
  const db = createTestDb(DB_PATH);
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Schema Version', () => {
  test('should create schema_versions table if missing', () => {
    const { ensureSchemaTable, getSchemaVersion } = require('../scripts/lib/schema-version.js');
    const db = new Database(DB_PATH);

    ensureSchemaTable(db);
    const version = getSchemaVersion(db);

    expect(version).toBe(0);
    db.close();
  });

  test('should set and get schema version', () => {
    const { ensureSchemaTable, setSchemaVersion, getSchemaVersion } = require('../scripts/lib/schema-version.js');
    const db = new Database(DB_PATH);

    ensureSchemaTable(db);
    setSchemaVersion(db, 1);

    expect(getSchemaVersion(db)).toBe(1);
    db.close();
  });

  test('should run migrations in order', () => {
    const { ensureSchemaTable, runMigrations, getSchemaVersion } = require('../scripts/lib/schema-version.js');
    const db = new Database(DB_PATH);

    ensureSchemaTable(db);

    const log: number[] = [];
    const migrations = [
      { version: 1, name: 'add_timestamps', up: (d: Database.Database) => { log.push(1); d.exec("SELECT 1"); } },
      { version: 2, name: 'add_vec_table', up: (d: Database.Database) => { log.push(2); d.exec("SELECT 1"); } },
    ];

    runMigrations(db, migrations);

    expect(getSchemaVersion(db)).toBe(2);
    expect(log).toEqual([1, 2]);
    db.close();
  });

  test('should skip already-applied migrations', () => {
    const { ensureSchemaTable, setSchemaVersion, runMigrations, getSchemaVersion } = require('../scripts/lib/schema-version.js');
    const db = new Database(DB_PATH);

    ensureSchemaTable(db);
    setSchemaVersion(db, 1);

    const log: number[] = [];
    const migrations = [
      { version: 1, name: 'add_timestamps', up: () => { log.push(1); } },
      { version: 2, name: 'add_vec_table', up: () => { log.push(2); } },
    ];

    runMigrations(db, migrations);

    expect(getSchemaVersion(db)).toBe(2);
    expect(log).toEqual([2]); // only migration 2 ran
    db.close();
  });
});

describe('v0.5.0 Migrations', () => {
  test('should create documents_vec table via migration', () => {
    const { ensureSchemaTable, runMigrations, getSchemaVersion } = require('../scripts/lib/schema-version.js');
    const { V050_MIGRATIONS } = require('../scripts/lib/migrations.js');
    const { loadSqliteVec } = require('../scripts/lib/db-helpers.js');
    const db = new Database(DB_PATH);

    loadSqliteVec(db);
    ensureSchemaTable(db);
    runMigrations(db, V050_MIGRATIONS);

    expect(getSchemaVersion(db)).toBe(1);

    // Verify vec table exists
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: better-sqlite3 .get() returns unknown
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents_vec'").get() as { name: string } | undefined;
    expect(row?.name).toBe('documents_vec');

    db.close();
  });

  test('should add created_at and updated_at to FTS metadata tracking', () => {
    const { ensureSchemaTable, runMigrations } = require('../scripts/lib/schema-version.js');
    const { V050_MIGRATIONS } = require('../scripts/lib/migrations.js');
    const { loadSqliteVec } = require('../scripts/lib/db-helpers.js');
    const db = new Database(DB_PATH);

    loadSqliteVec(db);
    ensureSchemaTable(db);
    runMigrations(db, V050_MIGRATIONS);

    // file_hashes should now have created_at column
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: pragma returns array of objects
    const info = db.pragma('table_info(file_hashes)') as Array<{ name: string }>;
    const colNames = info.map(c => c.name);
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');

    db.close();
  });
});
