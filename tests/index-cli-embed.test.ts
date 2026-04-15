/**
 * Tests for embedding pipeline used by --embed flag in index script.
 * Tests the library functions (embedding.ts, db-helpers.ts vec functions)
 * rather than the CLI subprocess.
 */

import path from 'path';
import { setupTestDir, teardownTestDir, createTestDb, insertFts, createTestDbWithVec, insertVec } from './helpers/db.js';

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
      const { hasVecTable } = require('../scripts/lib/db-helpers.js');
      expect(hasVecTable(db)).toBe(true);
    }

    db.close();
  });

  test('should handle missing sqlite-vec gracefully', () => {
    const db = createTestDb(DB_PATH);
    const { hasVecTable } = require('../scripts/lib/db-helpers.js');

    // Without loading sqlite-vec, vec table should not exist
    expect(hasVecTable(db)).toBe(false);

    db.close();
  });

  test('should insert and query vec embeddings when vec is available', () => {
    const { db, vecLoaded } = createTestDbWithVec(DB_PATH);

    if (!vecLoaded) {
      db.close();
      return; // Skip if sqlite-vec not available
    }

    // Insert a test embedding (384 dimensions)
    const testEmbedding = new Float32Array(384);
    testEmbedding[0] = 1.0;
    insertVec(db, 'test-doc', testEmbedding, 'test-model');

    // Verify it was inserted
    const { dbAll }: { dbAll: (db: unknown, sql: string, ...params: unknown[]) => { slug: string }[] } = require('../scripts/lib/db-helpers.js');
    const rows = dbAll(db, 'SELECT slug FROM documents_vec WHERE slug = ?', 'test-doc');
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

    // Insert two embeddings with different vectors
    const embed1 = new Float32Array(384).fill(0);
    embed1[0] = 1.0;
    insertVec(db, 'doc-a', embed1, 'test-model');

    const embed2 = new Float32Array(384).fill(0);
    embed2[1] = 1.0;
    insertVec(db, 'doc-b', embed2, 'test-model');

    // Search with vector similar to embed1
    const { searchVec } = require('../scripts/lib/hybrid-search.js');
    const queryEmbed = new Float32Array(384).fill(0);
    queryEmbed[0] = 0.9;

    const results = searchVec(db, Array.from(queryEmbed), 5);
    expect(results.length).toBe(2);
    // doc-a should be closer (lower distance) to query
    expect(results[0].slug).toBe('doc-a');

    db.close();
  });
});

describe('Embedding Pipeline — FTS5 + vec coexistence', () => {
  test('should allow FTS5 and vec tables in same database', () => {
    const { db, vecLoaded } = createTestDbWithVec(DB_PATH);

    // Insert FTS5 row
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

    // FTS5 should work
    const { searchFts5 } = require('../scripts/lib/hybrid-search.js');
    const ftsResults = searchFts5(db, 'coexistence', 5);
    expect(ftsResults.length).toBeGreaterThan(0);

    if (vecLoaded) {
      // Vec should also work
      const testEmbed = new Float32Array(384).fill(0);
      testEmbed[0] = 1.0;
      insertVec(db, 'coexist-doc', testEmbed, 'test-model');

      const { hasVecTable } = require('../scripts/lib/db-helpers.js');
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
      const testEmbed = new Float32Array(384).fill(0);
      testEmbed[0] = 1.0;
      insertVec(db, 'hybrid-test', testEmbed, 'test-model');
    }

    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');

    // With query embedding (if vec is available, will use both paths)
    const queryEmbed = vecLoaded ? Array.from(new Float32Array(384).fill(0).map((_, i) => i === 0 ? 0.9 : 0)) : undefined;
    const results = hybridSearch(db, 'hybrid search', {
      maxResults: 5,
      queryEmbedding: queryEmbed,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('hybrid-test');

    db.close();
  });
});
