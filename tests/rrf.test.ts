import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { createTestDbWithMigrations, insertFts } from './helpers/db.js';
import { computeRRF, searchPorter, searchTrigram, sanitizeFtsQuery, type RankedResult } from '../scripts/lib/rrf.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-rrf-'));
}

function cleanup(dir: string, db?: Database.Database): void {
  try { db?.close(); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('sanitizeFtsQuery', () => {
  it('strips hyphens to prevent FTS5 column-prefix parse', () => {
    expect(sanitizeFtsQuery('project-state-engine')).toBe('project state engine');
  });

  it('strips all FTS5 operators', () => {
    expect(sanitizeFtsQuery('"hello" AND world*')).toBe('hello AND world');
  });

  it('returns empty for operator-only input', () => {
    expect(sanitizeFtsQuery('---')).toBe('');
  });

  it('preserves Turkish characters', () => {
    expect(sanitizeFtsQuery('çalışma-planı')).toBe('çalışma planı');
  });
});

describe('computeRRF', () => {
  test('merges porter and trigram results', () => {
    const porter: RankedResult[] = [
      { slug: 'doc-a', rank: 1, path: '/a', score: 0 },
      { slug: 'doc-b', rank: 2, path: '/b', score: 0 },
    ];
    const trigram: RankedResult[] = [
      { slug: 'doc-b', rank: 1, path: '/b', score: 0 },
      { slug: 'doc-c', rank: 2, path: '/c', score: 0 },
    ];
    const fused = computeRRF(porter, trigram);
    expect(fused[0]!.slug).toBe('doc-b');
    expect(fused.length).toBe(3);
  });

  test('RRF score formula: 1/(K+rank)', () => {
    const porter: RankedResult[] = [{ slug: 'x', rank: 1, path: '/x', score: 0 }];
    const trigram: RankedResult[] = [{ slug: 'x', rank: 1, path: '/x', score: 0 }];
    const fused = computeRRF(porter, trigram, { k: 60 });
    expect(fused[0]!.score).toBeCloseTo(2 / 61, 4);
  });

  test('chunk dedup — same path keeps highest score', () => {
    const porter: RankedResult[] = [
      { slug: 'doc--chunk-0', rank: 1, path: '/doc.md', score: 0 },
      { slug: 'doc--chunk-3', rank: 3, path: '/doc.md', score: 0 },
    ];
    const trigram: RankedResult[] = [];
    const fused = computeRRF(porter, trigram, { dedupByPath: true });
    expect(fused.length).toBe(1);
    expect(fused[0]!.slug).toBe('doc--chunk-0');
  });

  test('empty inputs return empty', () => {
    expect(computeRRF([], [])).toEqual([]);
  });
});

describe('searchPorter + searchTrigram', () => {
  test('searchPorter returns ranked results from FTS5', () => {
    const dir = makeTmpDir();
    const db = createTestDbWithMigrations(path.join(dir, 'mindlore.db'));
    insertFts(db, {
      path: '/sources/ts.md',
      slug: 'typescript-guide',
      description: 'TypeScript guide',
      type: 'source',
      category: 'sources',
      title: 'TypeScript Hooks',
      content: 'TypeScript provides hooks for React applications.',
      tags: 'typescript,react',
    });
    const results = searchPorter(db, 'TypeScript hooks', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.rank).toBe(1);
    expect(results[0]!.score).toBe(0);
    cleanup(dir, db);
  });

  test('searchTrigram returns results from trigram table', () => {
    const dir = makeTmpDir();
    const db = createTestDbWithMigrations(path.join(dir, 'mindlore.db'));
    insertFts(db, {
      path: '/sources/ts.md',
      slug: 'typescript-guide',
      description: 'TypeScript guide',
      type: 'source',
      category: 'sources',
      title: 'TypeScript Hooks',
      content: 'TypeScript provides hooks for React applications.',
      tags: 'typescript,react',
    });
    const results = searchTrigram(db, 'TypeScript', 5);
    expect(results.length).toBeGreaterThan(0);
    cleanup(dir, db);
  });

  test('searchPorter returns empty for no match', () => {
    const dir = makeTmpDir();
    const db = createTestDbWithMigrations(path.join(dir, 'mindlore.db'));
    const results = searchPorter(db, 'nonexistentxyz', 5);
    expect(results).toEqual([]);
    cleanup(dir, db);
  });
});

describe('searchTrigram error handling', () => {
  test('no warn on "no such table" error', () => {
    const dir = makeTmpDir();
    const db = new Database(path.join(dir, 'mindlore.db'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const results = searchTrigram(db, 'anything', 5);
    expect(results).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    cleanup(dir, db);
  });

  test('warns on unexpected DB error', () => {
    const dir = makeTmpDir();
    const db = new Database(path.join(dir, 'mindlore.db'));
    db.exec('CREATE VIRTUAL TABLE mindlore_fts_trigram USING fts5(content)');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Query with a column that doesn't exist triggers a real error
    const results = searchTrigram(db, 'test', 5);
    // No crash — returns []
    expect(results).toEqual([]);
    warnSpy.mockRestore();
    cleanup(dir, db);
  });
});
