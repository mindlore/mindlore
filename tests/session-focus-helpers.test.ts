import Database from 'better-sqlite3';
import { createEpisodesTestEnvWithMigrations, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';

const {
  getEpisodeStats,
  checkStaleContent,
}: {
  getEpisodeStats: (db: Database.Database, config: Record<string, unknown>, project: string) => { chains: unknown[]; consolidationMsg: string | null };
  checkStaleContent: (db: Database.Database) => string | null;
} = require('../hooks/mindlore-session-focus.cjs');

let env: EpisodesTestEnv;

beforeEach(() => {
  env = createEpisodesTestEnvWithMigrations('focus-helpers');
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

describe('getEpisodeStats', () => {
  test('returns null consolidationMsg when raw episodes below threshold', () => {
    const result = getEpisodeStats(env.db, { consolidation: { threshold: 50 } }, 'test-project');
    expect(result.consolidationMsg).toBeNull();
    expect(result.chains).toBeDefined();
  });

  test('returns consolidation warning when raw count exceeds threshold', () => {
    for (let i = 0; i < 10; i++) {
      env.db.prepare(
        `INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at, consolidation_status)
         VALUES (?, 'discovery', 'project', 'test', 'ep', 'active', 'diary', datetime('now'), 'raw')`,
      ).run(`ep-raw-${i}`);
    }
    const result = getEpisodeStats(env.db, { consolidation: { threshold: 5 } }, 'test');
    expect(result.consolidationMsg).toContain('10 raw episode');
    expect(result.consolidationMsg).toContain('/mindlore-maintain consolidate');
  });

  test('uses default threshold of 50 when config omits it', () => {
    for (let i = 0; i < 3; i++) {
      env.db.prepare(
        `INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at, consolidation_status)
         VALUES (?, 'discovery', 'project', 'test', 'ep', 'active', 'diary', datetime('now'), 'raw')`,
      ).run(`ep-${i}`);
    }
    const result = getEpisodeStats(env.db, {}, 'test');
    expect(result.consolidationMsg).toBeNull();
  });

  test('counts episodes with NULL consolidation_status as raw', () => {
    for (let i = 0; i < 6; i++) {
      env.db.prepare(
        `INSERT INTO episodes (id, kind, scope, project, summary, status, source, created_at)
         VALUES (?, 'decision', 'project', 'test', 'ep', 'active', 'diary', datetime('now'))`,
      ).run(`ep-null-${i}`);
    }
    const result = getEpisodeStats(env.db, { consolidation: { threshold: 5 } }, 'test');
    expect(result.consolidationMsg).toContain('6 raw episode');
  });
});

describe('checkStaleContent', () => {
  test('returns null when no stale content', () => {
    env.db.prepare(
      "INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, datetime('now'))",
    ).run('/test/file.md', 'abc123');
    expect(checkStaleContent(env.db)).toBeNull();
  });

  test('returns null when stale count is 3 or fewer', () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 3; i++) {
      env.db.prepare(
        'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)',
      ).run(`/test/stale-${i}.md`, `hash${i}`, oldDate);
    }
    expect(checkStaleContent(env.db)).toBeNull();
  });

  test('returns warning when more than 3 stale files', () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 5; i++) {
      env.db.prepare(
        'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)',
      ).run(`/test/stale-${i}.md`, `hash${i}`, oldDate);
    }
    const msg = checkStaleContent(env.db);
    expect(msg).toContain('5 dosya');
    expect(msg).toContain('30+ gundur');
    expect(msg).toContain('/mindlore-evolve');
  });

  test('does not count recently indexed files', () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();
    for (let i = 0; i < 4; i++) {
      env.db.prepare(
        'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)',
      ).run(`/test/old-${i}.md`, `hash-old-${i}`, oldDate);
    }
    for (let i = 0; i < 10; i++) {
      env.db.prepare(
        'INSERT INTO file_hashes (path, content_hash, last_indexed) VALUES (?, ?, ?)',
      ).run(`/test/new-${i}.md`, `hash-new-${i}`, recentDate);
    }
    const msg = checkStaleContent(env.db);
    expect(msg).toContain('4 dosya');
  });
});
