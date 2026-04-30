import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { SearchCache } from '../scripts/lib/search-cache.js';
import type { SearchResult } from '../scripts/lib/search-engine.js';

describe('TTL Cache', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-cache-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('cache hit returns cached results', () => {
    const cache = new SearchCache(db, { ttlMs: 5000 });
    const results: SearchResult[] = [{ slug: 'a', path: '/a', title: 'A', description: '', category: '', tags: '', score: 1 }];
    cache.set('query1', results);
    expect(cache.get('query1')).toEqual(results);
  });

  test('cache miss after TTL', () => {
    const cache = new SearchCache(db, { ttlMs: 1 });
    cache.set('query1', []);
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }
    expect(cache.get('query1')).toBeNull();
  });

  test('invalidate clears all entries', () => {
    const cache = new SearchCache(db, { ttlMs: 5000 });
    cache.set('q1', []);
    cache.set('q2', []);
    cache.invalidate();
    expect(cache.get('q1')).toBeNull();
    expect(cache.get('q2')).toBeNull();
  });

  test('cleanup removes expired entries', () => {
    const cache = new SearchCache(db, { ttlMs: 1 });
    cache.set('old', []);
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }
    cache.cleanup();
    const count = (db.prepare('SELECT COUNT(*) as c FROM search_cache').get() as { c: number }).c;
    expect(count).toBe(0);
  });
});

describe('Progressive Throttling', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-throttle-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns 3 results for calls 1-10', () => {
    const cache = new SearchCache(db, { ttlMs: 5000 });
    expect(cache.getMaxResults(1)).toBe(3);
    expect(cache.getMaxResults(10)).toBe(3);
  });

  test('returns 1 result for calls 11-20', () => {
    const cache = new SearchCache(db, { ttlMs: 5000 });
    expect(cache.getMaxResults(11)).toBe(1);
    expect(cache.getMaxResults(20)).toBe(1);
  });

  test('returns 0 for calls 21+', () => {
    const cache = new SearchCache(db, { ttlMs: 5000 });
    expect(cache.getMaxResults(21)).toBe(0);
  });

  test('incrementCallCount tracks per session', () => {
    const cache = new SearchCache(db, { ttlMs: 5000 });
    expect(cache.incrementCallCount('sess-1')).toBe(1);
    expect(cache.incrementCallCount('sess-1')).toBe(2);
    expect(cache.incrementCallCount('sess-2')).toBe(1);
  });
});
