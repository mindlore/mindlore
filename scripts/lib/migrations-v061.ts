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
];
