import path from 'path';
import fs from 'fs';
import os from 'os';
import { createTestDbWithFullSchema, insertFts } from './helpers/db';
import { handleRelate } from '../scripts/lib/tool-adapters/relate-adapter';
import type { McpContext } from '../scripts/lib/mcp-tools';

describe('mindlore_relate tool', () => {
  let testDir: string;
  let ctx: McpContext;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-relate-'));
    const dbPath = path.join(testDir, 'test.db');
    const db = createTestDbWithFullSchema(dbPath);
    insertFts(db, { path: path.join(testDir, 'sources/alpha.md'), slug: 'alpha', title: 'Alpha', content: 'content A', category: 'sources', type: 'source' });
    insertFts(db, { path: path.join(testDir, 'sources/beta.md'), slug: 'beta', title: 'Beta', content: 'content B', category: 'sources', type: 'source' });
    ctx = { db, baseDir: testDir };
  });

  afterEach(() => {
    ctx.db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('adds a new relation', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const result = handleRelate(ctx, { action: 'add', source_a: 'alpha', source_b: 'beta', relation_type: 'extends' }) as { created: boolean; existing: boolean };
    expect(result.created).toBe(true);
    expect(result.existing).toBe(false);
  });

  it('returns existing=true for duplicate relation', () => {
    handleRelate(ctx, { action: 'add', source_a: 'alpha', source_b: 'beta', relation_type: 'extends' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const result = handleRelate(ctx, { action: 'add', source_a: 'alpha', source_b: 'beta', relation_type: 'extends' }) as { created: boolean; existing: boolean };
    expect(result.created).toBe(false);
    expect(result.existing).toBe(true);
  });

  it('removes a relation', () => {
    handleRelate(ctx, { action: 'add', source_a: 'alpha', source_b: 'beta', relation_type: 'cites' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const result = handleRelate(ctx, { action: 'remove', source_a: 'alpha', source_b: 'beta', relation_type: 'cites' }) as { removed: boolean };
    expect(result.removed).toBe(true);
  });

  it('returns removed=false for non-existent relation', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const result = handleRelate(ctx, { action: 'remove', source_a: 'alpha', source_b: 'beta', relation_type: 'cites' }) as { removed: boolean };
    expect(result.removed).toBe(false);
  });

  it('lists all relations', () => {
    handleRelate(ctx, { action: 'add', source_a: 'alpha', source_b: 'beta', relation_type: 'extends' });
    handleRelate(ctx, { action: 'add', source_a: 'beta', source_b: 'alpha', relation_type: 'cites' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const result = handleRelate(ctx, { action: 'list' }) as { relations: Array<{ source_a: string }>; total: number };
    expect(result.relations).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('lists relations filtered by source', () => {
    handleRelate(ctx, { action: 'add', source_a: 'alpha', source_b: 'beta', relation_type: 'extends' });
    handleRelate(ctx, { action: 'add', source_a: 'beta', source_b: 'alpha', relation_type: 'cites' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const result = handleRelate(ctx, { action: 'list', source: 'alpha' }) as { relations: Array<{ source_a: string }>; total: number };
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]!.source_a).toBe('alpha');
  });

  it('throws on invalid relation_type', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      handleRelate(ctx, { action: 'add', source_a: 'alpha', source_b: 'beta', relation_type: 'invalid' as 'cites' });
    }).toThrow();
  });

  it('throws when source slug not found in FTS5', () => {
    expect(() => {
      handleRelate(ctx, { action: 'add', source_a: 'nonexistent', source_b: 'beta', relation_type: 'cites' });
    }).toThrow(/not found/);
  });

  it('requires source_a and source_b for add action', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      handleRelate(ctx, { action: 'add', source_a: 'alpha' } as never);
    }).toThrow();
  });
});
