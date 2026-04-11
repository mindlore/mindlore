import { TYPE_TO_DIR } from '../scripts/lib/constants.js';

 
const { parseFrontmatter: parse, extractFtsMetadata } = require('../hooks/lib/mindlore-common.cjs') as {
  parseFrontmatter: (content: string) => { meta: Record<string, string | string[]>; body: string };
  extractFtsMetadata: (
    meta: Record<string, string | string[]>,
    body: string,
    filePath: string,
    baseDir: string,
  ) => { slug: string; description: string; type: string; category: string; title: string; tags: string; quality: string | null };
};

interface Frontmatter {
  slug?: string;
  type?: string;
  title?: string;
  tags?: string[];
  source_url?: string;
  [key: string]: unknown;
}

describe('Frontmatter Parser', () => {
  function parseFrontmatter(content: string): Frontmatter | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match?.[1]) return null;

    const fm: Record<string, unknown> = {};
    const lines = match[1].split('\n');
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const rawValue = line.slice(colonIdx + 1).trim();
      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        fm[key] = rawValue
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim());
      } else {
        fm[key] = rawValue;
      }
    }
    return Object.keys(fm).length > 0 ? (fm as Frontmatter) : null;
  }

  test('should parse valid frontmatter', () => {
    const content = [
      '---',
      'slug: my-source',
      'type: source',
      'title: My Source',
      'tags: [typescript, node]',
      '---',
      '',
      '# My Source',
    ].join('\n');

    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm!.slug).toBe('my-source');
    expect(fm!.type).toBe('source');
    expect(fm!.title).toBe('My Source');
    expect(fm!.tags).toEqual(['typescript', 'node']);
  });

  test('should return null for missing frontmatter', () => {
    const content = '# No Frontmatter\n\nJust content.';
    const fm = parseFrontmatter(content);
    expect(fm).toBeNull();
  });

  test('should handle empty frontmatter', () => {
    const content = '---\n---\n# Empty';
    const fm = parseFrontmatter(content);
    expect(fm).toBeNull();
  });

  test('should handle frontmatter with single field', () => {
    const content = '---\nslug: minimal\n---\n# Minimal';
    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm!.slug).toBe('minimal');
  });

  test('should handle CRLF line endings', () => {
    const content = '---\r\nslug: test\r\ntype: raw\r\n---\r\n# Test';
    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm!.slug).toBe('test');
    expect(fm!.type).toBe('raw');
  });

  test('should validate type-directory mapping', () => {
    expect(Object.keys(TYPE_TO_DIR)).toHaveLength(9);

    const dirs = new Set(Object.values(TYPE_TO_DIR));
    expect(dirs.size).toBe(9);
  });

  test('should extract tags for FTS5 indexing', () => {
    const content = '---\nslug: tagged\ntype: source\ntags: [security, hooks, fts5]\n---\n# Tagged Doc\n\nContent.';
    const { meta, body } = parse(content);
    const result = extractFtsMetadata(meta, body, '/test/sources/tagged.md', '/test');

    expect(result.tags).toBe('security, hooks, fts5');
    expect(result.quality).toBeNull();
  });

  test('should handle values containing colons', () => {
    const content = '---\nsource_url: https://example.com/path\nslug: test\n---\n';
    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm!.source_url).toBe('https://example.com/path');
  });
});
