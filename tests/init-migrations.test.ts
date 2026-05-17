import { describe, test, expect } from '@jest/globals';
import Database from 'better-sqlite3';
import { INIT_MIGRATIONS, EXPECTED_SCHEMA_VERSION } from '../scripts/lib/all-migrations';

describe('INIT_MIGRATIONS — fresh install gap fix (RT-1)', () => {
  test('INIT_MIGRATIONS includes V050-V061 migrations', () => {
    const versions = INIT_MIGRATIONS.map(m => m.version).sort((a, b) => a - b);
    // Fresh install must cover all versions from 1 onwards
    expect(versions).toContain(1);  // V050 v1
    expect(versions).toContain(2);  // V050 v2 (if any)
    expect(versions[versions.length - 1]).toBe(EXPECTED_SCHEMA_VERSION);
  });

  test('fresh init creates file_hashes.recall_count column', () => {
    const db = new Database(':memory:');
    // Create base tables as init.ts would before migrations run
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
    // Apply init migrations
    for (const mig of INIT_MIGRATIONS) {
      mig.up(db);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown, narrowing to expected row shape
    const cols = db.prepare(`PRAGMA table_info(file_hashes)`).all() as Array<{name: string}>;
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('recall_count');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });
});
