import path from 'path';
import fs from 'fs';
import { setupTestDir, teardownTestDir } from './helpers/db.js';

// Hook remains .cjs — import via require with type cast
 
const { parseFrontmatter } = require('../hooks/lib/mindlore-common.cjs') as {
  parseFrontmatter: (raw: string) => { meta: Record<string, string>; body: string };
};

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-log');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['diary', 'learnings']);
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Log Skill Structures', () => {
  test('learnings file should follow topic-based format', () => {
    const content = [
      '---',
      'slug: testing',
      'type: learning',
      'title: Testing Learnings',
      'tags: [testing, jest]',
      '---',
      '',
      '# Testing Learnings',
      '',
      "- YAPMA: Error handling testinde mock'u dolayli tetikleme",
      "- BEST PRACTICE: Side-effect'li moduller eklerken TUM test'lerde mock ekle",
      '',
    ].join('\n');

    const filePath = path.join(TEST_DIR, 'learnings', 'testing.md');
    fs.writeFileSync(filePath, content, 'utf8');

    const raw = fs.readFileSync(filePath, 'utf8');
    expect(raw).toContain('type: learning');
    expect(raw).toContain('YAPMA:');
    expect(raw).toContain('BEST PRACTICE:');
  });

  test('delta archived flag should be valid frontmatter', () => {
    const content = [
      '---',
      'slug: delta-2026-04-10-1200',
      'type: diary',
      'date: 2026-04-10',
      'archived: true',
      '---',
      '',
      '# Session Delta — 2026-04-10-1200',
      '',
    ].join('\n');

    const filePath = path.join(TEST_DIR, 'diary', 'delta-2026-04-10-1200.md');
    fs.writeFileSync(filePath, content, 'utf8');

    const { meta } = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
    expect(meta['archived']).toBe('true');
    expect(meta['type']).toBe('diary');
  });

  test('diary directory should accept delta and note files', () => {
    fs.writeFileSync(
      path.join(TEST_DIR, 'diary', 'delta-2026-04-10-1200.md'),
      '---\nslug: delta-2026-04-10-1200\ntype: diary\ndate: 2026-04-10\n---\n# Delta\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(TEST_DIR, 'diary', 'note-2026-04-10-1530.md'),
      '---\nslug: note-2026-04-10-1530\ntype: diary\ndate: 2026-04-10\n---\n# Note\n',
      'utf8',
    );

    const files = fs.readdirSync(path.join(TEST_DIR, 'diary'));
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.startsWith('delta-'))).toBe(true);
    expect(files.some((f) => f.startsWith('note-'))).toBe(true);
  });
});
