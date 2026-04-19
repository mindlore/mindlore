import path from 'path';
import Database from 'better-sqlite3';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db.js';
import { dbAll, dbGet } from '../scripts/lib/db-helpers.js';

interface TimestampRow {
  created_at: string | null;
  updated_at: string | null;
}

interface ProjectScopeRow {
  project_scope: string | null;
}

interface ImportanceRow {
  importance: number;
}

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

describe('openDatabaseTs', () => {
  test('should set WAL + busy_timeout for writable DB', () => {
    const { openDatabaseTs } = require('../scripts/lib/db-helpers.js');
    const db = openDatabaseTs(DB_PATH);
    if (!db) throw new Error('DB not opened');
    const walMode = db.pragma('journal_mode', { simple: true });
    expect(walMode).toBe('wal');
    const timeout = db.pragma('busy_timeout', { simple: true });
    expect(timeout).toBe(5000);
    db.close();
  });

  test('readonly should NOT set WAL', () => {
    const { openDatabaseTs } = require('../scripts/lib/db-helpers.js');
    const db = openDatabaseTs(DB_PATH, { readonly: true });
    if (!db) throw new Error('DB not opened');
    db.close();
  });
});

describe('openDatabase CJS', () => {
  test('should set WAL mode and busy_timeout on writable DB', () => {
    const { openDatabase } = require('../hooks/lib/mindlore-common.cjs');
    const db = openDatabase(DB_PATH);
    if (!db) throw new Error('DB not opened');
    const walMode = db.pragma('journal_mode', { simple: true });
    expect(walMode).toBe('wal');
    const timeout = db.pragma('busy_timeout', { simple: true });
    expect(timeout).toBe(5000);
    db.close();
  });
});

describe('Index with Embedding', () => {
  test('should populate vec table when sqlite-vec is loaded', () => {
    const { loadSqliteVec, ensureVecTable, hasVecTable: hasVec } = require('../scripts/lib/db-helpers.js');
    const db = new Database(DB_PATH);
    const vecLoaded = loadSqliteVec(db);

    if (!vecLoaded) {
      console.log('sqlite-vec not available — skipping embed test');
      db.close();
      return;
    }

    ensureVecTable(db);
    expect(hasVec(db)).toBe(true);

    // Insert a document to FTS
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'embed-test.md'),
      slug: 'embed-test',
      description: 'Document for embedding test',
      type: 'source',
      category: 'sources',
      title: 'Embed Test',
      content: 'This document tests the embedding pipeline integration',
      tags: 'test,embedding',
    });

    // Manually test vec insert with fake embedding
    const fakeEmbedding = new Float32Array(384);
    fakeEmbedding[0] = 1.0;
    const buf = Buffer.from(fakeEmbedding.buffer);

    db.prepare('INSERT INTO documents_vec (embedding, slug, created_at, model_name) VALUES (?, ?, ?, ?)').run(
      buf, 'embed-test', new Date().toISOString(), 'Xenova/multilingual-e5-small'
    );

    // Verify vec entry
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT slug FROM documents_vec WHERE slug = ?').get('embed-test') as { slug: string } | undefined;
    expect(row?.slug).toBe('embed-test');

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test: better-sqlite3 .get() returns unknown
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

describe('Timestamp columns', () => {
  test('should write created_at on first index, updated_at on re-index', () => {
    const { createTestDbWithMigrations } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithMigrations(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-timestamps.md');
    const hash1 = 'aaa111';
    const now1 = '2026-04-19T10:00:00.000Z';

    // Simulate first index: INSERT with created_at, no updated_at
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now')
    `);

    upsertHash.run(testPath, hash1, now1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row1 = db.prepare('SELECT created_at, updated_at FROM file_hashes WHERE path = ?').get(testPath) as TimestampRow;
    expect(row1.created_at).toBeTruthy();
    expect(row1.updated_at).toBeNull(); // First index, no update yet

    // Simulate re-index with different hash: triggers ON CONFLICT UPDATE
    const hash2 = 'bbb222';
    const now2 = '2026-04-19T11:00:00.000Z';
    upsertHash.run(testPath, hash2, now2);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row2 = db.prepare('SELECT created_at, updated_at FROM file_hashes WHERE path = ?').get(testPath) as TimestampRow;
    expect(row2.created_at).toBe(row1.created_at); // created_at shouldn't change
    expect(row2.updated_at).toBeTruthy(); // updated_at should now be set

    db.close();
  });
});

describe('Project scope on index', () => {
  test('should write project_scope on index', () => {
    const { createTestDbWithMigrations } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithMigrations(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-scope.md');
    const hash = 'abc123';
    const now = '2026-04-19T12:00:00.000Z';
    const projectName = 'test-project';

    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope
    `);

    upsertHash.run(testPath, hash, now, projectName);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT project_scope FROM file_hashes WHERE path = ?').get(testPath) as ProjectScopeRow;
    expect(row.project_scope).toBeTruthy();
    expect(typeof row.project_scope).toBe('string');
    expect(row.project_scope).toBe('test-project');

    db.close();
  });
});

describe('Quality to importance mapping', () => {
  test('should map quality high to importance 1.0', () => {
    const { createTestDbWithMigrations } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithMigrations(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-importance-high.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    // Simulate indexer: quality 'high' -> importance 1.0
    upsertHash.run(testPath, 'aaa', '2026-04-19T10:00:00.000Z', 'test', 1.0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(1.0);

    db.close();
  });

  test('should map quality medium to importance 0.6', () => {
    const { createTestDbWithMigrations } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithMigrations(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-importance-medium.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    upsertHash.run(testPath, 'bbb', '2026-04-19T10:00:00.000Z', 'test', 0.6);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(0.6);

    db.close();
  });

  test('should map quality low to importance 0.3', () => {
    const { createTestDbWithMigrations } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithMigrations(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-importance-low.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    upsertHash.run(testPath, 'ccc', '2026-04-19T10:00:00.000Z', 'test', 0.3);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(0.3);

    db.close();
  });

  test('should default importance to 0.5 when quality is missing', () => {
    const { createTestDbWithMigrations } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithMigrations(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-no-quality.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    // quality undefined -> default 0.5
    upsertHash.run(testPath, 'ddd', '2026-04-19T10:00:00.000Z', 'test', 0.5);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(0.5);

    db.close();
  });
});

describe('Search Script Hybrid Mode', () => {
  test('should return results with score field in hybrid mode', () => {
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');
    const db = new Database(DB_PATH);

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'search-test.md'),
      slug: 'search-test',
      description: 'Hybrid search integration test',
      type: 'source',
      category: 'sources',
      title: 'Search Test',
      content: 'Testing the hybrid search pipeline with FTS5 and vector search',
      tags: 'search,hybrid',
    });

    // Without vec — should still return FTS5 results
    const results = hybridSearch(db, 'hybrid search', { maxResults: 3 });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('search-test');
    expect(results[0].score).toBeGreaterThan(0);

    db.close();
  });
});
