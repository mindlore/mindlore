import type BetterSqlite3 from 'better-sqlite3';
type Database = BetterSqlite3.Database;

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
