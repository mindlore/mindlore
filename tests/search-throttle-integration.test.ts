import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { V072_MIGRATIONS } from '../scripts/lib/migrations-v072.js';
import { V078_MIGRATIONS } from '../scripts/lib/migrations-v078.js';
import { SQL_SEARCH_CACHE_CREATE } from '../scripts/lib/migrations-v063.js';

describe('Search throttle + cache + recall integration', () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'search-it-'));
    const dbPath = path.join(tmpDir, 'mindlore.db');
    db = new Database(dbPath);
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS mindlore_fts USING fts5(slug, path, title, content);
      CREATE TABLE IF NOT EXISTS file_hashes (
        path TEXT PRIMARY KEY,
        recall_count INTEGER DEFAULT 0,
        last_recalled_at TEXT,
        last_indexed TEXT
      );
      CREATE TABLE IF NOT EXISTS search_throttle (
        session_id TEXT PRIMARY KEY,
        call_count INTEGER DEFAULT 0,
        last_call TEXT
      );
      ${SQL_SEARCH_CACHE_CREATE};
    `);
    V072_MIGRATIONS.forEach(m => m.up(db));
    V078_MIGRATIONS.forEach(m => m.up(db));

    for (let i = 1; i <= 5; i++) {
      db.prepare(`INSERT INTO mindlore_fts (slug,path,title,content) VALUES (?, ?, ?, ?)`).run('s'+i, '/s'+i, 'S'+i, 'lorem ipsum dolor');
      db.prepare(`INSERT INTO file_hashes (path) VALUES (?)`).run('/s'+i);
    }
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('22-call accumulation: throttle reduce + cache hit + recall increment', () => {
    const { SearchCache } = require('../scripts/lib/search-cache.js');
    const { SearchThrottle } = require('../scripts/lib/search-throttle.js');
    const { incrementRecallCount } = require('../hooks/lib/mindlore-common.cjs');
    const cache = new SearchCache(db, { ttlMs: 300000 });
    const throttle = new SearchThrottle(db);
    const sessionId = 'test-session-' + Date.now();
    const baseMax = 3;

    let cacheHitCount = 0;
    let recallIncrements = 0;
    const query = 'lorem';

    for (let call = 1; call <= 22; call++) {
      const cc = throttle.incrementCallCount(sessionId);
      const eff = throttle.getMaxResults(cc, baseMax);
      if (eff === 0) continue;

      const cached = cache.get(query);
      if (cached) {
        cacheHitCount++;
        const sliced = cached.slice(0, eff);
        for (const r of sliced) {
          incrementRecallCount(db, r.path);
          recallIncrements++;
        }
        continue;
      }

      // simulate fresh search result
      const results = [{ path: '/s1', score: 0.5 }, { path: '/s2', score: 0.4 }, { path: '/s3', score: 0.3 }];
      cache.set(query, results);
      for (const r of results.slice(0, eff)) {
        incrementRecallCount(db, r.path);
        recallIncrements++;
      }
    }

    expect(cacheHitCount).toBeGreaterThan(0);
    const s1Recall = db.prepare('SELECT recall_count FROM file_hashes WHERE path = ?').get('/s1') as { recall_count: number };
    expect(s1Recall.recall_count).toBeGreaterThan(1);
    const finalCallCount = (db.prepare('SELECT call_count FROM search_throttle WHERE session_id = ?').get(sessionId) as { call_count: number }).call_count;
    expect(finalCallCount).toBe(22);
  });
});
