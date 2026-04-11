'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { sha256, createTestDb, insertFts, setupTestDir, teardownTestDir } = require('./helpers/db.cjs');

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-dedup');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR);
  const db = createTestDb(DB_PATH);
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Content-Hash Dedup', () => {
  test('should index file and store hash', () => {
    const db = new Database(DB_PATH);

    const content = '# Test\n\nSome content here.';
    const hash = sha256(content);
    const filePath = path.join(TEST_DIR, 'test.md');

    insertFts(db, filePath, 'test-doc', 'Some content here', 'source', 'sources', 'Test', content);
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(filePath, hash, new Date().toISOString());

    const result = db
      .prepare('SELECT content_hash FROM file_hashes WHERE path = ?')
      .get(filePath);
    expect(result.content_hash).toBe(hash);

    db.close();
  });

  test('should skip re-index when content unchanged', () => {
    const db = new Database(DB_PATH);

    const content = '# Unchanged\n\nThis content does not change.';
    const hash = sha256(content);
    const filePath = path.join(TEST_DIR, 'unchanged.md');

    insertFts(db, filePath, 'unchanged-doc', 'This content does not change', 'source', 'sources', 'Unchanged', content);
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(filePath, hash, '2026-01-01T00:00:00Z');

    const existing = db
      .prepare('SELECT content_hash FROM file_hashes WHERE path = ?')
      .get(filePath);
    const newHash = sha256(content);

    expect(existing.content_hash).toBe(newHash);

    const count = db
      .prepare('SELECT count(*) as cnt FROM mindlore_fts WHERE path = ?')
      .get(filePath);
    expect(count.cnt).toBe(1);

    db.close();
  });

  test('should re-index when content changes', () => {
    const db = new Database(DB_PATH);

    const original = '# Original\n\nFirst version.';
    const modified = '# Modified\n\nSecond version with changes.';
    const filePath = path.join(TEST_DIR, 'changing.md');

    // Index original
    const originalHash = sha256(original);
    insertFts(db, filePath, 'changing-doc', 'First version', 'source', 'sources', 'Original', original);
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(filePath, originalHash, '2026-01-01T00:00:00Z');

    // Check modified content
    const modifiedHash = sha256(modified);
    const existing = db
      .prepare('SELECT content_hash FROM file_hashes WHERE path = ?')
      .get(filePath);

    expect(existing.content_hash).not.toBe(modifiedHash);

    // Perform re-index
    db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
    insertFts(db, filePath, 'changing-doc', 'Second version with changes', 'source', 'sources', 'Modified', modified);
    db.prepare(
      `UPDATE file_hashes SET content_hash = ?, last_indexed = ? WHERE path = ?`
    ).run(modifiedHash, new Date().toISOString(), filePath);

    const results = db
      .prepare('SELECT path FROM mindlore_fts WHERE mindlore_fts MATCH ?')
      .all('changes');
    expect(results).toHaveLength(1);

    db.close();
  });
});
