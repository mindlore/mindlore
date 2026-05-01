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

  get(query: string): SearchResult[] | null {
    const h = this.hash(query);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = this.db.prepare(
      'SELECT results_json FROM search_cache WHERE query_hash = ? AND expires_at > ?'
    ).get(h, new Date().toISOString()) as { results_json: string } | undefined;
    if (!row) {
      this.cleanup();
      return null;
    }
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
