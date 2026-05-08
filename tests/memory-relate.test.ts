import path from 'path';
import fs from 'fs';
import os from 'os';
import { createTestDbWithFullSchema, insertFts } from './helpers/db';
import { handleSearch } from '../scripts/lib/tool-adapters/search-adapter';
import { handleRelate } from '../scripts/lib/tool-adapters/relate-adapter';
import type { McpContext } from '../scripts/lib/mcp-tools';

describe('Memory Relate — search with related sources', () => {
  let testDir: string;
  let ctx: McpContext;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-memrel-'));
    const dbPath = path.join(testDir, 'test.db');
    const db = createTestDbWithFullSchema(dbPath);
    insertFts(db, { path: path.join(testDir, 'sources/react.md'), slug: 'react', title: 'React Framework', content: 'React is a UI library for building user interfaces', category: 'sources', type: 'source' });
    insertFts(db, { path: path.join(testDir, 'sources/vue.md'), slug: 'vue', title: 'Vue Framework', content: 'Vue is a progressive framework', category: 'sources', type: 'source' });
    insertFts(db, { path: path.join(testDir, 'sources/angular.md'), slug: 'angular', title: 'Angular Framework', content: 'Angular is a platform', category: 'sources', type: 'source' });
    ctx = { db, baseDir: testDir };
  });

  afterEach(() => {
    ctx.db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('includes related sources in search response', () => {
    handleRelate(ctx, { action: 'add', source_a: 'react', source_b: 'vue', relation_type: 'extends' });
    const result = handleSearch(ctx, { query: 'React UI library' });
    expect(result.related).toBeDefined();
    expect(result.related.length).toBeGreaterThan(0);
    expect(result.related[0]!.source).toBe('vue');
    expect(result.related[0]!.via).toBe('react');
  });

  it('deduplicates related sources that appear in results', () => {
    handleRelate(ctx, { action: 'add', source_a: 'react', source_b: 'vue', relation_type: 'extends' });
    const result = handleSearch(ctx, { query: 'framework' });
    const resultSlugs = new Set(result.results.map(r => r.slug));
    for (const rel of result.related) {
      expect(resultSlugs.has(rel.source)).toBe(false);
    }
  });

  it('sorts related by priority (supersedes > contradicts > extends > cites)', () => {
    handleRelate(ctx, { action: 'add', source_a: 'react', source_b: 'vue', relation_type: 'cites' });
    handleRelate(ctx, { action: 'add', source_a: 'react', source_b: 'angular', relation_type: 'supersedes' });
    const result = handleSearch(ctx, { query: 'React UI library' });
    expect(result.related.length).toBeGreaterThanOrEqual(2);
    const types = result.related.map(r => r.relation_type);
    const supersIdx = types.indexOf('supersedes');
    const citesIdx = types.indexOf('cites');
    if (supersIdx !== -1 && citesIdx !== -1) {
      expect(supersIdx).toBeLessThan(citesIdx);
    }
  });

  it('returns max 5 related sources', () => {
    for (let i = 0; i < 8; i++) {
      const slug = `extra-${i}`;
      insertFts(ctx.db, { path: path.join(testDir, `sources/${slug}.md`), slug, title: `Extra ${i}`, content: `extra content ${i}`, category: 'sources', type: 'source' });
      handleRelate(ctx, { action: 'add', source_a: 'react', source_b: slug, relation_type: 'cites' });
    }
    const result = handleSearch(ctx, { query: 'React UI library' });
    expect(result.related.length).toBeLessThanOrEqual(5);
  });

  it('returns empty related when no relations exist', () => {
    const result = handleSearch(ctx, { query: 'React UI library' });
    expect(result.related).toEqual([]);
  });
});
