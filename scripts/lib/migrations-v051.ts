import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V051_MIGRATIONS: Migration[] = [
  {
    version: 2,
    name: 'add_source_type_and_project_scope',
    up: (db: Database) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pragma returns array of objects
      const cols = db.pragma('table_info(file_hashes)') as Array<{ name: string }>;
      const colNames = new Set(cols.map(c => c.name));

      if (!colNames.has('source_type')) {
        db.exec("ALTER TABLE file_hashes ADD COLUMN source_type TEXT DEFAULT 'mindlore'");
      }
      if (!colNames.has('project_scope')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN project_scope TEXT');
      }
      if (!colNames.has('content_hash')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN content_hash TEXT');
      }
    },
  },
];
