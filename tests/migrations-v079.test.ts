import { describe, test, expect } from '@jest/globals';
import Database from 'better-sqlite3';
import { ALL_MIGRATIONS } from '../scripts/lib/all-migrations';

function setupBaseTables(db: Database.Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(
      path UNINDEXED, slug, description, type UNINDEXED, category,
      title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED,
      tokenize='porter unicode61'
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      last_indexed TEXT NOT NULL
    );
  `);
  db.exec(`CREATE TABLE IF NOT EXISTS episodes (
    session_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    project TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0
  );`);
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS mindlore_relations (
      source_a TEXT NOT NULL,
      source_b TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      created_at TEXT,
      PRIMARY KEY (source_a, source_b, relation_type)
    );
  `);
}

describe('Migration v22 — file_hashes.slug column (SM-7)', () => {
  test('v22 migration adds slug column with index', () => {
    const db = new Database(':memory:');
    setupBaseTables(db);
    for (const mig of ALL_MIGRATIONS) mig.up(db);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
    const cols = db.prepare(`PRAGMA table_info(file_hashes)`).all() as Array<{name: string}>;
    expect(cols.map(c => c.name)).toContain('slug');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
    const indexes = db.prepare(`PRAGMA index_list(file_hashes)`).all() as Array<{name: string}>;
    expect(indexes.map(i => i.name)).toContain('idx_file_hashes_slug');
  });

  test('backfill derives slug from path', () => {
    const db = new Database(':memory:');
    setupBaseTables(db);
    // Apply migrations except v22
    for (const mig of ALL_MIGRATIONS.filter(m => m.version < 22)) mig.up(db);
    // Insert pre-v22 row
    db.prepare(`INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)`).run(
      'raw/sessions/test-2026-05-17.md', 'abc123', '2026-05-17T00:00:00Z'
    );
    // Apply v22
    const v22 = ALL_MIGRATIONS.find(m => m.version === 22);
    expect(v22).toBeDefined();
    v22!.up(db);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare(`SELECT slug FROM file_hashes WHERE path = ?`).get(
      'raw/sessions/test-2026-05-17.md'
    ) as {slug: string};
    expect(row.slug).toBe('test-2026-05-17');
  });
});
