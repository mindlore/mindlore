/**
 * Compounding test — v0.2 integration test
 *
 * Tests the full cycle: query → writeback → reindex → next query finds it.
 * Skipped in v0.1 (configured in jest.config.cjs testPathIgnorePatterns).
 */

import fs from 'fs';
import path from 'path';
import { sha256, createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db.js';
import { dbAll } from '../scripts/lib/db-helpers.js';

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-compounding');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources', 'insights']);
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

interface FtsPathRow extends Record<string, unknown> {
  path: string;
}

describe('Knowledge Compounding', () => {
  test('writeback → reindex → query should find the new content', () => {
    const db = createTestDb(DB_PATH);

    // Step 1: Index an existing source
    const sourcePath = path.join(TEST_DIR, 'sources', 'react-hooks.md');
    const sourceContent = '---\nslug: react-hooks\ntype: source\n---\n# React Hooks\n\nUseEffect cleanup patterns.';
    fs.writeFileSync(sourcePath, sourceContent);

    insertFts(db, { path: sourcePath, slug: 'react-hooks', description: 'UseEffect cleanup patterns', type: 'source', category: 'sources', title: 'React Hooks', content: sourceContent, tags: '', quality: null });
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(sourcePath, sha256(sourceContent), new Date().toISOString());

    // Step 2: Simulate query → writeback (agent creates an insight)
    const insightPath = path.join(TEST_DIR, 'insights', 'react-cleanup.md');
    const insightContent =
      '---\nslug: react-cleanup\ntype: insight\n---\n# React Cleanup Pattern\n\nAlways return cleanup function from useEffect to avoid memory leaks.';
    fs.writeFileSync(insightPath, insightContent);

    // Step 3: Reindex (simulates the hook)
    insertFts(db, { path: insightPath, slug: 'react-cleanup', description: 'Avoid memory leaks with useEffect cleanup', type: 'insight', category: 'insights', title: 'React Cleanup Pattern', content: insightContent, tags: '', quality: null });
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)'
    ).run(insightPath, sha256(insightContent), new Date().toISOString());

    // Step 4: Next query should find the writeback content
    const results = dbAll<FtsPathRow>(
      db,
      `SELECT path FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'memory leaks cleanup',
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.path.includes('react-cleanup'))).toBe(true);

    db.close();
  });
});
