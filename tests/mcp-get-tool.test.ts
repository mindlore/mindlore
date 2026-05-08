import path from 'path';
import fs from 'fs';
import os from 'os';
import { createTestDbWithFullSchema, insertFts } from './helpers/db';
import { handleGet } from '../scripts/lib/tool-adapters/get-adapter';
import { handleRelate } from '../scripts/lib/tool-adapters/relate-adapter';
import type { McpContext } from '../scripts/lib/mcp-tools';

describe('mindlore_get tool', () => {
  let testDir: string;
  let ctx: McpContext;
  const sourceContent = `---
slug: alpha-source
type: source
title: Alpha Source
---

## Architecture

This is the architecture section.

## Usage

This is the usage section.
`;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-get-'));
    const sourcesDir = path.join(testDir, 'sources');
    fs.mkdirSync(sourcesDir, { recursive: true });
    const sourcePath = path.join(sourcesDir, 'alpha-source.md');
    fs.writeFileSync(sourcePath, sourceContent);

    const dbPath = path.join(testDir, 'test.db');
    const db = createTestDbWithFullSchema(dbPath);
    insertFts(db, { path: sourcePath, slug: 'alpha-source', title: 'Alpha Source', content: sourceContent, category: 'sources', type: 'source' });
    insertFts(db, { path: path.join(sourcesDir, 'beta.md'), slug: 'beta', title: 'Beta', content: 'beta content', category: 'sources', type: 'source' });
    ctx = { db, baseDir: testDir };
  });

  afterEach(() => {
    ctx.db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('returns full content for a source slug', () => {
    const result = handleGet(ctx, { source: 'alpha-source' });
    expect(result.title).toBe('Alpha Source');
    expect(result.slug).toBe('alpha-source');
    expect(result.content).toContain('Architecture');
    expect(result.content).toContain('Usage');
    expect(result.metadata.size).toBeGreaterThan(0);
  });

  it('returns section content when section param given', () => {
    const result = handleGet(ctx, { source: 'alpha-source', section: 'Architecture' });
    expect(result.content).toContain('architecture section');
    expect(result.content).not.toContain('usage section');
    expect(result.section).toBe('Architecture');
  });

  it('returns section via case-insensitive slug match', () => {
    const result = handleGet(ctx, { source: 'alpha-source', section: 'architecture' });
    expect(result.content).toContain('architecture section');
    expect(result.section).toBe('Architecture');
  });

  it('returns available_sections when section not found', () => {
    const result = handleGet(ctx, { source: 'alpha-source', section: 'nonexistent' });
    expect(result.content).toBe('');
    expect(result.section).toBeUndefined();
    expect(result.available_sections).toContain('Architecture');
    expect(result.available_sections).toContain('Usage');
  });

  it('includes relations when include_relations is true', () => {
    handleRelate(ctx, { action: 'add', source_a: 'alpha-source', source_b: 'beta', relation_type: 'extends' });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const result = handleGet(ctx, { source: 'alpha-source', include_relations: true }) as { relations: Array<{ source: string; relation_type: string; direction: string }> };
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]!.source).toBe('beta');
    expect(result.relations[0]!.relation_type).toBe('extends');
    expect(result.relations[0]!.direction).toBe('outgoing');
  });

  it('excludes relations when include_relations is false', () => {
    handleRelate(ctx, { action: 'add', source_a: 'alpha-source', source_b: 'beta', relation_type: 'extends' });
    const result = handleGet(ctx, { source: 'alpha-source', include_relations: false });
    expect(result.relations).toBeUndefined();
  });

  it('throws when source slug not found', () => {
    expect(() => handleGet(ctx, { source: 'nonexistent' })).toThrow(/not found/);
  });

  it('throws when source file missing from disk', () => {
    insertFts(ctx.db, { path: path.join(testDir, 'sources/ghost.md'), slug: 'ghost', title: 'Ghost', content: 'x', category: 'sources', type: 'source' });
    expect(() => handleGet(ctx, { source: 'ghost' })).toThrow();
  });
});
