import path from 'path';
import Database from 'better-sqlite3';
import { setupTestDir, teardownTestDir, createTestDb, insertFts } from './helpers/db.js';
import { getCategoryWeight } from '../scripts/lib/hybrid-search.js';

const TEST_DIR = path.join(__dirname, '..', '.test-hybrid-search');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources']);
  const db = createTestDb(DB_PATH);
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('RRF Fusion', () => {
  test('should compute RRF scores correctly', () => {
    const { computeRRF } = require('../scripts/lib/hybrid-search.js');

    const ftsResults = [
      { slug: 'a', rank: -10 },
      { slug: 'b', rank: -5 },
    ];
    const vecResults = [
      { slug: 'b', distance: 0.5 },
      { slug: 'c', distance: 0.8 },
    ];

    const fused = computeRRF(ftsResults, vecResults, { k: 60, ftsWeight: 0.4, vecWeight: 0.6 });

    // 'b' appears in both — should have highest score
    expect(fused[0].slug).toBe('b');
    expect(fused.length).toBe(3); // a, b, c
    // All scores should be positive
    fused.forEach((r: { score: number }) => expect(r.score).toBeGreaterThan(0));
  });

  test('should handle FTS-only results (vec empty)', () => {
    const { computeRRF } = require('../scripts/lib/hybrid-search.js');

    const ftsResults = [
      { slug: 'a', rank: -10 },
      { slug: 'b', rank: -5 },
    ];

    const fused = computeRRF(ftsResults, [], { k: 60, ftsWeight: 0.4, vecWeight: 0.6 });
    expect(fused.length).toBe(2);
    expect(fused[0].slug).toBe('a');
  });

  test('should handle vec-only results (FTS empty)', () => {
    const { computeRRF } = require('../scripts/lib/hybrid-search.js');

    const vecResults = [
      { slug: 'a', distance: 0.3 },
      { slug: 'b', distance: 0.9 },
    ];

    const fused = computeRRF([], vecResults, { k: 60, ftsWeight: 0.4, vecWeight: 0.6 });
    expect(fused.length).toBe(2);
    expect(fused[0].slug).toBe('a'); // lower distance = more similar
  });

  test('should convert L2 distance to cosine similarity', () => {
    const { l2ToCosine } = require('../scripts/lib/hybrid-search.js');

    // L2 distance 0 = identical = cosine 1.0
    expect(l2ToCosine(0)).toBeCloseTo(1.0, 5);

    // L2 distance 2 = opposite = cosine 0.0 (for normalized vectors)
    expect(l2ToCosine(2)).toBeCloseTo(0.0, 5);

    // L2 distance 1 (90 degrees for normalized) = cosine 0.5
    expect(l2ToCosine(1)).toBeCloseTo(0.5, 5);
  });

  test('should normalize BM25 scores', () => {
    const { normalizeBM25 } = require('../scripts/lib/hybrid-search.js');

    // FTS5 returns negative ranks — more negative = better match
    expect(normalizeBM25(-25)).toBeCloseTo(1.0, 5);
    expect(normalizeBM25(-12.5)).toBeCloseTo(0.5, 5);
    expect(normalizeBM25(0)).toBeCloseTo(0.0, 5);
  });
});

describe('Hybrid Search Integration', () => {
  test('should search FTS5 and return results with path and score', () => {
    const { searchFts5 } = require('../scripts/lib/hybrid-search.js');
    const db = new Database(DB_PATH);

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'test.md'),
      slug: 'test-doc',
      description: 'TypeScript guide for beginners',
      type: 'source',
      category: 'sources',
      title: 'Test Doc',
      content: 'TypeScript is a typed superset of JavaScript',
      tags: 'typescript,javascript',
    });

    const results = searchFts5(db, 'TypeScript', 10);
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('test-doc');
    expect(results[0].rank).toBeDefined();

    db.close();
  });

  test('should fall back to pure FTS5 when vec table is missing', () => {
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');
    const db = new Database(DB_PATH);

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'fallback.md'),
      slug: 'fallback-doc',
      description: 'Fallback test document',
      type: 'source',
      category: 'sources',
      title: 'Fallback Doc',
      content: 'This tests the graceful fallback to pure FTS5',
      tags: 'test',
    });

    // No vec table loaded — should still work via FTS5 fallback
    const results = hybridSearch(db, 'fallback', { maxResults: 5 });
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe('fallback-doc');

    db.close();
  });
});

describe('category boost (v0.6.1)', () => {
  test('sources weight is higher than cc-session', () => {
    expect(getCategoryWeight('sources')).toBeGreaterThan(getCategoryWeight('cc-session'));
  });

  test('domains weight is higher than cc-subagent', () => {
    expect(getCategoryWeight('domains')).toBeGreaterThan(getCategoryWeight('cc-subagent'));
  });

  test('unknown category returns 1.0', () => {
    expect(getCategoryWeight('unknown-category')).toBe(1.0);
  });

  test('category boost affects FTS-only hybrid results', () => {
    const dbPath = path.join(TEST_DIR, 'boost.db');
    setupTestDir(TEST_DIR, ['sources']);
    const db = createTestDb(dbPath);

    insertFts(db, { path: '/src.md', slug: 'src', content: 'karar alindi mimari', category: 'sources' });
    insertFts(db, { path: '/sess.md', slug: 'sess', content: 'karar alindi mimari', category: 'cc-session' });

    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');
    const results = hybridSearch(db, 'karar', { maxResults: 5 });

    expect(results.length).toBe(2);
    expect(results[0].category).toBe('sources');

    db.close();
    teardownTestDir(TEST_DIR);
  });
});
