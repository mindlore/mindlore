import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { migrateFrontmatter } from '../scripts/mindlore-frontmatter-migrate';

let tmpHome: string;
let origHome: string | undefined;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mlfm-'));
  origHome = process.env.MINDLORE_HOME;
  process.env.MINDLORE_HOME = tmpHome;
  fs.mkdirSync(path.join(tmpHome, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(tmpHome, 'learnings'), { recursive: true });
});

afterEach(() => {
  process.env.MINDLORE_HOME = origHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('Frontmatter migration (B4-b Part B)', () => {
  test('missingSlug: adds slug from filename', async () => {
    const file = path.join(tmpHome, 'raw', '2026-05-17-test.md');
    fs.writeFileSync(file, `---\ntype: raw\n---\n\nContent`);
    const result = await migrateFrontmatter({ apply: true, backupDir: path.join(tmpHome, '.backup'), reindex: false });
    expect(result.written).toBeGreaterThan(0);
    const fixed = fs.readFileSync(file, 'utf8');
    expect(fixed).toMatch(/^slug: 2026-05-17-test$/m);
  });

  test('invalidSlugFormat: re-slugifies', async () => {
    const file = path.join(tmpHome, 'raw', 'foo.md');
    fs.writeFileSync(file, `---\nslug: Bad Slug Name\ntype: raw\n---\n\nContent`);
    await migrateFrontmatter({ apply: true, backupDir: path.join(tmpHome, '.backup'), reindex: false });
    const fixed = fs.readFileSync(file, 'utf8');
    expect(fixed).toMatch(/^slug: bad-slug-name$/m);
  });

  test('typeDirMismatch: fixes type field to match dir', async () => {
    const file = path.join(tmpHome, 'learnings', 'lesson.md');
    fs.writeFileSync(file, `---\nslug: lesson\ntype: source\n---\n\nContent`);
    await migrateFrontmatter({ apply: true, backupDir: path.join(tmpHome, '.backup'), reindex: false });
    const fixed = fs.readFileSync(file, 'utf8');
    expect(fixed).toMatch(/^type: lesson$/m);
  });

  test('dry-run does not modify files', async () => {
    const file = path.join(tmpHome, 'raw', 'test.md');
    const original = `---\ntype: raw\n---\n\nContent`;
    fs.writeFileSync(file, original);
    await migrateFrontmatter({ apply: false, backupDir: path.join(tmpHome, '.backup'), reindex: false });
    expect(fs.readFileSync(file, 'utf8')).toBe(original);
  });

  test('backup created before apply', async () => {
    const file = path.join(tmpHome, 'raw', 'test.md');
    fs.writeFileSync(file, `---\ntype: raw\n---\n\nContent`);
    const backupRoot = path.join(tmpHome, '.backup');
    await migrateFrontmatter({ apply: true, backupDir: backupRoot, reindex: false });
    const backups = fs.readdirSync(backupRoot);
    expect(backups.length).toBeGreaterThan(0);
    const firstBackup = backups[0] as string;
    expect(fs.existsSync(path.join(backupRoot, firstBackup, 'raw', 'test.md'))).toBe(true);
  });
});
