import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V078_MIGRATIONS: Migration[] = [
  {
    version: 21,
    name: 'symmetric_relations_backfill',
    up: (db: Database) => {
      db.exec(`
        INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type, created_at)
        SELECT source_b, source_a, relation_type, created_at
        FROM mindlore_relations
        WHERE relation_type IN ('contradicts')
          AND source_a != source_b
      `);
    },
  },
];
