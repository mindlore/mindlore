import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V072_MIGRATIONS: Migration[] = [
  {
    version: 20,
    name: 'create_mindlore_relations',
    up: (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mindlore_relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_a TEXT NOT NULL,
          source_b TEXT NOT NULL,
          relation_type TEXT NOT NULL CHECK(relation_type IN ('cites', 'extends', 'contradicts', 'supersedes')),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
          UNIQUE(source_a, source_b, relation_type)
        );
        CREATE INDEX IF NOT EXISTS idx_relations_source_a ON mindlore_relations(source_a);
        CREATE INDEX IF NOT EXISTS idx_relations_source_b ON mindlore_relations(source_b);
        CREATE INDEX IF NOT EXISTS idx_relations_type ON mindlore_relations(relation_type);
      `);
    },
  },
];
