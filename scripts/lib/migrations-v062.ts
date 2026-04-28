import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V062_MIGRATIONS: Migration[] = [
  {
    version: 8,
    name: 'raw_metadata_table',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS raw_metadata (
          path TEXT PRIMARY KEY,
          title TEXT,
          url TEXT,
          date_captured TEXT,
          headings TEXT,
          file_size INTEGER,
          line_count INTEGER,
          extracted_at TEXT NOT NULL
        )
      `);
    },
  },
  {
    version: 9,
    name: 'episodes_session_summary',
    up: (db: Database) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pragma returns typed array
      const cols = db.pragma('table_info(episodes)') as Array<{ name: string }>;
      if (!cols.some(c => c.name === 'session_summary')) {
        db.exec("ALTER TABLE episodes ADD COLUMN session_summary TEXT");
      }
    },
  },
];
