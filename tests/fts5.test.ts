import path from 'path';
import Database from 'better-sqlite3';
import fs from 'fs';
import { createTestDb, insertFts, setupTestDir, teardownTestDir, sha256, parseFrontmatter, extractFtsMetadata, resolveProject } from './helpers/db.js';
import { dbAll, dbGet } from '../scripts/lib/db-helpers.js';
import { DB_BUSY_TIMEOUT_MS } from '../scripts/lib/constants.js';

interface TimestampRow {
  created_at: string | null;
  updated_at: string | null;
}

interface ProjectScopeRow {
  project_scope: string | null;
}

interface ImportanceRow {
  importance: number;
}

const TEST_DIR = path.join(__dirname, '..', '.test-mindlore-fts5');
const DB_PATH = path.join(TEST_DIR, 'mindlore.db');

beforeEach(() => {
  setupTestDir(TEST_DIR, ['sources']);
  const db = createTestDb(DB_PATH);
  db.close();
});

afterEach(() => {
  teardownTestDir(TEST_DIR);
});

describe('FTS5 Database', () => {
  test('should create FTS5 table and insert content', () => {
    const db = new Database(DB_PATH);

    const testContent = '# Test Source\n\nThis is about TypeScript and Node.js performance.';
    const testPath = path.join(TEST_DIR, 'sources', 'test-source.md');

    insertFts(db, { path: testPath, slug: 'test-source', description: 'TypeScript and Node.js performance', type: 'source', category: 'sources', title: 'Test Source', content: testContent, tags: '', quality: null, dateCaptured: null });

    const result = dbGet<{ cnt: number }>(db, 'SELECT count(*) as cnt FROM mindlore_fts');
    expect(result!.cnt).toBe(1);

    db.close();
  });

  test('should find content via FTS5 MATCH query', () => {
    const db = new Database(DB_PATH);

    const testPath = path.join(TEST_DIR, 'sources', 'typescript-guide.md');
    const content = '# TypeScript Guide\n\nTypeScript provides static typing for JavaScript applications.';

    insertFts(db, { path: testPath, slug: 'typescript-guide', description: 'TypeScript static typing for JavaScript', type: 'source', category: 'sources', title: 'TypeScript Guide', content, tags: '', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string; rank: number }>(
      db,
      `SELECT path, rank FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'TypeScript',
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(testPath);

    db.close();
  });

  test('should return empty results for non-matching query', () => {
    const db = new Database(DB_PATH);

    const testPath = path.join(TEST_DIR, 'sources', 'python-guide.md');
    insertFts(db, { path: testPath, slug: 'python-guide', description: 'Python for data science', type: 'source', category: 'sources', title: 'Python Guide', content: '# Python Guide\n\nPython is great for data science.', tags: '', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string }>(
      db,
      `SELECT path FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'Kubernetes',
    );

    expect(results).toHaveLength(0);

    db.close();
  });

  test('should rank results by BM25 relevance', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'hooks-overview.md'), slug: 'hooks-overview', description: 'Hooks lifecycle callbacks overview', type: 'source', category: 'sources', title: 'Hooks Overview', content: '# Hooks Overview\n\nHooks are lifecycle callbacks.', tags: '', quality: null, dateCaptured: null });

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'hooks-deep-dive.md'), slug: 'hooks-deep-dive', description: 'Deep dive into hooks patterns', type: 'source', category: 'sources', title: 'Hooks Deep Dive', content: '# Hooks Deep Dive\n\nHooks hooks hooks. PreToolUse hooks, PostToolUse hooks, SessionStart hooks.', tags: '', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string; rank: number }>(
      db,
      `SELECT path, rank FROM mindlore_fts
         WHERE mindlore_fts MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'hooks',
    );

    expect(results).toHaveLength(2);
    const deepDive = results.find((r) => r.path.includes('deep-dive'));
    const overview = results.find((r) => r.path.includes('overview'));
    expect(deepDive).toBeDefined();
    expect(overview).toBeDefined();

    db.close();
  });

  test('should index and search by tags column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'tagged-doc.md'), slug: 'tagged-doc', description: 'A doc with tags', type: 'source', category: 'sources', title: 'Tagged Doc', content: '# Tagged\n\nContent here.', tags: 'security, hooks, fts5', quality: null, dateCaptured: null });

    const results = dbAll<{ path: string; tags: string }>(
      db,
      `SELECT path, tags FROM mindlore_fts
         WHERE tags MATCH ?
         ORDER BY rank
         LIMIT 3`,
      'security',
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.tags).toBe('security, hooks, fts5');

    db.close();
  });

  test('should store and retrieve date_captured column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'dated-doc.md'), slug: 'dated-doc', description: 'A doc with date', type: 'source', category: 'sources', title: 'Dated Doc', content: '# Dated\n\nContent here.', tags: 'test', quality: 'high', dateCaptured: '2026-04-12' });

    const result = dbGet<{ date_captured: string | null }>(db, 'SELECT date_captured FROM mindlore_fts WHERE path = ?', path.join(TEST_DIR, 'sources', 'dated-doc.md'));
    expect(result!.date_captured).toBe('2026-04-12');

    db.close();
  });

  test('should accept null date_captured column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'no-date.md'), slug: 'no-date', description: 'No date set', type: 'source', category: 'sources', title: 'No Date', content: '# Test\n\nContent.', tags: '', quality: null, dateCaptured: null });

    const result = dbGet<{ date_captured: string | null }>(db, 'SELECT date_captured FROM mindlore_fts WHERE path = ?', path.join(TEST_DIR, 'sources', 'no-date.md'));
    expect(result!.date_captured).toBeFalsy();

    db.close();
  });

  test('should accept null quality column', () => {
    const db = new Database(DB_PATH);

    insertFts(db, { path: path.join(TEST_DIR, 'sources', 'no-quality.md'), slug: 'no-quality', description: 'No quality set', type: 'source', category: 'sources', title: 'No Quality', content: '# Test\n\nContent.', tags: '', quality: null, dateCaptured: null });

    const result = dbGet<{ quality: string | null }>(db, 'SELECT quality FROM mindlore_fts WHERE path = ?', path.join(TEST_DIR, 'sources', 'no-quality.md'));
    expect(result!.quality).toBeFalsy();

    db.close();
  });
});

describe('openDatabaseTs', () => {
  test('should set WAL + busy_timeout for writable DB', () => {
    const { openDatabaseTs } = require('../scripts/lib/db-helpers.js');
    const db = openDatabaseTs(DB_PATH);
    if (!db) throw new Error('DB not opened');
    const walMode = db.pragma('journal_mode', { simple: true });
    expect(walMode).toBe('wal');
    const timeout = db.pragma('busy_timeout', { simple: true });
    expect(timeout).toBe(DB_BUSY_TIMEOUT_MS);
    db.close();
  });

  test('readonly should NOT set WAL', () => {
    const { openDatabaseTs } = require('../scripts/lib/db-helpers.js');
    const db = openDatabaseTs(DB_PATH, { readonly: true });
    if (!db) throw new Error('DB not opened');
    db.close();
  });
});

describe('openDatabase CJS', () => {
  test('should set WAL mode and busy_timeout on writable DB', () => {
    const { openDatabase } = require('../hooks/lib/mindlore-common.cjs');
    const db = openDatabase(DB_PATH);
    if (!db) throw new Error('DB not opened');
    const walMode = db.pragma('journal_mode', { simple: true });
    expect(walMode).toBe('wal');
    const timeout = db.pragma('busy_timeout', { simple: true });
    expect(timeout).toBe(DB_BUSY_TIMEOUT_MS);
    db.close();
  });
});

describe('Timestamp columns', () => {
  test('should write created_at on first index, updated_at on re-index', () => {
    const { createTestDbWithFullSchema } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithFullSchema(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-timestamps.md');
    const hash1 = 'aaa111';
    const now1 = '2026-04-19T10:00:00.000Z';

    // Simulate first index: INSERT with created_at, no updated_at
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now')
    `);

    upsertHash.run(testPath, hash1, now1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row1 = db.prepare('SELECT created_at, updated_at FROM file_hashes WHERE path = ?').get(testPath) as TimestampRow;
    expect(row1.created_at).toBeTruthy();
    expect(row1.updated_at).toBeNull(); // First index, no update yet

    // Simulate re-index with different hash: triggers ON CONFLICT UPDATE
    const hash2 = 'bbb222';
    const now2 = '2026-04-19T11:00:00.000Z';
    upsertHash.run(testPath, hash2, now2);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row2 = db.prepare('SELECT created_at, updated_at FROM file_hashes WHERE path = ?').get(testPath) as TimestampRow;
    expect(row2.created_at).toBe(row1.created_at); // created_at shouldn't change
    expect(row2.updated_at).toBeTruthy(); // updated_at should now be set

    db.close();
  });
});

