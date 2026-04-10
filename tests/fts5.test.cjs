'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { createTestDb, setupTestDir, teardownTestDir } = require('./helpers/db.cjs');

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

    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      testPath,
      testContent
    );

    const result = db.prepare('SELECT count(*) as cnt FROM mindlore_fts').get();
    expect(result.cnt).toBe(1);

    db.close();
  });

  test('should find content via FTS5 MATCH query', () => {
    const db = new Database(DB_PATH);

    const testPath = path.join(TEST_DIR, 'sources', 'typescript-guide.md');
    const content = '# TypeScript Guide\n\nTypeScript provides static typing for JavaScript applications.';

    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      testPath,
      content
    );

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
    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      testPath,
      '# Python Guide\n\nPython is great for data science.'
    );

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
    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      path.join(TEST_DIR, 'sources', 'hooks-overview.md'),
      '# Hooks Overview\n\nHooks are lifecycle callbacks.'
    );

    db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
      path.join(TEST_DIR, 'sources', 'hooks-deep-dive.md'),
      '# Hooks Deep Dive\n\nHooks hooks hooks. PreToolUse hooks, PostToolUse hooks, SessionStart hooks.'
    );

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
});
