import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createTestDbWithMigrations, insertFts } from './helpers/db.js';
import { search, extractKeywords } from '../scripts/lib/search-engine.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-se-'));
}

function cleanup(dir: string, db?: Database.Database): void {
  try { db?.close(); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
}

function seedDb(dbPath: string): Database.Database {
  const db = createTestDbWithMigrations(dbPath);
  insertFts(db, {
    path: '/sources/typescript.md',
    slug: 'typescript',
    description: 'TypeScript guide',
    type: 'source',
    category: 'sources',
    title: 'TypeScript Hooks',
    content: 'TypeScript provides hooks for React applications. Hooks are reusable.',
    tags: 'typescript,react',
  });
  insertFts(db, {
    path: '/sources/python.md',
    slug: 'python',
    description: 'Python guide',
    type: 'source',
    category: 'sources',
    title: 'Python Basics',
    content: 'Python is a dynamic programming language used for data science.',
    tags: 'python',
  });
  insertFts(db, {
    path: '/episodes/debug-session.md',
    slug: 'debug-session',
    description: 'Debug session log',
    type: 'episode',
    category: 'episodes',
    title: 'Debug Session',
    content: 'Fixed a critical TypeScript compilation error in hooks module.',
    tags: 'debug,typescript',
  });
  return db;
}

describe('extractKeywords', () => {
  test('removes stop words and short words', () => {
    const kw = extractKeywords('the TypeScript hooks are powerful');
    expect(kw).toContain('typescript');
    expect(kw).toContain('hooks');
    expect(kw).toContain('powerful');
    expect(kw).not.toContain('the');
    expect(kw).not.toContain('are');
  });

  test('returns empty for all stop words', () => {
    expect(extractKeywords('the a is are')).toEqual([]);
  });

  test('handles Turkish stop words', () => {
    const kw = extractKeywords('bu bir TypeScript projesi');
    expect(kw).toContain('typescript');
    expect(kw).toContain('projesi');
    expect(kw).not.toContain('bu');
    expect(kw).not.toContain('bir');
  });
});

describe('search pipeline', () => {
  test('basic search returns ranked results', () => {
    const dir = makeTmpDir();
    const db = seedDb(path.join(dir, 'mindlore.db'));
    const results = search(db, 'TypeScript hooks', {});
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.slug).toBe('typescript');
    cleanup(dir, db);
  });

  test('title match ranks higher via BM25 title boost', () => {
    const dir = makeTmpDir();
    const db = seedDb(path.join(dir, 'mindlore.db'));
    const results = search(db, 'TypeScript', { maxResults: 10 });
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]!.title).toContain('TypeScript');
    cleanup(dir, db);
  });

  test('returns empty array for no matches', () => {
    const dir = makeTmpDir();
    const db = seedDb(path.join(dir, 'mindlore.db'));
    const results = search(db, 'nonexistentterm12345xyz', {});
    expect(results).toEqual([]);
    cleanup(dir, db);
  });

  test('respects maxResults option', () => {
    const dir = makeTmpDir();
    const db = seedDb(path.join(dir, 'mindlore.db'));
    const results = search(db, 'TypeScript', { maxResults: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
    cleanup(dir, db);
  });

  test('category weight boosts sources over episodes', () => {
    const dir = makeTmpDir();
    const db = seedDb(path.join(dir, 'mindlore.db'));
    const results = search(db, 'TypeScript', { maxResults: 10 });
    const sourceResults = results.filter(r => r.category === 'sources');
    const episodeResults = results.filter(r => r.category === 'episodes');
    if (sourceResults.length > 0 && episodeResults.length > 0) {
      expect(sourceResults[0]!.score).toBeGreaterThanOrEqual(episodeResults[0]!.score);
    }
    cleanup(dir, db);
  });

  test('empty query returns empty', () => {
    const dir = makeTmpDir();
    const db = seedDb(path.join(dir, 'mindlore.db'));
    const results = search(db, '', {});
    expect(results).toEqual([]);
    cleanup(dir, db);
  });
});
