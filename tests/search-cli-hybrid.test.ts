/**
 * Tests for hybrid search CLI path — tests the library functions
 * that --hybrid flag invokes (synonym expansion + hybridSearch integration).
 */

import path from 'path';
import Database from 'better-sqlite3';
import { setupTestDir, teardownTestDir, createTestDb, insertFts } from './helpers/db.js';

const { hybridSearch } = require('../scripts/lib/hybrid-search.js');
const { expandQuery, loadSynonyms } = require('../scripts/lib/synonym.js');

const TEST_DIR = path.join(__dirname, '..', '.test-search-cli-hybrid');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources', 'domains']);

  const db = createTestDb(DB_PATH);

  insertFts(db, {
    path: path.join(TEST_DIR, 'sources', 'auth-guide.md'),
    slug: 'auth-guide',
    description: 'Authentication patterns and JWT token management',
    type: 'source',
    category: 'sources',
    title: 'Auth Guide',
    content: 'Authentication login patterns for secure applications with JWT tokens',
    tags: 'auth,security',
  });

  insertFts(db, {
    path: path.join(TEST_DIR, 'domains', 'database.md'),
    slug: 'database',
    description: 'SQLite and database optimization techniques',
    type: 'domain',
    category: 'domains',
    title: 'Database',
    content: 'SQLite FTS5 database optimization and indexing strategies',
    tags: 'sqlite,database',
  });

  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Hybrid Search CLI Path — synonym expansion + hybridSearch', () => {
  test('should find results via synonym expansion through hybridSearch', () => {
    const synonyms = loadSynonyms({
      synonyms: {
        auth: ['authentication', 'login', 'kimlik doğrulama'],
        db: ['database', 'veritabanı', 'sqlite'],
      },
    });
    const query = expandQuery('auth', synonyms).join(' ');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, query, { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('auth-guide');
    expect(results[0].score).toBeGreaterThan(0);

    db.close();
  });

  test('should boost results when synonym matches additional terms', () => {
    const synonyms = { db: ['database', 'sqlite'] };
    const expandedQuery = expandQuery('db', synonyms).join(' ');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, expandedQuery, { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('database');

    db.close();
  });

  test('should return FusedResult format with all expected fields', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, 'authentication', { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      slug: expect.any(String),
      score: expect.any(Number),
      ftsRank: expect.any(Number),
    });

    db.close();
  });

  test('should respect maxResults option', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, 'authentication OR database', { maxResults: 1 });

    expect(results.length).toBe(1);

    db.close();
  });

  test('should return empty array for unmatched query', () => {
    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, 'kubernetes docker', { maxResults: 3 });

    expect(results).toHaveLength(0);

    db.close();
  });

  test('should handle empty synonyms gracefully', () => {
    const synonyms = loadSynonyms({});
    const query = expandQuery('database', synonyms).join(' ');

    expect(query).toBe('database');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, query, { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);

    db.close();
  });
});
