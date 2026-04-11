import { validateFrontmatter, FRONTMATTER_SCHEMAS } from '../scripts/lib/schemas';

describe('Zod frontmatter schemas', () => {
  test('all 9 types have schemas defined', () => {
    const types = ['raw', 'source', 'domain', 'analysis', 'diary', 'decision', 'insight', 'connection', 'learning'];
    for (const t of types) {
      expect(FRONTMATTER_SCHEMAS[t]).toBeDefined();
    }
  });

  test('valid source frontmatter passes', () => {
    const result = validateFrontmatter({
      type: 'source',
      slug: 'react-hooks',
      title: 'React Hooks Guide',
      quality: 'high',
      tags: 'react, hooks',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing type field fails', () => {
    const result = validateFrontmatter({ slug: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('type');
  });

  test('unknown type fails', () => {
    const result = validateFrontmatter({ type: 'unknown', slug: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('unknown');
  });

  test('source missing slug fails', () => {
    const result = validateFrontmatter({ type: 'source' });
    expect(result.valid).toBe(false);
  });

  test('invalid quality enum fails', () => {
    const result = validateFrontmatter({
      type: 'source',
      slug: 'test',
      quality: 'excellent',
    });
    expect(result.valid).toBe(false);
  });

  test('valid diary frontmatter passes', () => {
    const result = validateFrontmatter({
      type: 'diary',
      slug: 'delta-2026-04-12',
      date: '2026-04-12',
    });
    expect(result.valid).toBe(true);
  });

  test('valid connection frontmatter passes', () => {
    const result = validateFrontmatter({
      type: 'connection',
      slug: 'conn-a-b',
      strength: 'medium',
      sources: ['source-a.md', 'source-b.md'],
    });
    expect(result.valid).toBe(true);
  });

  test('valid decision with supersedes passes', () => {
    const result = validateFrontmatter({
      type: 'decision',
      slug: 'dec-002',
      status: 'active',
      supersedes: 'dec-001',
    });
    expect(result.valid).toBe(true);
  });

  test('tags as array passes', () => {
    const result = validateFrontmatter({
      type: 'raw',
      slug: 'test-raw',
      tags: ['tag1', 'tag2'],
    });
    expect(result.valid).toBe(true);
  });

  test('tags as string passes', () => {
    const result = validateFrontmatter({
      type: 'raw',
      slug: 'test-raw',
      tags: 'tag1, tag2',
    });
    expect(result.valid).toBe(true);
  });
});
