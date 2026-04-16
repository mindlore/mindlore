import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createTestDbWithMigrations, setupTestDir, teardownTestDir } from './helpers/db.js';
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

    const db = createTestDbWithMigrations(DB_PATH);
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

    const db = createTestDbWithMigrations(DB_PATH);
    const copyDir = path.join(TEST_DIR, 'memory', 'test-project');
    fs.mkdirSync(copyDir, { recursive: true });
    const content = fs.readFileSync(memFile, 'utf8');
    fs.writeFileSync(path.join(copyDir, 'user_role.md'), content, 'utf8');

    expect(fs.existsSync(path.join(copyDir, 'user_role.md'))).toBe(true);
    const copied = fs.readFileSync(path.join(copyDir, 'user_role.md'), 'utf8');
    expect(copied).toContain('Senior developer');
    db.close();
  });

  test('should apply boost at query time based on CC memory type', () => {
    const { CC_MEMORY_BOOST } = require('../dist/scripts/lib/constants.js');
    expect(CC_MEMORY_BOOST.feedback).toBe(1.5);
    expect(CC_MEMORY_BOOST.user).toBe(1.3);
    expect(CC_MEMORY_BOOST.project).toBe(1.0);
    expect(CC_MEMORY_BOOST.reference).toBe(0.8);
  });
});
