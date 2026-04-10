'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { createTestDb, setupTestDir, teardownTestDir } = require('./helpers/db.cjs');

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-search');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources', 'domains']);

  const db = createTestDb(DB_PATH);

  db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
    path.join(TEST_DIR, 'sources', 'react-hooks.md'),
    '---\nslug: react-hooks\ntype: source\n---\n# React Hooks Guide\n\nuseEffect cleanup patterns for memory leak prevention.'
  );
  db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
    path.join(TEST_DIR, 'sources', 'typescript-generics.md'),
    '---\nslug: typescript-generics\ntype: source\n---\n# TypeScript Generics\n\nAdvanced generic patterns for type-safe APIs.'
  );
  db.prepare('INSERT INTO mindlore_fts (path, content) VALUES (?, ?)').run(
    path.join(TEST_DIR, 'domains', 'security.md'),
    '---\nslug: security\ntype: domain\n---\n# Security\n\nSSH hardening, firewall rules, audit checks.'
  );

  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Search Hook — Keyword Extraction', () => {
  // Inline the extractKeywords logic for testing
  function extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
      'through', 'after', 'before', 'above', 'below', 'up', 'down', 'out',
      'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
      'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too',
      'very', 'just', 'also', 'now', 'then', 'here', 'there', 'when',
      'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'this',
      'that', 'these', 'those', 'it', 'its', 'my', 'your', 'his', 'her',
      'our', 'their', 'me', 'him', 'us', 'them', 'i', 'you', 'he', 'she',
      'we', 'they', 'bu', 'su', 'bir', 'de', 'da', 've', 'ile', 'icin',
      'var', 'mi', 'ne', 'nasil', 'nedir', 'evet', 'hayir',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u00e7\u011f\u0131\u00f6\u015f\u00fc\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5);
  }

  test('should extract meaningful keywords from prompt', () => {
    const keywords = extractKeywords('How do React hooks handle cleanup?');
    expect(keywords).toContain('react');
    expect(keywords).toContain('hooks');
    expect(keywords).toContain('cleanup');
    expect(keywords).not.toContain('how');
    expect(keywords).not.toContain('do');
  });

  test('should handle Turkish stop words', () => {
    const keywords = extractKeywords('bu proje nasil calisir ve ne yapar');
    expect(keywords).toContain('proje');
    expect(keywords).toContain('calisir');
    expect(keywords).toContain('yapar');
    expect(keywords).not.toContain('nasil');
    expect(keywords).not.toContain('bu');
  });

  test('should limit to 5 keywords', () => {
    const keywords = extractKeywords(
      'react hooks typescript generics security firewall audit ssh hardening'
    );
    expect(keywords.length).toBeLessThanOrEqual(5);
  });

  test('should deduplicate keywords', () => {
    const keywords = extractKeywords('hooks hooks hooks different word');
    const hookCount = keywords.filter((k) => k === 'hooks').length;
    expect(hookCount).toBe(1);
  });
});

describe('Search Hook — FTS5 Query', () => {
  function queryFts(query) {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      return db
        .prepare(
          `SELECT path, rank FROM mindlore_fts
           WHERE mindlore_fts MATCH ?
           ORDER BY rank LIMIT 3`
        )
        .all(query);
    } finally {
      db.close();
    }
  }

  test('should find matching documents via FTS5', () => {
    const results = queryFts('react hooks');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toContain('react-hooks');
  });

  test('should return empty for non-matching query', () => {
    const results = queryFts('kubernetes docker');
    expect(results).toHaveLength(0);
  });

  test('should rank more relevant documents higher', () => {
    const results = queryFts('security');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toContain('security');
  });

  test('should handle OR queries across multiple keywords', () => {
    const results = queryFts('react OR typescript');
    expect(results.length).toBe(2);
  });
});
