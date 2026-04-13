import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type Database from 'better-sqlite3';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db';
import { dbAll, dbGet } from '../scripts/lib/db-helpers.js';

const TEST_DIR = path.join(__dirname, '..', '.test-quality-populate');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

let db: Database.Database;

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources', 'raw']);
  db = createTestDb(DB_PATH);
});

afterEach(() => {
  db.close();
  teardownTestDir(TEST_DIR);
});

describe('Quality populate — storage and retrieval', () => {
  test('high quality stored and retrieved correctly', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'anthropic-docs.md'),
      slug: 'anthropic-docs',
      type: 'source',
      title: 'Anthropic Claude API Docs',
      content: '# Claude API\n\nOfficial documentation from docs.anthropic.com',
      quality: 'high',
    });

    const row = dbGet<{ quality: string }>(db, 'SELECT quality FROM mindlore_fts WHERE slug = ?', 'anthropic-docs');
    expect(row?.quality).toBe('high');
  });

  test('medium quality stored and retrieved correctly', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'blog-post.md'),
      slug: 'blog-post',
      type: 'source',
      content: '# React Patterns\n\nSome thoughts on React patterns.',
      quality: 'medium',
    });

    const row = dbGet<{ quality: string }>(db, 'SELECT quality FROM mindlore_fts WHERE slug = ?', 'blog-post');
    expect(row?.quality).toBe('medium');
  });

  test('low quality stored and retrieved correctly', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'raw', 'quick-paste.md'),
      slug: 'quick-paste',
      type: 'raw',
      content: 'some random text pasted quickly',
      quality: 'low',
    });

    const row = dbGet<{ quality: string }>(db, 'SELECT quality FROM mindlore_fts WHERE slug = ?', 'quick-paste');
    expect(row?.quality).toBe('low');
  });

  test('NULL quality records are queryable via FTS5', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'no-quality.md'),
      slug: 'no-quality',
      type: 'source',
      content: '# Test\n\nContent without quality assignment.',
    });

    const row = dbGet<{ quality: string | null }>(db, 'SELECT quality FROM mindlore_fts WHERE slug = ?', 'no-quality');
    expect(row?.quality).toBeNull();

    const results = db.prepare("SELECT slug FROM mindlore_fts WHERE mindlore_fts MATCH 'quality'").all();
    expect(results.length).toBeGreaterThan(0);
  });

  test('all three quality values coexist in same DB', () => {
    for (const q of ['high', 'medium', 'low', null]) {
      insertFts(db, {
        path: path.join(TEST_DIR, 'sources', `quality-${q}.md`),
        slug: `quality-${q}`,
        type: 'source',
        content: `Test content for ${q}`,
        quality: q,
      });
    }

    const rows = dbAll<{ slug: string; quality: string | null }>(db, 'SELECT slug, quality FROM mindlore_fts WHERE slug LIKE ?', 'quality-%');
    expect(rows).toHaveLength(4);

    const qualities = rows.map(r => r.quality);
    expect(qualities).toContain('high');
    expect(qualities).toContain('medium');
    expect(qualities).toContain('low');
    expect(qualities).toContain(null);
  });
});

// ── Bulk populate script integration tests ──────────────────────────────

const INIT_SCRIPT = path.join(__dirname, '..', 'dist', 'scripts', 'init.js');
const POPULATE_SCRIPT = path.join(__dirname, '..', 'dist', 'scripts', 'quality-populate.js');
const BULK_DIR = path.join(__dirname, '..', '.test-quality-bulk');

function initMindlore(): void {
  execSync(`node "${INIT_SCRIPT}" init`, {
    cwd: BULK_DIR,
    stdio: 'pipe',
    env: { ...process.env, HOME: BULK_DIR, USERPROFILE: BULK_DIR },
  });
}

function writeSource(filename: string, frontmatter: string, body: string): void {
  const sourcesDir = path.join(BULK_DIR, '.mindlore', 'sources');
  fs.mkdirSync(sourcesDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourcesDir, filename),
    `---\n${frontmatter}\n---\n\n${body}\n`,
    'utf8',
  );
}

function readSourceQuality(filename: string): string | null {
  const content = fs.readFileSync(
    path.join(BULK_DIR, '.mindlore', 'sources', filename),
    'utf8',
  );
  const match = content.match(/^quality:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function runPopulate(): string {
  return execSync(`node "${POPULATE_SCRIPT}"`, {
    cwd: BULK_DIR,
    encoding: 'utf8',
    env: { ...process.env, HOME: BULK_DIR, USERPROFILE: BULK_DIR },
  });
}

describe('Quality populate — bulk script', () => {
  beforeEach(() => {
    fs.mkdirSync(BULK_DIR, { recursive: true });
    initMindlore();
  });

  afterEach(() => {
    fs.rmSync(BULK_DIR, { recursive: true, force: true });
  });

  test('should assign quality based on source_type heuristic', () => {
    writeSource('github-test.md', 'slug: github-test\ntype: source\nsource_type: github-repo', '# GitHub Test');
    writeSource('blog-test.md', 'slug: blog-test\ntype: source\nsource_type: blog', '# Blog Test');
    writeSource('snippet-test.md', 'slug: snippet-test\ntype: source\nsource_type: snippet', '# Snippet Test');

    runPopulate();

    expect(readSourceQuality('github-test.md')).toBe('high');
    expect(readSourceQuality('blog-test.md')).toBe('medium');
    expect(readSourceQuality('snippet-test.md')).toBe('low');
  });

  test('should preserve existing quality values', () => {
    writeSource('already-set.md', 'slug: already-set\ntype: source\nsource_type: blog\nquality: high', '# Already High');

    runPopulate();

    expect(readSourceQuality('already-set.md')).toBe('high');
  });

  test('should handle missing source_type with URL fallback', () => {
    writeSource('github-url.md', 'slug: github-url\ntype: source\nsource_url: https://github.com/user/repo', '# GitHub URL');
    writeSource('docs-url.md', 'slug: docs-url\ntype: source\nsource_url: https://docs.anthropic.com/api', '# Docs URL');

    runPopulate();

    expect(readSourceQuality('github-url.md')).toBe('high');
    expect(readSourceQuality('docs-url.md')).toBe('high');
  });

  test('should default to medium when no heuristic matches', () => {
    writeSource('unknown.md', 'slug: unknown\ntype: source', '# Unknown Source');

    runPopulate();

    expect(readSourceQuality('unknown.md')).toBe('medium');
  });

  test('should report correct counts', () => {
    writeSource('needs-quality.md', 'slug: needs-quality\ntype: source\nsource_type: blog', '# Needs Quality');
    writeSource('has-quality.md', 'slug: has-quality\ntype: source\nquality: low', '# Has Quality');

    const output = runPopulate();

    expect(output).toContain('1 updated');
    expect(output).toContain('1 already set');
    expect(output).toContain('2 total');
  });
});
