/**
 * Tests for embedding pipeline used by --embed flag in index script.
 * Tests the library functions (embedding.ts, db-helpers.ts vec functions)
 * rather than the CLI subprocess.
 */

import path from 'path';
import { setupTestDir, teardownTestDir, createTestDb, insertFts, createTestDbWithVec, insertVec } from './helpers/db.js';

const { hasVecTable, dbAll: dbAllFn }: {
  hasVecTable: (db: unknown) => boolean;
  dbAll: (db: unknown, sql: string, ...params: unknown[]) => { slug: string }[];
} = require('../scripts/lib/db-helpers.js');
const { searchFts5, searchVec, hybridSearch } = require('../scripts/lib/hybrid-search.js');

const TEST_DIR = path.join(__dirname, '..', '.test-index-cli-embed');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources']);
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Embedding Pipeline — vec table management', () => {
  test('should create vec table when sqlite-vec is available', () => {
    const { db, vecLoaded } = createTestDbWithVec(DB_PATH);

    if (vecLoaded) {
      expect(hasVecTable(db)).toBe(true);
    } else {
      expect(hasVecTable(db)).toBe(false);
    }

    db.close();
  });

  test('should handle missing sqlite-vec gracefully', () => {
    const db = createTestDb(DB_PATH);

    expect(hasVecTable(db)).toBe(false);

    db.close();
  });

  test('should insert and query vec embeddings when vec is available', () => {
    const { db, vecLoaded } = createTestDbWithVec(DB_PATH);

    if (!vecLoaded) {
      db.close();
      return;
    }

    const testEmbedding = new Float32Array(384);
    testEmbedding[0] = 1.0;
    insertVec(db, 'test-doc', testEmbedding, 'test-model');

    const rows = dbAllFn(db, 'SELECT slug FROM documents_vec WHERE slug = ?', 'test-doc');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe('test-doc');

    db.close();
  });

  test('should search vec table with embedding match when available', () => {
    const { db, vecLoaded } = createTestDbWithVec(DB_PATH);

    if (!vecLoaded) {
      db.close();
      return;
    }

    const embed1 = new Float32Array(384);
    embed1[0] = 1.0;
    insertVec(db, 'doc-a', embed1, 'test-model');

    const embed2 = new Float32Array(384);
    embed2[1] = 1.0;
    insertVec(db, 'doc-b', embed2, 'test-model');

    const queryEmbed = new Float32Array(384);
    queryEmbed[0] = 0.9;

    const results = searchVec(db, Array.from(queryEmbed), 5);
    expect(results.length).toBe(2);
    expect(results[0].slug).toBe('doc-a');

    db.close();
  });
});

describe('Embedding Pipeline — FTS5 + vec coexistence', () => {
  test('should allow FTS5 and vec tables in same database', () => {
    const { db, vecLoaded } = createTestDbWithVec(DB_PATH);

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'coexist.md'),
      slug: 'coexist-doc',
      description: 'Test coexistence of FTS5 and vec tables',
      type: 'source',
      category: 'sources',
      title: 'Coexist Doc',
      content: 'Testing that both FTS5 and vec work together',
      tags: 'test',
    });

    const ftsResults = searchFts5(db, 'coexistence', 5);
    expect(ftsResults.length).toBeGreaterThan(0);

    if (vecLoaded) {
      const testEmbed = new Float32Array(384);
      testEmbed[0] = 1.0;
      insertVec(db, 'coexist-doc', testEmbed, 'test-model');

      expect(hasVecTable(db)).toBe(true);
    }

    db.close();
  });

  test('should run hybridSearch with both FTS5 data and vec embeddings', () => {
    const { db, vecLoaded } = createTestDbWithVec(DB_PATH);

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'hybrid-test.md'),
      slug: 'hybrid-test',
      description: 'Document for hybrid search integration test',
      type: 'source',
      category: 'sources',
      title: 'Hybrid Test',
      content: 'Hybrid search combines FTS5 keyword and vector semantic results',
      tags: 'hybrid,search',
    });

    if (vecLoaded) {
      const testEmbed = new Float32Array(384);
      testEmbed[0] = 1.0;
      insertVec(db, 'hybrid-test', testEmbed, 'test-model');
    }

    let queryEmbed: number[] | undefined;
    if (vecLoaded) {
      const q = new Float32Array(384);
      q[0] = 0.9;
      queryEmbed = Array.from(q);
    }

    const results = hybridSearch(db, 'hybrid search', {
      maxResults: 5,
      queryEmbedding: queryEmbed,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('hybrid-test');

    db.close();
  });
});
