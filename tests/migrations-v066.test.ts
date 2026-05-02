import { createEpisodesTestEnvWithMigrations, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import { V066_MIGRATIONS, SQL_EPISODE_INJECT_LOG_CREATE } from '../scripts/lib/migrations-v066.js';

let env: EpisodesTestEnv;

beforeEach(() => {
  env = createEpisodesTestEnvWithMigrations('mig-v066');
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

describe('v0.6.6 migrations', () => {
  test('V066_MIGRATIONS has exactly 1 migration at version 14', () => {
    expect(V066_MIGRATIONS).toHaveLength(1);
    expect(V066_MIGRATIONS[0]!.version).toBe(14);
    expect(V066_MIGRATIONS[0]!.name).toBe('episode_inject_log');
  });

  test('episode_inject_log table exists after migration', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = env.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='episode_inject_log'",
    ).get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.name).toBe('episode_inject_log');
  });

  test('episode_inject_log has correct columns', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .all() returns unknown[]
    const columns = env.db.prepare('PRAGMA table_info(episode_inject_log)').all() as Array<{ name: string; type: string; notnull: number }>;
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('session_id');
    expect(colNames).toContain('episode_id');
    expect(colNames).toContain('injected_at');
    expect(columns.find(c => c.name === 'session_id')!.notnull).toBe(1);
    expect(columns.find(c => c.name === 'episode_id')!.notnull).toBe(1);
    expect(columns.find(c => c.name === 'injected_at')!.notnull).toBe(1);
  });

  test('episode_inject_log has composite primary key (session_id, episode_id)', () => {
    env.db.prepare(
      "INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s1', 'e1', datetime('now'))",
    ).run();
    env.db.prepare(
      "INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s1', 'e2', datetime('now'))",
    ).run();
    env.db.prepare(
      "INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s2', 'e1', datetime('now'))",
    ).run();

    expect(() => {
      env.db.prepare(
        "INSERT INTO episode_inject_log (session_id, episode_id, injected_at) VALUES ('s1', 'e1', datetime('now'))",
      ).run();
    }).toThrow();
  });

  test('migration is idempotent (CREATE TABLE IF NOT EXISTS)', () => {
    expect(() => {
      env.db.exec(SQL_EPISODE_INJECT_LOG_CREATE);
    }).not.toThrow();
  });

  test('schema version is 14 after all migrations', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = env.db.prepare(
      'SELECT MAX(version) as v FROM schema_versions',
    ).get() as { v: number };
    expect(row.v).toBeGreaterThanOrEqual(14);
  });
});
