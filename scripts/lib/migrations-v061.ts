import type { Migration } from './schema-version.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

export const V061_MIGRATIONS: Migration[] = [
  {
    version: 6,
    name: 'cleanup_project_category',
    up: (db: Database) => {
      db.exec(`
        UPDATE mindlore_fts SET project = 'unknown'
        WHERE project LIKE '.mindlore%' OR project LIKE 'C--%'
      `);
      db.exec(`
        UPDATE mindlore_fts SET category = 'cc-subagent'
        WHERE category IN ('subagent', 'cc_subagent')
      `);
      db.exec(`
        UPDATE mindlore_fts SET category = 'cc-session'
        WHERE category IN ('session', 'cc_session')
      `);
    },
  },
  {
    version: 7,
    name: 'split_fts_sessions',
    up: (db: Database) => {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts_sessions USING fts5(
          path, slug, description, type, category, title, content, tags,
          quality, date_captured, project
        )
      `);

      db.exec('BEGIN');
      try {
        db.exec(`
          INSERT INTO mindlore_fts_sessions (path, slug, description, type, category, title, content, tags, quality, date_captured, project)
          SELECT path, slug, description, type, category, title, content, tags, quality, date_captured, project
          FROM mindlore_fts
          WHERE category IN ('cc-subagent', 'cc-session')
        `);
        db.exec(`
          DELETE FROM mindlore_fts WHERE category IN ('cc-subagent', 'cc-session')
        `);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- pragma returns array of objects
      const cols = db.pragma('table_info(file_hashes)') as Array<{ name: string }>;
      if (!cols.some(c => c.name === 'table_target')) {
        db.exec("ALTER TABLE file_hashes ADD COLUMN table_target TEXT DEFAULT 'mindlore_fts'");
      }
    },
  },
];
