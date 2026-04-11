import path from 'path';
import type Database from 'better-sqlite3';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db';

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

    const row = db.prepare('SELECT quality FROM mindlore_fts WHERE slug = ?').get('anthropic-docs') as { quality: string };
    expect(row.quality).toBe('high');
  });

  test('medium quality stored and retrieved correctly', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'blog-post.md'),
      slug: 'blog-post',
      type: 'source',
      content: '# React Patterns\n\nSome thoughts on React patterns.',
      quality: 'medium',
    });

    const row = db.prepare('SELECT quality FROM mindlore_fts WHERE slug = ?').get('blog-post') as { quality: string };
    expect(row.quality).toBe('medium');
  });

  test('low quality stored and retrieved correctly', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'raw', 'quick-paste.md'),
      slug: 'quick-paste',
      type: 'raw',
      content: 'some random text pasted quickly',
      quality: 'low',
    });

    const row = db.prepare('SELECT quality FROM mindlore_fts WHERE slug = ?').get('quick-paste') as { quality: string };
    expect(row.quality).toBe('low');
  });

  test('NULL quality records are queryable via FTS5', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'no-quality.md'),
      slug: 'no-quality',
      type: 'source',
      content: '# Test\n\nContent without quality assignment.',
    });

    const row = db.prepare('SELECT quality FROM mindlore_fts WHERE slug = ?').get('no-quality') as { quality: string | null };
    expect(row.quality).toBeNull();

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

    const rows = db.prepare('SELECT slug, quality FROM mindlore_fts WHERE slug LIKE ?').all('quality-%') as Array<{ slug: string; quality: string | null }>;
    expect(rows).toHaveLength(4);

    const qualities = rows.map(r => r.quality);
    expect(qualities).toContain('high');
    expect(qualities).toContain('medium');
    expect(qualities).toContain('low');
    expect(qualities).toContain(null);
  });
});
