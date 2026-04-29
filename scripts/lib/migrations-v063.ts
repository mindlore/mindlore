import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const SQL_FTS_TRIGRAM_CREATE =
  "CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_trigram USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED, tokenize='trigram')";

export const SQL_VOCABULARY_CREATE =
  "CREATE TABLE IF NOT EXISTS vocabulary (word TEXT PRIMARY KEY) WITHOUT ROWID";

export const V063_MIGRATIONS: Migration[] = [
  {
    version: 10,
    name: 'fts_trigram_table',
    up: (db: Database) => {
      db.exec(SQL_FTS_TRIGRAM_CREATE);
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
];
