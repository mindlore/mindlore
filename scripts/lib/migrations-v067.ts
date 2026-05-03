import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function cleanupExpiredInjectLog(db: Database, ttlMs: number = THIRTY_DAYS_MS): number {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const result = db.prepare('DELETE FROM episode_inject_log WHERE injected_at < ?').run(cutoff);
  return result.changes;
}

export const V067_MIGRATIONS: Migration[] = [
  {
    version: 15,
    name: 'episodes_graduation_columns',
    up: (db: Database) => {
      db.exec("ALTER TABLE episodes ADD COLUMN graduated_at TEXT");
      db.exec("ALTER TABLE episodes ADD COLUMN rejected_at TEXT");
      db.exec("ALTER TABLE episodes ADD COLUMN rejection_reason TEXT");
    },
  },
  {
    version: 16,
    name: 'episode_inject_log_integer_fix',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE episode_inject_log_new (
          session_id TEXT NOT NULL,
          episode_id INTEGER NOT NULL,
          injected_at TEXT NOT NULL,
          PRIMARY KEY (session_id, episode_id)
        )
      `);
      db.exec(`
        INSERT INTO episode_inject_log_new (session_id, episode_id, injected_at)
        SELECT session_id, CAST(episode_id AS INTEGER), injected_at
        FROM episode_inject_log
      `);
      db.exec('DROP TABLE episode_inject_log');
      db.exec('ALTER TABLE episode_inject_log_new RENAME TO episode_inject_log');
    },
  },
  {
    version: 17,
    name: 'episode_inject_log_ttl',
    up: (db: Database) => {
      cleanupExpiredInjectLog(db);
    },
  },
];
