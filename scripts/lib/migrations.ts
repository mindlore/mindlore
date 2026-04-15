import type { Migration } from './schema-version.js';
import { EMBEDDING_DIM_CONST, VEC_TABLE_NAME } from './constants.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V050_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'add_vec_table_and_timestamps',
    up: (db: Database) => {
      // 1. Create vec table (requires sqlite-vec loaded)
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ${VEC_TABLE_NAME} USING vec0(
          embedding float[${EMBEDDING_DIM_CONST}],
          slug text,
          +created_at text,
          +model_name text
        )
      `);

      // 2. Add timestamp columns to file_hashes
      // (FTS5 virtual tables can't be altered — timestamps go in file_hashes)
      const cols = db.pragma('table_info(file_hashes)') as Array<{ name: string }>;
      const colNames = new Set(cols.map(c => c.name));

      if (!colNames.has('created_at')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN created_at TEXT');
      }
      if (!colNames.has('updated_at')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN updated_at TEXT');
      }
    },
  },
];
