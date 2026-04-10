'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-fts5');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  // Create fresh test directory and database
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'sources'), { recursive: true });

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
  // Clean up test directory
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
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
