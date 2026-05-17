import { describe, test, expect } from '@jest/globals';
import Database from 'better-sqlite3';
import { ALL_MIGRATIONS } from '../scripts/lib/all-migrations';
import { getRelationsForSlugs } from '../scripts/lib/relation-helpers';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
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
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);`);
  db.exec(`CREATE TABLE IF NOT EXISTS episodes (
    session_id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    project TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0
  );`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS mindlore_relations (
      source_a TEXT NOT NULL,
      source_b TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      created_at TEXT,
      PRIMARY KEY (source_a, source_b, relation_type)
    );
  `);
  for (const m of ALL_MIGRATIONS) m.up(db);
  return db;
}

describe('Backlink support — SM-9', () => {
  test('asymmetric relation produces backlink (incoming)', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_fts (path, slug, content) VALUES (?, ?, '')`).run('A.md', 'A');
    db.prepare(`INSERT INTO mindlore_fts (path, slug, content) VALUES (?, ?, '')`).run('B.md', 'B');
    db.prepare(`INSERT INTO mindlore_relations (source_a, source_b, relation_type) VALUES (?, ?, ?)`).run('A', 'B', 'supersedes');

    const result = getRelationsForSlugs(db, ['B']);
    const bRelations = result.get('B') ?? [];
    expect(bRelations).toContainEqual(expect.objectContaining({
      source: 'A',
      relation_type: 'supersedes',
      direction: 'incoming'
    }));
  });

  test('symmetric edge returns once despite v0.7.8 backfill', () => {
    const db = setupDb();
    db.prepare(`INSERT INTO mindlore_fts (path, slug, content) VALUES (?, ?, '')`).run('A.md', 'A');
    db.prepare(`INSERT INTO mindlore_fts (path, slug, content) VALUES (?, ?, '')`).run('B.md', 'B');
    // v0.7.8 backfill behavior — write both directions
    db.prepare(`INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type) VALUES (?, ?, ?)`).run('A', 'B', 'contradicts');
    db.prepare(`INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type) VALUES (?, ?, ?)`).run('B', 'A', 'contradicts');

    const result = getRelationsForSlugs(db, ['A']);
    const aRelations = result.get('A') ?? [];
    const relatedToB = aRelations.filter(r => r.source === 'B' && r.relation_type === 'contradicts');
    expect(relatedToB).toHaveLength(1);
  });
});
