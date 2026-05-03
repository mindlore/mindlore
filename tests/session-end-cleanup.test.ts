import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { ensureSchemaTable, runMigrations } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V051_MIGRATIONS } from '../scripts/lib/migrations-v051.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';
import { V066_MIGRATIONS } from '../scripts/lib/migrations-v066.js';
import { V067_MIGRATIONS } from '../scripts/lib/migrations-v067.js';

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- require() returns any
const { cleanupExpiredInjectLog, ensureEpisodesTable } = require('../hooks/lib/mindlore-common.cjs') as {
  cleanupExpiredInjectLog: (db: Database.Database, ttlMs?: number) => number;
  ensureEpisodesTable: (db: Database.Database) => void;
};

describe('session-end R4 — TTL cleanup integration', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-r4-'));
    const dbPath = path.join(tmpDir, 'mindlore.db');
    db = new Database(dbPath);
    db.exec('CREATE TABLE IF NOT EXISTS file_hashes (path TEXT PRIMARY KEY, hash TEXT, last_indexed TEXT)');
    db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(title, body, tags)');
    db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_sessions USING fts5(title, body)');
    ensureEpisodesTable(db);
    ensureSchemaTable(db);
    runMigrations(db, [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS]);
    for (let v = 9; v <= 13; v++) {
      db.prepare('INSERT OR IGNORE INTO schema_versions (version, name, applied_at) VALUES (?,?,?)').run(v, 'skip', new Date().toISOString());
    }
    runMigrations(db, [...V066_MIGRATIONS, ...V067_MIGRATIONS]);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes entries older than default 30 days', () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    db.prepare('INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?,?,?)').run('old-1', 1, oldDate);
    db.prepare('INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?,?,?)').run('old-2', 2, oldDate);
    db.prepare('INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?,?,?)').run('recent-1', 3, recentDate);

    const deleted = cleanupExpiredInjectLog(db);

    expect(deleted).toBe(2);
    const remaining = db.prepare('SELECT COUNT(*) as cnt FROM episode_inject_log').get() as { cnt: number };
    expect(remaining.cnt).toBe(1);
  });

  it('preserves all entries when none are expired', () => {
    const recentDate = new Date().toISOString();
    db.prepare('INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?,?,?)').run('s1', 1, recentDate);
    db.prepare('INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?,?,?)').run('s2', 2, recentDate);

    const deleted = cleanupExpiredInjectLog(db);

    expect(deleted).toBe(0);
    const remaining = db.prepare('SELECT COUNT(*) as cnt FROM episode_inject_log').get() as { cnt: number };
    expect(remaining.cnt).toBe(2);
  });

  it('respects custom TTL parameter', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?,?,?)').run('s1', 1, tenDaysAgo);

    const deletedWith30Day = cleanupExpiredInjectLog(db, 30 * 24 * 60 * 60 * 1000);
    expect(deletedWith30Day).toBe(0);

    const deletedWith7Day = cleanupExpiredInjectLog(db, 7 * 24 * 60 * 60 * 1000);
    expect(deletedWith7Day).toBe(1);
  });

  it('returns 0 when table is empty', () => {
    const deleted = cleanupExpiredInjectLog(db);
    expect(deleted).toBe(0);
  });
});
