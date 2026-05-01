import fs from 'fs';
import os from 'os';
import path from 'path';
import { createTestDbWithMigrations } from './helpers/db.js';
import { chunkMarkdown } from '../scripts/lib/chunker.js';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

describe('chunks table migration', () => {
  let db: Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-chunks-'));
    db = createTestDbWithMigrations(path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('chunks table exists after migration', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'").get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.name).toBe('chunks');
  });

  test('can insert and query chunks', () => {
    const insertChunk = db.prepare(
      'INSERT INTO chunks (source_path, chunk_index, heading, breadcrumb, char_count) VALUES (?, ?, ?, ?, ?)'
    );
    insertChunk.run('/test.md', 0, '# Title', '# Title', 100);
    insertChunk.run('/test.md', 1, '## Section', '# Title > ## Section', 200);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion
    const rows = db.prepare('SELECT * FROM chunks WHERE source_path = ? ORDER BY chunk_index').all('/test.md') as Array<{
      source_path: string; chunk_index: number; heading: string; breadcrumb: string; char_count: number;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.heading).toBe('# Title');
    expect(rows[1]!.breadcrumb).toBe('# Title > ## Section');
  });

  test('chunkMarkdown output fits chunks schema', () => {
    const md = '# Root\nIntro\n## Child\nContent here';
    const chunks = chunkMarkdown(md);

    const insertChunk = db.prepare(
      'INSERT INTO chunks (source_path, chunk_index, heading, breadcrumb, char_count) VALUES (?, ?, ?, ?, ?)'
    );
    for (const c of chunks) {
      insertChunk.run('/doc.md', c.index, c.heading, c.breadcrumb, c.charCount);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion
    const count = (db.prepare('SELECT COUNT(*) as c FROM chunks').get() as { c: number }).c;
    expect(count).toBe(chunks.length);
  });

  test('UNIQUE constraint on source_path + chunk_index', () => {
    const insertChunk = db.prepare(
      'INSERT INTO chunks (source_path, chunk_index, heading, breadcrumb, char_count) VALUES (?, ?, ?, ?, ?)'
    );
    insertChunk.run('/test.md', 0, '# A', '', 10);
    expect(() => insertChunk.run('/test.md', 0, '# B', '', 20)).toThrow();
  });
});
