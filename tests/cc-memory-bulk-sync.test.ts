import path from 'path';
import fs from 'fs';
import os from 'os';
import { discoverCcMemoryFiles, syncToDb } from '../scripts/cc-memory-bulk-sync.js';
import { createTestDb, setupTestDir, teardownTestDir } from './helpers/db.js';

const TEST_DIR = path.join(os.tmpdir(), 'mindlore-cc-bulk-sync-test');
const CLAUDE_DIR = path.join(TEST_DIR, '.claude');
const MINDLORE_DIR = path.join(TEST_DIR, '.mindlore');
const DB_PATH = path.join(MINDLORE_DIR, 'mindlore.db');

const PROJECT_NAME = 'C--test-project';
const MEMORY_DIR = path.join(CLAUDE_DIR, 'projects', PROJECT_NAME, 'memory');

const FILE_A_CONTENT = [
  '---',
  'slug: note-a',
  'type: learning',
  'title: Note A',
  'tags: [test, sync]',
  'quality: medium',
  'date_captured: 2026-04-18',
  '---',
  '',
  '# Note A',
  '',
  'This is a CC memory note.',
].join('\n');

const FILE_B_CONTENT = [
  '---',
  'slug: note-b',
  'type: learning',
  'title: Note B',
  'tags: [test]',
  'quality: low',
  '---',
  '',
  '# Note B',
  '',
  'Another CC memory note.',
].join('\n');

beforeEach(() => {
  setupTestDir(TEST_DIR);
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.mkdirSync(MINDLORE_DIR, { recursive: true });
  fs.mkdirSync(path.join(MINDLORE_DIR, 'memory'), { recursive: true });

  // MEMORY.md (should be skipped)
  fs.writeFileSync(path.join(MEMORY_DIR, 'MEMORY.md'), '# Index\n- [Note A](note-a.md)\n');
  // Two real memory files
  fs.writeFileSync(path.join(MEMORY_DIR, 'note-a.md'), FILE_A_CONTENT);
  fs.writeFileSync(path.join(MEMORY_DIR, 'note-b.md'), FILE_B_CONTENT);

  const db = createTestDb(DB_PATH);
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('discoverCcMemoryFiles', () => {
  test('finds .md files and skips MEMORY.md', () => {
    const files = discoverCcMemoryFiles(CLAUDE_DIR);
    expect(files.length).toBe(2);
    const names = files.map(f => path.basename(f)).sort();
    expect(names).toEqual(['note-a.md', 'note-b.md']);
    // MEMORY.md must not appear
    expect(files.every(f => path.basename(f) !== 'MEMORY.md')).toBe(true);
  });

  test('returns empty array when claude dir does not exist', () => {
    const files = discoverCcMemoryFiles(path.join(TEST_DIR, 'nonexistent'));
    expect(files).toEqual([]);
  });
});

describe('syncToDb', () => {
  test('inserts files into DB with category cc-memory', () => {
    const files = discoverCcMemoryFiles(CLAUDE_DIR);
    const result = syncToDb(DB_PATH, files, MINDLORE_DIR);

    expect(result.errors).toEqual([]);
    expect(result.synced).toBe(2);
    expect(result.skipped).toBe(0);

    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare("SELECT count(*) as cnt FROM mindlore_fts WHERE category = 'cc-memory'").get() as { cnt: number };
    expect(row.cnt).toBe(2);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .all() returns unknown[]
    const hashRows = db.prepare("SELECT source_type FROM file_hashes WHERE source_type = 'cc-memory'").all() as { source_type: string }[];
    expect(hashRows).toHaveLength(2);
    db.close();
  });

  test('is idempotent — second call synced=0, skipped=2', () => {
    const files = discoverCcMemoryFiles(CLAUDE_DIR);

    const first = syncToDb(DB_PATH, files, MINDLORE_DIR);
    expect(first.synced).toBe(2);
    expect(first.skipped).toBe(0);

    const second = syncToDb(DB_PATH, files, MINDLORE_DIR);
    expect(second.synced).toBe(0);
    expect(second.skipped).toBe(2);
    expect(second.errors).toEqual([]);

    // FTS row count stays 2, not 4
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- .get() returns unknown
    const row = db.prepare("SELECT count(*) as cnt FROM mindlore_fts WHERE category = 'cc-memory'").get() as { cnt: number };
    expect(row.cnt).toBe(2);
    db.close();
  });

  test('copies files to .mindlore/memory/ with project prefix', () => {
    const files = discoverCcMemoryFiles(CLAUDE_DIR);
    syncToDb(DB_PATH, files, MINDLORE_DIR);

    const destDir = path.join(MINDLORE_DIR, 'memory');
    const copied = fs.readdirSync(destDir).sort();
    expect(copied).toEqual([
      `${PROJECT_NAME}_note-a.md`,
      `${PROJECT_NAME}_note-b.md`,
    ]);
  });
});
