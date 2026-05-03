/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { createTestDbWithMigrations } from './helpers/db.js';
import { V068_MIGRATIONS } from '../scripts/lib/migrations-v068.js';
import { runMigrations } from '../scripts/lib/schema-version.js';

describe('V068 Migrations', () => {
  let db: Database.Database;
  const dbPath = path.join(os.tmpdir(), `mindlore-v068-test-${Date.now()}.db`);

  beforeEach(() => {
    db = createTestDbWithMigrations(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.unlinkSync(dbPath);
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
});
