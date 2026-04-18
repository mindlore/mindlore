import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import crypto from 'crypto';

describe('FTS5 catch-up mechanism', () => {
  let tmpDir: string;
  let mindloreDir: string;
  let rawDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-catchup-'));
    mindloreDir = path.join(tmpDir, '.mindlore');
    rawDir = path.join(mindloreDir, 'raw');
    dbPath = path.join(mindloreDir, 'mindlore.db');
    fs.mkdirSync(rawDir, { recursive: true });

    const db = new Database(dbPath);
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(
        path, slug, description, type, category, title, content, tags, quality, date_captured, project,
        tokenize='porter unicode61'
      );
      CREATE TABLE IF NOT EXISTS file_hashes (
        path TEXT PRIMARY KEY,
        content_hash TEXT,
        last_indexed TEXT
      );
    `);
    db.close();
  });

  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('indexes untracked files when INDEX.md triggers hook', () => {
    const untracked = path.join(rawDir, 'untracked-source.md');
    fs.writeFileSync(untracked, '---\nslug: untracked\ntype: raw\n---\nSome content here', 'utf8');

    const indexMd = path.join(mindloreDir, 'INDEX.md');
    fs.writeFileSync(indexMd, '# Index', 'utf8');

    const hookPath = path.resolve(__dirname, '..', 'hooks', 'mindlore-index.cjs');
    const input = JSON.stringify({ path: indexMd });

    try {
      execSync(`node "${hookPath}"`, {
        input,
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, MINDLORE_HOME: mindloreDir },
      });
    } catch { /* hook may exit with non-zero */ }

    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT * FROM file_hashes WHERE path = ?').get(untracked);
    db.close();
    expect(row).toBeDefined();
  });

  it('skips already-indexed files (hash dedup)', () => {
    const tracked = path.join(rawDir, 'tracked.md');
    const content = '---\nslug: tracked\ntype: raw\n---\nAlready indexed';
    fs.writeFileSync(tracked, content, 'utf8');

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const db = new Database(dbPath);
    db.prepare('INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)')
      .run(tracked, hash, new Date().toISOString());
    db.close();

    const indexMd = path.join(mindloreDir, 'INDEX.md');
    fs.writeFileSync(indexMd, '# Index', 'utf8');

    const hookPath = path.resolve(__dirname, '..', 'hooks', 'mindlore-index.cjs');
    const input = JSON.stringify({ path: indexMd });

    try {
      execSync(`node "${hookPath}"`, {
        input,
        encoding: 'utf8',
        timeout: 10000,
        env: { ...process.env, MINDLORE_HOME: mindloreDir },
      });
    } catch { /* hook may exit with non-zero */ }

    const db2 = new Database(dbPath, { readonly: true });
    const count = db2.prepare('SELECT COUNT(*) as c FROM file_hashes').get() as { c: number };
    db2.close();
    expect(count.c).toBe(1);
  });
});
