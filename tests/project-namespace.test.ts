import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createTestDb, insertFts, setupTestDir, teardownTestDir } from './helpers/db';
import { dbGet, dbAll } from '../scripts/lib/db-helpers.js';

const TEST_DIR = path.join(__dirname, '..', '.test-project-namespace');
const commonPath = path.resolve(__dirname, '..', 'hooks', 'lib', 'mindlore-common.cjs');

beforeEach(() => {
  setupTestDir(TEST_DIR);
  delete require.cache[require.resolve(commonPath)];
});

afterEach(() => {
  delete require.cache[require.resolve(commonPath)];
  teardownTestDir(TEST_DIR);
});

// ── getProjectName ────────────────────────────────────────────────────

describe('getProjectName', () => {
  test('returns basename of current working directory', () => {
    const fakeProject = path.join(TEST_DIR, 'my-cool-project');
    fs.mkdirSync(fakeProject, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(fakeProject);
    try {
      const { getProjectName } = require(commonPath);
      expect(getProjectName()).toBe('my-cool-project');
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('reflects cwd change between calls', () => {
    const projectA = path.join(TEST_DIR, 'project-alpha');
    const projectB = path.join(TEST_DIR, 'project-beta');
    fs.mkdirSync(projectA, { recursive: true });
    fs.mkdirSync(projectB, { recursive: true });

    const originalCwd = process.cwd();
    try {
      process.chdir(projectA);
      delete require.cache[require.resolve(commonPath)];
      expect(require(commonPath).getProjectName()).toBe('project-alpha');

      process.chdir(projectB);
      delete require.cache[require.resolve(commonPath)];
      expect(require(commonPath).getProjectName()).toBe('project-beta');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

// ── project column in FTS5 ────────────────────────────────────────────

describe('project column — insertFtsRow', () => {
  test('stores project value in FTS5 row', () => {
    const dbPath = path.join(TEST_DIR, 'store.db');
    const db = createTestDb(dbPath);

    insertFts(db, {
      path: '/fake/sources/entry.md',
      slug: 'entry',
      title: 'Entry Doc',
      content: 'some content here',
      project: 'my-project',
    });

    const row = dbGet<{ project: string }>(db, 'SELECT project FROM mindlore_fts WHERE path = ?', '/fake/sources/entry.md');
    db.close();

    expect(row?.project).toBe('my-project');
  });

  test('stores null project when not provided', () => {
    const dbPath = path.join(TEST_DIR, 'null-project.db');
    const db = createTestDb(dbPath);

    insertFts(db, {
      path: '/fake/sources/legacy.md',
      slug: 'legacy',
      content: 'legacy data',
    });

    const row = dbGet<{ project: string | null }>(db, 'SELECT project FROM mindlore_fts WHERE path = ?', '/fake/sources/legacy.md');
    db.close();

    expect(row?.project).toBeNull();
  });
});

// ── project filter in FTS5 queries ───────────────────────────────────

describe('project column — FTS5 filtering', () => {
  test('project filter returns only matching project rows', () => {
    const dbPath = path.join(TEST_DIR, 'filter.db');
    const db = createTestDb(dbPath);

    insertFts(db, { path: '/alpha/doc.md', slug: 'alpha-doc', title: 'Alpha Doc', content: 'shared keyword findme', project: 'project-alpha' });
    insertFts(db, { path: '/beta/doc.md', slug: 'beta-doc', title: 'Beta Doc', content: 'shared keyword findme', project: 'project-beta' });

    const alphaRows = dbAll<{ path: string }>(db, 'SELECT path FROM mindlore_fts WHERE mindlore_fts MATCH ? AND project = ?', 'shared keyword findme', 'project-alpha');

    const betaRows = dbAll<{ path: string }>(db, 'SELECT path FROM mindlore_fts WHERE mindlore_fts MATCH ? AND project = ?', 'shared keyword findme', 'project-beta');

    db.close();

    expect(alphaRows).toHaveLength(1);
    expect(alphaRows[0]?.path).toBe('/alpha/doc.md');
    expect(betaRows).toHaveLength(1);
    expect(betaRows[0]?.path).toBe('/beta/doc.md');
  });

  test('unfiltered query returns rows from all projects', () => {
    const dbPath = path.join(TEST_DIR, 'unfiltered.db');
    const db = createTestDb(dbPath);

    insertFts(db, { path: '/p1/doc.md', slug: 'p1', content: 'unique term omnisearch', project: 'project-one' });
    insertFts(db, { path: '/p2/doc.md', slug: 'p2', content: 'unique term omnisearch', project: 'project-two' });
    insertFts(db, { path: '/p3/doc.md', slug: 'p3', content: 'unique term omnisearch', project: null });

    const rows = dbAll<{ path: string }>(db, 'SELECT path FROM mindlore_fts WHERE mindlore_fts MATCH ?', 'unique term omnisearch');

    db.close();

    expect(rows).toHaveLength(3);
  });

  test('project filter returns empty when no rows match project', () => {
    const dbPath = path.join(TEST_DIR, 'nomatch.db');
    const db = createTestDb(dbPath);

    insertFts(db, { path: '/alpha/doc.md', slug: 'alpha', content: 'some content findme', project: 'project-alpha' });

    const rows = dbAll<{ path: string }>(db, 'SELECT path FROM mindlore_fts WHERE mindlore_fts MATCH ? AND project = ?', 'some content findme', 'project-other');

    db.close();

    expect(rows).toHaveLength(0);
  });
});

// ── detectSchemaVersion ───────────────────────────────────────────────

describe('detectSchemaVersion', () => {
  test('returns 11 for 11-column FTS5 DB (SQL_FTS_CREATE)', () => {
    const dbPath = path.join(TEST_DIR, 'v11.db');
    const db = createTestDb(dbPath);
    db.close();

    const { detectSchemaVersion, openDatabase } = require(commonPath);
    const openDb = openDatabase(dbPath);
    const version = detectSchemaVersion(openDb);
    openDb.close();

    expect(version).toBe(11);
  });

  test('returns 2 (legacy fallback) for DB without mindlore_fts table', () => {
    const dbPath = path.join(TEST_DIR, 'empty.db');
    new Database(dbPath).close();

    const { detectSchemaVersion, openDatabase } = require(commonPath);
    const openDb = openDatabase(dbPath);
    const version = detectSchemaVersion(openDb);
    openDb.close();

    expect(version).toBe(2);
  });
});
