import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const SQL_FTS_TRIGRAM_CREATE =
  "CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_trigram USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED, tokenize='trigram')";

export const SQL_VOCABULARY_CREATE =
  "CREATE TABLE IF NOT EXISTS vocabulary (word TEXT PRIMARY KEY) WITHOUT ROWID";

export const SQL_SEARCH_CACHE_CREATE =
  "CREATE TABLE IF NOT EXISTS search_cache (query_hash TEXT PRIMARY KEY, results_json TEXT NOT NULL, expires_at TEXT NOT NULL)";

export const SQL_SEARCH_THROTTLE_CREATE =
  "CREATE TABLE IF NOT EXISTS search_throttle (session_id TEXT PRIMARY KEY, call_count INTEGER NOT NULL DEFAULT 0, last_call TEXT NOT NULL)";

export const V063_MIGRATIONS: Migration[] = [
  {
    version: 10,
    name: 'fts_trigram_table',
    up: (db: Database) => {
      db.exec(SQL_FTS_TRIGRAM_CREATE);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const porterCount = (db.prepare('SELECT COUNT(*) as c FROM mindlore_fts').get() as { c: number }).c;
      if (porterCount > 0) {
        db.exec(`
          INSERT INTO mindlore_fts_trigram(path, slug, description, type, category, title, content, tags, quality, date_captured, project)
          SELECT path, slug, description, type, category, title, content, tags, quality, date_captured, project
          FROM mindlore_fts
        `);
      }
    },
  },
  {
    version: 11,
    name: 'vocabulary_table',
    up: (db: Database) => {
      db.exec(SQL_VOCABULARY_CREATE);
    },
  },
  {
    version: 12,
    name: 'chunks_table',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS chunks (
          id INTEGER PRIMARY KEY,
          source_path TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          heading TEXT,
          breadcrumb TEXT,
          char_count INTEGER,
          UNIQUE(source_path, chunk_index)
        )
      `);
    },
  },
  {
    version: 13,
    name: 'search_cache_tables',
    up: (db: Database) => {
      db.exec(SQL_SEARCH_CACHE_CREATE);
      db.exec(SQL_SEARCH_THROTTLE_CREATE);
    },
  },
];
