import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db';

const TEST_DIR = path.join(__dirname, '..', '.test-evolve');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

let db: Database.Database;

beforeEach(() => {
  setupTestDir(TEST_DIR, [
    'raw', 'sources', 'domains', 'analyses', 'insights',
    'connections', 'learnings', 'diary', 'decisions',
  ]);
  fs.writeFileSync(path.join(TEST_DIR, 'INDEX.md'), [
    '# Knowledge Index',
    '',
    '## Sources',
    '- [react-hooks](sources/react-hooks.md)',
    '- [cc-internals](sources/cc-internals.md)',
    '',
    '## Domains',
    '- [frontend](domains/frontend.md)',
  ].join('\n'));

  db = createTestDb(DB_PATH);
});

afterEach(() => {
  db.close();
  teardownTestDir(TEST_DIR);
});

describe('Evolve — orphan detection and cross-reference analysis', () => {
  test('detects orphan files not listed in INDEX.md', () => {
    // Create a source file that IS in INDEX
    fs.writeFileSync(path.join(TEST_DIR, 'sources', 'react-hooks.md'),
      '---\nslug: react-hooks\ntype: source\n---\n# React Hooks\n');

    // Create a source file NOT in INDEX (orphan)
    fs.writeFileSync(path.join(TEST_DIR, 'sources', 'orphan-doc.md'),
      '---\nslug: orphan-doc\ntype: source\n---\n# Orphan\n');

    const indexContent = fs.readFileSync(path.join(TEST_DIR, 'INDEX.md'), 'utf8');
    const sourceFiles = fs.readdirSync(path.join(TEST_DIR, 'sources'))
      .filter(f => f.endsWith('.md'));

    const orphans = sourceFiles.filter(f => !indexContent.includes(f.replace('.md', '')));
    expect(orphans).toContain('orphan-doc.md');
    expect(orphans).not.toContain('react-hooks.md');
  });

  test('detects source without domain reference', () => {
    // Source exists
    fs.writeFileSync(path.join(TEST_DIR, 'sources', 'cc-internals.md'),
      '---\nslug: cc-internals\ntype: source\n---\n# CC Internals\nHooks and memory.\n');

    // Domain exists but doesn't reference cc-internals
    fs.writeFileSync(path.join(TEST_DIR, 'domains', 'frontend.md'),
      '---\nslug: frontend\ntype: domain\n---\n# Frontend\nReact and Vue patterns.\n');

    const domainContent = fs.readFileSync(path.join(TEST_DIR, 'domains', 'frontend.md'), 'utf8');
    const sourceFiles = fs.readdirSync(path.join(TEST_DIR, 'sources'))
      .filter(f => f.endsWith('.md'));

    const unreferenced = sourceFiles.filter(f => {
      const slug = f.replace('.md', '');
      return !domainContent.includes(slug);
    });

    expect(unreferenced).toContain('cc-internals.md');
  });

  test('INDEX.md can be updated with new entries', () => {
    const indexPath = path.join(TEST_DIR, 'INDEX.md');
    const original = fs.readFileSync(indexPath, 'utf8');

    // Add new source reference
    const updated = original.replace(
      '## Domains',
      '- [new-source](sources/new-source.md)\n\n## Domains'
    );
    fs.writeFileSync(indexPath, updated);

    const content = fs.readFileSync(indexPath, 'utf8');
    expect(content).toContain('new-source');
    expect(content).toContain('react-hooks');
  });

  test('log.md receives EVOLVE entries', () => {
    const logPath = path.join(TEST_DIR, 'log.md');
    fs.writeFileSync(logPath, '| Date | Op | File |\n|------|-----|------|\n');

    const entry = `| 2026-04-12 | evolve | 2 orphans fixed, 1 ref added |\n`;
    fs.appendFileSync(logPath, entry);

    const content = fs.readFileSync(logPath, 'utf8');
    expect(content).toContain('evolve');
    expect(content).toContain('orphans fixed');
  });

  test('FTS5 indexed sources can be queried for staleness check', () => {
    insertFts(db, {
      path: path.join(TEST_DIR, 'sources', 'react-hooks.md'),
      slug: 'react-hooks',
      type: 'source',
      title: 'React Hooks',
      content: 'React hooks patterns',
      dateCaptured: '2026-03-01',
    });

    insertFts(db, {
      path: path.join(TEST_DIR, 'domains', 'frontend.md'),
      slug: 'frontend',
      type: 'domain',
      title: 'Frontend',
      content: 'Frontend development patterns',
      dateCaptured: '2026-01-15',
    });

    // Domain is older than source — potentially stale
    const sources = db.prepare(
      "SELECT slug, date_captured FROM mindlore_fts WHERE type = 'source'"
    ).all() as Array<{ slug: string; date_captured: string | null }>;

    const domains = db.prepare(
      "SELECT slug, date_captured FROM mindlore_fts WHERE type = 'domain'"
    ).all() as Array<{ slug: string; date_captured: string | null }>;

    expect(sources[0]!.date_captured).toBe('2026-03-01');
    expect(domains[0]!.date_captured).toBe('2026-01-15');
    // Domain is older → candidate for evolve update
    expect(domains[0]!.date_captured! < sources[0]!.date_captured!).toBe(true);
  });
});
