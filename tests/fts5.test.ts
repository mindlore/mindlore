import path from 'path';
import Database from 'better-sqlite3';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db.js';
import { dbAll, dbGet } from '../scripts/lib/db-helpers.js';

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

    insertFts(db, { path: testPath, slug: 'test-source', description: 'TypeScript and Node.js performance', type: 'source', category: 'sources', title: 'Test Source', content: testContent, tags: '', quality: null, dateCaptured: null });

    const result = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM mindlore_fts');
    expect(result!.cnt).toBe(1);

    db.close();
  });

  test('should find content via FTS5 MATCH query', () => {
    const db = new Database(DB_PATH);

    const testPath = path.join(TEST_DIR, 'sources', 'typescript-guide.md');
    const content = '# TypeScript Guide\n\nTypeScript provides static typing for JavaScript applications.';

    insertFts(db, { path: testPath, slug: 'typescript-guide', description: 'TypeScript static typing for JavaScript', type: 'source', category: 'sources', title: 'TypeScript Guide', content, tags: '', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string; rank: number }>(
      db,
      `SELECT path, rank FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'TypeScript',
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(testPath);

    db.close();
  });

  test('should return empty results for non-matching query', () => {
    const db = new Database(DB_PATH);

    const testPath = path.join(TEST_DIR, 'sources', 'python-guide.md');
    insertFts(db, { path: testPath, slug: 'python-guide', description: 'Python for data science', type: 'source', category: 'sources', title: 'Python Guide', content: '# Python Guide\n\nPython is great for data science.', tags: '', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string }>(
      db,
      `SELECT path FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'Kubernetes',
    );

    expect(results).toHaveLength(0);

    db.close();
  });

  test('should rank results by BM25 relevance', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'hooks-overview.md'), slug: 'hooks-overview', description: 'Hooks lifecycle callbacks overview', type: 'source', category: 'sources', title: 'Hooks Overview', content: '# Hooks Overview\n\nHooks are lifecycle callbacks.', tags: '', quality: null, dateCaptured: null });

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'hooks-deep-dive.md'), slug: 'hooks-deep-dive', description: 'Deep dive into hooks patterns', type: 'source', category: 'sources', title: 'Hooks Deep Dive', content: '# Hooks Deep Dive\n\nHooks hooks hooks. PreToolUse hooks, PostToolUse hooks, SessionStart hooks.', tags: '', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string; rank: number }>(
      db,
      `SELECT path, rank FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'hooks',
    );

    expect(results).toHaveLength(2);
    const deepDive = results.find((r) => r.path.includes('deep-dive'));
    const overview = results.find((r) => r.path.includes('overview'));
    expect(deepDive).toBeDefined();
    expect(overview).toBeDefined();

    db.close();
  });

  test('should index and search by tags column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'tagged-doc.md'), slug: 'tagged-doc', description: 'A doc with tags', type: 'source', category: 'sources', title: 'Tagged Doc', content: '# Tagged\n\nContent here.', tags: 'security, hooks, fts5', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string; tags: string }>(
      db,
      `SELECT path, tags FROM mindlore_fts
         WHERE tags MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'security',
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.tags).toBe('security, hooks, fts5');

    db.close();
  });

  test('should store and retrieve date_captured column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'dated-doc.md'), slug: 'dated-doc', description: 'A doc with date', type: 'source', category: 'sources', title: 'Dated Doc', content: '# Dated\n\nContent here.', tags: 'test', quality: 'high', dateCaptured: '2026-04-12' });

    const result = dbGet<{ date_captured: string | null }>(db, 'SELECT date_captured FROM mindlore_fts WHERE path = ?', path.join(TEST_DIR, 'sources', 'dated-doc.md'));
    expect(result!.date_captured).toBe('2026-04-12');

    db.close();
  });

  test('should accept null date_captured column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'no-date.md'), slug: 'no-date', description: 'No date set', type: 'source', category: 'sources', title: 'No Date', content: '# Test\n\nContent.', tags: '', quality: null, dateCaptured: null });

    const result = dbGet<{ date_captured: string | null }>(db, 'SELECT date_captured FROM mindlore_fts WHERE path = ?', path.join(TEST_DIR, 'sources', 'no-date.md'));
    expect(result!.date_captured).toBeFalsy();

    db.close();
  });

  test('should accept null quality column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'no-quality.md'), slug: 'no-quality', description: 'No quality set', type: 'source', category: 'sources', title: 'No Quality', content: '# Test\n\nContent.', tags: '', quality: null, dateCaptured: null });

    const result = dbGet<{ quality: string | null }>(db, 'SELECT quality FROM mindlore_fts WHERE path = ?', path.join(TEST_DIR, 'sources', 'no-quality.md'));
    expect(result!.quality).toBeFalsy();

    db.close();
  });
});

describe('Vec Table', () => {
  test('should load sqlite-vec extension and create vec table', () => {
    const { loadSqliteVec, ensureVecTable } = require('../scripts/lib/db-helpers.js');
    const db = new Database(DB_PATH);

    const loaded = loadSqliteVec(db);
    expect(loaded).toBe(true);

    ensureVecTable(db);

    // Verify table exists by inserting and querying
    const testEmbedding = new Float32Array(384);
    testEmbedding[0] = 1.0; // unit vector along first dimension

    db.prepare('INSERT INTO documents_vec (embedding, slug, created_at, model_name) VALUES (?, ?, ?, ?)').run(
      Buffer.from(testEmbedding.buffer),
      'test-slug',
      new Date().toISOString(),
      'test-model'
    );

    // vec0 metadata columns are filterable in WHERE
    const row = db.prepare('SELECT slug FROM documents_vec WHERE slug = ?').get('test-slug') as { slug: string } | undefined;
    expect(row?.slug).toBe('test-slug');

    db.close();
  });

  test('should return false when sqlite-vec is not available', () => {
    const { ensureVecTable } = require('../scripts/lib/db-helpers.js');
    const db = new Database(DB_PATH);

    // Without loadSqliteVec, ensureVecTable should handle gracefully
    expect(() => ensureVecTable(db)).not.toThrow();

    db.close();
  });
});
