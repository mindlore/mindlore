import { createEpisodesTestEnvWithMigrations, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import { runMigrations } from '../scripts/lib/schema-version.js';
import { V067_MIGRATIONS } from '../scripts/lib/migrations-v067.js';
import Database from 'better-sqlite3';

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- require() returns any, narrowing to known CJS export shape
const { checkReflectTrigger, getGraduatedLessonCount } = require('../hooks/lib/mindlore-common.cjs') as {
  checkReflectTrigger: (db: Database.Database, project: string, threshold?: number) => string | null;
  getGraduatedLessonCount: (db: Database.Database, project: string) => number;
};

function setupDb(): EpisodesTestEnv {
  const env = createEpisodesTestEnvWithMigrations('grad');
  runMigrations(env.db, V067_MIGRATIONS);
  return env;
}

describe('Q1 — auto reflect trigger', () => {
  let env: EpisodesTestEnv;
  beforeEach(() => { env = setupDb(); });
  afterEach(() => { destroyEpisodesTestEnv(env); });

  it('returns null when nominations below threshold', () => {
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('n1', 'nomination', 'test', 'test nom', 'staged', new Date().toISOString());

    expect(checkReflectTrigger(env.db, 'test', 5)).toBeNull();
  });

  it('returns trigger message when nominations reach threshold', () => {
    const now = new Date().toISOString();
    for (let i = 1; i <= 5; i++) {
      env.db.prepare(
        "INSERT INTO episodes (id, kind, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(`n${i}`, 'nomination', 'test', `nom ${i}`, 'staged', now);
    }

    const msg = checkReflectTrigger(env.db, 'test', 5);
    expect(msg).toContain('/mindlore-reflect');
    expect(msg).toContain('5');
  });

  it('ignores non-staged nominations', () => {
    const now = new Date().toISOString();
    for (let i = 1; i <= 5; i++) {
      env.db.prepare(
        "INSERT INTO episodes (id, kind, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(`n${i}`, 'nomination', 'test', `nom ${i}`, i <= 3 ? 'staged' : 'approved', now);
    }

    expect(checkReflectTrigger(env.db, 'test', 5)).toBeNull();
  });
});

describe('Q2 — graduation tracking', () => {
  let env: EpisodesTestEnv;
  beforeEach(() => { env = setupDb(); });
  afterEach(() => { destroyEpisodesTestEnv(env); });

  it('can set graduated_at on a nomination', () => {
    const now = new Date().toISOString();
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('n1', 'nomination', 'test', 'test nom', 'staged', now);

    env.db.prepare("UPDATE episodes SET status = 'approved', graduated_at = ? WHERE id = 'n1'").run(now);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = env.db.prepare("SELECT status, graduated_at FROM episodes WHERE id = 'n1'").get() as { status: string; graduated_at: string };
    expect(row.status).toBe('approved');
    expect(row.graduated_at).toBe(now);
  });

  it('can set rejected_at and rejection_reason', () => {
    const now = new Date().toISOString();
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('n1', 'nomination', 'test', 'test nom', 'staged', now);

    env.db.prepare("UPDATE episodes SET status = 'rejected', rejected_at = ?, rejection_reason = ? WHERE id = 'n1'").run(now, 'Too vague');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- better-sqlite3 .get() returns unknown
    const row = env.db.prepare("SELECT status, rejected_at, rejection_reason FROM episodes WHERE id = 'n1'").get() as { status: string; rejected_at: string; rejection_reason: string };
    expect(row.status).toBe('rejected');
    expect(row.rejected_at).toBe(now);
    expect(row.rejection_reason).toBe('Too vague');
  });
});

describe('Q3 — graduated lesson count', () => {
  let env: EpisodesTestEnv;
  beforeEach(() => { env = setupDb(); });
  afterEach(() => { destroyEpisodesTestEnv(env); });

  it('returns 0 when no graduated lessons', () => {
    expect(getGraduatedLessonCount(env.db, 'test')).toBe(0);
  });

  it('counts graduated lessons correctly', () => {
    const now = new Date().toISOString();
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, graduated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run('n1', 'nomination', 'test', 'Always run build before test', 'approved', now, now);
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, graduated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run('n2', 'nomination', 'test', 'Check CI after push', 'approved', now, now);
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run('n3', 'nomination', 'test', 'Not graduated', 'staged', now);

    expect(getGraduatedLessonCount(env.db, 'test')).toBe(2);
  });

  it('ignores rejected nominations', () => {
    const now = new Date().toISOString();
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, graduated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run('n1', 'nomination', 'test', 'Good lesson', 'approved', now, now);
    env.db.prepare(
      "INSERT INTO episodes (id, kind, project, summary, status, rejected_at, rejection_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run('n2', 'nomination', 'test', 'Bad lesson', 'rejected', now, 'Too vague', now);

    expect(getGraduatedLessonCount(env.db, 'test')).toBe(1);
  });
});
