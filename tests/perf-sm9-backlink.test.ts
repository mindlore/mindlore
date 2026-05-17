import { describe, test, expect } from '@jest/globals';
import Database from 'better-sqlite3';
import { ALL_MIGRATIONS } from '../scripts/lib/all-migrations';
import { getRelationsForSlugs } from '../scripts/lib/relation-helpers';

// SM-9 perf baseline: getRelationsForSlugs with 1000 slugs must complete in < 100ms
// Baseline captured 2026-05-17 on feature/v0.7.9-fix-cleanup-quality

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

describe('SM-9 perf baseline — getRelationsForSlugs(1000 slugs)', () => {
  test('1000 slugs complete in < 100ms', () => {
    const db = setupDb();
    const slugs: string[] = [];
    const insert = db.prepare(`INSERT INTO mindlore_fts (path, slug, content) VALUES (?, ?, '')`);
    const insertRel = db.prepare(`INSERT OR IGNORE INTO mindlore_relations (source_a, source_b, relation_type) VALUES (?, ?, ?)`);

    // Insert 1000 slugs with some relations between them
    db.transaction(() => {
      for (let i = 0; i < 1000; i++) {
        const slug = `doc-${i.toString().padStart(4, '0')}`;
        slugs.push(slug);
        insert.run(`${slug}.md`, slug);
      }
      // Insert ~200 relations (every 5th slug points to next)
      for (let i = 0; i < 1000; i += 5) {
        insertRel.run(slugs[i], slugs[(i + 1) % 1000], 'related');
      }
    })();

    const start = performance.now();
    const result = getRelationsForSlugs(db, slugs);
    const elapsed = performance.now() - start;

    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(100); // < 100ms
  });
});
