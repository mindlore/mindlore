import crypto from 'crypto';
import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;
import type { SearchResult } from './search-engine.js';

export interface SearchCacheOptions {
  ttlMs?: number;
}

export class SearchCache {
  private db: Database;
  private ttlMs: number;

  constructor(db: Database, options: SearchCacheOptions = {}) {
    this.db = db;
    this.ttlMs = options.ttlMs ?? 300000;
  }

  private hash(query: string): string {
    return crypto.createHash('sha256').update(query).digest('hex').slice(0, 16);
  }

  private ensureStatsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        hits INTEGER NOT NULL DEFAULT 0,
        misses INTEGER NOT NULL DEFAULT 0
      )
    `);
    this.db.prepare('INSERT OR IGNORE INTO search_cache_stats (id, hits, misses) VALUES (1, 0, 0)').run();
  }

  getStats(): { hits: number; misses: number; hitRate: number } {
    this.ensureStatsTable();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- single-row table
    const row = this.db.prepare('SELECT hits, misses FROM search_cache_stats WHERE id = 1').get() as { hits: number; misses: number };
    const total = row.hits + row.misses;
    return { hits: row.hits, misses: row.misses, hitRate: total > 0 ? row.hits / total : 0 };
  }

  resetStats(): void {
    this.ensureStatsTable();
    this.db.prepare('UPDATE search_cache_stats SET hits = 0, misses = 0 WHERE id = 1').run();
  }

  get(query: string): SearchResult[] | null {
    const h = this.hash(query);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = this.db.prepare(
      'SELECT results_json FROM search_cache WHERE query_hash = ? AND expires_at > ?'
    ).get(h, new Date().toISOString()) as { results_json: string } | undefined;
    if (!row) {
      this.ensureStatsTable();
      this.db.prepare('UPDATE search_cache_stats SET misses = misses + 1 WHERE id = 1').run();
      this.cleanup();
      return null;
    }
    this.ensureStatsTable();
    this.db.prepare('UPDATE search_cache_stats SET hits = hits + 1 WHERE id = 1').run();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON stored by set()
    return JSON.parse(row.results_json) as SearchResult[];
  }

  set(query: string, results: SearchResult[]): void {
    const h = this.hash(query);
    const expiresAt = new Date(Date.now() + this.ttlMs).toISOString();
    this.db.prepare(
      'INSERT OR REPLACE INTO search_cache (query_hash, results_json, expires_at) VALUES (?, ?, ?)'
    ).run(h, JSON.stringify(results), expiresAt);
  }

  invalidate(): void {
    this.db.exec('DELETE FROM search_cache');
  }

  cleanup(): void {
    this.db.prepare('DELETE FROM search_cache WHERE expires_at < ?').run(new Date().toISOString());
  }

}

export class SearchThrottle {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  incrementCallCount(sessionId: string): number {
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = this.db.prepare(`
      INSERT INTO search_throttle (session_id, call_count, last_call)
      VALUES (?, 1, ?)
      ON CONFLICT(session_id) DO UPDATE SET call_count = call_count + 1, last_call = ?
      RETURNING call_count
    `).get(sessionId, now, now) as { call_count: number } | undefined;
    return row?.call_count ?? 1;
  }

  getMaxResults(callCount: number): number {
    if (callCount <= 10) return 3;
    if (callCount <= 20) return 1;
    return 0;
  }
}
