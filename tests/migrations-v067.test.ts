import { createEpisodesTestEnvWithMigrations, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import { runMigrations, getSchemaVersion } from '../scripts/lib/schema-version.js';
import { V067_MIGRATIONS, cleanupExpiredInjectLog } from '../scripts/lib/migrations-v067.js';

let env: EpisodesTestEnv;

beforeEach(() => {
  env = createEpisodesTestEnvWithMigrations('mig-v067');
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

describe('v0.6.7 migrations', () => {
  describe('v15 — graduation columns', () => {
    it('adds graduated_at, rejected_at, rejection_reason to episodes', () => {
      runMigrations(env.db, V067_MIGRATIONS);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
      const cols = env.db.prepare("PRAGMA table_info('episodes')").all() as Array<{ name: string }>;
      const colNames = cols.map(c => c.name);
      expect(colNames).toContain('graduated_at');
      expect(colNames).toContain('rejected_at');
      expect(colNames).toContain('rejection_reason');
    });

    it('defaults are null', () => {
      runMigrations(env.db, V067_MIGRATIONS);
      env.db.prepare(
        "INSERT INTO episodes (id, kind, project, summary, created_at) VALUES ('e1', 'nomination', 'test', 'test nomination', '2026-05-02')"
      ).run();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const row = env.db.prepare("SELECT graduated_at, rejected_at, rejection_reason FROM episodes WHERE id = 'e1'").get() as Record<string, unknown>;
      expect(row.graduated_at).toBeNull();
      expect(row.rejected_at).toBeNull();
      expect(row.rejection_reason).toBeNull();
    });
  });

  describe('v16 — episode_inject_log INTEGER fix', () => {
    it('episode_id column becomes INTEGER', () => {
      env.db.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s1', '42', '2026-05-01')").run();
      runMigrations(env.db, V067_MIGRATIONS);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
      const cols = env.db.prepare("PRAGMA table_info('episode_inject_log')").all() as Array<{ name: string; type: string }>;
      const epCol = cols.find(c => c.name === 'episode_id');
      expect(epCol?.type).toBe('INTEGER');
    });

    it('preserves existing data after migration', () => {
      env.db.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s1', '42', '2026-05-01')").run();
      runMigrations(env.db, V067_MIGRATIONS);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const row = env.db.prepare("SELECT episode_id FROM episode_inject_log WHERE session_id = 's1'").get() as { episode_id: number };
      expect(row.episode_id).toBe(42);
    });
  });

  describe('v17 — inject log TTL cleanup', () => {
    it('cleanupExpiredInjectLog deletes rows older than 30 days', () => {
      runMigrations(env.db, V067_MIGRATIONS);
      const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const recent = new Date().toISOString();
      env.db.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?, ?, ?)").run('old-s', 1, old);
      env.db.prepare("INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES (?, ?, ?)").run('new-s', 2, recent);
      const deleted = cleanupExpiredInjectLog(env.db);
      expect(deleted).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
      const remaining = env.db.prepare("SELECT COUNT(*) as cnt FROM episode_inject_log").get() as { cnt: number };
      expect(remaining.cnt).toBe(1);
    });
  });

  it('schema version reaches 17', () => {
    runMigrations(env.db, V067_MIGRATIONS);
    expect(getSchemaVersion(env.db)).toBe(17);
  });
});
