import fs from 'fs';
import path from 'path';
import { setupTestDir, teardownTestDir } from './helpers/db';

const TEST_DIR = path.join(__dirname, '..', '.test-reflect');
const DIARY_DIR = path.join(TEST_DIR, 'diary');
const LEARNINGS_DIR = path.join(TEST_DIR, 'learnings');

function writeDelta(slug: string, date: string, files: string[], opts?: { archived?: boolean }): void {
  const frontmatter = [
    '---',
    `slug: ${slug}`,
    'type: diary',
    `date: ${date}`,
    ...(opts?.archived ? ['archived: true'] : []),
    '---',
  ];
  const content = [
    ...frontmatter,
    '',
    `# Session Delta — ${slug}`,
    '',
    '## Changed Files',
    ...files.map(f => `- ${f}`),
  ].join('\n');
  fs.writeFileSync(path.join(DIARY_DIR, `${slug}.md`), content);
}

beforeEach(() => {
  setupTestDir(TEST_DIR, ['diary', 'learnings']);
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('Reflect — diary scanning and pattern extraction', () => {
  test('diary deltas are readable and parseable', () => {
    writeDelta('delta-2026-04-10-1400', '2026-04-10', ['tests/fts5.test.ts', 'scripts/lib/constants.ts']);
    writeDelta('delta-2026-04-11-0900', '2026-04-11', ['tests/dedup.test.ts', 'scripts/lib/constants.ts']);

    const deltas = fs.readdirSync(DIARY_DIR)
      .filter(f => f.startsWith('delta-') && f.endsWith('.md'))
      .sort();

    expect(deltas).toHaveLength(2);
    for (const d of deltas) {
      const content = fs.readFileSync(path.join(DIARY_DIR, d), 'utf8');
      expect(content).toContain('type: diary');
      expect(content).toContain('## Changed Files');
    }
  });

  test('recurring patterns are detectable across deltas', () => {
    writeDelta('delta-2026-04-10-1000', '2026-04-10', ['scripts/lib/constants.ts', 'tests/fts5.test.ts']);
    writeDelta('delta-2026-04-11-1000', '2026-04-11', ['scripts/lib/constants.ts', 'hooks/mindlore-search.cjs']);
    writeDelta('delta-2026-04-12-1000', '2026-04-12', ['scripts/lib/constants.ts', 'tests/dedup.test.ts']);

    const fileCounts: Record<string, number> = {};
    const deltaFiles = fs.readdirSync(DIARY_DIR).filter(f => f.startsWith('delta-'));

    for (const d of deltaFiles) {
      const content = fs.readFileSync(path.join(DIARY_DIR, d), 'utf8');
      const changedSection = content.split('## Changed Files')[1] || '';
      for (const line of changedSection.split('\n').filter(l => l.startsWith('- '))) {
        const file = line.replace('- ', '').trim();
        fileCounts[file] = (fileCounts[file] || 0) + 1;
      }
    }

    expect(fileCounts['scripts/lib/constants.ts']).toBe(3);
  });

  test('learnings are written with correct frontmatter format', () => {
    const learning = [
      '---',
      'type: learning',
      'slug: testing-patterns',
      'title: Testing Patterns',
      'tags: testing, jest',
      '---',
      '',
      '# Testing Patterns',
      '',
      '- YAPMA: Test icinde sleep kullanma — deterministic timer mock kullan',
      '- BEST PRACTICE: Her test kendi temp dizinini olusturup temizlesin',
    ].join('\n');

    fs.writeFileSync(path.join(LEARNINGS_DIR, 'testing-patterns.md'), learning);

    const content = fs.readFileSync(path.join(LEARNINGS_DIR, 'testing-patterns.md'), 'utf8');
    expect(content).toContain('type: learning');
    expect(content).toContain('YAPMA:');
    expect(content).toContain('BEST PRACTICE:');
  });

  test('archived deltas are excluded from reflect scan', () => {
    writeDelta('delta-2026-04-08-1000', '2026-04-08', ['old-file.ts'], { archived: true });
    writeDelta('delta-2026-04-09-1000', '2026-04-09', ['active-file.ts']);

    const deltas = fs.readdirSync(DIARY_DIR)
      .filter(f => f.startsWith('delta-') && f.endsWith('.md'))
      .filter(f => !fs.readFileSync(path.join(DIARY_DIR, f), 'utf8').includes('archived: true'));

    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toContain('04-09');
  });

  test('learnings append to existing topic file without overwriting', () => {
    const initial = [
      '---',
      'type: learning',
      'slug: git-workflow',
      'title: Git Workflow',
      '---',
      '',
      '# Git Workflow',
      '',
      '- BEST PRACTICE: Atomic commits — bir degisiklik, bir commit',
    ].join('\n');

    fs.writeFileSync(path.join(LEARNINGS_DIR, 'git-workflow.md'), initial);

    fs.appendFileSync(path.join(LEARNINGS_DIR, 'git-workflow.md'),
      '\n- YAPMA: Force push to main — her zaman feature branch kullan\n');

    const content = fs.readFileSync(path.join(LEARNINGS_DIR, 'git-workflow.md'), 'utf8');
    expect(content).toContain('Atomic commits');
    expect(content).toContain('Force push');

    const ruleCount = (content.match(/^- (YAPMA|BEST PRACTICE|KRITIK):/gm) || []).length;
    expect(ruleCount).toBe(2);
  });

  test('empty diary directory returns no deltas', () => {
    const deltas = fs.readdirSync(DIARY_DIR)
      .filter(f => f.startsWith('delta-') && f.endsWith('.md'));
    expect(deltas).toHaveLength(0);
  });
});
