import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V068_MIGRATIONS: Migration[] = [
  {
    version: 18,
    name: 'inject_log_injected_at_index',
    up: (db: Database) => {
      db.exec('CREATE INDEX IF NOT EXISTS idx_inject_log_injected_at ON episode_inject_log(injected_at)');
    },
  },
];
