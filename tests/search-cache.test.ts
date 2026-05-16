import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { SearchCache } from '../scripts/lib/search-cache.js';
import { SQL_SEARCH_CACHE_CREATE } from '../scripts/lib/migrations-v063.js';
import type { SearchResult } from '../scripts/lib/search-engine.js';

function setupCacheTables(db: Database.Database): void {
  db.exec(SQL_SEARCH_CACHE_CREATE);
}

describe('TTL Cache', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-cache-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('journal_mode = WAL');
    setupCacheTables(db);
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test assertion
    const count = (db.prepare('SELECT COUNT(*) as c FROM search_cache').get() as { c: number }).c;
    expect(count).toBe(0);
  });
});

describe('SearchCache hit rate', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-stats-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('journal_mode = WAL');
    setupCacheTables(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('tracks hits and misses', () => {
    const cache = new SearchCache(db, { ttlMs: 300000 });
    const mockResults: SearchResult[] = [{ slug: 'test', path: '/test', title: 'Test', description: '', category: 'sources', tags: '', score: 1.0 }];

    cache.get('miss-query'); // miss
    cache.set('hit-query', mockResults);
    cache.get('hit-query'); // hit
    cache.get('another-miss'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBeCloseTo(1/3);
  });

  it('resets stats', () => {
    const cache = new SearchCache(db, { ttlMs: 300000 });
    cache.get('miss');
    cache.resetStats();
    expect(cache.getStats()).toEqual({ hits: 0, misses: 0, hitRate: 0 });
  });
});


