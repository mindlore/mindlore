import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V052_MIGRATIONS: Migration[] = [
  {
    version: 3,
    name: 'add_skill_memory_table',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS skill_memory (
          id INTEGER PRIMARY KEY,
          skill_name TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          access_count INTEGER DEFAULT 0,
          UNIQUE(skill_name, key)
        )
      `);
    },
  },
];
