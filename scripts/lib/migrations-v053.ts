import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V053_MIGRATIONS: Migration[] = [
  {
    version: 4,
    name: 'add_recall_telemetry_and_decay',
    up: (db: Database) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pragma returns array of objects
      const cols = db.pragma('table_info(file_hashes)') as Array<{ name: string }>;
      const colNames = new Set(cols.map(c => c.name));

      if (!colNames.has('recall_count')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN recall_count INTEGER DEFAULT 0');
      }
      if (!colNames.has('last_recalled_at')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN last_recalled_at TEXT');
      }
      if (!colNames.has('archived_at')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN archived_at TEXT');
      }
      if (!colNames.has('importance')) {
        db.exec('ALTER TABLE file_hashes ADD COLUMN importance REAL DEFAULT 1.0');
      }
    },
  },
  {
    version: 5,
    name: 'add_episode_consolidation',
    up: (db: Database) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
      const table = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='episodes'"
      ).get() as { name: string } | undefined;
      if (!table) return;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pragma returns array of objects
      const cols = db.pragma('table_info(episodes)') as Array<{ name: string }>;
      const colNames = new Set(cols.map(c => c.name));

      if (!colNames.has('consolidation_status')) {
        db.exec("ALTER TABLE episodes ADD COLUMN consolidation_status TEXT DEFAULT 'raw'");
      }
      if (!colNames.has('consolidated_into')) {
        db.exec('ALTER TABLE episodes ADD COLUMN consolidated_into TEXT');
      }
      if (!colNames.has('decay_score')) {
        db.exec('ALTER TABLE episodes ADD COLUMN decay_score REAL');
      }
      if (!colNames.has('last_decay_calc')) {
        db.exec('ALTER TABLE episodes ADD COLUMN last_decay_calc TEXT');
      }
    },
  },
];
