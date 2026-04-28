import { createEpisodesTestEnv, destroyEpisodesTestEnv } from './helpers/db.js';
import type { EpisodesTestEnv } from './helpers/db.js';
import {
  createEpisode,
  queryEpisodes,
  getEpisode,
  EPISODE_KINDS,
  EPISODE_STATUSES,
} from '../scripts/lib/episodes.js';
import type Database from 'better-sqlite3';

let env: EpisodesTestEnv;
let db: Database.Database;

beforeEach(() => {
  env = createEpisodesTestEnv('nomination');
  db = env.db;
});

afterEach(() => {
  destroyEpisodesTestEnv(env);
});

describe('nomination kind', () => {
  test('EPISODE_KINDS includes nomination', () => {
    expect(EPISODE_KINDS).toContain('nomination');
    expect(EPISODE_KINDS).toHaveLength(9);
  });

  test('can create nomination episode', () => {
    const ep = createEpisode(db, {
      kind: 'nomination',
      summary: 'Always use CO-EVOLUTION pattern for schema changes',
      body: '## Target: learnings\n## Reason\n3x tekrar: episodes.ts + common.cjs sync hatası',
      tags: 'co-evolution,schema',
      source: 'reflect',
    });
    expect(ep.kind).toBe('nomination');
    expect(ep.status).toBe('active');
  });
});

describe('nomination statuses', () => {
  test('EPISODE_STATUSES includes staged, reviewed, approved, rejected', () => {
    expect(EPISODE_STATUSES).toContain('staged');
    expect(EPISODE_STATUSES).toContain('reviewed');
    expect(EPISODE_STATUSES).toContain('approved');
    expect(EPISODE_STATUSES).toContain('rejected');
    expect(EPISODE_STATUSES).toHaveLength(7);
  });

  test('can create nomination with staged status via DB', () => {
    const ep = createEpisode(db, {
      kind: 'nomination',
      summary: 'Test rule nomination',
      source: 'reflect',
    });
    db.prepare("UPDATE episodes SET status = 'staged' WHERE id = ?").run(ep.id);
    const updated = getEpisode(db, ep.id);
    expect(updated?.status).toBe('staged');
  });

  test('staged nominations are hidden from default query', () => {
    createEpisode(db, {
      kind: 'nomination',
      summary: 'Staged nom',
      source: 'reflect',
    });
    db.prepare("UPDATE episodes SET status = 'staged' WHERE kind = 'nomination'").run();

    const results = queryEpisodes(db, {});
    expect(results.filter(e => e.kind === 'nomination')).toHaveLength(0);
  });

  test('can query staged nominations explicitly', () => {
    createEpisode(db, {
      kind: 'nomination',
      summary: 'Staged nom',
      source: 'reflect',
    });
    db.prepare("UPDATE episodes SET status = 'staged' WHERE kind = 'nomination'").run();

    const results = queryEpisodes(db, { kind: 'nomination', status: 'staged' });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('staged');
  });

  test('nomination status transition: staged → approved', () => {
    const ep = createEpisode(db, {
      kind: 'nomination',
      summary: 'Approved rule',
      source: 'reflect',
    });
    db.prepare("UPDATE episodes SET status = 'staged' WHERE id = ?").run(ep.id);
    db.prepare("UPDATE episodes SET status = 'approved' WHERE id = ?").run(ep.id);
    const updated = getEpisode(db, ep.id);
    expect(updated?.status).toBe('approved');
  });

  test('nomination status transition: staged → rejected', () => {
    const ep = createEpisode(db, {
      kind: 'nomination',
      summary: 'Rejected rule',
      body: '## Reason\nTest',
      source: 'reflect',
    });
    db.prepare("UPDATE episodes SET status = 'staged' WHERE id = ?").run(ep.id);
    db.prepare("UPDATE episodes SET status = 'rejected' WHERE id = ?").run(ep.id);
    const updated = getEpisode(db, ep.id);
    expect(updated?.status).toBe('rejected');
  });
});
