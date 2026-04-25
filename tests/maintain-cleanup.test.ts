import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';

describe('maintain-cleanup', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-'));
    fs.mkdirSync(path.join(baseDir, 'raw', 'sessions', 'foo'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(baseDir, { recursive: true, force: true });
  });

  test('backfills missing project frontmatter', async () => {
    const file = path.join(baseDir, 'raw', 'sessions', 'foo', 'session.md');
    fs.writeFileSync(file, '---\ntype: raw\n---\n\nbody', 'utf8');
    const { runCleanup } = await import('../scripts/maintain-cleanup.js');
    const report = await runCleanup({ baseDir, dryRun: false });
    const after = fs.readFileSync(file, 'utf8');
    expect(after).toMatch(/project:\s+foo/);
    expect(report.backfilled.length).toBeGreaterThan(0);
  });

  test('detects FTS5 gap (file on disk, not in db)', async () => {
    const dbPath = path.join(baseDir, 'mindlore.db');
    const db = new Database(dbPath);
    db.exec(
      "CREATE VIRTUAL TABLE mindlore_fts USING fts5(path UNINDEXED, slug, description, type UNINDEXED, category, title, content, tags, quality UNINDEXED, date_captured UNINDEXED, project UNINDEXED, tokenize='porter unicode61')"
    );
    // Insert a known file so it is NOT a gap
    const knownFile = path.join(baseDir, 'raw', 'sessions', 'foo', 'known.md');
    fs.writeFileSync(knownFile, '---\nproject: foo\n---\nknown', 'utf8');
    const knownPath = knownFile.replace(/\\/g, '/');
    db.prepare('INSERT INTO mindlore_fts(path, slug, description, type, category, title, content, tags) VALUES(?,?,?,?,?,?,?,?)')
      .run(knownPath, '', '', '', '', '', '', '');
    db.close();
    // Orphan file — on disk but NOT in DB
    const orphan = path.join(baseDir, 'raw', 'sessions', 'foo', 'orphan.md');
    fs.writeFileSync(orphan, '---\nproject: test\n---\nx', 'utf8');
    const { runCleanup } = await import('../scripts/maintain-cleanup.js');
    const report = await runCleanup({ baseDir, dryRun: true });
    expect(report.fts5Gaps.length).toBe(1);
    expect(report.fts5Gaps[0]).toContain('orphan.md');
  });

  test('dryRun does not modify files', async () => {
    const file = path.join(baseDir, 'raw', 'sessions', 'foo', 'session.md');
    const original = '---\ntype: raw\n---\n\nbody';
    fs.writeFileSync(file, original, 'utf8');
    const { runCleanup } = await import('../scripts/maintain-cleanup.js');
    await runCleanup({ baseDir, dryRun: true });
    expect(fs.readFileSync(file, 'utf8')).toBe(original);
  });

  test('skips files that already have project frontmatter', async () => {
    const file = path.join(baseDir, 'raw', 'sessions', 'foo', 'session.md');
    fs.writeFileSync(file, '---\ntype: raw\nproject: foo\n---\n\nbody', 'utf8');
    const { runCleanup } = await import('../scripts/maintain-cleanup.js');
    const report = await runCleanup({ baseDir, dryRun: false });
    expect(report.backfilled.length).toBe(0);
    const after = fs.readFileSync(file, 'utf8');
    expect(after).toBe('---\ntype: raw\nproject: foo\n---\n\nbody');
  });
});
