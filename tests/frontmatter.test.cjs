'use strict';

describe('Frontmatter Parser', () => {
  function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;

    const fm = {};
    const lines = match[1].split('\n');
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim());
      }
      fm[key] = value;
    }
    return fm;
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
    expect(fm.slug).toBe('my-source');
    expect(fm.type).toBe('source');
    expect(fm.title).toBe('My Source');
    expect(fm.tags).toEqual(['typescript', 'node']);
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
    expect(fm.slug).toBe('minimal');
  });

  test('should handle CRLF line endings', () => {
    const content = '---\r\nslug: test\r\ntype: raw\r\n---\r\n# Test';
    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm.slug).toBe('test');
    expect(fm.type).toBe('raw');
  });

  test('should validate type-directory mapping', () => {
    const { TYPE_TO_DIR } = require('../scripts/lib/constants.cjs');

    expect(Object.keys(TYPE_TO_DIR)).toHaveLength(9);

    const dirs = new Set(Object.values(TYPE_TO_DIR));
    expect(dirs.size).toBe(9);
  });

  test('should extract tags for FTS5 indexing', () => {
    const { parseFrontmatter: parse, extractFtsMetadata } = require('../hooks/lib/mindlore-common.cjs');

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
    expect(fm.source_url).toBe('https://example.com/path');
  });
});
