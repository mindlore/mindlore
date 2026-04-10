'use strict';

/**
 * Compounding test — v0.2 integration test
 *
 * Tests the full cycle: query → writeback → reindex → next query finds it.
 * Skipped in v0.1 (configured in jest.config.cjs testPathIgnorePatterns).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-compounding');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function setupDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts
    USING fts5(path, content, tokenize='unicode61');
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_hashes (
      path TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      last_indexed TEXT NOT NULL
    );
  `);
  return db;
}

beforeEach(() => {
  fs.mkdirSync(path.join(TEST_DIR, 'sources'), { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'insights'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Knowledge Compounding', () => {
  test('writeback → reindex → query should find the new content', () => {
    const db = setupDb();

    // Step 1: Index an existing source
    const sourcePath = path.join(TEST_DIR, 'sources', 'react-hooks.md');
    const sourceContent = '---\nslug: react-hooks\ntype: source\n---\n# React Hooks\n\nUseEffect cleanup patterns.';
    fs.writeFileSync(sourcePath, sourceContent);

    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      sourcePath,
      sourceContent
    );
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(sourcePath, sha256(sourceContent), new Date().toISOString());

    // Step 2: Simulate query → writeback (agent creates an insight)
    const insightPath = path.join(TEST_DIR, 'insights', 'react-cleanup.md');
    const insightContent =
      '---\nslug: react-cleanup\ntype: insight\n---\n# React Cleanup Pattern\n\nAlways return cleanup function from useEffect to avoid memory leaks.';
    fs.writeFileSync(insightPath, insightContent);

    // Step 3: Reindex (simulates the hook)
    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      insightPath,
      insightContent
    );
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(insightPath, sha256(insightContent), new Date().toISOString());

    // Step 4: Next query should find the writeback content
    const results = db
      .prepare(
        `SELECT path FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`
      )
      .all('memory leaks cleanup');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.path.includes('react-cleanup'))).toBe(true);

    db.close();
  });
});
