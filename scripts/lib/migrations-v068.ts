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
  {
    version: 19,
    name: 'drop_dead_vec_tables',
    up: (db: Database) => {
      // Shadow tables must be dropped before the virtual table.
      // If sqlite-vec extension is not loaded, virtual table DROP fails silently
      // so we drop shadows first (regular tables), then attempt the virtual table.
      const shadowTables = [
        'documents_vec_info', 'documents_vec_chunks',
        'documents_vec_rowids', 'documents_vec_vector_chunks00',
        'documents_vec_metadatachunks00', 'documents_vec_metadatatext00',
        'documents_vec_auxiliary',
      ];
      for (const table of shadowTables) {
        db.exec(`DROP TABLE IF EXISTS "${table}"`);
      }
      // Virtual table (vec0) can't be dropped without the extension loaded.
      // Shadow tables hold all the data; orphan virtual table entry is harmless metadata.
      try { db.exec('DROP TABLE IF EXISTS documents_vec'); } catch { /* vec0 module not available */ }
    },
  },
];
