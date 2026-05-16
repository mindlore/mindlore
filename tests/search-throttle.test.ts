import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { SearchThrottle } from '../scripts/lib/search-throttle.js';
import { SQL_SEARCH_THROTTLE_CREATE } from '../scripts/lib/migrations-v063.js';

function setupThrottleTable(db: Database.Database): void {
  db.exec(SQL_SEARCH_THROTTLE_CREATE);
}

describe('SearchThrottle', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindlore-throttle-'));
    db = new Database(path.join(tmpDir, 'test.db'));
    db.pragma('journal_mode = WAL');
    setupThrottleTable(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allows first request', () => {
    const throttle = new SearchThrottle(db);
    expect(throttle.incrementCallCount('q1')).toBe(1);
  });

  it('blocks duplicate within window (call count caps)', () => {
    const throttle = new SearchThrottle(db);
    throttle.incrementCallCount('q1');
    expect(throttle.getMaxResults(5)).toBe(3);
    expect(throttle.getMaxResults(15)).toBe(1);
    expect(throttle.getMaxResults(25)).toBe(0);
  });

  it('honors baseMax under throttle threshold (adaptive expansion)', () => {
    const throttle = new SearchThrottle(db);
    expect(throttle.getMaxResults(5, 5)).toBe(5);
    expect(throttle.getMaxResults(5, 2)).toBe(2);
    expect(throttle.getMaxResults(15, 5)).toBe(1);
    expect(throttle.getMaxResults(25, 5)).toBe(0);
  });

  it('tracks per session', () => {
    const throttle = new SearchThrottle(db);
    expect(throttle.incrementCallCount('sess-1')).toBe(1);
    expect(throttle.incrementCallCount('sess-1')).toBe(2);
    expect(throttle.incrementCallCount('sess-2')).toBe(1);
  });
});
