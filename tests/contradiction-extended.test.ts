import fs from 'fs';
import path from 'path';
import { setupTestDir, teardownTestDir } from './helpers/db.js';

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-contradiction');

function writeFile(relPath: string, content: string): void {
  const full = path.join(TEST_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function makeFrontmatter(fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources', 'domains', 'analyses', 'insights', 'decisions', 'learnings']);
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

// Lazy import to use dist build
function loadModule(): typeof import('../scripts/lib/contradiction.js') {
  return require('../scripts/lib/contradiction.js');
}

describe('contradiction module', () => {
  describe('date contradictions', () => {
    test('detects conflicting dates for same event across files sharing a tag', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'a', type: 'source', tags: '[ai, release]' }) +
        'GPT-4 was released on 2023-03-14.\n'
      );
      writeFile('sources/b.md',
        makeFrontmatter({ slug: 'b', type: 'source', tags: '[ai, release]' }) +
        'GPT-4 was released on 2023-04-01.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const dateResults = results.filter(r => r.rule === 'date-contradiction');
      expect(dateResults.length).toBeGreaterThanOrEqual(1);
      expect(dateResults[0]!.files.length).toBe(2);
    });

    test('no date contradiction when dates match', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'a', type: 'source', tags: '[ai]' }) +
        'GPT-4 was released on 2023-03-14.\n'
      );
      writeFile('sources/b.md',
        makeFrontmatter({ slug: 'b', type: 'source', tags: '[ai]' }) +
        'GPT-4 was released on 2023-03-14.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const dateResults = results.filter(r => r.rule === 'date-contradiction');
      expect(dateResults).toHaveLength(0);
    });
  });

  describe('boolean contradictions', () => {
    test('detects enabled vs disabled for same feature', () => {
      const { detectContradictions } = loadModule();

      writeFile('domains/a.md',
        makeFrontmatter({ slug: 'config-a', type: 'domain', tags: '[infra]' }) +
        'The cache is enabled by default.\n'
      );
      writeFile('domains/b.md',
        makeFrontmatter({ slug: 'config-b', type: 'domain', tags: '[infra]' }) +
        'The cache is disabled by default.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const boolResults = results.filter(r => r.rule === 'boolean-contradiction');
      expect(boolResults.length).toBeGreaterThanOrEqual(1);
      expect(boolResults[0]!.detail).toContain('cache');
    });

    test('no boolean contradiction when different subjects', () => {
      const { detectContradictions } = loadModule();

      writeFile('domains/a.md',
        makeFrontmatter({ slug: 'a', type: 'domain', tags: '[infra]' }) +
        'The cache is enabled.\n'
      );
      writeFile('domains/b.md',
        makeFrontmatter({ slug: 'b', type: 'domain', tags: '[infra]' }) +
        'The logging is disabled.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const boolResults = results.filter(r => r.rule === 'boolean-contradiction');
      expect(boolResults).toHaveLength(0);
    });
  });

  describe('version contradictions', () => {
    test('detects conflicting version numbers for same feature', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'a', type: 'source', tags: '[nodejs]' }) +
        'Node.js version 18.0.0 is recommended.\n'
      );
      writeFile('sources/b.md',
        makeFrontmatter({ slug: 'b', type: 'source', tags: '[nodejs]' }) +
        'Node.js version 20.0.0 is recommended.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const versionResults = results.filter(r => r.rule === 'version-contradiction');
      expect(versionResults.length).toBeGreaterThanOrEqual(1);
    });

    test('no version contradiction when versions match', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'a', type: 'source', tags: '[nodejs]' }) +
        'Node.js version 20.0.0 is recommended.\n'
      );
      writeFile('sources/b.md',
        makeFrontmatter({ slug: 'b', type: 'source', tags: '[nodejs]' }) +
        'Node.js version 20.0.0 is recommended.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const versionResults = results.filter(r => r.rule === 'version-contradiction');
      expect(versionResults).toHaveLength(0);
    });
  });

  describe('frontmatter inconsistencies', () => {
    test('detects duplicate slugs with conflicting types', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'my-topic', type: 'source', tags: '[test]' }) +
        'Content A.\n'
      );
      writeFile('domains/b.md',
        makeFrontmatter({ slug: 'my-topic', type: 'domain', tags: '[test]' }) +
        'Content B.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const fmResults = results.filter(r => r.rule === 'frontmatter-inconsistency');
      expect(fmResults.length).toBeGreaterThanOrEqual(1);
      expect(fmResults[0]!.detail).toContain('my-topic');
    });

    test('no frontmatter issue when slugs are unique', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'topic-a', type: 'source', tags: '[test]' }) +
        'Content A.\n'
      );
      writeFile('domains/b.md',
        makeFrontmatter({ slug: 'topic-b', type: 'domain', tags: '[test]' }) +
        'Content B.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const fmResults = results.filter(r => r.rule === 'frontmatter-inconsistency');
      expect(fmResults).toHaveLength(0);
    });
  });

  describe('clean data — no false positives', () => {
    test('returns empty array for clean consistent data', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'clean-a', type: 'source', tags: '[dev]' }) +
        'TypeScript is great for type safety.\n'
      );
      writeFile('sources/b.md',
        makeFrontmatter({ slug: 'clean-b', type: 'source', tags: '[dev]' }) +
        'ESLint helps maintain code quality.\n'
      );

      const results = detectContradictions(TEST_DIR);
      expect(results).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('handles empty directories', () => {
      const { detectContradictions } = loadModule();
      const results = detectContradictions(TEST_DIR);
      expect(results).toHaveLength(0);
    });

    test('handles files without frontmatter', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/no-fm.md', 'Just plain content, no frontmatter.\n');

      const results = detectContradictions(TEST_DIR);
      expect(results).toHaveLength(0);
    });

    test('handles files without tags', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/no-tags.md',
        makeFrontmatter({ slug: 'no-tags', type: 'source' }) +
        'Content without tags.\n'
      );

      const results = detectContradictions(TEST_DIR);
      expect(results).toHaveLength(0);
    });

    test('handles missing directories gracefully', () => {
      const { detectContradictions } = loadModule();
      const emptyDir = path.join(TEST_DIR, 'subempty');
      fs.mkdirSync(emptyDir, { recursive: true });
      const results = detectContradictions(emptyDir);
      expect(results).toHaveLength(0);
    });
  });

  describe('tag exact-prefix match (M2 regression)', () => {
    test('"api" tag should not collide with "api-gateway" tag', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/api.md',
        makeFrontmatter({ slug: 'api-doc', type: 'source', tags: '[api]' }) +
        'REST API was released on 2024-01-01.\n'
      );
      writeFile('sources/gateway.md',
        makeFrontmatter({ slug: 'gw-doc', type: 'source', tags: '[api-gateway]' }) +
        'REST API was released on 2024-06-01.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const dateResults = results.filter(r => r.rule === 'date-contradiction');
      expect(dateResults).toHaveLength(0);
    });

    test('exact tag match groups files correctly', () => {
      const { detectContradictions } = loadModule();

      writeFile('sources/a.md',
        makeFrontmatter({ slug: 'a', type: 'source', tags: '[api]' }) +
        'Service version 1.0.0 is live.\n'
      );
      writeFile('sources/b.md',
        makeFrontmatter({ slug: 'b', type: 'source', tags: '[api]' }) +
        'Service version 2.0.0 is live.\n'
      );

      const results = detectContradictions(TEST_DIR);
      const versionResults = results.filter(r => r.rule === 'version-contradiction');
      expect(versionResults.length).toBeGreaterThanOrEqual(1);
    });
  });
});
