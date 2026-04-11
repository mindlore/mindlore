import fs from 'fs';
import path from 'path';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db';

const TEST_DIR = path.join(__dirname, '..', '.test-e2e-pipeline');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, [
    'raw', 'sources', 'domains', 'analyses', 'insights',
    'connections', 'learnings', 'diary', 'decisions',
  ]);
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('E2E Pipeline: ingest → index → search → connections', () => {
  test('full pipeline: write source → index → search finds it', () => {
    // Step 1: Simulate ingest — write raw + source
    const rawContent = [
      '---',
      'slug: react-hooks-raw',
      'type: raw',
      'source_url: https://react.dev/reference/react/useEffect',
      'date_captured: 2026-04-12',
      '---',
      '',
      '# useEffect',
      '',
      'useEffect is a React Hook that lets you synchronize a component with an external system.',
    ].join('\n');

    const sourceContent = [
      '---',
      'slug: react-hooks',
      'type: source',
      'title: React useEffect Guide',
      'source_url: https://react.dev/reference/react/useEffect',
      'date_captured: 2026-04-12',
      'tags: react, hooks, useEffect',
      'quality: high',
      '---',
      '',
      '# React useEffect Guide',
      '',
      'useEffect lets you synchronize with external systems.',
      '',
      '## Key Takeaways',
      '- Cleanup function prevents memory leaks',
      '- Dependency array controls re-execution',
    ].join('\n');

    fs.writeFileSync(path.join(TEST_DIR, 'raw', 'react-hooks-raw.md'), rawContent);
    fs.writeFileSync(path.join(TEST_DIR, 'sources', 'react-hooks.md'), sourceContent);

    // Step 2: Index into FTS5
    const db = createTestDb(DB_PATH);
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'react-hooks.md'),
      slug: 'react-hooks',
      description: 'React useEffect synchronization patterns',
      type: 'source',
      category: 'sources',
      title: 'React useEffect Guide',
      content: sourceContent,
      tags: 'react, hooks, useEffect',
      quality: 'high',
      dateCaptured: '2026-04-12',
    });

    // Step 3: Search — should find the indexed source
    const results = db.prepare(
      "SELECT slug, title, quality, date_captured FROM mindlore_fts WHERE mindlore_fts MATCH 'useEffect'"
    ).all() as Array<{ slug: string; title: string; quality: string; date_captured: string }>;

    expect(results).toHaveLength(1);
    expect(results[0]!.slug).toBe('react-hooks');
    expect(results[0]!.quality).toBe('high');
    expect(results[0]!.date_captured).toBe('2026-04-12');

    db.close();
  });

  test('multi-source search with ranking', () => {
    const db = createTestDb(DB_PATH);

    // Insert 3 sources with overlapping keywords
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'hooks-guide.md'),
      slug: 'hooks-guide',
      type: 'source',
      title: 'Hooks Complete Guide',
      content: 'Hooks hooks hooks. useEffect, useState, useCallback. Hooks are lifecycle callbacks in React.',
      tags: 'react, hooks',
      quality: 'high',
    });

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'cc-hooks.md'),
      slug: 'cc-hooks',
      type: 'source',
      title: 'Claude Code Hooks',
      content: 'PreToolUse hooks, PostToolUse hooks, SessionStart hooks. CC lifecycle callbacks.',
      tags: 'hooks, claude-code',
      quality: 'high',
    });

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'python-basics.md'),
      slug: 'python-basics',
      type: 'source',
      title: 'Python Basics',
      content: 'Python is a programming language for data science and web development.',
      tags: 'python',
      quality: 'medium',
    });

    // Search "hooks" — should return 2, not python
    const results = db.prepare(
      "SELECT slug FROM mindlore_fts WHERE mindlore_fts MATCH 'hooks' ORDER BY rank"
    ).all() as Array<{ slug: string }>;

    expect(results.length).toBeGreaterThanOrEqual(2);
    const slugs = results.map(r => r.slug);
    expect(slugs).toContain('hooks-guide');
    expect(slugs).toContain('cc-hooks');
    expect(slugs).not.toContain('python-basics');

    db.close();
  });

  test('connection detection: shared tags across sources', () => {
    const db = createTestDb(DB_PATH);

    // Two sources with shared "hooks" tag but different domains
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'react-hooks.md'),
      slug: 'react-hooks',
      type: 'source',
      title: 'React Hooks',
      content: 'React hooks for state management',
      tags: 'hooks, react, state-management',
    });

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'cc-hooks.md'),
      slug: 'cc-hooks',
      type: 'source',
      title: 'CC Hooks',
      content: 'Claude Code hooks for lifecycle callbacks',
      tags: 'hooks, claude-code, lifecycle',
    });

    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'unrelated.md'),
      slug: 'unrelated',
      type: 'source',
      title: 'Python ML',
      content: 'Machine learning with Python',
      tags: 'python, ml',
    });

    // Find tag overlap (simulating explore logic)
    const allSources = db.prepare(
      "SELECT slug, tags FROM mindlore_fts WHERE type = 'source'"
    ).all() as Array<{ slug: string; tags: string }>;

    const tagMap: Record<string, string[]> = {};
    for (const src of allSources) {
      if (!src.tags) continue;
      const tags = src.tags.split(',').map(t => t.trim());
      for (const tag of tags) {
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag]!.push(src.slug);
      }
    }

    // "hooks" tag shared by react-hooks and cc-hooks
    expect(tagMap['hooks']).toBeDefined();
    expect(tagMap['hooks']!).toContain('react-hooks');
    expect(tagMap['hooks']!).toContain('cc-hooks');
    expect(tagMap['hooks']!).not.toContain('unrelated');

    // Write connection file
    const connectionContent = [
      '---',
      'type: connection',
      'slug: conn-react-cc-hooks',
      'sources: [react-hooks.md, cc-hooks.md]',
      'strength: medium',
      'tags: hooks',
      '---',
      '',
      '## Connection',
      'Both sources discuss hooks patterns in different contexts.',
    ].join('\n');

    const connPath = path.join(TEST_DIR, 'connections', 'conn-react-cc-hooks.md');
    fs.writeFileSync(connPath, connectionContent);
    expect(fs.existsSync(connPath)).toBe(true);

    // Connection is indexable
    insertFts(db, {
      path: connPath,
      slug: 'conn-react-cc-hooks',
      type: 'connection',
      title: 'React Hooks ↔ CC Hooks',
      content: connectionContent,
      tags: 'hooks',
    });

    const connResults = db.prepare(
      "SELECT slug FROM mindlore_fts WHERE type = 'connection'"
    ).all() as Array<{ slug: string }>;
    expect(connResults).toHaveLength(1);

    db.close();
  });

  test('10-column FTS5 schema integrity', () => {
    const db = createTestDb(DB_PATH);

    // Insert a row with all 10 columns and read back to verify schema
    insertFts(db, {
      path: '/test/schema-check.md',
      slug: 'schema-check',
      description: 'test desc',
      type: 'source',
      category: 'sources',
      title: 'Schema Check',
      content: 'test content',
      tags: 'test',
      quality: 'high',
      dateCaptured: '2026-04-12',
    });

    const row = db.prepare(
      'SELECT path, slug, description, type, category, title, content, tags, quality, date_captured FROM mindlore_fts WHERE slug = ?'
    ).get('schema-check') as Record<string, string | null>;

    expect(row.path).toBe('/test/schema-check.md');
    expect(row.slug).toBe('schema-check');
    expect(row.description).toBe('test desc');
    expect(row.type).toBe('source');
    expect(row.category).toBe('sources');
    expect(row.title).toBe('Schema Check');
    expect(row.content).toBe('test content');
    expect(row.tags).toBe('test');
    expect(row.quality).toBe('high');
    expect(row.date_captured).toBe('2026-04-12');

    db.close();
  });
});
