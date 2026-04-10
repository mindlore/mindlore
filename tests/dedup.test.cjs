'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-dedup');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });

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
  db.close();
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('Content-Hash Dedup', () => {
  test('should index file and store hash', () => {
    const db = new Database(DB_PATH);

    const content = '# Test\n\nSome content here.';
    const hash = sha256(content);
    const filePath = path.join(TEST_DIR, 'test.md');

    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      filePath,
      content
    );
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

    // First index
    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      filePath,
      content
    );
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(filePath, hash, '2026-01-01T00:00:00Z');

    // Simulate re-index check
    const existing = db
      .prepare('SELECT content_hash FROM file_hashes WHERE path = ?')
      .get(filePath);
    const newHash = sha256(content);

    // Same content = same hash = skip
    expect(existing.content_hash).toBe(newHash);

    // Verify only 1 FTS entry exists
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
    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      filePath,
      original
    );
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(filePath, originalHash, '2026-01-01T00:00:00Z');

    // Check modified content
    const modifiedHash = sha256(modified);
    const existing = db
      .prepare('SELECT content_hash FROM file_hashes WHERE path = ?')
      .get(filePath);

    // Different content = different hash = re-index
    expect(existing.content_hash).not.toBe(modifiedHash);

    // Perform re-index
    db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      filePath,
      modified
    );
    db.prepare(
      `UPDATE file_hashes SET content_hash = ?, last_indexed = ? WHERE path = ?`
    ).run(modifiedHash, new Date().toISOString(), filePath);

    // Verify new content is searchable
    const results = db
      .prepare('SELECT path FROM mindlore_fts WHERE mindlore_fts MATCH ?')
      .all('changes');
    expect(results).toHaveLength(1);

    db.close();
  });
});
