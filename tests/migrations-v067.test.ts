import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { ensureSchemaTable, runMigrations, getSchemaVersion } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS, V051_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';
import { V062_MIGRATIONS } from '../scripts/lib/migrations-v062.js';
import { V063_MIGRATIONS } from '../scripts/lib/migrations-v063.js';
import { V066_MIGRATIONS } from '../scripts/lib/migrations-v066.js';
import { V067_MIGRATIONS, cleanupExpiredInjectLog } from '../scripts/lib/migrations-v067.js';
import { createTestDb } from './helpers/db.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- require() returns any
const { ensureEpisodesTable } = require('../hooks/lib/mindlore-common.cjs') as {
  ensureEpisodesTable: (db: Database.Database) => void;
};

const PRE_V067_MIGRATIONS = [
  ...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS,
  ...V053_MIGRATIONS, ...V062_MIGRATIONS, ...V063_MIGRATIONS,
  ...V066_MIGRATIONS,
];

function setupPreV067Db(): { db: Database.Database; tmpDir: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig067-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = createTestDb(dbPath);
  ensureEpisodesTable(db);
  ensureSchemaTable(db);
  runMigrations(db, PRE_V067_MIGRATIONS);
  return { db, tmpDir };
}

let testDb: Database.Database;
let tmpDir: string;

beforeEach(() => {
  const env = setupPreV067Db();
  testDb = env.db;
  tmpDir = env.tmpDir;
});

afterEach(() => {
  testDb.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('v0.6.7 migrations', () => {
  it('starts at schema version 14 before v067 migrations', () => {
    expect(getSchemaVersion(testDb)).toBe(14);
  });

  describe('v15 — graduation columns', () => {
    it('adds graduated_at, rejected_at, rejection_reason to episodes', () => {
      runMigrations(testDb, V067_MIGRATIONS);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
      const cols = testDb.prepare("PRAGMA table_info('episodes')").all() as Array<{ name: string }>;
      const colNames = cols.map(c => c.name);
      expect(colNames).toContain('graduated_at');
      expect(colNames).toContain('rejected_at');
      expect(colNames).toContain('rejection_reason');
    });

    it('defaults are null', () => {
      runMigrations(testDb, V067_MIGRATIONS);
      testDb.prepare(
        "INSERT INTO episodes (id, kind, project, summary, created_at) VALUES ('e1', 'nomination', 'test', 'test nomination', '2026-05-02')"
      ).run();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const row = testDb.prepare("SELECT graduated_at, rejected_at, rejection_reason FROM episodes WHERE id = 'e1'").get() as Record<string, unknown>;
      expect(row.graduated_at).toBeNull();
      expect(row.rejected_at).toBeNull();
      expect(row.rejection_reason).toBeNull();
    });
  });

  describe('v16 — episode_inject_log INTEGER fix', () => {
    it('episode_id column is TEXT before migration', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
      const cols = testDb.prepare("PRAGMA table_info('episode_inject_log')").all() as Array<{ name: string; type: string }>;
      const epCol = cols.find(c => c.name === 'episode_id');
      expect(epCol?.type).toBe('TEXT');
    });

    it('episode_id column becomes INTEGER after migration', () => {
      testDb.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s1', '42', '2026-05-01')").run();
      runMigrations(testDb, V067_MIGRATIONS);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
      const cols = testDb.prepare("PRAGMA table_info('episode_inject_log')").all() as Array<{ name: string; type: string }>;
      const epCol = cols.find(c => c.name === 'episode_id');
      expect(epCol?.type).toBe('INTEGER');
    });

    it('preserves and converts TEXT data to INTEGER after migration', () => {
      testDb.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s1', '42', '2026-05-01')").run();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const before = testDb.prepare("SELECT typeof(episode_id) as t FROM episode_inject_log WHERE session_id = 's1'").get() as { t: string };
      expect(before.t).toBe('text');

      runMigrations(testDb, V067_MIGRATIONS);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const after = testDb.prepare("SELECT episode_id, typeof(episode_id) as t FROM episode_inject_log WHERE session_id = 's1'").get() as { episode_id: number; t: string };
      expect(after.episode_id).toBe(42);
      expect(after.t).toBe('integer');
    });
  });

  describe('v17 — inject log TTL cleanup', () => {
    it('cleanupExpiredInjectLog deletes rows older than 30 days', () => {
      runMigrations(testDb, V067_MIGRATIONS);
      const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const recent = new Date().toISOString();
      testDb.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?, ?, ?)").run('old-s', 1, old);
      testDb.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?, ?, ?)").run('new-s', 2, recent);
      const deleted = cleanupExpiredInjectLog(testDb);
      expect(deleted).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const remaining = testDb.prepare("SELECT COUNT(*) as cnt FROM episode_inject_log").get() as { cnt: number };
      expect(remaining.cnt).toBe(1);
    });
  });

  it('schema version reaches 17', () => {
    runMigrations(testDb, V067_MIGRATIONS);
    expect(getSchemaVersion(testDb)).toBe(17);
  });
});
