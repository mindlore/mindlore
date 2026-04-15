/**
 * Tests for hybrid search CLI path — tests the library functions
 * that --hybrid flag invokes (synonym expansion + hybridSearch integration).
 */

import path from 'path';
import Database from 'better-sqlite3';
import { setupTestDir, teardownTestDir, createTestDb, insertFts } from './helpers/db.js';

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
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');
    const { expandQuery, loadSynonyms } = require('../scripts/lib/synonym.js');

    const config = {
      synonyms: {
        auth: ['authentication', 'login', 'kimlik doğrulama'],
        db: ['database', 'veritabanı', 'sqlite'],
      },
    };
    const synonyms = loadSynonyms(config);
    const expanded = expandQuery('auth', synonyms);
    const query = expanded.join(' ');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, query, { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('auth-guide');
    expect(results[0].score).toBeGreaterThan(0);

    db.close();
  });

  test('should boost results when synonym matches additional terms', () => {
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');
    const { expandQuery } = require('../scripts/lib/synonym.js');

    const synonyms = { db: ['database', 'sqlite'] };
    const expandedTerms = expandQuery('db', synonyms);
    const expandedQuery = expandedTerms.join(' ');

    // Expanded query should include "database" and "sqlite" — both in the DB domain doc
    expect(expandedTerms).toContain('database');
    expect(expandedTerms).toContain('sqlite');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, expandedQuery, { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('database');

    db.close();
  });

  test('should return FusedResult format with all expected fields', () => {
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, 'authentication', { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('score');
    expect(first).toHaveProperty('ftsRank');
    expect(typeof first.score).toBe('number');
    expect(typeof first.ftsRank).toBe('number');

    db.close();
  });

  test('should respect maxResults option', () => {
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, 'authentication OR database', { maxResults: 1 });

    expect(results.length).toBe(1);

    db.close();
  });

  test('should return empty array for unmatched query', () => {
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, 'kubernetes docker', { maxResults: 3 });

    expect(results).toHaveLength(0);

    db.close();
  });

  test('should handle empty synonyms gracefully', () => {
    const { hybridSearch } = require('../scripts/lib/hybrid-search.js');
    const { expandQuery, loadSynonyms } = require('../scripts/lib/synonym.js');

    const synonyms = loadSynonyms({});
    const expanded = expandQuery('database', synonyms);

    expect(expanded).toEqual(['database']);

    const db = new Database(DB_PATH, { readonly: true });
    const results = hybridSearch(db, expanded.join(' '), { maxResults: 3 });

    expect(results.length).toBeGreaterThan(0);

    db.close();
  });
});
