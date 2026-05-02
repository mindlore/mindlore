import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const SQL_EPISODE_INJECT_LOG_CREATE =
  "CREATE TABLE IF NOT EXISTS episode_inject_log (session_id TEXT NOT NULL, episode_id TEXT NOT NULL, injected_at TEXT NOT NULL, PRIMARY KEY (session_id, episode_id))";

export const V066_MIGRATIONS: Migration[] = [
  {
    version: 14,
    name: 'episode_inject_log',
    up: (db: Database) => {
      db.exec(SQL_EPISODE_INJECT_LOG_CREATE);
    },
  },
];
