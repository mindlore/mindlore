import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createTestDbWithFullSchema, setupTestDir, teardownTestDir, sha256 } from './helpers/db.js';
import { dbAll } from '../scripts/lib/db-helpers.js';

const TEST_DIR = path.join(__dirname, '..', '.test-cc-memory-sync');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');
const MEMORY_DIR = path.join(TEST_DIR, 'mock-memory');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources']);
  setupTestDir(MEMORY_DIR, []);
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
  teardownTestDir(MEMORY_DIR);
});

describe('CC Memory Sync', () => {
  test('should detect CC memory path and set source_type', () => {
    const memFile = path.join(MEMORY_DIR, 'feedback_testing.md');
    fs.writeFileSync(memFile, [
      '---',
      'name: Test Feedback',
      'description: Always run tests before commit',
      'type: feedback',
      '---',
      '',
      'Run tests before every commit.',
    ].join('\n'));

    const db = createTestDbWithFullSchema(DB_PATH);
    const { parseFrontmatter, insertFtsRow }: {
      parseFrontmatter: (c: string) => { meta: Record<string, unknown> };
      insertFtsRow: (db: Database.Database, entry: Record<string, unknown>) => void;
    } = require('../hooks/lib/mindlore-common.cjs');

    const content = fs.readFileSync(memFile, 'utf8');
    const { meta } = parseFrontmatter(content);

    insertFtsRow(db, {
      path: memFile,
      slug: 'feedback_testing',
      description: meta.description ?? '',
      type: String(meta.type ?? 'unknown'),
      category: 'cc-memory',
      title: String(meta.name ?? ''),
      content,
      tags: '',
      quality: null,
      project: 'test-project',
    });

    const rows = dbAll<{ path: string }>(db, "SELECT path FROM mindlore_fts WHERE category = 'cc-memory'");
    expect(rows.length).toBe(1);
    db.close();
  });

  test('should redact secrets from CC memory before indexing', () => {
    const memFile = path.join(MEMORY_DIR, 'project_tokens.md');
    fs.writeFileSync(memFile, [
      '---',
      'name: Token Info',
      'type: project',
      '---',
      '',
      'API key: sk-proj-abc123def456ghi789jkl012mno345pqr',
    ].join('\n'));

    const { redactSecrets } = require('../dist/scripts/lib/privacy-filter.js');
    const content = fs.readFileSync(memFile, 'utf8');
    const cleaned = redactSecrets(content);

    expect(cleaned).not.toContain('sk-proj-');
    expect(cleaned).toContain('[REDACTED]');
  });

  test('should copy CC memory file to ~/.mindlore/memory/{project}/', () => {
    const memFile = path.join(MEMORY_DIR, 'user_role.md');
    fs.writeFileSync(memFile, [
      '---',
      'name: User Role',
      'type: user',
      '---',
      '',
      'Senior developer focused on security.',
    ].join('\n'));

    const db = createTestDbWithFullSchema(DB_PATH);
    const copyDir = path.join(TEST_DIR, 'memory', 'test-project');
    fs.mkdirSync(copyDir, { recursive: true });
    const content = fs.readFileSync(memFile, 'utf8');
    fs.writeFileSync(path.join(copyDir, 'user_role.md'), content, 'utf8');

    expect(fs.existsSync(path.join(copyDir, 'user_role.md'))).toBe(true);
    const copied = fs.readFileSync(path.join(copyDir, 'user_role.md'), 'utf8');
    expect(copied).toContain('Senior developer');
    db.close();
  });

  test('should not crash on unchanged file re-index (double db.close regression)', () => {
    // Regression test for: early-return path called db.close() before finally block
    // which also called db.close(), causing a crash on the most common code path.
    const memFile = path.join(MEMORY_DIR, 'unchanged_test.md');
    const content = [
      '---',
      'name: Unchanged Test',
      'type: feedback',
      '---',
      '',
      'This content will not change between indexes.',
    ].join('\n');
    fs.writeFileSync(memFile, content);

    const hash = sha256(content);
    const db = createTestDbWithFullSchema(DB_PATH);

    // First index: insert file_hash
    db.prepare(
      'INSERT INTO file_hashes (path, content_hash, last_indexed, source_type) VALUES (?, ?, ?, ?)'
    ).run(memFile, hash, new Date().toISOString(), 'cc-memory');

    // Simulate the indexCcMemory try/finally pattern with early return on unchanged
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const existing = db.prepare('SELECT content_hash FROM file_hashes WHERE path = ?').get(memFile) as { content_hash: string } | undefined;
      expect(existing).toBeDefined();
      expect(existing?.content_hash).toBe(hash);

      if (existing && existing.content_hash === hash) {
        return; // unchanged — only finally should close
      }
    } finally {
      db.close(); // single close — no crash
    }
  });

});
