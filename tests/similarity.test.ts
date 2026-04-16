import path from 'path';
import { createTestDbWithMigrations, insertFts, setupTestDir, teardownTestDir } from './helpers/db.js';
import { findSimilar } from '../scripts/lib/similarity.js';

const TEST_DIR = path.join(__dirname, '..', '.test-similarity');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources']);
  const db = createTestDbWithMigrations(DB_PATH);
  insertFts(db, {
    path: path.join(TEST_DIR, 'sources', 'react-hooks.md'),
    slug: 'react-hooks',
    description: 'React hooks patterns and useEffect cleanup',
    type: 'source',
    category: 'sources',
    title: 'React Hooks Guide',
    content: 'React hooks patterns and useEffect cleanup for memory leak prevention.',
    tags: 'react,hooks',
  });
  insertFts(db, {
    path: path.join(TEST_DIR, 'sources', 'vue-composition.md'),
    slug: 'vue-composition',
    description: 'Vue composition API and reactivity',
    type: 'source',
    category: 'sources',
    title: 'Vue Composition API',
    content: 'Vue 3 composition API patterns and reactive state management.',
    tags: 'vue,composition',
  });
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Similarity / Duplicate Detection', () => {
  test('should find similar documents by FTS5 keyword match', () => {
    const results = findSimilar(DB_PATH, 'React hooks useEffect cleanup patterns');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.slug).toBe('react-hooks');
  });

  test('should return empty for unrelated content', () => {
    const results = findSimilar(DB_PATH, 'Kubernetes pod networking and service mesh');
    expect(results.length).toBe(0);
  });

  test('should return similarity score', () => {
    const results = findSimilar(DB_PATH, 'React hooks useEffect');
    if (results.length > 0) {
      expect(results[0]!).toHaveProperty('score');
      expect(typeof results[0]!.score).toBe('number');
    }
  });

  test('should limit results to maxResults', () => {
    const results = findSimilar(DB_PATH, 'API patterns', { maxResults: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
