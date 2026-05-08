import path from 'path';
import fs from 'fs';
import os from 'os';
import { createTestDbWithFullSchema, insertFts } from './helpers/db';
import { handleIngest } from '../scripts/lib/tool-adapters/ingest-adapter';
import { handleRelate } from '../scripts/lib/tool-adapters/relate-adapter';
import { handleSearch } from '../scripts/lib/tool-adapters/search-adapter';
import { handleGet } from '../scripts/lib/tool-adapters/get-adapter';
import type { McpContext } from '../scripts/lib/mcp-tools';

describe('E2E: KG pipeline — ingest → relate → search → get', () => {
  let testDir: string;
  let ctx: McpContext;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-e2e-kg-'));
    fs.mkdirSync(path.join(testDir, 'raw'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'sources'), { recursive: true });
    const dbPath = path.join(testDir, 'test.db');
    const db = createTestDbWithFullSchema(dbPath);
    ctx = { db, baseDir: testDir };
  });

  afterEach(() => {
    ctx.db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('full pipeline: ingest two sources, relate, search finds related, get retrieves with relations', () => {
    // 1. Ingest source A
    const a = handleIngest(ctx, { type: 'text', content: 'React is a UI framework for web apps', title: 'React Guide' });
    expect(a.slug).toBe('react-guide');

    // Manually index into FTS5 (ingest writes to raw/, FTS5 sync is via hook)
    insertFts(ctx.db, { path: a.path, slug: a.slug, title: 'React Guide', content: 'React is a UI framework for web apps', category: 'raw', type: 'raw' });

    // 2. Ingest source B
    const b = handleIngest(ctx, { type: 'text', content: 'Next.js builds on top of React for SSR', title: 'Next.js Guide' });
    expect(b.slug).toBe('nextjs-guide');
    insertFts(ctx.db, { path: b.path, slug: b.slug, title: 'Next.js Guide', content: 'Next.js builds on top of React for SSR', category: 'raw', type: 'raw' });

    // 3. Relate: B extends A
    const rel = handleRelate(ctx, { action: 'add', source_a: 'nextjs-guide', source_b: 'react-guide', relation_type: 'extends' }) as { created: boolean };
    expect(rel.created).toBe(true);

    // 4. Search for "Next.js" → related should include react-guide
    const search = handleSearch(ctx, { query: 'Next.js SSR' });
    const nextResult = search.results.find(r => r.slug === 'nextjs-guide');
    expect(nextResult).toBeDefined();

    // 5. Get source with relations
    const got = handleGet(ctx, { source: 'nextjs-guide' });
    expect(got.content).toContain('Next.js builds on top of React');
    expect(got.relations).toBeDefined();
    expect(got.relations!.some(r => r.source === 'react-guide')).toBe(true);

    // 6. Remove relation → search should have empty related for this pair
    handleRelate(ctx, { action: 'remove', source_a: 'nextjs-guide', source_b: 'react-guide', relation_type: 'extends' });
    const got2 = handleGet(ctx, { source: 'nextjs-guide' });
    expect(got2.relations ?? []).toHaveLength(0);
  });
});
