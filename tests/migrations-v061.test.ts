import Database from 'better-sqlite3';
import { V061_MIGRATIONS } from '../scripts/lib/migrations-v061.js';
import { ensureSchemaTable, runMigrations, getSchemaVersion } from '../scripts/lib/schema-version.js';
import { V050_MIGRATIONS, V051_MIGRATIONS } from '../scripts/lib/migrations.js';
import { V052_MIGRATIONS } from '../scripts/lib/migrations-v052.js';
import { V053_MIGRATIONS } from '../scripts/lib/migrations-v053.js';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE VIRTUAL TABLE mindlore_fts USING fts5(
      path, slug, description, type, category, title, content, tags,
      quality, date_captured, project
    );
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY, content_hash TEXT, last_indexed TEXT,
      recall_count INTEGER DEFAULT 0, last_recalled_at TEXT,
      archived_at TEXT, importance REAL DEFAULT 1.0
    );
  `);
  ensureSchemaTable(db);
  const allPrior = [...V050_MIGRATIONS, ...V051_MIGRATIONS, ...V052_MIGRATIONS, ...V053_MIGRATIONS];
  runMigrations(db, allPrior);
  return db;
}

describe('migrations-v061 step 2: table split', () => {
  it('moves cc-subagent and cc-session rows to sessions table', () => {
    const db = setupDb();
    db.prepare(
      "INSERT INTO mindlore_fts (path, slug, type, category, project) VALUES (?, ?, ?, ?, ?)"
    ).run('/source.md', 'src', 'source', 'sources', 'mindlore');
    db.prepare(
      "INSERT INTO mindlore_fts (path, slug, type, category, project) VALUES (?, ?, ?, ?, ?)"
    ).run('/sub1.md', 'sub1', 'cc-subagent', 'cc-subagent', 'mindlore');
    db.prepare(
      "INSERT INTO mindlore_fts (path, slug, type, category, project) VALUES (?, ?, ?, ?, ?)"
    ).run('/sess1.md', 'sess1', 'cc-session', 'cc-session', 'mindlore');

    runMigrations(db, V061_MIGRATIONS);

    expect(getSchemaVersion(db)).toBe(7);

    const knowledge = db.prepare("SELECT * FROM mindlore_fts").all();
    expect(knowledge).toHaveLength(1);
    expect((knowledge[0] as {category: string}).category).toBe('sources');

    const sessions = db.prepare("SELECT * FROM mindlore_fts_sessions").all();
    expect(sessions).toHaveLength(2);

    db.close();
  });

  it('adds table_target column to file_hashes', () => {
    const db = setupDb();
    runMigrations(db, V061_MIGRATIONS);
    const cols = db.pragma('table_info(file_hashes)') as Array<{name: string}>;
    expect(cols.map(c => c.name)).toContain('table_target');
    db.close();
  });
});

describe('migrations-v061 step 1: cleanup', () => {
  it('normalizes dirty project values', () => {
    const db = setupDb();
    db.prepare(
      "INSERT INTO mindlore_fts (path, slug, type, category, project) VALUES (?, ?, ?, ?, ?)"
    ).run('/test.md', 'test', 'source', 'sources', '.mindlore');
    db.prepare(
      "INSERT INTO mindlore_fts (path, slug, type, category, project) VALUES (?, ?, ?, ?, ?)"
    ).run('/test2.md', 'test2', 'source', 'sources', 'C--Users-Omrfc');

    runMigrations(db, V061_MIGRATIONS.slice(0, 1));

    expect(getSchemaVersion(db)).toBe(6);
    const rows = db.prepare("SELECT project FROM mindlore_fts").all() as Array<{project: string}>;
    for (const row of rows) {
      expect(row.project).not.toMatch(/^\.mindlore|^C--/);
    }
    db.close();
  });
});