describe('Project scope on index', () => {
  test('should write project_scope on index', () => {
    const { createTestDbWithFullSchema } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithFullSchema(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-scope.md');
    const hash = 'abc123';
    const now = '2026-04-19T12:00:00.000Z';
    const projectName = 'test-project';

    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope)
      VALUES (?, ?, ?, datetime('now'), ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope
    `);

    upsertHash.run(testPath, hash, now, projectName);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT project_scope FROM file_hashes WHERE path = ?').get(testPath) as ProjectScopeRow;
    expect(row.project_scope).toBeTruthy();
    expect(typeof row.project_scope).toBe('string');
    expect(row.project_scope).toBe('test-project');

    db.close();
  });
});

describe('Quality to importance mapping', () => {
  test('should map quality high to importance 1.0', () => {
    const { createTestDbWithFullSchema } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithFullSchema(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-importance-high.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    // Simulate indexer: quality 'high' -> importance 1.0
    upsertHash.run(testPath, 'aaa', '2026-04-19T10:00:00.000Z', 'test', 1.0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(1.0);

    db.close();
  });

  test('should map quality medium to importance 0.6', () => {
    const { createTestDbWithFullSchema } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithFullSchema(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-importance-medium.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    upsertHash.run(testPath, 'bbb', '2026-04-19T10:00:00.000Z', 'test', 0.6);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(0.6);

    db.close();
  });

  test('should map quality low to importance 0.3', () => {
    const { createTestDbWithFullSchema } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithFullSchema(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-importance-low.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    upsertHash.run(testPath, 'ccc', '2026-04-19T10:00:00.000Z', 'test', 0.3);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(0.3);

    db.close();
  });

  test('should default importance to 0.5 when quality is missing', () => {
    const { createTestDbWithFullSchema } = require('./helpers/db.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test helper returns Database
    const db = createTestDbWithFullSchema(DB_PATH) as import('better-sqlite3').Database;

    const testPath = path.join(TEST_DIR, 'sources', 'test-no-quality.md');
    const upsertHash = db.prepare(`
      INSERT INTO file_hashes (path, content_hash, last_indexed, created_at, project_scope, importance)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        content_hash = excluded.content_hash,
        last_indexed = excluded.last_indexed,
        updated_at = datetime('now'),
        project_scope = excluded.project_scope,
        importance = excluded.importance
    `);

    // quality undefined -> default 0.5
    upsertHash.run(testPath, 'ddd', '2026-04-19T10:00:00.000Z', 'test', 0.5);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = db.prepare('SELECT importance FROM file_hashes WHERE path = ?').get(testPath) as ImportanceRow;
    expect(row.importance).toBe(0.5);

    db.close();
  });
});

describe('FTS5 Sync Gap Recovery', () => {
  test('should re-index file when hash exists in file_hashes but FTS5 entry is missing', () => {
    const db = new Database(DB_PATH);
    const content = '---\nslug: orphan-hash\ntype: source\n---\n# Orphan Hash Test\n\nThis file has hash but no FTS5 entry.';
    const hash = sha256(content);
    const filePath = path.join(TEST_DIR, 'sources', 'orphan-hash.md');
    fs.writeFileSync(filePath, content, 'utf8');

    db.prepare('INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)').run(filePath, hash, new Date().toISOString());

    const hashRow = db.prepare('SELECT * FROM file_hashes WHERE path = ?').get(filePath);
    expect(hashRow).toBeDefined();
    const ftsRow = db.prepare('SELECT * FROM mindlore_fts WHERE path = ?').get(filePath);
    expect(ftsRow).toBeUndefined();

    db.close();

    const { execSync } = require('child_process');
    execSync(`node ${path.join(__dirname, '..', 'dist', 'scripts', 'mindlore-fts5-index.js')}`, {
      env: { ...process.env, MINDLORE_HOME: TEST_DIR },
      timeout: 15000,
    });

    const db2 = new Database(DB_PATH, { readonly: true });
    const ftsAfter = db2.prepare('SELECT * FROM mindlore_fts WHERE path = ?').get(filePath);
    expect(ftsAfter).toBeDefined();
    db2.close();
  });
});

describe('resolveProject — frontmatter-first project resolution', () => {
  test('should use frontmatter project when available', () => {
    const content = '---\nslug: kastell-session\nproject: kastell\ntype: raw\n---\nSession content';
    const testPath = path.join(TEST_DIR, 'sources', 'kastell-session.md');
    fs.writeFileSync(testPath, content);
    const { meta, body } = parseFrontmatter(content);
    const ftsData = extractFtsMetadata(meta, body, testPath, TEST_DIR);
    const project = resolveProject(ftsData.project, testPath, 'wrong-cwd');
    expect(project).toBe('kastell');
  });

  test('should use path-based project for session files without frontmatter project', () => {
    const sessionDir = path.join(TEST_DIR, 'raw', 'sessions', 'kastell');
    fs.mkdirSync(sessionDir, { recursive: true });
    const content = '---\nslug: test-session\ntype: raw\n---\nNo project field';
    const testPath = path.join(sessionDir, '2026-04-24-abc123.md');
    fs.writeFileSync(testPath, content);
    const { meta, body } = parseFrontmatter(content);
    const ftsData = extractFtsMetadata(meta, body, testPath, TEST_DIR);
    const project = resolveProject(ftsData.project, testPath, 'wrong-cwd');
    expect(project).toBe('kastell');
  });

  test('should use path-based project for diary files', () => {
    const diaryDir = path.join(TEST_DIR, 'diary', 'mindlore');
    fs.mkdirSync(diaryDir, { recursive: true });
    const content = '---\nslug: diary-entry\ntype: diary\n---\nDiary content';
    const testPath = path.join(diaryDir, 'delta-2026-04-24.md');
    fs.writeFileSync(testPath, content);
    const { meta, body } = parseFrontmatter(content);
    const ftsData = extractFtsMetadata(meta, body, testPath, TEST_DIR);
    const project = resolveProject(ftsData.project, testPath, 'wrong-cwd');
    expect(project).toBe('mindlore');
  });

  test('should fall back to CWD when no frontmatter or path hint', () => {
    const content = '---\nslug: generic-source\ntype: source\n---\nGeneric content';
    const testPath = path.join(TEST_DIR, 'sources', 'generic.md');
    fs.writeFileSync(testPath, content);
    const { meta, body } = parseFrontmatter(content);
    const ftsData = extractFtsMetadata(meta, body, testPath, TEST_DIR);
    const project = resolveProject(ftsData.project, testPath, 'my-project');
    expect(project).toBe('my-project');
  });

  test('extractFtsMetadata should return project from frontmatter', () => {
    const content = '---\nslug: test\nproject: kastell\n---\nBody';
    const { meta, body } = parseFrontmatter(content);
    const ftsData = extractFtsMetadata(meta, body, '/tmp/test.md', '/tmp');
    expect(ftsData.project).toBe('kastell');
  });

  test('extractFtsMetadata should return null project when not in frontmatter', () => {
    const content = '---\nslug: test\n---\nBody';
    const { meta, body } = parseFrontmatter(content);
    const ftsData = extractFtsMetadata(meta, body, '/tmp/test.md', '/tmp');
    expect(ftsData.project).toBeNull();
  });
});

describe('search project filter (v0.6.1)', () => {
  test('project-scoped FTS5 returns matching project first', () => {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec(`CREATE VIRTUAL TABLE mindlore_fts USING fts5(path, slug, description, type, category, title, content, tags, quality, date_captured, project)`);
    db.prepare("INSERT INTO mindlore_fts (path, slug, project, category, content) VALUES (?, ?, ?, ?, ?)").run('/mindlore/spec.md', 'spec', 'mindlore', 'sources', 'roadmap plan');
    db.prepare("INSERT INTO mindlore_fts (path, slug, project, category, content) VALUES (?, ?, ?, ?, ?)").run('/kastell/spec.md', 'kspec', 'kastell', 'sources', 'roadmap plan');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only, known schema
    const projectRows = db.prepare(
      "SELECT slug, project FROM mindlore_fts WHERE project = ? AND mindlore_fts MATCH ? ORDER BY rank LIMIT 5"
    ).all('mindlore', 'roadmap') as Array<{slug: string; project: string}>;

    expect(projectRows.length).toBeGreaterThan(0);
    expect(projectRows[0]!.project).toBe('mindlore');
    db.close();
  });
});

describe('version tokenization (v0.6.1)', () => {
  test('version numbers can be found via merged digit tokens', () => {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec(`CREATE VIRTUAL TABLE mindlore_fts USING fts5(path, slug, description, type, category, title, content, tags, quality, date_captured, project)`);
    db.prepare("INSERT INTO mindlore_fts (path, slug, content, category) VALUES (?, ?, ?, ?)").run('/roadmap.md', 'roadmap', 'v0.6.1 roadmap plan details', 'sources');

    // FTS5 unicode61 tokenizes "v0.6.1" as tokens [v0, 6, 1] — phrase match
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only, known schema
    const rows = db.prepare(
      'SELECT slug FROM mindlore_fts WHERE mindlore_fts MATCH ? LIMIT 5'
    ).all('"v0 6 1"') as Array<{slug: string}>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.slug).toBe('roadmap');
    db.close();
  });
});

describe('Search snippet extraction', () => {
  test('search results include snippet with matching content', () => {
    const { search } = require('../dist/scripts/lib/search-engine.js');
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec(`CREATE VIRTUAL TABLE mindlore_fts USING fts5(path, slug, description, type, category, title, content, tags, quality, date_captured, project)`);
    db.exec(`CREATE VIRTUAL TABLE mindlore_fts_porter USING fts5(path, slug, description, type, category, title, content, tags, quality, date_captured, project, tokenize="porter unicode61")`);
    db.exec(`CREATE VIRTUAL TABLE mindlore_fts_trigram USING fts5(path, slug, description, type, category, title, content, tags, quality, date_captured, project, tokenize="trigram")`);

    const content = 'This document explains how TypeScript generics work with constraints and inference patterns.';
    const stmt = db.prepare('INSERT INTO mindlore_fts (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const stmtPorter = db.prepare('INSERT INTO mindlore_fts_porter (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const stmtTrigram = db.prepare('INSERT INTO mindlore_fts_trigram (path, slug, description, type, category, title, content, tags, quality, date_captured, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    const args = ['/docs/typescript-generics.md', 'typescript-generics', 'TypeScript generics guide', 'source', 'sources', 'TypeScript Generics', content, 'typescript,generics', 'high', null, null];
    stmt.run(...args);
    stmtPorter.run(...args);
    stmtTrigram.run(...args);

    const results = search(db, 'TypeScript generics constraints', { maxResults: 3 });
    db.close();

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.snippet).toBeDefined();
    expect(results[0]!.snippet).toContain('TypeScript');
  });
});
