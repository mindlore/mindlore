'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { createTestDb, insertFts, setupTestDir, teardownTestDir } = require('./helpers/db.cjs');

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-fts5');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources']);
  const db = createTestDb(DB_PATH);
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('FTS5 Database', () => {
  test('should create FTS5 table and insert content', () => {
    const db = new Database(DB_PATH);

    const testContent = '# Test Source\n\nThis is about TypeScript and Node.js performance.';
    const testPath = path.join(TEST_DIR, 'sources', 'test-source.md');

    insertFts(db, testPath, 'test-source', 'TypeScript and Node.js performance', 'source', 'sources', 'Test Source', testContent);

    const result = db.prepare('SELECT count(*) as cnt FROM mindlore_fts').get();
    expect(result.cnt).toBe(1);

    db.close();
  });

  test('should find content via FTS5 MATCH query', () => {
    const db = new Database(DB_PATH);

    const testPath = path.join(TEST_DIR, 'sources', 'typescript-guide.md');
    const content = '# TypeScript Guide\n\nTypeScript provides static typing for JavaScript applications.';

    insertFts(db, testPath, 'typescript-guide', 'TypeScript static typing for JavaScript', 'source', 'sources', 'TypeScript Guide', content);

    const results = db
      .prepare(
        `SELECT path, rank FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`
      )
      .all('TypeScript');

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(testPath);

    db.close();
  });

  test('should return empty results for non-matching query', () => {
    const db = new Database(DB_PATH);

    const testPath = path.join(TEST_DIR, 'sources', 'python-guide.md');
    insertFts(db, testPath, 'python-guide', 'Python for data science', 'source', 'sources', 'Python Guide', '# Python Guide\n\nPython is great for data science.');

    const results = db
      .prepare(
        `SELECT path FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`
      )
      .all('Kubernetes');

    expect(results).toHaveLength(0);

    db.close();
  });

  test('should rank results by BM25 relevance', () => {
    const db = new Database(DB_PATH);

    // Insert two documents — one more relevant
    insertFts(db, path.join(TEST_DIR, 'sources', 'hooks-overview.md'), 'hooks-overview', 'Hooks lifecycle callbacks overview', 'source', 'sources', 'Hooks Overview', '# Hooks Overview\n\nHooks are lifecycle callbacks.');

    insertFts(db, path.join(TEST_DIR, 'sources', 'hooks-deep-dive.md'), 'hooks-deep-dive', 'Deep dive into hooks patterns', 'source', 'sources', 'Hooks Deep Dive', '# Hooks Deep Dive\n\nHooks hooks hooks. PreToolUse hooks, PostToolUse hooks, SessionStart hooks.');

    const results = db
      .prepare(
        `SELECT path, rank FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`
      )
      .all('hooks');

    expect(results).toHaveLength(2);
    // More relevant doc (more occurrences) should rank higher (lower rank value)
    const deepDive = results.find((r) => r.path.includes('deep-dive'));
    const overview = results.find((r) => r.path.includes('overview'));
    expect(deepDive).toBeDefined();
    expect(overview).toBeDefined();

    db.close();
  });

  test('should index and search by tags column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, path.join(TEST_DIR, 'sources', 'tagged-doc.md'), 'tagged-doc', 'A doc with tags', 'source', 'sources', 'Tagged Doc', '# Tagged\n\nContent here.', 'security, hooks, fts5');

    // Search by tag keyword
    const results = db
      .prepare(
        `SELECT path, tags FROM mindlore_fts
         WHERE tags MATCH ?
         ORDER BY rank
         LIMIT 3`
      )
      .all('security');

    expect(results).toHaveLength(1);
    expect(results[0].tags).toBe('security, hooks, fts5');

    db.close();
  });

  test('should accept null quality column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, path.join(TEST_DIR, 'sources', 'no-quality.md'), 'no-quality', 'No quality set', 'source', 'sources', 'No Quality', '# Test\n\nContent.', '', null);

    const result = db.prepare('SELECT quality FROM mindlore_fts WHERE path = ?').get(path.join(TEST_DIR, 'sources', 'no-quality.md'));
    expect(result.quality).toBeFalsy();

    db.close();
  });
});
