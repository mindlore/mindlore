import path from 'path';
import Database from 'better-sqlite3';
import { sha256, createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db.js';
import { dbGet, dbAll } from '../scripts/lib/db-helpers.js';

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

    insertFts(db, { path: filePath, slug: 'test-doc', description: 'Some content here', type: 'source', category: 'sources', title: 'Test', content, tags: '', quality: null });
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)',
    ).run(filePath, hash, new Date().toISOString());

    const result = dbGet<{ content_hash: string }>(db, 'SELECT content_hash FROM file_hashes WHERE path = ?', filePath);
    expect(result!.content_hash).toBe(hash);

    db.close();
  });

  test('should skip re-index when content unchanged', () => {
    const db = new Database(DB_PATH);

    const content = '# Unchanged\n\nThis content does not change.';
    const hash = sha256(content);
    const filePath = path.join(TEST_DIR, 'unchanged.md');

    insertFts(db, { path: filePath, slug: 'unchanged-doc', description: 'This content does not change', type: 'source', category: 'sources', title: 'Unchanged', content, tags: '', quality: null });
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)',
    ).run(filePath, hash, '2026-01-01T00:00:00Z');

    const existing = dbGet<{ content_hash: string }>(db, 'SELECT content_hash FROM file_hashes WHERE path = ?', filePath);
    const newHash = sha256(content);

    expect(existing!.content_hash).toBe(newHash);

    const count = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM mindlore_fts WHERE path = ?', filePath);
    expect(count!.cnt).toBe(1);

    db.close();
  });

  test('should re-index when content changes', () => {
    const db = new Database(DB_PATH);

    const original = '# Original\n\nFirst version.';
    const modified = '# Modified\n\nSecond version with changes.';
    const filePath = path.join(TEST_DIR, 'changing.md');

    const originalHash = sha256(original);
    insertFts(db, { path: filePath, slug: 'changing-doc', description: 'First version', type: 'source', category: 'sources', title: 'Original', content: original, tags: '', quality: null });
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)',
    ).run(filePath, originalHash, '2026-01-01T00:00:00Z');

    const modifiedHash = sha256(modified);
    const existing = dbGet<{ content_hash: string }>(db, 'SELECT content_hash FROM file_hashes WHERE path = ?', filePath);

    expect(existing!.content_hash).not.toBe(modifiedHash);

    db.prepare('DELETE FROM mindlore_fts WHERE path = ?').run(filePath);
    insertFts(db, { path: filePath, slug: 'changing-doc', description: 'Second version with changes', type: 'source', category: 'sources', title: 'Modified', content: modified, tags: '', quality: null });
    db.prepare(
      'UPDATE file_hashes SET content_hash = ?, last_indexed = ? WHERE path = ?',
    ).run(modifiedHash, new Date().toISOString(), filePath);

    const results = dbAll<{ path: string }>(db, 'SELECT path FROM mindlore_fts WHERE mindlore_fts MATCH ?', 'changes');
    expect(results).toHaveLength(1);

    db.close();
  });
});
